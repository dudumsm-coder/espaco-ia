"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentsService } from "@/services/appointments.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus, Clock, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_LABEL = { pending: "Pendente", confirmed: "Confirmado", cancelled: "Cancelado", completed: "Realizado" };
const STATUS_COLOR = { pending: "bg-yellow-100 text-yellow-700", confirmed: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-700", completed: "bg-blue-100 text-blue-700" };

export default function AgendamentosPage() {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [topic, setTopic] = useState("");
  const qc = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: appointmentsService.list,
  });

  const create = useMutation({
    mutationFn: () => appointmentsService.create({
      scheduled_at: new Date(`${date}T${time}:00`).toISOString(),
      topic: topic || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setShowForm(false); setDate(""); setTime(""); setTopic("");
    },
  });

  const cancel = useMutation({
    mutationFn: (id: number) => appointmentsService.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Consultorias de 30 minutos · 50 créditos</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" />Agendar</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nova consultoria</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Data *</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Horário *</label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tema</label>
              <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: Implementação de IA no meu negócio" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => create.mutate()} disabled={!date || !time || create.isPending}>
                {create.isPending ? "Agendando..." : "Confirmar (50 créditos)"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Calendar className="h-12 w-12 mb-4 text-primary/30" />
          <p className="font-medium">Nenhum agendamento</p>
          <p className="text-sm mt-1">Agende sua primeira consultoria de IA.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(appt => (
            <Card key={appt.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{appt.topic || "Consultoria de IA"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(appt.scheduled_at).toLocaleString("pt-BR")} · {appt.duration_minutes} min
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[appt.status]}`}>
                  {STATUS_LABEL[appt.status]}
                </span>
                {appt.status === "pending" && (
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => cancel.mutate(appt.id)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
