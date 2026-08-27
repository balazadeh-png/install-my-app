-- ============================================================================
-- Sprint 15: Integración SII vía ApiPyme (Registro de Ventas, Compras y Boletas)
-- ============================================================================

-- 1. Tabla sii_api_connections (Almacena tokens de ApiPyme protegidos server-side)
CREATE TABLE IF NOT EXISTS public.sii_api_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL UNIQUE,
    provider text NOT NULL DEFAULT 'apipyme',
    company_token text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    last_synced_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sii_conn_entity ON public.sii_api_connections(entity_id);

ALTER TABLE public.sii_api_connections ENABLE ROW LEVEL SECURITY;

-- Política restrictiva: NUNCA permitir acceso SELECT/INSERT/UPDATE directo desde el cliente
DROP POLICY IF EXISTS "no_client_access" ON public.sii_api_connections;
CREATE POLICY "no_client_access" ON public.sii_api_connections
FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 2. Enums para Documentos Sincronizados y Estados de Extracción
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sii_document_type') THEN
        CREATE TYPE public.sii_document_type AS ENUM ('venta', 'compra');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sii_sync_status') THEN
        CREATE TYPE public.sii_sync_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');
    END IF;
END $$;

-- 3. Tabla sii_synced_documents (Facturas, ND, NC sincronizadas desde el SII)
CREATE TABLE IF NOT EXISTS public.sii_synced_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    document_type public.sii_document_type NOT NULL,
    period text NOT NULL, -- Formato YYYYMM (ej. '202608')
    sii_doc_type text,    -- '33' Factura, '34' Exenta, '56' ND, '61' NC...
    folio text,           -- N° de documento / folio
    issue_date date,
    party_tax_id text,    -- RUT contraparte (receptor en ventas, emisor en compras)
    party_name text,      -- Razón social contraparte
    net_amount numeric(20,4) DEFAULT 0,
    tax_amount numeric(20,4) DEFAULT 0,
    exempt_amount numeric(20,4) DEFAULT 0,
    total_amount numeric(20,4) DEFAULT 0,
    raw_payload jsonb NOT NULL DEFAULT '{}',
    extracted_at timestamptz,
    synced_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, document_type, period, sii_doc_type, folio, party_tax_id)
);

CREATE INDEX IF NOT EXISTS ix_sii_doc_entity_period ON public.sii_synced_documents(entity_id, period);
CREATE INDEX IF NOT EXISTS ix_sii_doc_type ON public.sii_synced_documents(document_type);

ALTER TABLE public.sii_synced_documents ENABLE ROW LEVEL SECURITY;

-- 4. Tabla sii_boletas_summary (Agregado oficial de boletas electrónicas por período)
CREATE TABLE IF NOT EXISTS public.sii_boletas_summary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    period text NOT NULL, -- Formato YYYYMM
    cantidad_documentos integer DEFAULT 0,
    monto_neto numeric(20,4) DEFAULT 0,
    monto_exento numeric(20,4) DEFAULT 0,
    monto_iva numeric(20,4) DEFAULT 0,
    monto_total numeric(20,4) DEFAULT 0,
    extracted_at timestamptz,
    synced_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, period)
);

CREATE INDEX IF NOT EXISTS ix_sii_boletas_entity_period ON public.sii_boletas_summary(entity_id, period);

ALTER TABLE public.sii_boletas_summary ENABLE ROW LEVEL SECURITY;

-- 5. Tabla sii_sync_jobs (Trazabilidad de extracciones asíncronas y webhooks)
CREATE TABLE IF NOT EXISTS public.sii_sync_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    module text NOT NULL, -- 'ventas' | 'compras' | 'f29' | 'honorarios'
    period text NOT NULL,
    apipyme_task_id text UNIQUE,
    status public.sii_sync_status DEFAULT 'PENDING' NOT NULL,
    rows_extracted integer DEFAULT 0,
    error_message text,
    requested_at timestamptz DEFAULT now() NOT NULL,
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_sii_jobs_entity ON public.sii_sync_jobs(entity_id);
CREATE INDEX IF NOT EXISTS ix_sii_jobs_task ON public.sii_sync_jobs(apipyme_task_id);

ALTER TABLE public.sii_sync_jobs ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS Multiempresa Estándar
CREATE POLICY "read_sii_synced_documents" ON public.sii_synced_documents
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_sii_synced_documents" ON public.sii_synced_documents
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_sii_boletas_summary" ON public.sii_boletas_summary
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_sii_boletas_summary" ON public.sii_boletas_summary
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);

CREATE POLICY "read_sii_sync_jobs" ON public.sii_sync_jobs
FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), entity_id));

CREATE POLICY "write_sii_sync_jobs" ON public.sii_sync_jobs
FOR ALL TO authenticated USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
  AND public.user_has_company_access(auth.uid(), entity_id)
);
