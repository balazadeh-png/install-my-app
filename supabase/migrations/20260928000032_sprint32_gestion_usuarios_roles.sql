-- ============================================================================
-- Sprint 32: Gestión Integral de Usuarios, Roles y Seguridad Multiempresa
-- EasyERP — Administración granular de accesos, credenciales y empresas
-- ============================================================================

-- 0. Garantizar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Asegurar función has_role con soporte bootstrap para primer admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
    OR (
      _role = 'admin'::public.app_role
      AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- 2. Asegurar que el módulo de 'roles' figure en la tabla modules para el Dashboard
INSERT INTO public.modules (name, label, group_name, active)
VALUES ('roles', 'Usuarios y Roles', 'Configuración', true)
ON CONFLICT (name) DO UPDATE 
SET label = EXCLUDED.label, 
    group_name = EXCLUDED.group_name,
    active = true;

-- 3. Función RPC: admin_get_users_list
-- Retorna lista completa de usuarios con perfil, rol y acceso multiempresa
DROP FUNCTION IF EXISTS public.admin_get_users_list();
CREATE OR REPLACE FUNCTION public.admin_get_users_list()
RETURNS TABLE (
    id uuid,
    email text,
    full_name text,
    user_name text,
    active boolean,
    created_at timestamptz,
    role public.app_role,
    companies jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Verificar rol administrador
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores pueden ver la lista de usuarios' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT 
        u.id,
        u.email::text,
        COALESCE(p.full_name, (u.raw_user_meta_data->>'full_name')::text, split_part(u.email, '@', 1))::text AS full_name,
        COALESCE(p.user_name, split_part(u.email, '@', 1))::text AS user_name,
        COALESCE(p.active, true) AS active,
        u.created_at,
        COALESCE(ur.role, 'viewer'::public.app_role) AS role,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'entity_id', cu.entity_id,
                        'entity_name', e.name,
                        'entity_code', e.code,
                        'role', cu.role,
                        'is_default', cu.is_default
                    ) ORDER BY e.name
                )
                FROM public.company_users cu
                JOIN public.entities e ON e.id = cu.entity_id
                WHERE cu.user_id = u.id
            ),
            '[]'::jsonb
        ) AS companies
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN (
        SELECT DISTINCT ON (user_id) user_id, role
        FROM public.user_roles
        ORDER BY user_id, 
            CASE role 
                WHEN 'admin' THEN 1 
                WHEN 'accountant' THEN 2 
                WHEN 'sales' THEN 3 
                WHEN 'purchasing' THEN 4 
                WHEN 'inventory' THEN 5 
                ELSE 6 
            END
    ) ur ON ur.user_id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_users_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users_list() TO authenticated;

-- 4. Función RPC: admin_create_user
-- Crea un usuario completo en auth.users, profiles, user_roles y company_users
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, public.app_role, uuid[], uuid);
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email text,
    p_password text,
    p_full_name text,
    p_role public.app_role DEFAULT 'accountant',
    p_company_ids uuid[] DEFAULT '{}',
    p_default_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_email text;
    v_user_id uuid;
    v_entity_id uuid;
    v_first_company uuid;
    v_encrypted_pw text;
    v_username text;
BEGIN
    -- Validar administrador
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores pueden crear usuarios' USING ERRCODE = '42501';
    END IF;

    -- Validaciones de entrada
    v_clean_email := lower(trim(p_email));
    IF v_clean_email IS NULL OR v_clean_email = '' OR position('@' in v_clean_email) = 0 THEN
        RAISE EXCEPTION 'Correo electrónico inválido';
    END IF;

    IF length(p_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe contener al menos 6 caracteres';
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
        RAISE EXCEPTION 'El correo % ya se encuentra registrado en el sistema', v_clean_email;
    END IF;

    v_user_id := gen_random_uuid();
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));
    v_username := lower(split_part(v_clean_email, '@', 1)) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);

    -- Determinar empresa por defecto
    IF p_default_company_id IS NOT NULL THEN
        v_first_company := p_default_company_id;
    ELSIF array_length(p_company_ids, 1) > 0 THEN
        v_first_company := p_company_ids[1];
    ELSE
        SELECT id INTO v_first_company FROM public.entities WHERE active = true ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- Insertar en auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_user_id,
        'authenticated',
        'authenticated',
        v_clean_email,
        v_encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', p_full_name),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    -- Insertar en auth.identities (id es de tipo uuid en Supabase)
    BEGIN
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
            'email',
            v_user_id::text,
            NULL,
            now(),
            now()
        )
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Insertar en public.profiles
    INSERT INTO public.profiles (
        id,
        user_name,
        full_name,
        email,
        active,
        active_entity_id,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_username,
        p_full_name,
        v_clean_email,
        true,
        v_first_company,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        active = true,
        active_entity_id = COALESCE(profiles.active_entity_id, EXCLUDED.active_entity_id);

    -- Asignar rol en user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Asignar acceso granular a empresas
    IF array_length(p_company_ids, 1) > 0 THEN
        FOREACH v_entity_id IN ARRAY p_company_ids LOOP
            INSERT INTO public.company_users (user_id, entity_id, role, is_default)
            VALUES (
                v_user_id, 
                v_entity_id, 
                p_role, 
                (v_entity_id = v_first_company)
            )
            ON CONFLICT (user_id, entity_id) DO UPDATE 
            SET role = EXCLUDED.role, is_default = EXCLUDED.is_default;
        END LOOP;
    ELSIF v_first_company IS NOT NULL THEN
        INSERT INTO public.company_users (user_id, entity_id, role, is_default)
        VALUES (v_user_id, v_first_company, p_role, true)
        ON CONFLICT (user_id, entity_id) DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_clean_email,
        'message', 'Usuario creado exitosamente'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, public.app_role, uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, public.app_role, uuid[], uuid) TO authenticated;

-- 5. Función RPC: admin_reset_user_password
DROP FUNCTION IF EXISTS public.admin_reset_user_password(uuid, text);
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
    p_user_id uuid,
    p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores pueden resetear contraseñas' USING ERRCODE = '42501';
    END IF;

    IF length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe contener al menos 6 caracteres';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'El usuario indicado no existe';
    END IF;

    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Contraseña restablecida correctamente');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;

-- 6. Función RPC: admin_toggle_user_active
DROP FUNCTION IF EXISTS public.admin_toggle_user_active(uuid, boolean);
CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
    p_user_id uuid,
    p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores pueden cambiar el estado del usuario' USING ERRCODE = '42501';
    END IF;

    IF p_user_id = auth.uid() AND NOT p_active THEN
        RAISE EXCEPTION 'No puedes desactivar tu propia cuenta de administrador';
    END IF;

    UPDATE public.profiles
    SET active = p_active,
        updated_at = now()
    WHERE id = p_user_id;

    UPDATE auth.users
    SET banned_until = CASE WHEN p_active THEN NULL ELSE '2099-01-01 00:00:00+00'::timestamptz END,
        updated_at = now()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'active', p_active);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_toggle_user_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean) TO authenticated;

-- 7. Función RPC: admin_delete_user
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);
CREATE OR REPLACE FUNCTION public.admin_delete_user(
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores pueden eliminar usuarios' USING ERRCODE = '42501';
    END IF;

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'No puedes eliminar tu propia cuenta de administrador';
    END IF;

    -- Eliminar referencias en orden
    DELETE FROM public.company_users WHERE user_id = p_user_id;
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
    DELETE FROM public.profiles WHERE id = p_user_id;
    DELETE FROM auth.identities WHERE user_id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado permanentemente');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- 8. Función RPC: admin_update_user_role
DROP FUNCTION IF EXISTS public.admin_update_user_role(uuid, public.app_role);
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    p_user_id uuid,
    p_new_role public.app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores pueden modificar roles' USING ERRCODE = '42501';
    END IF;

    -- Reemplazar rol en user_roles
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_new_role);

    -- Actualizar role por defecto en company_users
    UPDATE public.company_users
    SET role = p_new_role
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'role', p_new_role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, public.app_role) TO authenticated;

-- 9. Función RPC: admin_set_user_companies
DROP FUNCTION IF EXISTS public.admin_set_user_companies(uuid, jsonb, uuid);
CREATE OR REPLACE FUNCTION public.admin_set_user_companies(
    p_user_id uuid,
    p_company_assignments jsonb,
    p_default_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_item jsonb;
    v_entity_id uuid;
    v_role public.app_role;
    v_is_default boolean;
    v_default_set boolean := false;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acceso denegado: solo administradores pueden asignar empresas' USING ERRCODE = '42501';
    END IF;

    -- Limpiar asignaciones previas
    DELETE FROM public.company_users WHERE user_id = p_user_id;

    -- Insertar nuevas
    IF p_company_assignments IS NOT NULL AND jsonb_array_length(p_company_assignments) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_company_assignments) LOOP
            v_entity_id := (v_item->>'entity_id')::uuid;
            v_role := COALESCE((v_item->>'role')::public.app_role, 'accountant'::public.app_role);
            v_is_default := COALESCE((v_item->>'is_default')::boolean, false);

            IF p_default_company_id IS NOT NULL AND v_entity_id = p_default_company_id THEN
                v_is_default := true;
                v_default_set := true;
            END IF;

            INSERT INTO public.company_users (user_id, entity_id, role, is_default)
            VALUES (p_user_id, v_entity_id, v_role, v_is_default)
            ON CONFLICT (user_id, entity_id) DO UPDATE
            SET role = EXCLUDED.role, is_default = EXCLUDED.is_default;
        END LOOP;

        IF NOT v_default_set THEN
            UPDATE public.company_users
            SET is_default = true
            WHERE id = (SELECT id FROM public.company_users WHERE user_id = p_user_id ORDER BY created_at ASC LIMIT 1);
        END IF;

        UPDATE public.profiles
        SET active_entity_id = (SELECT entity_id FROM public.company_users WHERE user_id = p_user_id AND is_default = true LIMIT 1)
        WHERE id = p_user_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Empresas actualizadas correctamente');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_companies(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_companies(uuid, jsonb, uuid) TO authenticated;
