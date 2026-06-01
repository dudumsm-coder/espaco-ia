"use client";
import { BookOpen } from "lucide-react";

export default function ConhecimentoPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Base de Conhecimento</h1>
        <p className="text-muted-foreground text-sm mt-1">Artigos e guias sobre IA</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <BookOpen className="h-12 w-12 mb-4 text-primary/30" />
        <p className="font-medium">Em breve</p>
        <p className="text-sm mt-1">Artigos sobre IA e transformação digital estarão disponíveis em breve.</p>
      </div>
    </div>
  );
}
