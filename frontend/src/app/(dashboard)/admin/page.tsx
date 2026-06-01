"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdminPage() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<User[]>("/admin/users").then((r) => r.data),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administração</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestão de usuários</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Usuários ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">Nome</th>
                    <th className="text-left py-2 pr-4">E-mail</th>
                    <th className="text-left py-2 pr-4">Role</th>
                    <th className="text-right py-2 pr-4">Créditos</th>
                    <th className="text-left py-2">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4 font-medium">{u.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{u.email}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">{u.credits}</td>
                      <td className="py-2 text-muted-foreground">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
