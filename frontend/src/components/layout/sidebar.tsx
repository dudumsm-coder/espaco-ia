"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
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
  const { user: clerkUser } = useUser();
  const { user: dbUser, logout } = useAuth();
  const { signOut } = useClerk();

  const displayName = clerkUser?.firstName || dbUser?.name || "Usuário";
  const credits = dbUser?.credits ?? 0;
  const isAdmin = dbUser?.role === "admin";

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

        {isAdmin && (
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
            <p className="font-medium truncate">{displayName}</p>
            <p className="text-muted-foreground text-xs">{credits} créditos</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
