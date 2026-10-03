# Sprint 38 — Orden de Compra

**Fase:** EasyERP core / Operaciones
**Depende de:** Sprint 37 (`supplier_catalog_items`), Sprint 2 (`get_next_entry_number`/`naming_series`, se reutiliza tal cual), Sprint 6 (`purchase_invoices`)
**Bloquea a:** un futuro sprint de 3-Way Match (no incluido aquí — ver Fuera de alcance)

## Objetivo

Generar órdenes de compra por proveedor, seleccionando ítems desde su catálogo (Sprint 37), con numeración interna única por empresa.

## Decisión de diseño: número de OC reutilizando `naming_series`

Ya existe en el proyecto (Sprint 2) un mecanismo atómico de correlativos por empresa: `get_next_entry_number(_entity_id, _prefix)`, con bloqueo de fila (`FOR UPDATE`) para que dos OC no puedan nacer con el mismo número aunque se creen al mismo tiempo. Lo reutilizo con el prefijo `'OC-'` en vez de crear un contador nuevo — es exactamente el problema que esa función ya resuelve bien. El número se asigna **al crear** la orden (no al confirmarla): pediste que cada orden generada tenga su número, no que lo tenga recién al aprobarse.

## Supuesto sobre "campos según el proveedor y el tipo" — confírmamelo

Entendí esto como: los campos de cada línea varían según si el ítem elegido del catálogo es `producto` o `servicio` (ej. un servicio no necesariamente necesita cantidad superior a 1, un producto sí) — **no** como un sistema de campos personalizados configurables por proveedor. Si lo que tenías en mente es que cada proveedor pueda definir sus propios campos adicionales (más allá de producto/servicio), eso es un diseño distinto y más grande — un motor de campos dinámicos — y conviene tratarlo como su propio sprint en vez de metido aquí a medias.

## Alcance incluido

- `purchase_orders` / `purchase_order_lines`: cabecera y líneas, con selección de ítems desde `supplier_catalog_items` del proveedor elegido (el combo de ítems se filtra a ese proveedor).
- Campo `observaciones` en la cabecera.
- `po_number` único por empresa, generado con `get_next_entry_number(entity_id, 'OC-')`.
- **El gancho**, no el motor: `purchase_invoices.purchase_order_id` (nullable) para que, cuando se construya el 3-Way Match, ya exista dónde enlazar la factura de compra a su orden. Este sprint no compara OC vs. recepción vs. factura — solo dispone el campo.

## Fuera de alcance

- El 3-Way Match en sí (comparar cantidades/montos entre OC, recepción de mercadería y factura) — falta además definir qué es "recepción" en el flujo general de Compras (el de 3PL tiene su propio modelo de recepción, Sprint 19, que es independiente de este).
- Aprobación de la OC por montos/jerarquía.
- Envío de la OC al proveedor por email o a través del portal.
- El motor de campos dinámicos por proveedor, si era eso lo que pedías (ver el supuesto de arriba).

## Cambios de esquema (sketch SQL)

```sql
DO $$ BEGIN
  CREATE TYPE public.po_status AS ENUM ('draft', 'sent', 'confirmed', 'cancelled', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    party_id uuid REFERENCES public.parties(id) ON DELETE RESTRICT NOT NULL,
    po_number text NOT NULL,
    status public.po_status NOT NULL DEFAULT 'draft',
    issue_date date NOT NULL DEFAULT CURRENT_DATE,
    expected_date date,
    warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
    cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    currency_code text REFERENCES public.currencies(code) NOT NULL DEFAULT 'CLP',
    exchange_rate numeric(20,9) DEFAULT 1.0 NOT NULL,
    observaciones text,
    subtotal_amount numeric(20,4) DEFAULT 0 NOT NULL,
    tax_amount numeric(20,4) DEFAULT 0 NOT NULL,
    total_amount numeric(20,4) DEFAULT 0 NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, po_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
    catalog_item_id uuid REFERENCES public.supplier_catalog_items(id) ON DELETE SET NULL,
    item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
    description text NOT NULL,
    item_type public.catalog_item_type NOT NULL DEFAULT 'producto',
    qty numeric(20,4) NOT NULL DEFAULT 1,
    unit_price numeric(20,4) NOT NULL DEFAULT 0,
    tax_rate numeric(6,3) DEFAULT 19.0 NOT NULL,
    line_total numeric(20,4) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- El gancho para el 3-Way Match futuro
ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

-- Creación con número atómico, en una sola función (evita el número "fantasma" de una OC que falla a mitad de camino)
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  _entity_id uuid, _party_id uuid, _warehouse_id uuid, _cost_center_id uuid,
  _currency_code text, _exchange_rate numeric, _expected_date date, _observaciones text,
  _lines jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po_id uuid; v_po_number text; v_line jsonb;
  v_subtotal numeric(20,4) := 0; v_tax numeric(20,4) := 0; v_line_total numeric(20,4);
BEGIN
  IF NOT (public.user_has_company_access(auth.uid(), _entity_id)
          AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'purchasing'))) THEN
    RAISE EXCEPTION 'Sin permiso para crear órdenes de compra' USING ERRCODE = '42501';
  END IF;
  IF _lines IS NULL OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION 'La orden debe tener al menos una línea' USING ERRCODE = '22023';
  END IF;

  v_po_number := public.get_next_entry_number(_entity_id, 'OC-');

  INSERT INTO public.purchase_orders (entity_id, party_id, po_number, warehouse_id, cost_center_id,
    currency_code, exchange_rate, expected_date, observaciones, created_by)
  VALUES (_entity_id, _party_id, v_po_number, _warehouse_id, _cost_center_id,
    COALESCE(_currency_code, 'CLP'), COALESCE(_exchange_rate, 1.0), _expected_date, _observaciones, auth.uid())
  RETURNING id INTO v_po_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_line_total := (v_line->>'qty')::numeric * (v_line->>'unit_price')::numeric;
    v_subtotal := v_subtotal + v_line_total;
    v_tax := v_tax + v_line_total * (COALESCE((v_line->>'tax_rate')::numeric, 19.0) / 100);

    INSERT INTO public.purchase_order_lines (purchase_order_id, catalog_item_id, item_id,
      description, item_type, qty, unit_price, tax_rate, line_total)
    VALUES (v_po_id, (v_line->>'catalog_item_id')::uuid, (v_line->>'item_id')::uuid,
      v_line->>'description', COALESCE((v_line->>'item_type')::public.catalog_item_type, 'producto'),
      (v_line->>'qty')::numeric, (v_line->>'unit_price')::numeric,
      COALESCE((v_line->>'tax_rate')::numeric, 19.0), v_line_total);
  END LOOP;

  UPDATE public.purchase_orders
     SET subtotal_amount = v_subtotal, tax_amount = v_tax, total_amount = v_subtotal + v_tax
   WHERE id = v_po_id;

  RETURN v_po_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_purchase_order(uuid, uuid, uuid, uuid, text, numeric, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, uuid, uuid, text, numeric, date, text, jsonb) TO authenticated;
```

## Criterios de aceptación

- [ ] Crear dos OC para el mismo proveedor en rápida sucesión produce dos `po_number` distintos y correlativos, sin colisión (probar con dos pestañas/llamadas simultáneas si es posible).
- [ ] El combo de ítems al crear una línea muestra solo el catálogo del proveedor seleccionado en la cabecera.
- [ ] Una OC con una línea sin `qty` o `unit_price` válido no se crea — ni la cabecera ni las líneas (todo o nada).
- [ ] El campo `observaciones` se guarda y se muestra en el detalle de la OC.
- [ ] `purchase_invoices.purchase_order_id` existe y acepta NULL — no rompe ninguna factura de compra ya creada.

---

## Prompt listo para pegar en Lovable

```
Voy a agregar Órdenes de Compra, reutilizando la función de correlativos get_next_entry_number (Sprint 2) para el número de OC en vez de crear un contador nuevo.

1. Crea el enum po_status ('draft','sent','confirmed','cancelled','closed') dentro de un bloque DO con EXCEPTION WHEN duplicate_object.

2. Crea purchase_orders (entity_id, party_id FK a parties on delete restrict NOT NULL, po_number text NOT NULL, status default 'draft', issue_date default CURRENT_DATE, expected_date, warehouse_id FK nullable, cost_center_id FK nullable, currency_code FK a currencies default 'CLP', exchange_rate numeric(20,9) default 1.0, observaciones text, subtotal_amount/tax_amount/total_amount numeric(20,4) default 0, created_by FK a auth.users, created_at, único por entity_id+po_number).

3. Crea purchase_order_lines (purchase_order_id FK on delete cascade, catalog_item_id FK nullable a supplier_catalog_items on delete set null, item_id FK nullable a items on delete set null, description NOT NULL, item_type default 'producto' usando el enum catalog_item_type del Sprint 37, qty numeric(20,4) default 1, unit_price numeric(20,4) default 0, tax_rate numeric(6,3) default 19.0, line_total numeric(20,4) default 0, created_at).

4. Agrega purchase_order_id uuid references purchase_orders(id) on delete set null (nullable) a purchase_invoices — es solo el gancho para el 3-Way Match futuro, no implementes ninguna lógica de matching todavía.

5. Crea la función create_purchase_order(_entity_id, _party_id, _warehouse_id, _cost_center_id, _currency_code, _exchange_rate, _expected_date, _observaciones, _lines jsonb) — SECURITY DEFINER, valida que quien llama tiene user_has_company_access sobre _entity_id y rol admin o purchasing (si no, excepción con ERRCODE 42501), exige al menos una línea (si no, ERRCODE 22023), obtiene el número con get_next_entry_number(_entity_id, 'OC-'), inserta la cabecera, luego cada línea calculando line_total = qty * unit_price, acumula subtotal y el impuesto de cada línea (tax_rate/100 sobre su line_total), y al final actualiza los totales de la cabecera. Revoca el EXECUTE a PUBLIC y otórgalo a authenticated.

6. Aplica RLS multiempresa normal a purchase_orders y purchase_order_lines (user_has_company_access vía entity_id, o vía la orden padre para las líneas).

7. En purchases.tsx agrega una pestaña nueva "Órdenes de Compra": listado con número, proveedor, estado, total y fecha; formulario de creación que primero pide el proveedor, y según ese proveedor carga su supplier_catalog_items activo en el selector de ítems de cada línea (mostrando si es producto o servicio); permite agregar varias líneas, cantidad y precio editables (precargados desde el ítem del catálogo pero modificables), y un campo de texto "Observaciones"; al guardar, llama a create_purchase_order con las líneas armadas y muestra el po_number asignado.

Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
