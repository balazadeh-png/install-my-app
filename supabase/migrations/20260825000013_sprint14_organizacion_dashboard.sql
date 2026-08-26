-- ============================================================================
-- Sprint 14: Reorganización del Dashboard por Grupos Temáticos
-- ============================================================================

-- 1. Agregar columnas de agrupación y ordenamiento a la tabla modules
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS group_sort_order integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0 NOT NULL;

-- 2. Asignar Módulos a los 4 Grupos Temáticos Oficiales:

-- Grupo 1: Finanzas (group_sort_order = 1)
UPDATE public.modules 
SET group_name = 'Finanzas', group_sort_order = 1, sort_order = 1, active = true 
WHERE name = 'accounting';

UPDATE public.modules 
SET group_name = 'Finanzas', group_sort_order = 1, sort_order = 2, active = true 
WHERE name = 'cash';

UPDATE public.modules 
SET group_name = 'Finanzas', group_sort_order = 1, sort_order = 3, active = true 
WHERE name = 'assets';

UPDATE public.modules 
SET group_name = 'Finanzas', group_sort_order = 1, sort_order = 4, active = true 
WHERE name = 'reports';

-- Grupo 2: Operaciones (group_sort_order = 2)
UPDATE public.modules 
SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 1, active = true 
WHERE name = 'purchases';

UPDATE public.modules 
SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 2, active = true 
WHERE name = 'sales';

UPDATE public.modules 
SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 3, active = true 
WHERE name = 'inventory';

UPDATE public.modules 
SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 4, active = true 
WHERE name = 'production';

UPDATE public.modules 
SET group_name = 'Operaciones', group_sort_order = 2, sort_order = 5, active = true 
WHERE name = 'pos';

-- Grupo 3: Impuestos (group_sort_order = 3)
UPDATE public.modules 
SET group_name = 'Impuestos', group_sort_order = 3, sort_order = 1, active = true 
WHERE name IN ('declaraciones_juradas', 'declaraciones-juradas');

UPDATE public.modules 
SET group_name = 'Impuestos', group_sort_order = 3, sort_order = 2, active = true 
WHERE name IN ('sii_books', 'sii-books');

UPDATE public.modules 
SET group_name = 'Impuestos', group_sort_order = 3, sort_order = 3, active = true 
WHERE name = 'taxes';

-- Grupo 4: Configuración (group_sort_order = 4)
UPDATE public.modules 
SET group_name = 'Configuración', group_sort_order = 4, sort_order = 1, active = true 
WHERE name = 'setup';
