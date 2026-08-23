-- ============================================================================
-- Migración: Actualización de Moneda Base a CLP (Pesos Chilenos)
-- ============================================================================

-- 1. Configurar CLP como moneda predeterminada en la tabla currencies
INSERT INTO public.currencies (code, name, decimals, is_default, active)
VALUES ('CLP', 'Peso Chileno', 0, true, true)
ON CONFLICT (code) DO UPDATE
SET is_default = true, name = 'Peso Chileno', decimals = 0, active = true;

-- 2. Asegurar que otras monedas no queden marcadas como default
UPDATE public.currencies
SET is_default = false
WHERE code != 'CLP';

-- 3. Asegurar moneda extranjera USD para operaciones multimoneda
INSERT INTO public.currencies (code, name, decimals, is_default, active)
VALUES ('USD', 'Dólar Estadounidense', 2, false, true)
ON CONFLICT (code) DO NOTHING;

-- 4. Actualizar zona horaria por defecto en profiles para Chile
ALTER TABLE public.profiles
ALTER COLUMN timezone SET DEFAULT 'America/Santiago';

-- 5. Actualizar entidades existentes con moneda base CLP
UPDATE public.entities
SET currency = 'CLP'
WHERE currency = 'NIO';

-- 6. Actualizar asientos contables que hayan quedado con NIO
UPDATE public.gl_entries
SET currency = 'CLP'
WHERE currency = 'NIO';
