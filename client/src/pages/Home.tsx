import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { AGENTS } from "@shared/types";
import {
  Mic, Lightbulb, Search, ClipboardList, FileText, Layers,
  Sparkles, ArrowRight, LogOut, LayoutDashboard, User, Crown,
  Menu, X,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const iconMap: Record<string, React.ElementType> = {
  Mic, Lightbulb, Search, ClipboardList, FileText, Layers,
};

const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  blue:    { bg: "bg-blue-50",    text: "text-blue-600",    border: "hover:border-blue-300",    iconBg: "bg-blue-100" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-600",   border: "hover:border-amber-300",   iconBg: "bg-amber-100" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "hover:border-emerald-300", iconBg: "bg-emerald-100" },
  violet:  { bg: "bg-violet-50",  text: "text-violet-600",  border: "hover:border-violet-300",  iconBg: "bg-violet-100" },
  rose:    { bg: "bg-rose-50",    text: "text-rose-600",    border: "hover:border-rose-300",    iconBg: "bg-rose-100" },
  cyan:    { bg: "bg-cyan-50",    text: "text-cyan-600",    border: "hover:border-cyan-300",    iconBg: "bg-cyan-100" },
};

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Espaço IA</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors">
              Início
            </Link>
            <Link href="/planos" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors">
              Planos
            </Link>
            {isAuthenticated && (
              <Link href="/perfil" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors">
                Meu Perfil
              </Link>
            )}
            {user?.role === "admin" && (
              <Link href="/admin" className="px-3 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors">
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {user?.name}
                </span>
                <Button variant="ghost" size="sm" onClick={() => logout()}>
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Sair
                </Button>
              </div>
            ) : (
              <Button asChild size="sm" className="hidden md:inline-flex">
                <a href={getLoginUrl()}>Entrar</a>
              </Button>
            )}
            <button
              className="md:hidden p-2 rounded-md hover:bg-muted"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white p-4 space-y-2">
            <Link href="/" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>Início</Link>
            <Link href="/planos" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>Planos</Link>
            {isAuthenticated && (
              <>
                <Link href="/perfil" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>Meu Perfil</Link>
                {user?.role === "admin" && (
                  <Link href="/admin" className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted" onClick={() => setMobileMenuOpen(false)}>Admin</Link>
                )}
                <button className="block w-full text-left px-3 py-2 text-sm font-medium rounded-md hover:bg-muted text-destructive" onClick={() => { logout(); setMobileMenuOpen(false); }}>Sair</button>
              </>
            )}
            {!isAuthenticated && (
              <a href={getLoginUrl()} className="block px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground text-center">Entrar</a>
            )}
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="gradient-hero text-white py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="container relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-sm font-medium mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma de Agentes de IA
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold mb-6 leading-tight">
              Transforme seu negócio com Inteligência Artificial
            </h1>
            <p className="text-lg lg:text-xl mb-8 text-white/85 leading-relaxed max-w-2xl">
              6 agentes especializados para ajudar você em cada etapa do desenvolvimento do seu projeto, da ideação à prototipagem.
            </p>
            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
                  <a href="#agentes">
                    Explorar Agentes
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
                  <a href={getLoginUrl()}>
                    Começar Agora
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 bg-transparent">
                <Link href="/planos">
                  <Crown className="mr-2 h-4 w-4" />
                  Ver Planos
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Agents Section */}
      <section id="agentes" className="py-16 lg:py-24">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Tudo que você precisa para começar com IA
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Uma plataforma completa para explorar, aprender e implementar soluções de Inteligência Artificial no seu negócio.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.values(AGENTS).map((agent) => {
              const Icon = iconMap[agent.icon] || Sparkles;
              const colors = colorMap[agent.color] || colorMap.blue;

              return (
                <Link key={agent.slug} href={isAuthenticated ? `/agente/${agent.slug}` : "#"}>
                  <Card className={`agent-card border-2 h-full ${colors.border} cursor-pointer`}>
                    <CardHeader className="pb-3">
                      <div className={`w-11 h-11 rounded-xl ${colors.iconBg} flex items-center justify-center mb-3`}>
                        <Icon className={`h-5.5 w-5.5 ${colors.text}`} />
                      </div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                        {agent.description}
                      </p>
                      <span className={`text-sm font-medium ${colors.text} inline-flex items-center gap-1.5`}>
                        {agent.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 lg:py-24 bg-muted/40">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Como funciona</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comece em minutos com nossos agentes especializados
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Crie sua conta", desc: "Faça login e escolha o plano ideal para suas necessidades." },
              { step: "2", title: "Escolha um agente", desc: "Selecione o agente especializado para a etapa do seu projeto." },
              { step: "3", title: "Converse e crie", desc: "Interaja com o agente e obtenha resultados profissionais." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full gradient-hero text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24">
        <div className="container">
          <Card className="gradient-hero-subtle border-primary/20 overflow-hidden">
            <CardContent className="py-12 text-center">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">Pronto para começar?</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Dê o primeiro passo na transformação digital da sua empresa com nossos agentes de IA.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {isAuthenticated ? (
                  <Button asChild size="lg">
                    <a href="#agentes">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Explorar Agentes
                    </a>
                  </Button>
                ) : (
                  <Button asChild size="lg">
                    <a href={getLoginUrl()}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Criar Conta Grátis
                    </a>
                  </Button>
                )}
                <Button asChild size="lg" variant="outline">
                  <Link href="/planos">Ver Planos</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 mt-auto">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded gradient-hero flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold">Espaço IA</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Espaço IA. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
