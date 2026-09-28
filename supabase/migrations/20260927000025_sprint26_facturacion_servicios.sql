-- Sprint 26: Facturación de Servicios 3PL y Notas de Corrección
-- Agrega soporte para referenciar facturas anteriores (notas de crédito / débito de ajuste) en sales_invoices

ALTER TABLE public.sales_invoices
ADD COLUMN IF NOT EXISTS adjustment_of_invoice_id uuid REFERENCES public.sales_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoices_adjustment_of_invoice_id
ON public.sales_invoices(adjustment_of_invoice_id);

COMMENT ON COLUMN public.sales_invoices.adjustment_of_invoice_id IS 'ID de la factura original que este documento ajusta o corrige (nota de crédito/débito)';
