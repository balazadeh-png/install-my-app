# Sprint 2 — Motor Contable de Partida Doble

**Fase:** 1 — Fundación
**Depende de:** Sprint 1 (multiempresa)
**Bloquea a:** Sprints 3, 4, 6, 7 (todo lo que postea al mayor)

## Objetivo

Reemplazar el insert de filas sueltas en `gl_entries` por comprobantes contables reales: una cabecera que agrupa líneas, que solo se puede postear si debe = haber, con numeración correlativa real, y que una vez posteada no se puede editar ni borrar — solo reversar.

## Por qué (brecha que resuelve)

El diálogo "Registrar Asiento" en `accounting.tsx` hoy hace un `insert` de una sola fila (un débito **o** un crédito) sin relación con ninguna otra fila. No hay nada que impida que la suma de débitos nunca cuadre con la de créditos, no hay número de comprobante real (existe `naming_series` pero el insert no lo usa), y no hay ninguna restricción de base de datos que impida un `UPDATE` o `DELETE` sobre un asiento ya "posteado". Para un ERP tipo SAP esto es un problema de integridad contable, no un detalle cosmético — y todo lo que sigue (multimoneda, centros de costo, ventas/compras) postea al mayor, así que hay que arreglarlo antes de agregarles más columnas encima.

## Alcance incluido

- Tabla `journal_entries` (cabecera: empresa, libro, fecha, glosa, tipo de comprobante, estado, usuario, número).
- `gl_entries` se reestructura como `journal_entry_lines` (detalle: cuenta, débito, crédito, memo de línea, tercero).
- Trigger/función que valida `SUM(debit) = SUM(credit)` por comprobante antes de permitir el estado `posted`.
- Función `post_journal_entry(id)` que consume la numeración de `naming_series` de forma atómica y cambia el estado a `posted`.
- Trigger que rechaza `UPDATE`/`DELETE` sobre comprobantes en estado `posted` (solo se permite crear un comprobante de reversión que referencia al original).
- UI: el diálogo "Registrar Asiento" pasa a ser un formulario de comprobante con N líneas (mínimo 2), que muestra en vivo si cuadra o no, y no permite guardar si no cuadra.

## Fuera de alcance

- Montos en moneda distinta a la funcional (Sprint 3).
- Centros de costo/unidad en cada línea (Sprint 4).

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.journal_entry_status AS ENUM ('draft', 'posted', 'reversed');

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT NOT NULL,
    book_id uuid REFERENCES public.books(id) ON DELETE RESTRICT,
    entry_number text,
    naming_series_id uuid REFERENCES public.naming_series(id),
    posting_date date NOT NULL,
    fiscal_year_id uuid REFERENCES public.fiscal_years(id),
    accounting_period_id uuid REFERENCES public.accounting_periods(id),
    voucher_type text NOT NULL DEFAULT 'Manual',
    memo text,
    status public.journal_entry_status NOT NULL DEFAULT 'draft',
    reversal_of uuid REFERENCES public.journal_entries(id),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
    line_no integer NOT NULL,
    account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
    party_id uuid REFERENCES public.parties(id),
    debit numeric(20,4) NOT NULL DEFAULT 0,
    credit numeric(20,4) NOT NULL DEFAULT 0,
    memo text,
    CONSTRAINT ck_line_debit_or_credit CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)),
    CONSTRAINT ck_line_non_negative CHECK (debit >= 0 AND credit >= 0)
);

-- Validación de cuadre antes de postear
CREATE OR REPLACE FUNCTION public.post_journal_entry(_journal_entry_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_debit numeric(20,4);
  v_credit numeric(20,4);
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO v_debit, v_credit
    FROM public.journal_entry_lines WHERE journal_entry_id = _journal_entry_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'El comprobante no cuadra: debe % vs haber %', v_debit, v_credit;
  END IF;

  IF v_debit = 0 THEN
    RAISE EXCEPTION 'El comprobante no puede tener monto cero';
  END IF;

  UPDATE public.journal_entries SET status = 'posted', updated_at = now()
  WHERE id = _journal_entry_id AND status = 'draft';
END;
$$;

-- Inmutabilidad: nada se edita ni se borra una vez posteado
CREATE OR REPLACE FUNCTION public.reject_posted_journal_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'No se puede modificar ni eliminar un comprobante posteado. Use una reversión.';
  END IF;
  RETURN NULL; -- para DELETE; para UPDATE devolver OLD si se quiere permitir algo puntual
END;
$$;

CREATE TRIGGER trg_reject_posted_update
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW WHEN (OLD.status = 'posted' AND NEW.status = 'posted')
EXECUTE FUNCTION public.reject_posted_journal_mutation();

CREATE TRIGGER trg_reject_posted_delete
BEFORE DELETE ON public.journal_entries
FOR EACH ROW WHEN (OLD.status = 'posted')
EXECUTE FUNCTION public.reject_posted_journal_mutation();
```

> `gl_entries` puede conservarse como vista de compatibilidad (`CREATE VIEW gl_entries AS SELECT ... FROM journal_entry_lines JOIN journal_entries ...`) mientras se migra el resto del código que la consulta, o migrarse de una vez si `accounting.tsx` es el único consumidor real hoy.

## Cambios de UI/backend esperados

- Nuevo formulario de comprobante: cabecera (fecha, glosa, libro) + tabla editable de líneas (cuenta, débito, crédito, tercero opcional), con fila de totales que se pone en rojo si no cuadra, y botón "Postear" deshabilitado hasta que cuadre.
- Vista de "Libro Diario" agrupada por comprobante (no por línea suelta como hoy).
- Acción "Reversar" sobre un comprobante posteado, que crea uno nuevo con las líneas invertidas y `reversal_of` apuntando al original.
- El insert debe consumir `naming_series.next_number` de forma atómica (`SELECT ... FOR UPDATE` o función dedicada) para armar `entry_number`.

## Criterios de aceptación

- [ ] No es posible postear un comprobante donde la suma de débitos ≠ suma de créditos.
- [ ] Un comprobante posteado no se puede editar ni borrar desde la UI ni por API directa (el trigger lo bloquea a nivel de base de datos).
- [ ] Reversar un comprobante crea uno nuevo enlazado, sin tocar el original.
- [ ] Cada comprobante posteado tiene un número correlativo real tomado de `naming_series`.

---

## Prompt listo para pegar en Lovable

```
El módulo de Contabilidad hoy inserta filas sueltas en `gl_entries` (un débito o un crédito por vez), sin exigir que cuadren y sin proteger los asientos ya guardados. Necesito convertirlo en un motor de partida doble real:

1. Crea el enum `journal_entry_status` ('draft', 'posted', 'reversed').

2. Crea la tabla `journal_entries` como cabecera de comprobante: entity_id, book_id, entry_number, naming_series_id, posting_date, fiscal_year_id, accounting_period_id, voucher_type, memo, status, reversal_of (self-FK), created_by, timestamps.

3. Crea `journal_entry_lines` como el detalle: journal_entry_id, line_no, account_id, party_id, debit, credit, memo — con un CHECK que obligue "(debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)" y otro que exija ambos >= 0.

4. Crea la función `post_journal_entry(_journal_entry_id uuid)` que valide que SUM(debit) = SUM(credit) de las líneas, rechace comprobantes en cero, y cambie el estado a 'posted' solo si estaba en 'draft'.

5. Crea triggers BEFORE UPDATE y BEFORE DELETE en `journal_entries` que impidan cualquier modificación o borrado cuando el estado actual sea 'posted' — la única forma de "deshacer" un comprobante posteado debe ser un comprobante de reversión nuevo con las líneas invertidas y `reversal_of` apuntando al original.

6. Migra los datos existentes de `gl_entries` agrupándolos en comprobantes (agrupa por fecha + memo + voucher_type como aproximación razonable ya que hoy no hay cabecera) y crea una vista `gl_entries` de compatibilidad si algo más del código todavía la consulta.

7. En `accounting.tsx`, reemplaza el diálogo actual "Registrar Asiento" por un formulario de comprobante: cabecera (fecha, glosa, libro) + una tabla editable de líneas (cuenta, débito, crédito, tercero opcional) con un botón para agregar/quitar líneas, una fila de totales que se ponga en rojo mientras no cuadre, y el botón "Postear" deshabilitado hasta que debe = haber y haya al menos dos líneas. Al postear, llama a `post_journal_entry` y consume `naming_series.next_number` de forma atómica para el número del comprobante.

8. Agrega una acción "Reversar" sobre comprobantes posteados que cree uno nuevo con las líneas invertidas.

9. Actualiza la vista "Libro Diario / Partidas" para que agrupe por comprobante en vez de mostrar líneas sueltas sin relación.

Al terminar, documenta el cambio en `.md/CHANGELOG.md` y actualiza la sección de Libro Mayor en `.md/ARQUITECTURA.md` y `.md/MODULOS.md`.
```
