import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const getCurrentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    return profile ?? null;
  });

export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_name: z.string().min(2).max(50),
        full_name: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const email = user.email ?? null;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (existing) {
      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          user_name: data.user_name,
          full_name: data.full_name ?? null,
          email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }

    const { data: created, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        user_name: data.user_name,
        full_name: data.full_name ?? null,
        email,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return created;
  });

export const getUserRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.role);
  });

export const getModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("active", true)
      .order("label");

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const assignAdminIfFirst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Verify the caller is authenticated and can read user_roles via RLS.
    const { data: existingRoles, error: readError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId);

    if (readError) throw new Error(readError.message);
    if ((existingRoles ?? []).length > 0) {
      return { assigned: false };
    }

    // Privileged insert bypasses RLS so the first user can become admin.
    const { createClient } = await import("@supabase/supabase-js");
    const SUPABASE_URL = process.env["SUPABASE_URL"];
    const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing service role configuration");
    }

    const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" as AppRole });

    if (error) throw new Error(error.message);
    return { assigned: true };
  });
