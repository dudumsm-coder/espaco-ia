"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  LayoutDashboard, MessageSquare, FileText, Calendar,
  BookOpen, CreditCard, Users, LogOut, Zap,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat IA", icon: MessageSquare },
  { href: "/engenharia", label: "Engenharia de Req.", icon: FileText },
  { href: "/agendamentos", label: "Agendamentos", icon: Calendar },
  { href: "/conhecimento", label: "Conhecimento", icon: BookOpen },
  { href: "/creditos", label: "Créditos", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Zap className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg">Espaço IA</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}

        {user?.role === "admin" && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            Admin
          </Link>
        )}
      </nav>

      <div className="border-t px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2 text-sm">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user?.name}</p>
            <p className="text-muted-foreground text-xs">{user?.credits} créditos</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
