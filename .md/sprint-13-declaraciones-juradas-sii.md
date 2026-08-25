# Sprint 13 — Declaraciones Juradas SII

**Fase:** 2 — Módulos Ampliados (último sprint del plan)
**Depende de:** Sprint 12 (declaración de impuestos — comparte la misma lógica de extracción de datos contables)

## Objetivo

Un motor **extensible** de Declaraciones Juradas — no una implementación fija de una o dos DJs específicas — porque existen varias decenas (1879, 1887, 1907, 1922/1923, 1929, 1946, 1947, 1962, entre otras) y cuáles aplican depende del régimen tributario y la actividad de cada empresa/cliente.

## Por qué

Programar cada DJ como una función a medida en el código de la aplicación no escala — cada año pueden agregarse o modificarse formularios, y tu cartera de clientes probablemente no necesita las mismas DJs entre sí. Un catálogo configurable, donde cada DJ define sus propios campos y de dónde sale cada uno (qué cuenta o grupo de terceros lo alimenta), te permite agregar declaraciones nuevas sin depender de otra ronda de desarrollo cada vez.

## Antes de construir esto

Decide con tu propio criterio de contador **con cuáles 2-3 DJs partir** según tu cartera real de clientes (por ejemplo, 1879 de honorarios es casi universal para una firma de servicios; otras dependen de si tus clientes tienen trabajadores dependientes, operaciones en el exterior, etc.). No tiene sentido pedirle a Lovable que programe las ~15 DJs existentes de una sola vez — este sprint construye el **motor**, y tú decides qué definiciones cargar primero.

## Alcance incluido

- `dj_definitions`: catálogo configurable de declaraciones (código, nombre, periodicidad, esquema de campos requeridos).
- `dj_field_mappings`: por empresa, qué cuenta contable o grupo de terceros alimenta cada campo de una DJ específica.
- `dj_generations`: una corrida de generación por empresa/DJ/año tributario, con los valores resultantes y un estado que exige revisión humana antes de considerarse presentada.
- Implementación de referencia: cargar la definición de 1-2 DJs comunes (a decidir contigo) para validar que el motor funciona de punta a punta.

## Fuera de alcance

- Presentación automática al SII (misma lógica que en el Sprint 12 — esto calcula y deja listo, no presenta).
- Cargar el catálogo completo de todas las DJs existentes — se agregan progresivamente según necesidad real.

## Cambios de esquema (sketch SQL)

```sql
CREATE TABLE IF NOT EXISTS public.dj_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dj_code text NOT NULL UNIQUE,      -- ej. '1879', '1887'
    name text NOT NULL,
    periodicity text NOT NULL DEFAULT 'anual',
    field_schema jsonb NOT NULL DEFAULT '{}', -- describe los campos que esta DJ requiere
    active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.dj_field_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    dj_definition_id uuid REFERENCES public.dj_definitions(id) NOT NULL,
    field_key text NOT NULL,           -- corresponde a una clave del field_schema
    source_account_id uuid REFERENCES public.accounts(id),
    source_party_group_id uuid REFERENCES public.party_groups(id),
    UNIQUE (entity_id, dj_definition_id, field_key)
);

CREATE TYPE public.dj_generation_status AS ENUM ('draft', 'reviewed', 'filed');

CREATE TABLE IF NOT EXISTS public.dj_generations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id) NOT NULL,
    dj_definition_id uuid REFERENCES public.dj_definitions(id) NOT NULL,
    tax_year integer NOT NULL,
    generated_values jsonb NOT NULL DEFAULT '{}',
    status public.dj_generation_status DEFAULT 'draft',
    generated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (entity_id, dj_definition_id, tax_year)
);
```

**Lógica de `generate_dj(entity_id, dj_code, tax_year)`:** lee los `dj_field_mappings` de esa empresa para la DJ indicada; por cada campo mapeado, suma los movimientos del año tributario en la cuenta o grupo de terceros configurado; arma `generated_values` como un objeto con todos los campos resueltos; crea el registro en `dj_generations` con estado `draft`.

## Cambios de UI/backend esperados

- Pantalla "Catálogo de Declaraciones Juradas": alta de una definición de DJ (código, nombre, periodicidad, campos requeridos) — pensada para que tú (o quien administre el sistema) agregue nuevas DJs sin depender de otra ronda de desarrollo.
- Pantalla "Configuración de DJ por Empresa": para cada DJ activa, mapear sus campos a cuentas contables o grupos de terceros de una empresa específica.
- Pantalla "Generación de DJ": elegir empresa, DJ y año tributario, botón "Generar", vista del resultado con el mismo flujo de estados `draft` → `reviewed` → `filed` del Sprint 12.

## Criterios de aceptación

- [ ] Se puede dar de alta una nueva definición de DJ (código, campos) sin tocar código de la aplicación.
- [ ] Mapear los campos de una DJ a las cuentas de una empresa específica permite generar sus valores automáticamente para un año tributario.
- [ ] El resultado queda en `draft` y exige revisión humana antes de marcarse como presentado.
- [ ] Agregar una segunda DJ al catálogo no requiere modificar las tablas ni las funciones ya construidas — solo cargar su definición y sus mapeos.

---

## Prompt listo para pegar en Lovable

```
Necesito un motor extensible de Declaraciones Juradas SII — un catálogo configurable, no una implementación fija de una sola DJ.

1. Crea `dj_definitions` (dj_code único, name, periodicity, field_schema jsonb, active) como catálogo de declaraciones.

2. Crea `dj_field_mappings` (entity_id, dj_definition_id, field_key, source_account_id, source_party_group_id), única por (entity_id, dj_definition_id, field_key) — define, por empresa, qué cuenta o grupo de terceros alimenta cada campo de una DJ.

3. Crea el enum `dj_generation_status` ('draft','reviewed','filed') y la tabla `dj_generations` (entity_id, dj_definition_id, tax_year, generated_values jsonb, status, generated_at), única por (entity_id, dj_definition_id, tax_year).

4. Crea la función `generate_dj(_entity_id uuid, _dj_definition_id uuid, _tax_year int)`: lee los mapeos de campos configurados para esa empresa y esa DJ, para cada uno suma los movimientos del año tributario en la cuenta o grupo de terceros mapeado, arma el resultado como un objeto en `generated_values`, y crea el registro en estado 'draft'.

5. Crea una pantalla "Catálogo de Declaraciones Juradas" para dar de alta definiciones de DJ (código, nombre, periodicidad, campos requeridos).

6. Crea una pantalla "Configuración de DJ por Empresa" para mapear los campos de una DJ activa a cuentas o grupos de terceros de una empresa específica.

7. Crea una pantalla "Generación de DJ": selector de empresa/DJ/año tributario, botón "Generar", vista del resultado con controles para pasar de 'draft' a 'reviewed' (solo accountant/admin) y de ahí a 'filed'.

8. Carga como datos de ejemplo la definición de la DJ 1879 (honorarios) con sus campos típicos, para validar que el motor funciona de punta a punta — no cargues el catálogo completo de todas las DJs existentes.

Aplica RLS multiempresa. Al terminar, documenta en `.md/CHANGELOG.md` y agrega el módulo a `.md/MODULOS.md` y `.md/ARQUITECTURA.md`. Con esto se completa el plan de la Fase 2 del RoadMap.
```
