-- ============================================================================
-- Sprint 36: Búsqueda Asíncrona Tolerante de Facturas Pendientes (Typeahead)
-- EasyERP: pg_trgm GIN, heurística de relevancia y coincidencia exacta
-- ============================================================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Índices GIN con pg_trgm para acelerar búsquedas fuzzy en folios y razones sociales
CREATE INDEX IF NOT EXISTS ix_sales_invoices_num_trgm 
    ON public.sales_invoices USING gin (invoice_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_purchase_invoices_num_trgm 
    ON public.purchase_invoices USING gin (invoice_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_parties_name_trgm 
    ON public.parties USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_parties_tax_id_trgm 
    ON public.parties USING gin (tax_id gin_trgm_ops);


-- 3. Función RPC: search_pending_invoices
-- Busca simultáneamente por: Folio, RUT, Razón Social y Monto.
-- Insensible a mayúsculas, tildes y prefijos.
-- Ordena por relevancia: coincidencia exacta de folio, posible match por monto, y similitud fuzzy.
CREATE OR REPLACE FUNCTION public.search_pending_invoices(
    term text DEFAULT '',
    tenant_id uuid DEFAULT NULL,
    "limit" integer DEFAULT 50,
    target_amount numeric DEFAULT NULL,
    invoice_type text DEFAULT 'sale'
)
RETURNS TABLE (
    id uuid,
    invoice_number text,
    issue_date date,
    due_date date,
    party_name text,
    party_tax_id text,
    currency_code text,
    total_amount numeric,
    paid_amount numeric,
    balance_due numeric,
    is_exact_amount_match boolean,
    relevance_score numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_term text := COALESCE(TRIM(term), '');
    v_clean_term_unaccent text;
    v_numeric_term text;
    v_clean_rut text;
    v_limit int := LEAST(GREATEST(COALESCE("limit", 50), 1), 100);
BEGIN
    IF tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id es requerido para realizar la búsqueda de facturas.';
    END IF;

    -- Normalizar término
    v_clean_term_unaccent := lower(unaccent(v_clean_term));
    v_numeric_term := regexp_replace(v_clean_term, '\D', '', 'g');
    v_clean_rut := replace(replace(v_clean_term, '.', ''), '-', '');

    -- A) Búsqueda en FACTURAS DE VENTA (sales_invoice_balances)
    IF lower(COALESCE(invoice_type, 'sale')) IN ('sale', 'sales', 'venta', 'ventas') THEN
        RETURN QUERY
        SELECT 
            sib.id,
            sib.invoice_number,
            sib.issue_date,
            sib.due_date,
            sib.party_name,
            sib.party_tax_id,
            sib.currency_code,
            sib.total_amount,
            sib.paid_amount,
            sib.balance_due,
            (target_amount IS NOT NULL AND ABS(sib.balance_due - target_amount) < 1.0) AS is_exact_amount_match,
            (
                -- Scoring de Relevancia
                -- 1. Coincidencia exacta de folio (1000 pts)
                CASE 
                    WHEN v_clean_term <> '' AND (
                        lower(sib.invoice_number) = lower(v_clean_term) OR 
                        (v_numeric_term <> '' AND regexp_replace(sib.invoice_number, '\D', '', 'g') = v_numeric_term)
                    ) THEN 1000.0
                    -- 2. Folio contiene el término (600 pts)
                    WHEN v_clean_term <> '' AND sib.invoice_number ILIKE '%' || v_clean_term || '%' THEN 600.0
                    WHEN v_numeric_term <> '' AND regexp_replace(sib.invoice_number, '\D', '', 'g') LIKE '%' || v_numeric_term || '%' THEN 500.0
                    ELSE 0.0
                END
                +
                -- 3. Match de Monto exacto con movimiento bancario (400 pts)
                CASE 
                    WHEN target_amount IS NOT NULL AND ABS(sib.balance_due - target_amount) < 1.0 THEN 400.0
                    ELSE 0.0
                END
                +
                -- 4. Coincidencia de RUT cliente (300 pts)
                CASE 
                    WHEN v_clean_rut <> '' AND length(v_clean_rut) >= 3 AND replace(replace(sib.party_tax_id, '.', ''), '-', '') ILIKE '%' || v_clean_rut || '%' THEN 300.0
                    ELSE 0.0
                END
                +
                -- 5. Coincidencia en Razón Social del cliente (200 pts)
                CASE 
                    WHEN v_clean_term_unaccent <> '' AND lower(unaccent(sib.party_name)) ILIKE '%' || v_clean_term_unaccent || '%' THEN 200.0
                    ELSE 0.0
                END
                +
                -- 6. Similitud trigram fuzzy (0 a 100 pts)
                CASE 
                    WHEN v_clean_term <> '' THEN 
                        (similarity(sib.party_name, v_clean_term) * 50.0) +
                        (similarity(sib.invoice_number, v_clean_term) * 50.0)
                    ELSE 0.0
                END
            )::numeric AS relevance_score
        FROM public.sales_invoice_balances sib
        WHERE sib.entity_id = tenant_id
          AND sib.balance_due > 0
          AND (
            -- Si no hay término, mostrar todas las pendientes (priorizando monto y fecha)
            v_clean_term = ''
            OR
            -- Búsqueda en folio (con o sin prefijos)
            sib.invoice_number ILIKE '%' || v_clean_term || '%'
            OR (v_numeric_term <> '' AND regexp_replace(sib.invoice_number, '\D', '', 'g') LIKE '%' || v_numeric_term || '%')
            OR
            -- Búsqueda en RUT
            (v_clean_rut <> '' AND replace(replace(sib.party_tax_id, '.', ''), '-', '') ILIKE '%' || v_clean_rut || '%')
            OR
            -- Búsqueda en Nombre (insensible a mayúsculas y acentos)
            lower(unaccent(sib.party_name)) ILIKE '%' || v_clean_term_unaccent || '%'
            OR
            -- Fuzzy similarity
            similarity(sib.party_name, v_clean_term) > 0.15
            OR similarity(sib.invoice_number, v_clean_term) > 0.2
            OR
            -- Coincidencia en Monto
            (v_numeric_term <> '' AND sib.balance_due::bigint::text LIKE '%' || v_numeric_term || '%')
          )
        ORDER BY 
            -- Primero los posibles matches con el monto del movimiento
            (target_amount IS NOT NULL AND ABS(sib.balance_due - target_amount) < 1.0) DESC,
            -- Luego por mayor puntaje de relevancia
            relevance_score DESC,
            -- Luego las más recientes
            sib.issue_date DESC
        LIMIT v_limit;

    -- B) Búsqueda en FACTURAS DE COMPRA (purchase_invoice_balances)
    ELSE
        RETURN QUERY
        SELECT 
            pib.id,
            pib.invoice_number,
            pib.issue_date,
            pib.due_date,
            pib.party_name,
            pib.party_tax_id,
            pib.currency_code,
            pib.total_amount,
            pib.paid_amount,
            pib.balance_due,
            (target_amount IS NOT NULL AND ABS(pib.balance_due - target_amount) < 1.0) AS is_exact_amount_match,
            (
                CASE 
                    WHEN v_clean_term <> '' AND (
                        lower(pib.invoice_number) = lower(v_clean_term) OR 
                        (v_numeric_term <> '' AND regexp_replace(pib.invoice_number, '\D', '', 'g') = v_numeric_term)
                    ) THEN 1000.0
                    WHEN v_clean_term <> '' AND pib.invoice_number ILIKE '%' || v_clean_term || '%' THEN 600.0
                    WHEN v_numeric_term <> '' AND regexp_replace(pib.invoice_number, '\D', '', 'g') LIKE '%' || v_numeric_term || '%' THEN 500.0
                    ELSE 0.0
                END
                +
                CASE 
                    WHEN target_amount IS NOT NULL AND ABS(pib.balance_due - target_amount) < 1.0 THEN 400.0
                    ELSE 0.0
                END
                +
                CASE 
                    WHEN v_clean_rut <> '' AND length(v_clean_rut) >= 3 AND replace(replace(pib.party_tax_id, '.', ''), '-', '') ILIKE '%' || v_clean_rut || '%' THEN 300.0
                    ELSE 0.0
                END
                +
                CASE 
                    WHEN v_clean_term_unaccent <> '' AND lower(unaccent(pib.party_name)) ILIKE '%' || v_clean_term_unaccent || '%' THEN 200.0
                    ELSE 0.0
                END
                +
                CASE 
                    WHEN v_clean_term <> '' THEN 
                        (similarity(pib.party_name, v_clean_term) * 50.0) +
                        (similarity(pib.invoice_number, v_clean_term) * 50.0)
                    ELSE 0.0
                END
            )::numeric AS relevance_score
        FROM public.purchase_invoice_balances pib
        WHERE pib.entity_id = tenant_id
          AND pib.balance_due > 0
          AND (
            v_clean_term = ''
            OR pib.invoice_number ILIKE '%' || v_clean_term || '%'
            OR (v_numeric_term <> '' AND regexp_replace(pib.invoice_number, '\D', '', 'g') LIKE '%' || v_numeric_term || '%')
            OR (v_clean_rut <> '' AND replace(replace(pib.party_tax_id, '.', ''), '-', '') ILIKE '%' || v_clean_rut || '%')
            OR lower(unaccent(pib.party_name)) ILIKE '%' || v_clean_term_unaccent || '%'
            OR similarity(pib.party_name, v_clean_term) > 0.15
            OR similarity(pib.invoice_number, v_clean_term) > 0.2
            OR (v_numeric_term <> '' AND pib.balance_due::bigint::text LIKE '%' || v_numeric_term || '%')
          )
        ORDER BY 
            (target_amount IS NOT NULL AND ABS(pib.balance_due - target_amount) < 1.0) DESC,
            relevance_score DESC,
            pib.issue_date DESC
        LIMIT v_limit;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_pending_invoices(text, uuid, integer, numeric, text) TO authenticated, service_role;
