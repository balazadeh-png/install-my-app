-- ==============================================================================
-- SPRINT 30a: Nuevos Tipos de Tarifa de Almacenaje 3PL
-- Separado en su propia migración porque Postgres no permite usar un nuevo valor
-- de enum en la misma transacción donde es agregado con ALTER TYPE.
-- ==============================================================================

ALTER TYPE public.service_rate_type ADD VALUE IF NOT EXISTS 'storage_m3';
ALTER TYPE public.service_rate_type ADD VALUE IF NOT EXISTS 'storage_unit';
