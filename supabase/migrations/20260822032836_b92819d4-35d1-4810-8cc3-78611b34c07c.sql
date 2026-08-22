INSERT INTO public.user_roles (user_id, role)
VALUES ('5877f5d4-a90d-4382-a03b-3e53d3de89cb', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;