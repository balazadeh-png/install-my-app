# Sprint 14 — Reorganización del Dashboard por Grupos

**Fase:** Post Fase 2 — Refinamiento de UX
**Depende de:** Todos los módulos ya implementados (confirmaste Fase 1 + Fase 2 completas)

## Objetivo

Reemplazar la grilla plana y alfabética de módulos del Dashboard por 4 secciones temáticas — Finanzas, Operaciones, Impuestos, Configuración — en el orden y agrupación que definiste.

## Por qué

Hoy `getModules()` ordena estrictamente por `label`, que es exactamente lo que se ve en tu captura: Activos Fijos, Bancos/Tesorería, Compras... todo mezclado alfabéticamente sin ninguna lógica de negocio. Con los 13 módulos ya en producción, ese orden deja de ser útil — mezcla lo financiero, lo operativo y lo tributario sin criterio.

## Alcance incluido

- Columnas nuevas en `modules`: `group_name`, `group_sort_order` (orden del grupo) y `sort_order` (orden dentro del grupo).
- Reasignación de los 13 módulos existentes a los 4 grupos, en el orden exacto que especificaste.
- `getModules()` pasa a ordenar por grupo y luego por orden interno, en vez de por `label`.
- El Dashboard agrupa el resultado (ya viene ordenado) y renderiza una sección con encabezado por grupo, reutilizando la misma Card que ya tienes — no se rediseña la card individual.
- Diseño data-driven a propósito: los módulos de gestión de accesos que planeas agregar más adelante bajo Configuración solo necesitan insertarse en `modules` con `group_name = 'Configuracion'` — aparecen solos, sin tocar el Dashboard de nuevo.

## Fuera de alcance

- Los módulos de gestión y granularidad de acceso en sí — los mencionas como algo para más adelante; este sprint solo deja la estructura lista para recibirlos.

## Cambios de esquema (sketch SQL)

```sql
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS group_sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Finanzas
UPDATE public.modules SET group_name = 'Finanzas', group_sort_order = 1, sort_order = 1 WHERE name = 'accounting';
UPDATE public.modules SET group_name = 'Finanzas', group_sort_order = 1, sort_order = 2 WHERE name = 'cash';
UPDATE public.modules SET group_name = 'Finanzas', group_sort_order = 1, sort_order = 3 WHERE name = 'assets';
UPDATE public.modules SET group_name = 'Finanzas', group_sort_order = 1, sort_order = 4 WHERE name = 'reports';

-- Operaciones
UPDATE public.modules SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 1 WHERE name = 'purchases';
UPDATE public.modules SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 2 WHERE name = 'sales';
UPDATE public.modules SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 3 WHERE name = 'inventory';
UPDATE public.modules SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 4 WHERE name = 'production';
UPDATE public.modules SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 5 WHERE name = 'pos';

-- Impuestos
UPDATE public.modules SET group_name = 'Impuestos', group_sort_order = 3, sort_order = 1 WHERE name IN ('declaraciones-juradas','declaraciones_juradas');
UPDATE public.modules SET group_name = 'Impuestos', group_sort_order = 3, sort_order = 2 WHERE name IN ('sii-books','sii_books');
UPDATE public.modules SET group_name = 'Impuestos', group_sort_order = 3, sort_order = 3 WHERE name = 'taxes';

-- Configuración
UPDATE public.modules SET group_name = 'Configuracion', group_sort_order = 4, sort_order = 1 WHERE name = 'setup';
```

> Tu `moduleConfig` en `dashboard.tsx` ya contempla dos variantes de nombre para Declaraciones Juradas (`declaraciones-juradas` / `declaraciones_juradas`) y Libros SII (`sii-books` / `sii_books`) — antes de correr los `UPDATE` de Impuestos, confirma cuál es el valor real en la tabla y descarta la rama que no aplique.

## Cambios de UI/backend esperados

- `getModules()` en `src/lib/auth.functions.ts`: cambiar `.order("label")` por `.order("group_sort_order").order("sort_order")`.
- `dashboard.tsx`: agrupar el arreglo `modules` (ya ordenado) por `group_name`, y renderizar una sección por grupo — encabezado con el nombre del grupo (más un ícono de `lucide-react`, ya importado en ese archivo: `Landmark` para Finanzas, `Factory` para Operaciones, `FileBadge2` para Impuestos, `Settings` para Configuración) seguido de la misma grilla de `Card` que ya existe.
- Cualquier módulo sin `group_name` asignado cae en una sección final "Otros", en vez de desaparecer silenciosamente.

## Criterios de aceptación

- [ ] El Dashboard muestra 4 secciones — Finanzas, Operaciones, Impuestos, Configuración — en ese orden.
- [ ] Dentro de cada sección, los módulos aparecen en el orden exacto que especificaste.
- [ ] Insertar un módulo nuevo con `group_name = 'Configuracion'` lo hace aparecer ahí automáticamente, sin tocar código del Dashboard.
- [ ] El diseño de cada card individual no cambia — solo cambia cómo se agrupan y ordenan.

---

## Prompt listo para pegar en Lovable

```
Necesito reorganizar el Dashboard: hoy `getModules()` trae los módulos ordenados solo por `label` (alfabético) y el Dashboard los muestra todos juntos en una sola grilla. Quiero agruparlos en 4 secciones con encabezado, en este orden y con estos módulos:

- Finanzas: Contabilidad (accounting), Bancos/Tesorería (cash), Activos Fijos (assets), Reportes (reports)
- Operaciones: Compras (purchases), Ventas (sales), Inventario (inventory), Producción (production), Punto de Venta (pos)
- Impuestos: Declaraciones Juradas SII (declaraciones-juradas), Libros Legales SII (sii-books), Impuestos F29/F22 (taxes)
- Configuración: Configuración (setup) — esta sección va a recibir más módulos más adelante (gestión de accesos de usuarios por empresa/módulo, auditoría), así que el diseño debe soportar que aparezcan módulos nuevos aquí sin tocar código.

1. Agrega las columnas `group_name` (text), `group_sort_order` (integer, default 0) y `sort_order` (integer, default 0) a la tabla `modules`.

2. Actualiza las filas existentes de `modules` asignando `group_name`, `group_sort_order` (Finanzas=1, Operaciones=2, Impuestos=3, Configuracion=4) y `sort_order` (la posición dentro de su grupo, según el orden de arriba) a cada módulo. Antes de los UPDATE de Impuestos, revisa si el `name` real usa guion o guion bajo para "declaraciones-juradas"/"declaraciones_juradas" y "sii-books"/"sii_books" — vi ambas variantes contempladas en el `moduleConfig` del Dashboard — y usa la que corresponda en tu base.

3. En `getModules()` (`src/lib/auth.functions.ts`), cambia `.order("label")` por `.order("group_sort_order").order("sort_order")`.

4. En `dashboard.tsx`, agrupa el arreglo `modules` que ya viene ordenado (por su `group_name`, sin reordenar en el frontend) y renderiza una sección por grupo en vez de una sola grilla: un encabezado con el nombre del grupo y un ícono de `lucide-react` ya disponible en el archivo (Landmark para Finanzas, Factory para Operaciones, FileBadge2 para Impuestos, Settings para Configuración), seguido de la misma grilla de Card que ya existe para los módulos de ese grupo. No cambies el diseño de cada card individual, solo la agrupación.

5. Si algún módulo queda sin `group_name` asignado, muéstralo en una sección final "Otros" en vez de que desaparezca silenciosamente.

Al terminar, documenta el cambio en `.md/CHANGELOG.md`.
```
