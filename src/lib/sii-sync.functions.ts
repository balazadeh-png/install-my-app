import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const SUPABASE_URL = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Configuración del servidor incompleta (service role key no disponible).");
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// 1. Verificar Token contra ApiPyme directamente
export const verifyApiPymeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(5, "Token inválido"),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    try {
      const res = await fetch("https://apipyme.cl/api/v1/empresa/", {
        headers: { "X-Company-Token": data.token.trim() },
      });

      if (res.status === 401) {
        return { valid: false, message: "Token ApiPyme inválido o no autorizado." };
      }
      if (res.status === 403) {
        return { valid: false, message: "Licencia de ApiPyme inactiva o suspendida." };
      }
      if (!res.ok) {
        return { valid: false, message: `Error del servidor ApiPyme (${res.status}).` };
      }

      const body = await res.json();
      return {
        valid: true,
        business_name: body.business_name || body.razon_social || "Empresa autorizada",
        rut: body.rut || body.tax_id || "",
        is_active: body.is_active ?? true,
        expires_at: body.expires_at ?? null,
      };
    } catch (err: any) {
      return { valid: false, message: err.message || "Error al conectar con ApiPyme" };
    }
  });

// 2. Guardar Conexión ApiPyme de forma segura (Server-Side Only)
export const saveApiPymeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        entity_id: z.string().uuid(),
        company_token: z.string().min(5),
      })
      .parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Validar acceso del usuario a la empresa
    const { data: hasAccess } = await supabase.rpc("user_has_company_access", {
      _user_id: userId,
      _entity_id: data.entity_id,
    });

    if (!hasAccess) {
      throw new Error("No tienes permisos para configurar esta empresa.");
    }

    const admin = getAdminClient();
    const { error } = await admin.from("sii_api_connections").upsert(
      {
        entity_id: data.entity_id,
        provider: "apipyme",
        company_token: data.company_token.trim(),
        active: true,
      },
      { onConflict: "entity_id" }
    );

    if (error) throw new Error(error.message);
    return { success: true };
  });

// 3. Consultar Estado de Conexión (Sin revelar el token al cliente)
export const getApiPymeConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        entity_id: z.string().uuid(),
      })
      .parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: hasAccess } = await supabase.rpc("user_has_company_access", {
      _user_id: userId,
      _entity_id: data.entity_id,
    });

    if (!hasAccess) {
      return { connected: false, last_synced_at: null };
    }

    const admin = getAdminClient();
    const { data: conn } = await admin
      .from("sii_api_connections")
      .select("active, last_synced_at, provider")
      .eq("entity_id", data.entity_id)
      .maybeSingle();

    return {
      connected: !!conn && conn.active,
      last_synced_at: conn?.last_synced_at ?? null,
      provider: conn?.provider ?? "apipyme",
    };
  });

// Función auxiliar de paginación real
async function fetchAllPages(module: "ventas" | "compras", period: string, token: string) {
  let page = 1;
  let documentos: any[] = [];
  let boletas: any = null;
  let actualizadoEn: string | null = null;

  while (true) {
    const url = `https://apipyme.cl/api/v1/${module}/${period}/?page=${page}&page_size=5000`;
    const res = await fetch(url, {
      headers: { "X-Company-Token": token },
    });

    if (res.status === 202) {
      const { task_id } = await res.json();
      return { pending: true, task_id, documentos: [], boletas: null, actualizadoEn: null };
    }
    if (res.status === 401) throw new Error("Token ApiPyme inválido o empresa inactiva.");
    if (res.status === 403) throw new Error(`Sin licencia activa para el módulo "${module}".`);
    if (res.status === 429) throw new Error("Límite diario de consultas ApiPyme alcanzado para esta empresa.");
    if (!res.ok) throw new Error(`ApiPyme respondió con código ${res.status} para ${module}/${period}`);

    const body = await res.json();
    const rows = Array.isArray(body.data) ? body.data : [];
    documentos = documentos.concat(rows);
    actualizadoEn = body.actualizado_en ?? null;

    if (module === "ventas" && body.boletas) {
      boletas = body.boletas;
    }

    if (!body.pagination || !body.pagination.tiene_siguiente) {
      break;
    }
    page++;
  }

  return { pending: false, task_id: null, documentos, boletas, actualizadoEn };
}

// 4. Función de sincronización para uso interno o webhook
export async function syncSiiDocumentsInternal(entity_id: string, document_type: "venta" | "compra", period: string) {
  const admin = getAdminClient();
  const { data: conn } = await admin
    .from("sii_api_connections")
    .select("company_token")
    .eq("entity_id", entity_id)
    .maybeSingle();

  if (!conn || !conn.company_token) {
    throw new Error("Esta empresa no tiene una conexión ApiPyme configurada.");
  }

  const module = document_type === "venta" ? "ventas" : "compras";
  const result = await fetchAllPages(module, period, conn.company_token);

  if (result.pending) {
    await admin.from("sii_sync_jobs").upsert(
      {
        entity_id,
        module,
        period,
        apipyme_task_id: result.task_id,
        status: "PENDING",
      },
      { onConflict: "apipyme_task_id" }
    );
    return { status: "pending", task_id: result.task_id, count: 0 };
  }

  // Mapear documentos y hacer upsert
  const docsToInsert = result.documentos.map((doc: any) => ({
    entity_id,
    document_type,
    period,
    sii_doc_type: String(doc.doc_type || doc.tipo_dte || "33"),
    folio: String(doc.doc_number || doc.folio || ""),
    issue_date: doc.issue_date || doc.fecha_emision || null,
    party_tax_id: doc.rut_receiver || doc.rut_issuer || doc.rut_contraparte || "",
    party_name: doc.receiver_name || doc.issuer_name || doc.razon_social || "",
    net_amount: Number(doc.net_amount ?? doc.monto_neto ?? 0),
    tax_amount: Number(doc.tax_amount ?? doc.monto_iva ?? 0),
    exempt_amount: Number(doc.exempt_amount ?? doc.monto_exento ?? 0),
    total_amount: Number(doc.total_amount ?? doc.monto_total ?? 0),
    raw_payload: doc,
    extracted_at: doc.extracted_at ? new Date(doc.extracted_at).toISOString() : new Date().toISOString(),
  }));

  if (docsToInsert.length > 0) {
    // Upsert por lotes
    const { error: upsertErr } = await admin.from("sii_synced_documents").upsert(docsToInsert, {
      onConflict: "entity_id,document_type,period,sii_doc_type,folio,party_tax_id",
    });
    if (upsertErr) throw new Error(upsertErr.message);
  }

  // Guardar resumen de boletas si viene en ventas
  if (result.boletas) {
    const b = result.boletas;
    await admin.from("sii_boletas_summary").upsert(
      {
        entity_id,
        period,
        cantidad_documentos: Number(b.cantidad_documentos || b.count || 0),
        monto_neto: Number(b.monto_neto || b.net_amount || 0),
        monto_exento: Number(b.monto_exento || b.exempt_amount || 0),
        monto_iva: Number(b.monto_iva || b.tax_amount || 0),
        monto_total: Number(b.monto_total || b.total_amount || 0),
        extracted_at: b.extracted_at ? new Date(b.extracted_at).toISOString() : new Date().toISOString(),
      },
      { onConflict: "entity_id,period" }
    );
  }

  // Actualizar last_synced_at
  await admin
    .from("sii_api_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("entity_id", entity_id);

  return { status: "completed", count: docsToInsert.length };
}

// 5. Server Function: Sincronizar Documentos (Usuario Autenticado)
export const syncSiiDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        entity_id: z.string().uuid(),
        document_type: z.enum(["venta", "compra"]),
        period: z.string().regex(/^\d{6}$/, "El período debe tener formato YYYYMM (ej. 202608)"),
      })
      .parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: hasAccess } = await supabase.rpc("user_has_company_access", {
      _user_id: userId,
      _entity_id: data.entity_id,
    });

    if (!hasAccess) {
      throw new Error("No tienes permisos para sincronizar documentos de esta empresa.");
    }

    return await syncSiiDocumentsInternal(data.entity_id, data.document_type, data.period);
  });
