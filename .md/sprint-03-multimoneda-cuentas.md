# Sprint 3 — Multimoneda a Nivel de Cuenta

**Fase:** 1 — Fundación
**Depende de:** Sprint 1 (multiempresa), Sprint 2 (partida doble)
**Bloquea a:** Sprint 6 (ventas/compras en moneda extranjera), Sprint 7 (revalorización)

## Objetivo

Permitir que una cuenta específica (banco, cuentas por cobrar, facturas de importación/exportación) tenga **su propia moneda**, distinta de la moneda funcional de la empresa, y que cada línea de asiento registre el monto en ambas monedas de forma consistente y trazable.

## Por qué (brecha que resuelve)

Esto es literalmente lo que pediste: *"cada empresa [tiene] su moneda local principal, pero pudiendo llevar cuentas contables en otras monedas"*. Hoy `accounts` no tiene ningún campo de moneda — toda cuenta hereda implícitamente la moneda de la empresa, y el formulario de asientos ni siquiera deja elegir moneda (queda fija en `"CLP"` en el código). No hay forma de que "Banco Santander USD" lleve su propio saldo en dólares.

## Alcance incluido

- `accounts.currency_code` (nullable FK a `currencies.code`) — si es `NULL`, la cuenta usa la moneda de la empresa.
- `journal_entry_lines` gana `currency_code`, `exchange_rate`, `debit_account_currency`, `credit_account_currency` — de modo que cada línea guarda el monto en la moneda de la cuenta **y** su equivalente ya convertido a la moneda funcional (que es lo que sigue alimentando `debit`/`credit` para que los reportes existentes no se rompan).
- Función `get_exchange_rate(origen, destino, fecha)`: exige que exista una tasa **exacta** para esa fecha — sin usar una tasa vieja en silencio, porque eso genera diferencias que nadie audita después.
- Trigger que, al insertar una línea, resuelve automáticamente la moneda de la cuenta y calcula `debit`/`credit` (moneda funcional) a partir de `debit_account_currency`/`credit_account_currency` (moneda de cuenta) y la tasa del día.
- UI: selector de moneda al crear una cuenta; en el formulario de asiento, cuando la cuenta elegida tiene moneda distinta a la de la empresa, aparece el campo en moneda extranjera y un monto equivalente calculado en vivo.

## Fuera de alcance

- Revalorización de saldos al cierre (Sprint 7).
- Múltiples libros paralelos en distinta moneda (IFRS/USD en paralelo al libro fiscal) — queda como extensión futura si la necesitas; el diseño de `books` ya lo admite (`books.entity_id`), no hace falta tocarlo ahora.

## Cambios de esquema (sketch SQL)

```sql
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS currency_code text REFERENCES public.currencies(code);

ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS currency_code text REFERENCES public.currencies(code),
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(20,9) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS debit_account_currency numeric(20,4),
  ADD COLUMN IF NOT EXISTS credit_account_currency numeric(20,4);

CREATE OR REPLACE FUNCTION public.get_exchange_rate(_origin text, _destination text, _date date)
RETURNS numeric(20,9)
LANGUAGE plpgsql STABLE AS $$
DECLARE v_rate numeric(20,9);
BEGIN
  IF _origin = _destination THEN RETURN 1; END IF;
  SELECT rate INTO v_rate FROM public.exchange_rates
  WHERE origin = _origin AND destination = _destination AND date = _date;
  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'No existe tasa % → % para %. Regístrela antes de continuar.', _origin, _destination, _date;
  END IF;
  RETURN v_rate;
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_line_currency_amounts()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_entity_currency text;
  v_account_currency text;
  v_posting_date date;
BEGIN
  SELECT e.base_currency_code, je.posting_date INTO v_entity_currency, v_posting_date
  FROM public.journal_entries je JOIN public.entities e ON e.id = je.entity_id
  WHERE je.id = NEW.journal_entry_id;

  SELECT COALESCE(currency_code, v_entity_currency) INTO v_account_currency
  FROM public.accounts WHERE id = NEW.account_id;

  NEW.currency_code := v_account_currency;
  NEW.debit_account_currency := COALESCE(NEW.debit_account_currency, NEW.debit);
  NEW.credit_account_currency := COALESCE(NEW.credit_account_currency, NEW.credit);

  IF v_account_currency = v_entity_currency THEN
    NEW.exchange_rate := 1;
    NEW.debit := NEW.debit_account_currency;
    NEW.credit := NEW.credit_account_currency;
  ELSE
    NEW.exchange_rate := public.get_exchange_rate(v_account_currency, v_entity_currency, v_posting_date);
    NEW.debit := ROUND(NEW.debit_account_currency * NEW.exchange_rate, 4);
    NEW.credit := ROUND(NEW.credit_account_currency * NEW.exchange_rate, 4);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_resolve_line_currency
BEFORE INSERT ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.resolve_line_currency_amounts();
```

> Importante: la validación de cuadre del Sprint 2 (`post_journal_entry`) sigue comparando `debit`/`credit` (moneda funcional) — eso no cambia. Lo que cambia es que ahora esos valores pueden venir calculados a partir de un monto en moneda extranjera.

## Cambios de UI/backend esperados

- Diálogo "Nueva Cuenta" (`accounting.tsx`): agrega un `<Select>` de moneda (opcional — "usar la de la empresa" como default).
- Formulario de comprobante: al elegir una cuenta con `currency_code` distinto al de la empresa, la línea muestra dos campos ("Monto en USD" y, de solo lectura, "Equivalente en CLP") calculados contra `exchange_rates` para la fecha del comprobante. Si no existe la tasa de ese día, mostrar un aviso con acceso directo para registrarla (atajo hacia `cash.tsx`) en vez de fallar sin explicación.
- `cash.tsx`: confirmar que el CRUD de `exchange_rates` ya cubre alta rápida de una tasa para una fecha puntual (hoy solo lista/consulta según `MODULOS.md`).

## Criterios de aceptación

- [ ] Crear una cuenta "Banco Santander USD" con `currency_code = 'USD'` dentro de una empresa cuya moneda base es CLP.
- [ ] Registrar un comprobante que debita esa cuenta en USD calcula automáticamente el equivalente en CLP usando la tasa del día del comprobante.
- [ ] Si no existe tasa para esa fecha exacta, el sistema avisa claramente en vez de usar una tasa antigua sin decirlo.
- [ ] Los reportes existentes (Balance, P&L) que leen `debit`/`credit` en moneda funcional siguen funcionando sin cambios, porque esas columnas siguen pobladas correctamente.

---

## Prompt listo para pegar en Lovable

```
Necesito que las cuentas contables puedan operar en una moneda distinta a la moneda base de la empresa (por ejemplo, una cuenta bancaria en USD dentro de una empresa cuya moneda base es CLP), y que los asientos registren el monto en ambas monedas.

1. Agrega la columna `currency_code` (text, FK a `currencies.code`, nullable) a `accounts`. Si es NULL, la cuenta usa la moneda base de la empresa (`entities.base_currency_code`).

2. Agrega a `journal_entry_lines` las columnas: `currency_code` (FK a currencies), `exchange_rate` (numeric 20,9, default 1), `debit_account_currency` (numeric 20,4), `credit_account_currency` (numeric 20,4).

3. Crea la función `get_exchange_rate(_origin text, _destination text, _date date)` que retorne 1 si origen = destino, busque la tasa exacta en `exchange_rates` para esa fecha, y lance una excepción clara si no existe (no uses una tasa antigua como fallback silencioso).

4. Crea un trigger BEFORE INSERT en `journal_entry_lines` que: determine la moneda efectiva de la cuenta (la suya propia o la de la empresa si es null), copie/complete `debit_account_currency`/`credit_account_currency` desde `debit`/`credit` si no vienen informados, y si la moneda de la cuenta es distinta a la de la empresa, recalcule `debit`/`credit` (moneda funcional) multiplicando el monto en moneda de cuenta por la tasa de cambio de la fecha del comprobante (usando `get_exchange_rate`). Si son la misma moneda, `exchange_rate = 1` y los montos quedan iguales en ambas columnas.

5. En el diálogo "Nueva Cuenta" de `accounting.tsx`, agrega un selector de moneda opcional (por defecto, "usar la moneda de la empresa").

6. En el formulario de comprobante (del Sprint 2), cuando la cuenta seleccionada en una línea tenga una moneda distinta a la de la empresa activa, muestra un campo para el monto en esa moneda extranjera y, de solo lectura al lado, el equivalente calculado en la moneda de la empresa usando la tasa de `exchange_rates` para la fecha del comprobante. Si no existe tasa para esa fecha, muestra un aviso con un botón para registrarla al instante (un modal simple que inserte en `exchange_rates`) en vez de dejar que la operación falle sin explicación.

Al terminar, documenta en `.md/CHANGELOG.md` y actualiza la sección de multimoneda en `.md/ARQUITECTURA.md`.
```
