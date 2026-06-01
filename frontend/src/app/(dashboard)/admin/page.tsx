"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { User } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Zap, FolderOpen, Plus, Minus, Shield, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { formatDate, formatCurrency, cn } from "@/lib/utils";

interface Stats { total_users: number; total_admins: number; total_projetos: number; total_credits_distributed: number; total_credits_purchased: number; }
interface Package { id: number; name: string; credits: number; price_brl: number; is_popular: boolean; active: boolean; stripe_price_id: string | null; }
interface Transaction { id: number; type: string; amount: number; balance_after: number; description: string; created_at: string; }

const ROLE_LABEL: Record<string, string> = { user: "Usuário", admin: "Admin" };
const TX_COLOR: Record<string, string> = { debit: "text-red-600", credit: "text-green-600", admin_adjust: "text-blue-600", free_grant: "text-violet-600" };

export default function AdminPage() {
  const qc = useQueryClient();
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [creditAdjust, setCreditAdjust] = useState<Record<number, string>>({});
  const [creditReason, setCreditReason] = useState<Record<number, string>>({});
  const [newPkg, setNewPkg] = useState({ name: "", credits: "", price_brl: "", is_popular: false });
  const [showNewPkg, setShowNewPkg] = useState(false);

  const { data: stats } = useQuery<Stats>({ queryKey: ["admin-stats"], queryFn: () => api.get("/admin/stats").then(r => r.data) });
  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["admin-users"], queryFn: () => api.get("/admin/users").then(r => r.data) });
  const { data: packages = [] } = useQuery<Package[]>({ queryKey: ["admin-packages"], queryFn: () => api.get("/admin/packages").then(r => r.data) });
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["admin-transactions", expandedUser],
    queryFn: () => api.get(`/admin/users/${expandedUser}/transactions`).then(r => r.data),
    enabled: !!expandedUser,
  });

  const adjustCredits = useMutation({
    mutationFn: ({ userId, delta, reason }: { userId: number; delta: number; reason: string }) =>
      api.patch(`/admin/users/${userId}`, { credits_adjust: delta, adjust_reason: reason }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-transactions", expandedUser] }); },
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      api.patch(`/admin/users/${userId}`, { role }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const createPkg = useMutation({
    mutationFn: () => api.post("/admin/packages", { name: newPkg.name, credits: Number(newPkg.credits), price_brl: Number(newPkg.price_brl), is_popular: newPkg.is_popular }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-packages"] }); setShowNewPkg(false); setNewPkg({ name: "", credits: "", price_brl: "", is_popular: false }); },
  });

  const togglePkg = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => api.patch(`/admin/packages/${id}`, { active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-packages"] }),
  });

  const handleAdjust = (userId: number, sign: 1 | -1) => {
    const val = parseInt(creditAdjust[userId] || "0");
    if (!val || val <= 0) return;
    adjustCredits.mutate({ userId, delta: val * sign, reason: creditReason[userId] || "Ajuste admin" });
    setCreditAdjust(prev => ({ ...prev, [userId]: "" }));
    setCreditReason(prev => ({ ...prev, [userId]: "" }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestão de usuários, créditos e pacotes</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Usuários", value: stats.total_users, icon: Users, color: "text-blue-600 bg-blue-50" },
            { label: "Admins", value: stats.total_admins, icon: Shield, color: "text-violet-600 bg-violet-50" },
            { label: "Projetos", value: stats.total_projetos, icon: FolderOpen, color: "text-green-600 bg-green-50" },
            { label: "Créditos Distribuídos", value: stats.total_credits_distributed, icon: Zap, color: "text-amber-600 bg-amber-50" },
            { label: "Créditos Comprados", value: stats.total_credits_purchased, icon: Zap, color: "text-emerald-600 bg-emerald-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg mb-2", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Usuários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Usuários ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-muted-foreground text-sm p-4">Carregando...</p>
          ) : (
            <div className="divide-y">
              {users.map(u => (
                <div key={u.id}>
                  {/* Linha principal */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{u.name}</p>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                          u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {ROLE_LABEL[u.role]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email || "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{u.credits}</p>
                      <p className="text-xs text-muted-foreground">créditos</p>
                    </div>
                    <p className="text-xs text-muted-foreground hidden md:block shrink-0 w-20 text-right">{formatDate(u.created_at)}</p>
                    {expandedUser === u.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>

                  {/* Painel expandido */}
                  {expandedUser === u.id && (
                    <div className="bg-muted/20 border-t px-4 py-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Ajuste de créditos */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ajustar Créditos</p>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="1"
                              placeholder="Qtd"
                              value={creditAdjust[u.id] || ""}
                              onChange={e => setCreditAdjust(prev => ({ ...prev, [u.id]: e.target.value }))}
                              className="w-24 h-8 text-sm"
                            />
                            <Input
                              placeholder="Motivo (opcional)"
                              value={creditReason[u.id] || ""}
                              onChange={e => setCreditReason(prev => ({ ...prev, [u.id]: e.target.value }))}
                              className="flex-1 h-8 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 h-8" onClick={() => handleAdjust(u.id, 1)} disabled={adjustCredits.isPending}>
                              <Plus className="h-3 w-3" /> Adicionar
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-1 h-8" onClick={() => handleAdjust(u.id, -1)} disabled={adjustCredits.isPending}>
                              <Minus className="h-3 w-3" /> Remover
                            </Button>
                          </div>
                        </div>

                        {/* Role */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permissão</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={u.role === "user" ? "default" : "outline"}
                              className="h-8"
                              onClick={() => changeRole.mutate({ userId: u.id, role: "user" })}
                              disabled={changeRole.isPending}
                            >
                              Usuário
                            </Button>
                            <Button
                              size="sm"
                              variant={u.role === "admin" ? "default" : "outline"}
                              className="h-8"
                              onClick={() => changeRole.mutate({ userId: u.id, role: "admin" })}
                              disabled={changeRole.isPending}
                            >
                              <Shield className="h-3 w-3 mr-1" /> Admin
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">Saldo atual: <strong>{u.credits} créditos</strong></p>
                        </div>
                      </div>

                      {/* Histórico de transações */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últimas Transações</p>
                          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => qc.invalidateQueries({ queryKey: ["admin-transactions", u.id] })}>
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </div>
                        {transactions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma transação</p>
                        ) : (
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {transactions.map(tx => (
                              <div key={tx.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                                <span className={cn("font-semibold w-16 shrink-0", TX_COLOR[tx.type] || "text-foreground")}>
                                  {tx.amount > 0 ? "+" : ""}{tx.amount}
                                </span>
                                <span className="text-muted-foreground flex-1 truncate">{tx.description}</span>
                                <span className="text-muted-foreground shrink-0">saldo: {tx.balance_after}</span>
                                <span className="text-muted-foreground shrink-0">{formatDate(tx.created_at)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pacotes de Crédito */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" /> Pacotes de Crédito
            </CardTitle>
            <Button size="sm" onClick={() => setShowNewPkg(!showNewPkg)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Pacote
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showNewPkg && (
            <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
              <p className="text-sm font-semibold">Novo Pacote</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input placeholder="Nome" value={newPkg.name} onChange={e => setNewPkg(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" />
                <Input type="number" placeholder="Créditos" value={newPkg.credits} onChange={e => setNewPkg(p => ({ ...p, credits: e.target.value }))} className="h-8 text-sm" />
                <Input type="number" placeholder="Preço R$" value={newPkg.price_brl} onChange={e => setNewPkg(p => ({ ...p, price_brl: e.target.value }))} className="h-8 text-sm" />
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="popular" checked={newPkg.is_popular} onChange={e => setNewPkg(p => ({ ...p, is_popular: e.target.checked }))} />
                  <label htmlFor="popular" className="text-sm">Popular</label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createPkg.mutate()} disabled={!newPkg.name || !newPkg.credits || !newPkg.price_brl || createPkg.isPending}>
                  Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowNewPkg(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {(packages as Package[]).map(pkg => (
              <div key={pkg.id} className={cn("rounded-xl border p-4 space-y-2", !pkg.active && "opacity-50")}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{pkg.name}</p>
                    {pkg.is_popular && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Popular</span>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => togglePkg.mutate({ id: pkg.id, active: !pkg.active })}
                  >
                    {pkg.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
                <p className="text-2xl font-bold">{pkg.credits} <span className="text-sm font-normal text-muted-foreground">créditos</span></p>
                <p className="text-primary font-semibold">{formatCurrency(pkg.price_brl)}</p>
              </div>
            ))}
            {packages.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-4">Nenhum pacote criado. Clique em "Novo Pacote" para começar.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
