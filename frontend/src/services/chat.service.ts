import api from "@/lib/api";
import type { ChatConversation } from "@/types";

export const chatService = {
  listConversations: () =>
    api.get<ChatConversation[]>("/chat/conversations").then((r) => r.data),

  getConversation: (id: number) =>
    api.get<ChatConversation>(`/chat/conversations/${id}`).then((r) => r.data),

  sendMessage: async (
    content: string,
    conversationId: number | null,
    onChunk: (chunk: string) => void,
    onDone: (data: { conversation_id: number; credits: number }) => void
  ) => {
    const token = localStorage.getItem("access_token");
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/chat/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, conversation_id: conversationId }),
      }
    );

    if (!res.ok) throw new Error("Falha ao enviar mensagem");
    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n").filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = JSON.parse(line.slice(6));
        if (json.chunk) onChunk(json.chunk);
        if (json.done) onDone({ conversation_id: json.conversation_id, credits: json.credits });
      }
    }
  },
};
