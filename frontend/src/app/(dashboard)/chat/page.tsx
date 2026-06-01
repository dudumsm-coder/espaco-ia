"use client";
import { useState, useRef, useEffect } from "react";
import { chatService } from "@/services/chat.service";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const { setUser, user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setLoading(true);

    let reply = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      await chatService.sendMessage(
        content,
        conversationId,
        (chunk) => {
          reply += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: reply };
            return updated;
          });
        },
        ({ conversation_id, credits }) => {
          setConversationId(conversation_id);
          if (user) setUser({ ...user, credits });
        }
      );
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Erro ao processar. Tente novamente." };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Chat IA</h1>
        <p className="text-muted-foreground text-sm">Especialista em IA e transformação digital · 10 créditos/mensagem</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 rounded-xl border bg-white p-4 shadow-sm">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot className="h-12 w-12 mb-4 text-primary/30" />
            <p className="font-medium">Como posso ajudar com IA hoje?</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted rounded-tl-sm"
            )}>
              {msg.content || (loading && i === messages.length - 1 ? "..." : "")}
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 mt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Pergunte sobre IA..."
          disabled={loading}
          className="bg-white"
        />
        <Button onClick={send} disabled={loading || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
