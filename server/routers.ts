import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { invokeAgentLLM, getAgentModelName } from "./agentLLM";
import * as db from "./db";
import { AGENT_SLUGS, AGENT_SYSTEM_PROMPTS, type AgentSlug } from "@shared/types";

// ─── Role-based procedures ──────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  return next({ ctx });
});

const editorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "editor") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a editores e administradores" });
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

  // ─── Credits ──────────────────────────────────────────────────────────────
  credits: router({
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      const creditInfo = await db.checkUserHasCredits(ctx.user.id);
      return {
        balance: creditInfo.balance,
        isAdmin: creditInfo.isAdmin,
        hasCredits: creditInfo.hasCredits,
        totalTokensUsed: (await db.getUserById(ctx.user.id))?.totalTokensUsed ?? 0,
        totalCreditsSpent: (await db.getUserById(ctx.user.id))?.totalCreditsSpent ?? 0,
      };
    }),

    getTransactions: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ ctx, input }) => {
        return db.getUserCreditTransactions(ctx.user.id, input?.limit ?? 50);
      }),
  }),

  // ─── Agents ──────────────────────────────────────────────────────────────
  agents: router({
    createSession: protectedProcedure
      .input(z.object({ agentSlug: z.string(), title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const slug = input.agentSlug as AgentSlug;
        if (!AGENT_SLUGS.includes(slug)) throw new TRPCError({ code: "BAD_REQUEST", message: "Agente inválido" });

        const access = await checkAgentAccess(ctx.user.id, slug);
        if (!access.allowed) throw new TRPCError({ code: "FORBIDDEN", message: access.reason });

        const sessionId = await db.createAgentSession({
          userId: ctx.user.id,
          agentSlug: slug,
          title: input.title || "Nova sessão",
        });

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

        // Check credits before sending (admin is exempt)
        const creditCheck = await db.checkUserHasCredits(ctx.user.id);
        if (!creditCheck.isAdmin && !creditCheck.hasCredits) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Créditos insuficientes. Adquira mais créditos ou faça upgrade do plano." });
        }

        // Save user message
        await db.addAgentMessage({ sessionId: input.sessionId, role: "user", content: input.message });

        // Get history
        const messages = await db.getSessionMessages(input.sessionId);
        const llmMessages = [
          { role: "system" as const, content: AGENT_SYSTEM_PROMPTS[slug] || "Você é um assistente útil." },
          ...messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
        ];

        // Usa o modelo correto para cada agente
        const modelUsed = getAgentModelName(slug);
        const response = await invokeAgentLLM(slug, llmMessages);
        const aiResponse = typeof response.choices[0].message.content === "string"
          ? response.choices[0].message.content
          : "Desculpe, não consegui processar sua mensagem.";

        // Track token usage
        const tokensUsed = response.usage?.total_tokens ?? 0;
        const { creditsCharged } = await db.debitUserCredits(ctx.user.id, tokensUsed, input.sessionId);

        // Save assistant message with token/credit info
        const msgId = await db.addAgentMessage({
          sessionId: input.sessionId,
          role: "assistant",
          content: aiResponse,
          tokensUsed,
          creditsCharged,
        });

        // Update session totals
        await db.updateSessionTokens(input.sessionId, tokensUsed, creditsCharged);

        // Auto-title from first message
        if (messages.length <= 1) {
          const shortTitle = input.message.substring(0, 80);
          await db.updateAgentSession(input.sessionId, { title: shortTitle });
        }

        return { response: aiResponse, tokensUsed, creditsCharged, modelUsed };
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
        monthlyCredits: z.number().default(0),
        maxSessionsPerMonth: z.number().default(5),
        maxMessagesPerSession: z.number().default(20),
        maxTokensPerMessage: z.number().default(4096),
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
        monthlyCredits: z.number().optional(),
        maxSessionsPerMonth: z.number().optional(),
        maxMessagesPerSession: z.number().optional(),
        maxTokensPerMessage: z.number().optional(),
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

        // Grant monthly credits
        if (level.monthlyCredits > 0) {
          await db.addUserCredits(ctx.user.id, level.monthlyCredits, "subscription_grant", `Créditos do plano ${level.name}`);
        }

        // Update user role based on plan
        const roleMap: Record<string, string> = { free: "free", premium: "premium", editor: "editor", admin: "admin" };
        const newRole = roleMap[level.slug] || "user";
        if (newRole !== "admin") {
          await db.updateUser(ctx.user.id, { role: newRole as any });
        }

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

    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUser(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────
  admin: router({
    getUsers: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),

    getMetrics: adminProcedure.query(async () => {
      const [totalUsers, totalSessions, agentUsage, subscriptions, roleStats] = await Promise.all([
        db.getTotalUsers(),
        db.getTotalSessions(),
        db.getAgentUsageStats(),
        db.getAllSubscriptions(),
        db.getUsersByRole(),
      ]);
      return {
        totalUsers,
        totalSessions,
        agentUsage,
        activeSubscriptions: subscriptions.filter(s => s.status === "active").length,
        roleStats,
      };
    }),

    getAllSubscriptions: adminProcedure.query(async () => {
      return db.getAllSubscriptions();
    }),

    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["user", "admin", "editor", "premium", "free"]) }))
      .mutation(async ({ input }) => {
        await db.updateUser(input.userId, { role: input.role });
        return { success: true };
      }),

    grantCredits: adminProcedure
      .input(z.object({ userId: z.number(), credits: z.number(), description: z.string().optional() }))
      .mutation(async ({ input }) => {
        const newBalance = await db.addUserCredits(
          input.userId,
          input.credits,
          "admin_grant",
          input.description || `Créditos concedidos pelo admin`,
        );
        return { newBalance };
      }),

    seedLevels: adminProcedure.mutation(async () => {
      await db.seedDefaultAccessLevels();
      return { success: true };
    }),
  }),
});

// ─── Access Control Helper ───────────────────────────────────────────────────

async function checkAgentAccess(userId: number, agentSlug: AgentSlug): Promise<{ allowed: boolean; reason?: string }> {
  const user = await db.getUserById(userId);
  if (!user) return { allowed: false, reason: "Usuário não encontrado." };

  // Admin has full access
  if (user.role === "admin") return { allowed: true };

  // Editor has full access
  if (user.role === "editor") return { allowed: true };

  const sub = await db.getUserSubscription(userId);

  // No subscription = free tier
  if (!sub) {
    if (agentSlug !== "entrevista") return { allowed: false, reason: "Faça upgrade do seu plano para acessar este agente." };
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

  if (!level.allowedAgents.includes(agentSlug) && !level.allowedAgents.includes("*")) {
    return { allowed: false, reason: "Este agente não está disponível no seu plano." };
  }

  if (level.maxSessionsPerMonth !== -1 && sub.sessionsUsedThisPeriod >= level.maxSessionsPerMonth) {
    return { allowed: false, reason: "Limite de sessões do período atingido." };
  }

  return { allowed: true };
}

export type AppRouter = typeof appRouter;
