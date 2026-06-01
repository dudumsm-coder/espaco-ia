"use client";
import { Calendar } from "lucide-react";

export default function AgendamentosPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agendamentos</h1>
        <p className="text-muted-foreground text-sm mt-1">Agende consultorias de 30 minutos</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Calendar className="h-12 w-12 mb-4 text-primary/30" />
        <p className="font-medium">Em breve</p>
        <p className="text-sm mt-1">Agendamento de consultorias estará disponível em breve.</p>
      </div>
    </div>
  );
}
