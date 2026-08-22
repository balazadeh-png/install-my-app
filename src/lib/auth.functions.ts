import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "admin" | "accountant" | "sales" | "purchasing" | "inventory" | "viewer";

export const getCurrentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    return profile ?? null;
  });

export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_name: z.string().min(2).max(50),
        full_name: z.string().optional(),
      })
      .parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const email = user.email;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (existing) {
      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          user_name: data.user_name,
          full_name: data.full_name ?? null,
          email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return updated;
    }

    const { data: created, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        user_name: data.user_name,
        full_name: data.full_name ?? null,
        email,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return created;
  });

export const getUserRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.role);
  });

export const getModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("active", true)
      .order("label");

    if (error) throw new Error(error.message);
    return data ?? [];
  });
