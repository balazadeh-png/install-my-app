DO $do$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.seed_demo_base(date)'::regprocedure);
  src := replace(src, 'SELECT DISTINCT ur.user_id, e, ''admin'', false', 'SELECT DISTINCT ur.user_id, e, ''admin''::public.app_role, false');
  EXECUTE src;
  src := pg_get_functiondef('public.seed_demo_month(uuid, date)'::regprocedure);
  src := replace(src, 'CASE WHEN is_current THEN ''en_curso'' ELSE ''finalizada'' END,', '(CASE WHEN is_current THEN ''en_curso'' ELSE ''finalizada'' END)::public.route_status,');
  EXECUTE src;
END $do$;