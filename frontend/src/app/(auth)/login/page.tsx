"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";

export default function LoginPage() {
  const { setAuth, setUser } = useAuthStore();
  const router = useRouter();

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      const tokens = await authService.login(data);
      const user = await authService.me();
      setAuth(user, tokens.access_token, tokens.refresh_token);
      router.push("/dashboard");
    } catch {
      setError("root", { message: "Credenciais inválidas" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border shadow-sm p-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">Espaço IA</span>
        </div>

        <h1 className="text-2xl font-bold text-center mb-6">Entrar</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">E-mail</label>
            <Input type="email" placeholder="seu@email.com" {...register("email")} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Senha</label>
            <Input type="password" placeholder="••••••" {...register("password")} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          {errors.root && <p className="text-red-500 text-sm text-center">{errors.root.message}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Não tem conta?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">Criar conta</Link>
        </p>
      </div>
    </div>
  );
}
