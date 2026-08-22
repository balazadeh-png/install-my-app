import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { ensureProfile, assignAdminIfFirst } from "@/lib/auth.functions";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Iniciar sesión | Cacao Accounting" },
      { name: "description", content: "Inicia sesión o crea una cuenta en Cacao Accounting." },
      { property: "og:title", content: "Iniciar sesión | Cacao Accounting" },
      { property: "og:description", content: "Inicia sesión o crea una cuenta en Cacao Accounting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AuthPage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && isAuthenticated) {
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Cacao Accounting</CardTitle>
          <CardDescription>
            Sistema contable y administrativo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="register">Crear cuenta</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm />
            </TabsContent>
            <TabsContent value="register">
              <RegisterForm />
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">O continúa con</span>
            </div>
          </div>

          <GoogleSignInButton />
        </CardContent>
      </Card>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const ensureProfileFn = useServerFn(ensureProfile);
  const assignAdminFn = useServerFn(assignAdminIfFirst);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        const metadata = user.user_metadata || {};
        const username = metadata["user_name"] || email.split("@")[0];
        await ensureProfileFn({
          data: {
            user_name: username,
            full_name: metadata["full_name"] || "",
          },
        });
        await assignAdminFn({ data: {} });
      }
    } catch (err) {
      console.error(err);
    }

    setBusy(false);
    navigate({ to: "/dashboard" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Correo electrónico</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="tu@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Contraseña</Label>
        <Input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Iniciar sesión
      </Button>
    </form>
  );
}

function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const ensureProfileFn = useServerFn(ensureProfile);
  const assignAdminFn = useServerFn(assignAdminIfFirst);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_name: userName,
          full_name: fullName,
        },
      },
    });

    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    if (data.user) {
      try {
        await ensureProfileFn({
          data: {
            user_name: userName,
            full_name: fullName,
          },
        });
        await assignAdminFn({ data: {} });
      } catch (err) {
        console.error(err);
      }

      toast.success("Cuenta creada. Bienvenido a Cacao Accounting.");
      setBusy(false);
      navigate({ to: "/dashboard" });
    } else {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="register-email">Correo electrónico</Label>
        <Input
          id="register-email"
          type="email"
          placeholder="tu@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-username">Nombre de usuario</Label>
        <Input
          id="register-username"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-fullname">Nombre completo</Label>
        <Input
          id="register-fullname"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">Contraseña</Label>
        <Input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Crear cuenta
      </Button>
    </form>
  );
}

function GoogleSignInButton() {
  const navigate = useNavigate();
  const ensureProfileFn = useServerFn(ensureProfile);
  const assignAdminFn = useServerFn(assignAdminIfFirst);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });

    if (result.error) {
      setBusy(false);
      toast.error(result.error.message);
      return;
    }

    if (result.redirected) {
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      const metadata = user.user_metadata || {};
      const email = user.email || "";
      const username = metadata["user_name"] || email.split("@")[0] || "usuario";
      try {
        await ensureProfileFn({
          data: {
            user_name: username,
            full_name: metadata["full_name"] || "",
          },
        });
        await assignAdminFn({ data: {} });
      } catch (err) {
        console.error(err);
      }
    }

    setBusy(false);
    navigate({ to: "/dashboard" });
  }

  return (
    <Button variant="outline" className="w-full" onClick={handleClick} disabled={busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Google
    </Button>
  );
}
