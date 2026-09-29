-- ============================================================================
-- Sprint 33: Configuración Granular de Módulos por Empresa (Multi-Inquilino)
-- EasyERP — Permite activar o desactivar módulos independientemente por entidad
-- ============================================================================

-- 1. Tabla company_modules
CREATE TABLE IF NOT EXISTS public.company_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE NOT NULL,
    module_name text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, module_name)
);

CREATE INDEX IF NOT EXISTS ix_company_modules_entity_id ON public.company_modules(entity_id);
CREATE INDEX IF NOT EXISTS ix_company_modules_module ON public.company_modules(module_name);

-- 2. Habilitar RLS en company_modules
ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_modules_read" ON public.company_modules;
CREATE POLICY "company_modules_read"
ON public.company_modules FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "company_modules_admin_write" ON public.company_modules;
CREATE POLICY "company_modules_admin_write"
ON public.company_modules FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Asegurar catálogo maestro de módulos en public.modules con sus grupos
INSERT INTO public.modules (name, label, group_name, group_sort_order, sort_order, active)
VALUES
    ('accounting', 'Contabilidad', 'Finanzas', 1, 1, true),
    ('cash', 'Bancos / Tesorería', 'Finanzas', 1, 2, true),
    ('assets', 'Activos Fijos', 'Finanzas', 1, 3, true),
    ('reports', 'Reportes Financieros', 'Finanzas', 1, 4, true),
    ('sales', 'Ventas', 'Operaciones', 2, 1, true),
    ('pos', 'Punto de Venta (POS)', 'Operaciones', 2, 2, true),
    ('purchases', 'Compras', 'Operaciones', 2, 3, true),
    ('inventory', 'Inventario', 'Operaciones', 2, 4, true),
    ('production', 'Producción', 'Operaciones', 2, 5, true),
    ('dispatch', 'Guías de Despacho (3PL)', 'Logística 3PL', 3, 1, true),
    ('dashboard-3pl', 'Dashboard BI 3PL', 'Logística 3PL', 3, 2, true),
    ('portal', 'Portal Clientes 3PL', 'Logística 3PL', 3, 3, true),
    ('sii-books', 'Libros Legales SII', 'Impuestos', 4, 1, true),
    ('taxes', 'Impuestos (F29/F22)', 'Impuestos', 4, 2, true),
    ('declaraciones-juradas', 'DDJJ (SII)', 'Impuestos', 4, 3, true),
    ('roles', 'Usuarios y Roles', 'Configuración', 5, 1, true),
    ('setup', 'Configuración General', 'Configuración', 5, 2, true)
ON CONFLICT (name) DO UPDATE 
SET label = EXCLUDED.label,
    group_name = EXCLUDED.group_name,
    group_sort_order = EXCLUDED.group_sort_order,
    sort_order = EXCLUDED.sort_order,
    active = true;

-- 4. Función RPC: get_company_modules
-- Retorna el estado (habilitado/deshabilitado) de cada módulo para una empresa específica
DROP FUNCTION IF EXISTS public.get_company_modules(uuid);
CREATE OR REPLACE FUNCTION public.get_company_modules(p_entity_id uuid)
RETURNS TABLE (
    module_name text,
    label text,
    group_name text,
    group_sort_order integer,
    sort_order integer,
    enabled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.name AS module_name,
        m.label,
        COALESCE(m.group_name, 'General') AS group_name,
        COALESCE(m.group_sort_order, 99) AS group_sort_order,
        COALESCE(m.sort_order, 99) AS sort_order,
        -- El módulo setup siempre debe estar habilitado
        CASE 
            WHEN m.name = 'setup' THEN true
            ELSE COALESCE(cm.enabled, true)
        END AS enabled
    FROM public.modules m
    LEFT JOIN public.company_modules cm 
        ON cm.module_name = m.name 
        AND cm.entity_id = p_entity_id
    WHERE m.active = true
    ORDER BY COALESCE(m.group_sort_order, 99) ASC, COALESCE(m.sort_order, 99) ASC, m.label ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_modules(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_modules(uuid) TO authenticated;

-- 5. Función RPC: set_company_modules_bulk
-- Permite guardar en lote la activación o desactivación de módulos por empresa
DROP FUNCTION IF EXISTS public.set_company_modules_bulk(uuid, jsonb);
CREATE OR REPLACE FUNCTION public.set_company_modules_bulk(
    p_entity_id uuid,
    p_modules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
    v_val boolean;
    v_item jsonb;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores pueden configurar módulos por empresa' USING ERRCODE = '42501';
    END IF;

    IF jsonb_typeof(p_modules) = 'object' THEN
        FOR v_key, v_val IN SELECT key, value::boolean FROM jsonb_each_text(p_modules) LOOP
            -- El módulo setup siempre se mantiene habilitado
            IF v_key = 'setup' THEN
                v_val := true;
            END IF;

            INSERT INTO public.company_modules (entity_id, module_name, enabled, updated_at)
            VALUES (p_entity_id, v_key, v_val, now())
            ON CONFLICT (entity_id, module_name) DO UPDATE
            SET enabled = EXCLUDED.enabled, updated_at = now();
        END LOOP;
    ELSIF jsonb_typeof(p_modules) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_modules) LOOP
            v_key := v_item->>'module_name';
            IF v_key IS NULL THEN
                v_key := v_item->>'name';
            END IF;
            v_val := COALESCE((v_item->>'enabled')::boolean, true);

            IF v_key = 'setup' THEN
                v_val := true;
            END IF;

            IF v_key IS NOT NULL THEN
                INSERT INTO public.company_modules (entity_id, module_name, enabled, updated_at)
                VALUES (p_entity_id, v_key, v_val, now())
                ON CONFLICT (entity_id, module_name) DO UPDATE
                SET enabled = EXCLUDED.enabled, updated_at = now();
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'entity_id', p_entity_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_modules_bulk(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_modules_bulk(uuid, jsonb) TO authenticated;

-- 6. Backfill inicial: Asegurar módulos activos para todas las empresas actuales
INSERT INTO public.company_modules (entity_id, module_name, enabled)
SELECT e.id, m.name, true
FROM public.entities e
CROSS JOIN public.modules m
WHERE m.active = true
ON CONFLICT (entity_id, module_name) DO NOTHING;
