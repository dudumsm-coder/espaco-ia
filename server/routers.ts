import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { AGENT_SLUGS, AGENT_SYSTEM_PROMPTS, type AgentSlug } from "@shared/types";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Agents ──────────────────────────────────────────────────────────────
  agents: router({
    createSession: protectedProcedure
      .input(z.object({ agentSlug: z.string(), title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const slug = input.agentSlug as AgentSlug;
        if (!AGENT_SLUGS.includes(slug)) throw new TRPCError({ code: "BAD_REQUEST", message: "Agente inválido" });

        // Check access
        const access = await checkAgentAccess(ctx.user.id, slug);
        if (!access.allowed) throw new TRPCError({ code: "FORBIDDEN", message: access.reason });

        const sessionId = await db.createAgentSession({
          userId: ctx.user.id,
          agentSlug: slug,
          title: input.title || "Nova sessão",
        });

        // Increment session count
        const sub = await db.getUserSubscription(ctx.user.id);
        if (sub) await db.incrementSessionCount(sub.id);

        return { sessionId };
      }),

    getSessions: protectedProcedure
      .input(z.object({ agentSlug: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return db.getUserAgentSessions(ctx.user.id, input.agentSlug);
      }),

    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await db.getAgentSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return db.getSessionMessages(input.sessionId);
      }),

    sendMessage: protectedProcedure
      .input(z.object({ sessionId: z.number(), message: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getAgentSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });

        const slug = session.agentSlug as AgentSlug;

        // Save user message
        await db.addAgentMessage({ sessionId: input.sessionId, role: "user", content: input.message });

        // Get history
        const messages = await db.getSessionMessages(input.sessionId);
        const llmMessages = [
          { role: "system" as const, content: AGENT_SYSTEM_PROMPTS[slug] || "Você é um assistente útil." },
          ...messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
        ];

        const response = await invokeLLM({ messages: llmMessages });
        const aiResponse = typeof response.choices[0].message.content === "string"
          ? response.choices[0].message.content
          : "Desculpe, não consegui processar sua mensagem.";

        await db.addAgentMessage({ sessionId: input.sessionId, role: "assistant", content: aiResponse });

        // Auto-title from first message
        if (messages.length <= 1) {
          const shortTitle = input.message.substring(0, 80);
          await db.updateAgentSession(input.sessionId, { title: shortTitle });
        }

        return { response: aiResponse };
      }),

    deleteSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getAgentSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        await db.updateAgentSession(input.sessionId, { status: "archived" });
        return { success: true };
      }),
  }),

  // ─── Access Levels ───────────────────────────────────────────────────────
  accessLevels: router({
    getActive: publicProcedure.query(async () => {
      return db.getActiveAccessLevels();
    }),

    getAll: adminProcedure.query(async () => {
      return db.getAllAccessLevels();
    }),

    create: adminProcedure
      .input(z.object({
        slug: z.string(),
        name: z.string(),
        description: z.string().optional(),
        priceMonthly: z.number().default(0),
        priceYearly: z.number().default(0),
        maxSessionsPerMonth: z.number().default(5),
        maxMessagesPerSession: z.number().default(20),
        allowedAgents: z.array(z.string()),
        features: z.record(z.string(), z.boolean()),
        sortOrder: z.number().default(0),
        active: z.boolean().default(true),
        highlighted: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createAccessLevel(input as any);
        return { id };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        priceMonthly: z.number().optional(),
        priceYearly: z.number().optional(),
        maxSessionsPerMonth: z.number().optional(),
        maxMessagesPerSession: z.number().optional(),
        allowedAgents: z.array(z.string()).optional(),
        features: z.record(z.string(), z.boolean()).optional(),
        sortOrder: z.number().optional(),
        active: z.boolean().optional(),
        highlighted: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAccessLevel(id, data as any);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAccessLevel(input.id);
        return { success: true };
      }),
  }),

  // ─── Subscriptions ─────────────────────────────────────────────────────
  subscriptions: router({
    getMy: protectedProcedure.query(async ({ ctx }) => {
      const sub = await db.getUserSubscription(ctx.user.id);
      if (!sub) return null;
      const level = await db.getAccessLevelById(sub.accessLevelId);
      return { ...sub, accessLevel: level };
    }),

    subscribe: protectedProcedure
      .input(z.object({
        accessLevelId: z.number(),
        billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
      }))
      .mutation(async ({ ctx, input }) => {
        const level = await db.getAccessLevelById(input.accessLevelId);
        if (!level) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado" });

        // Cancel existing subscription
        const existing = await db.getUserSubscription(ctx.user.id);
        if (existing) await db.updateSubscription(existing.id, { status: "cancelled", cancelledAt: new Date() });

        const now = new Date();
        const periodEnd = new Date(now);
        if (input.billingCycle === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);
        else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

        const subId = await db.createSubscription({
          userId: ctx.user.id,
          accessLevelId: input.accessLevelId,
          billingCycle: input.billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          status: "active",
        });

        // Record payment if not free
        const price = input.billingCycle === "monthly" ? level.priceMonthly : level.priceYearly;
        if (price > 0) {
          await db.createPayment({
            userId: ctx.user.id,
            subscriptionId: subId,
            amountCents: price,
            status: "completed",
            description: `Assinatura ${level.name} - ${input.billingCycle === "monthly" ? "Mensal" : "Anual"}`,
          });
        }

        return { subscriptionId: subId };
      }),

    cancel: protectedProcedure.mutation(async ({ ctx }) => {
      const sub = await db.getUserSubscription(ctx.user.id);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma assinatura ativa" });
      await db.updateSubscription(sub.id, { status: "cancelled", cancelledAt: new Date() });
      return { success: true };
    }),
  }),

  // ─── User Profile ─────────────────────────────────────────────────────
  profile: router({
    getPayments: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserPayments(ctx.user.id);
    }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────
  admin: router({
    getUsers: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),

    getMetrics: adminProcedure.query(async () => {
      const [totalUsers, totalSessions, agentUsage, subscriptions] = await Promise.all([
        db.getTotalUsers(),
        db.getTotalSessions(),
        db.getAgentUsageStats(),
        db.getAllSubscriptions(),
      ]);
      return { totalUsers, totalSessions, agentUsage, activeSubscriptions: subscriptions.filter(s => s.status === "active").length };
    }),

    getAllSubscriptions: adminProcedure.query(async () => {
      return db.getAllSubscriptions();
    }),

    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
      .mutation(async ({ input }) => {
        const db2 = await db.getDb();
        if (!db2) throw new Error("Database not available");
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db2.update(usersTable).set({ role: input.role }).where(eq(usersTable.id, input.userId));
        return { success: true };
      }),
  }),
});

// ─── Access Control Helper ───────────────────────────────────────────────────

async function checkAgentAccess(userId: number, agentSlug: AgentSlug): Promise<{ allowed: boolean; reason?: string }> {
  const sub = await db.getUserSubscription(userId);

  // No subscription = free tier (allow entrevista only, 3 sessions)
  if (!sub) {
    if (agentSlug !== "entrevista") return { allowed: false, reason: "Faça upgrade do seu plano para acessar este agente." };
    // Count existing sessions this month
    const sessions = await db.getUserAgentSessions(userId, agentSlug);
    const thisMonth = sessions.filter(s => {
      const d = new Date(s.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    if (thisMonth.length >= 3) return { allowed: false, reason: "Limite de sessões gratuitas atingido. Faça upgrade para continuar." };
    return { allowed: true };
  }

  const level = await db.getAccessLevelById(sub.accessLevelId);
  if (!level) return { allowed: false, reason: "Plano não encontrado." };

  // Check allowed agents
  if (!level.allowedAgents.includes(agentSlug) && !level.allowedAgents.includes("*")) {
    return { allowed: false, reason: "Este agente não está disponível no seu plano." };
  }

  // Check session limit
  if (sub.sessionsUsedThisPeriod >= level.maxSessionsPerMonth && level.maxSessionsPerMonth !== -1) {
    return { allowed: false, reason: "Limite de sessões do período atingido." };
  }

  return { allowed: true };
}

export type AppRouter = typeof appRouter;
