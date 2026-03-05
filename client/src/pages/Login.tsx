import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { Sparkles, ArrowLeft, Shield, Zap, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) setLocation("/");
  }, [isAuthenticated, setLocation]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Espaço IA</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Info */}
          <div className="hidden lg:block">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao início
            </Link>
            <h1 className="text-4xl font-extrabold mb-4 leading-tight">
              Acesse a plataforma de <span className="text-primary">Agentes de IA</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Entre com sua conta para acessar os 6 agentes especializados e transformar seu negócio.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-0.5">6 Agentes Especializados</h3>
                  <p className="text-sm text-muted-foreground">Da ideação à prototipagem, cada etapa do seu projeto coberta.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-0.5">Seguro e Confiável</h3>
                  <p className="text-sm text-muted-foreground">Seus dados protegidos com autenticação segura via OAuth.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-0.5">Planos Flexíveis</h3>
                  <p className="text-sm text-muted-foreground">Comece grátis e evolua conforme sua necessidade.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Login Card */}
          <div>
            <Card className="shadow-lg border-2">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-14 h-14 rounded-2xl gradient-hero flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <CardTitle className="text-2xl">Entrar no Espaço IA</CardTitle>
                <CardDescription className="text-base">
                  Escolha como deseja acessar a plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {/* Manus OAuth (primary) */}
                <Button asChild size="lg" className="w-full h-12 text-base font-semibold">
                  <a href={getLoginUrl()}>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Entrar com Manus
                  </a>
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground">ou continue com</span>
                  </div>
                </div>

                {/* Google */}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-12 text-base font-medium"
                  asChild
                >
                  <a href={getLoginUrl()}>
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Entrar com Google
                  </a>
                </Button>

                {/* GitHub */}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-12 text-base font-medium"
                  asChild
                >
                  <a href={getLoginUrl()}>
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Entrar com GitHub
                  </a>
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-6 leading-relaxed">
                  Ao entrar, você concorda com nossos Termos de Uso e Política de Privacidade.
                  Seus dados são registrados de forma segura em nossa plataforma.
                </p>
              </CardContent>
            </Card>

            <p className="text-center text-sm text-muted-foreground mt-4 lg:hidden">
              <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao início
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
