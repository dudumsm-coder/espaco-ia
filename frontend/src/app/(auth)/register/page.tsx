"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap } from "lucide-react";

export default function RegisterPage() {
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    try {
      const tokens = await authService.register({ name: data.name, email: data.email, password: data.password });
      const user = await authService.me();
      setAuth(user, tokens.access_token, tokens.refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Erro ao criar conta";
      setError("root", { message: msg });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border shadow-sm p-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">Espaço IA</span>
        </div>

        <h1 className="text-2xl font-bold text-center mb-6">Criar conta</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {[
            { name: "name" as const, label: "Nome", type: "text", placeholder: "Seu nome" },
            { name: "email" as const, label: "E-mail", type: "email", placeholder: "seu@email.com" },
            { name: "password" as const, label: "Senha", type: "password", placeholder: "••••••" },
            { name: "confirmPassword" as const, label: "Confirmar senha", type: "password", placeholder: "••••••" },
          ].map(({ name, label, type, placeholder }) => (
            <div key={name}>
              <label className="text-sm font-medium mb-1 block">{label}</label>
              <Input type={type} placeholder={placeholder} {...register(name)} />
              {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]?.message}</p>}
            </div>
          ))}

          {errors.root && <p className="text-red-500 text-sm text-center">{errors.root.message}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar conta grátis"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
