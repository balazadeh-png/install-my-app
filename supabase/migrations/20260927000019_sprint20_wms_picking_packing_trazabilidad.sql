-- Migration: Sprint 20 - WMS: Picking, Packing y Trazabilidad
-- Extensión de líneas de guía de despacho para tracking físico, salida de stock y trazabilidad de lotes

-- 1. Agregar columnas a dispatch_note_lines
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.warehouse_locations(id) ON DELETE SET NULL;
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS lot_number text;
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS picked boolean DEFAULT false NOT NULL;
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS packed boolean DEFAULT false NOT NULL;
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS picked_at timestamptz;
ALTER TABLE public.dispatch_note_lines ADD COLUMN IF NOT EXISTS packed_at timestamptz;

-- 2. Índices para acelerar consultas de picking, packing y búsqueda por lote (trazabilidad)
CREATE INDEX IF NOT EXISTS ix_dnl_location ON public.dispatch_note_lines(location_id);
CREATE INDEX IF NOT EXISTS ix_dnl_lot ON public.dispatch_note_lines(lot_number);
CREATE INDEX IF NOT EXISTS ix_dnl_picked ON public.dispatch_note_lines(picked);
CREATE INDEX IF NOT EXISTS ix_dnl_packed ON public.dispatch_note_lines(packed);
