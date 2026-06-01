"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { engenhariaService } from "@/services/engenharia.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Plus, FileText, ChevronRight } from "lucide-react";
import type { ProjectStatus } from "@/types";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  iniciacao: "Iniciação",
  elicitacao: "Elicitação",
  analise: "Análise",
  validacao: "Validação",
  documentacao: "Documentação",
  baseline: "Baseline",
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  iniciacao: "bg-gray-100 text-gray-700",
  elicitacao: "bg-blue-100 text-blue-700",
  analise: "bg-yellow-100 text-yellow-700",
  validacao: "bg-orange-100 text-orange-700",
  documentacao: "bg-purple-100 text-purple-700",
  baseline: "bg-green-100 text-green-700",
};

export default function EngenhariaPage() {
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [dominio, setDominio] = useState("");
  const qc = useQueryClient();

  const { data: projetos = [], isLoading } = useQuery({
    queryKey: ["projetos"],
    queryFn: engenhariaService.listarProjetos,
  });

  const criar = useMutation({
    mutationFn: () => engenhariaService.criarProjeto({ nome, dominio: dominio || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projetos"] }); setShowForm(false); setNome(""); setDominio(""); },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Engenharia de Requisitos</h1>
          <p className="text-muted-foreground text-sm mt-1">Sistema multi-agente para elicitação e análise</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo projeto
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Novo projeto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nome do projeto *</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Sistema de gestão de estoque" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Domínio</label>
              <Input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="Ex: E-commerce, Saúde, Financeiro..." />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => criar.mutate()} disabled={!nome.trim() || criar.isPending}>
                {criar.isPending ? "Criando..." : "Criar"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando projetos...</p>
      ) : projetos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p>Nenhum projeto ainda. Crie o primeiro!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projetos.map((p) => (
            <Link key={p.id} href={`/engenharia/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center gap-4 py-4">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.nome}</p>
                    {p.dominio && <p className="text-xs text-muted-foreground">{p.dominio}</p>}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[p.status]}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
