# Sprint 17 — Comercio Exterior (SICEX)

**Fase:** 3 — Vertical 3PL / Cumplimiento
**Depende de:** Sprint 16 (`dispatch_notes`, `parties.is_3pl_client`)
**Bloquea a:** ninguno de forma dura — mejora el Sprint 18

## Objetivo

Registrar operaciones de comercio exterior (exportación/importación) de un cliente 3PL, asociadas opcionalmente a una guía de despacho, y dejar el modelo listo para conectar con SICEX cuando se resuelva el acceso.

## ⚠️ Dependencia externa (misma naturaleza que el DTE, distinta de esa)

La conexión real a SICEX exige que Aduanas autorice el acceso (usuario habilitado en el sistema, certificado digital de la empresa). Es un trámite administrativo, no solo técnico. Este sprint deja el modelo de datos y el gancho (`dus_number`, `customs_status`) — no hay llamada real a ningún servicio de SICEX todavía.

## Alcance incluido

- `foreign_trade_operations`: operación de comercio exterior, opcionalmente ligada a una `dispatch_notes`.
- `foreign_trade_certificates`: certificados fito/zoosanitarios, de origen, u otros, con vigencia.
- Pestaña "Comercio Exterior" (puede vivir dentro de `dispatch.tsx` como cuarta pestaña, o como ruta separada `comercio-exterior.tsx` si `dispatch.tsx` ya se siente muy cargado).

## Fuera de alcance

- Envío real a SICEX / DUS autorizado — depende de la habilitación de Aduanas.

## Cambios de esquema (sketch SQL)

```sql
CREATE TYPE public.ft_operation_type AS ENUM ('exportacion', 'importacion');
CREATE TYPE public.ft_customs_status AS ENUM ('pendiente', 'tramitando', 'autorizado', 'rechazado');

CREATE TABLE IF NOT EXISTS public.foreign_trade_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    party_id uuid REFERENCES public.parties(id) NOT NULL,
    dispatch_note_id uuid REFERENCES public.dispatch_notes(id),
    operation_type public.ft_operation_type NOT NULL,
    country_code text,
    dus_number text,
    customs_status public.ft_customs_status NOT NULL DEFAULT 'pendiente',
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.foreign_trade_certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id uuid REFERENCES public.foreign_trade_operations(id) ON DELETE CASCADE NOT NULL,
    certificate_type text NOT NULL,
    certificate_number text,
    issued_by text,
    valid_until date,
    created_at timestamptz DEFAULT now() NOT NULL
);
```

## Criterios de aceptación

- [ ] Se puede registrar una operación de comercio exterior para un cliente 3PL, ligada opcionalmente a una guía de despacho existente.
- [ ] Se pueden adjuntar certificados con número y vigencia.
- [ ] Todo queda en `customs_status = 'pendiente'` — ningún envío real a SICEX.

---

## Prompt listo para pegar en Lovable

```
Voy a agregar registro de operaciones de comercio exterior para clientes 3PL, sin conexión real a SICEX todavía (eso depende de un trámite de Aduanas, no de código).

1. Crea los enums ft_operation_type ('exportacion','importacion') y ft_customs_status ('pendiente','tramitando','autorizado','rechazado').

2. Crea foreign_trade_operations (entity_id, party_id NOT NULL, dispatch_note_id nullable FK a dispatch_notes, operation_type, country_code, dus_number, customs_status default 'pendiente', created_at).

3. Crea foreign_trade_certificates (operation_id FK on delete cascade, certificate_type, certificate_number, issued_by, valid_until date, created_at).

4. Agrega una cuarta pestaña "Comercio Exterior" en dispatch.tsx: formulario para crear una operación (cliente 3PL, tipo, país, guía de despacho opcional) y una lista de certificados adjuntos por operación (tipo, número, vigencia). No agregues ningún botón de "enviar a SICEX".

Aplica RLS multiempresa normal (patrón user_has_company_access) a ambas tablas. Documenta en .md/CHANGELOG.md y actualiza .md/ARQUITECTURA.md y .md/MODULOS.md.
```
