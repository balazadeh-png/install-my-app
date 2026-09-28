DO $do$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.seed_demo_base(date)'::regprocedure);
  src := replace(src, 'SELECT e, p.id, w.id FROM (VALUES', 'SELECT e, pp.id, ww.id FROM (VALUES');
  src := replace(src, 'JOIN public.parties p ON p.entity_id = e AND p.tax_id = v.tax
  JOIN public.warehouses w ON w.entity_id = e AND w.code = v.wh;', 'JOIN public.parties pp ON pp.entity_id = e AND pp.tax_id = v.tax
  JOIN public.warehouses ww ON ww.entity_id = e AND ww.code = v.wh;');
  EXECUTE src;
END $do$;