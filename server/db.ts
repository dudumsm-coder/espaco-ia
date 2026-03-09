import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  accessLevels, InsertAccessLevel,
  userSubscriptions, InsertUserSubscription,
  paymentHistory, InsertPaymentRecord,
  agentSessions, InsertAgentSession,
  agentMessages, InsertAgentMessage,
  creditTransactions, InsertCreditTransaction,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, id));
}

// ─── Credits ─────────────────────────────────────────────────────────────────

/**
 * Credit pricing: 1 credit = 1 cent BRL
 * Token cost: ~$0.00015 per 1K tokens (input) + ~$0.0006 per 1K tokens (output)
 * With 50% margin: cost * 1.5
 * Simplified: 1 credit = ~1000 tokens (with margin built in)
 */
const CREDITS_PER_1K_TOKENS = 1.5; // 1 credit base + 50% margin = 1.5 credits per 1K tokens

export function calculateCreditsForTokens(totalTokens: number): number {
  return Math.ceil((totalTokens / 1000) * CREDITS_PER_1K_TOKENS);
}

export async function debitUserCredits(
  userId: number,
  tokensUsed: number,
  sessionId?: number,
  messageId?: number,
): Promise<{ creditsCharged: number; newBalance: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  // Admin has unlimited credits
  if (user.role === "admin") {
    return { creditsCharged: 0, newBalance: user.creditsBalance };
  }

  const creditsToCharge = calculateCreditsForTokens(tokensUsed);
  const newBalance = user.creditsBalance - creditsToCharge;

  // Update user balance and total tokens
  await db.update(users).set({
    creditsBalance: newBalance,
    totalTokensUsed: sql`${users.totalTokensUsed} + ${tokensUsed}`,
    totalCreditsSpent: sql`${users.totalCreditsSpent} + ${creditsToCharge}`,
  }).where(eq(users.id, userId));

  // Record transaction
  await db.insert(creditTransactions).values({
    userId,
    type: "usage",
    amount: -creditsToCharge,
    balanceAfter: newBalance,
    description: `Consumo de ${tokensUsed} tokens`,
    relatedSessionId: sessionId,
    relatedMessageId: messageId,
    tokensConsumed: tokensUsed,
  });

  return { creditsCharged: creditsToCharge, newBalance };
}

export async function addUserCredits(
  userId: number,
  credits: number,
  type: "purchase" | "subscription_grant" | "refund" | "admin_grant",
  description: string,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const newBalance = user.creditsBalance + credits;
  await db.update(users).set({ creditsBalance: newBalance }).where(eq(users.id, userId));

  await db.insert(creditTransactions).values({
    userId,
    type,
    amount: credits,
    balanceAfter: newBalance,
    description,
  });

  return newBalance;
}

export async function getUserCreditTransactions(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}

export async function checkUserHasCredits(userId: number): Promise<{ hasCredits: boolean; balance: number; isAdmin: boolean }> {
  const user = await getUserById(userId);
  if (!user) return { hasCredits: false, balance: 0, isAdmin: false };
  if (user.role === "admin") return { hasCredits: true, balance: Infinity, isAdmin: true };
  return { hasCredits: user.creditsBalance > 0, balance: user.creditsBalance, isAdmin: false };
}

// ─── Access Levels ───────────────────────────────────────────────────────────

export async function getActiveAccessLevels() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accessLevels).where(eq(accessLevels.active, true)).orderBy(accessLevels.sortOrder);
}

export async function getAllAccessLevels() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accessLevels).orderBy(accessLevels.sortOrder);
}

export async function getAccessLevelById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accessLevels).where(eq(accessLevels.id, id)).limit(1);
  return result[0];
}

export async function getAccessLevelBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(accessLevels).where(eq(accessLevels.slug, slug)).limit(1);
  return result[0];
}

export async function createAccessLevel(data: InsertAccessLevel) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(accessLevels).values(data);
  return result[0].insertId;
}

export async function updateAccessLevel(id: number, data: Partial<InsertAccessLevel>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(accessLevels).set(data).where(eq(accessLevels.id, id));
}

export async function deleteAccessLevel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(accessLevels).where(eq(accessLevels.id, id));
}

// ─── User Subscriptions ──────────────────────────────────────────────────────

export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userSubscriptions)
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, "active")))
    .limit(1);
  return result[0];
}

export async function createSubscription(data: InsertUserSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userSubscriptions).values(data);
  return result[0].insertId;
}

export async function updateSubscription(id: number, data: Partial<InsertUserSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userSubscriptions).set(data).where(eq(userSubscriptions.id, id));
}

export async function incrementSessionCount(subscriptionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userSubscriptions)
    .set({ sessionsUsedThisPeriod: sql`${userSubscriptions.sessionsUsedThisPeriod} + 1` })
    .where(eq(userSubscriptions.id, subscriptionId));
}

export async function getAllSubscriptions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userSubscriptions).orderBy(desc(userSubscriptions.createdAt));
}

// ─── Payment History ─────────────────────────────────────────────────────────

export async function getUserPayments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentHistory)
    .where(eq(paymentHistory.userId, userId))
    .orderBy(desc(paymentHistory.createdAt));
}

export async function createPayment(data: InsertPaymentRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(paymentHistory).values(data);
  return result[0].insertId;
}

// ─── Agent Sessions ──────────────────────────────────────────────────────────

export async function createAgentSession(data: InsertAgentSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(agentSessions).values(data);
  return result[0].insertId;
}

export async function getUserAgentSessions(userId: number, agentSlug?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(agentSessions.userId, userId)];
  if (agentSlug) conditions.push(eq(agentSessions.agentSlug, agentSlug));
  return db.select().from(agentSessions).where(and(...conditions)).orderBy(desc(agentSessions.updatedAt));
}

export async function getAgentSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(agentSessions).where(eq(agentSessions.id, id)).limit(1);
  return result[0];
}

export async function updateAgentSession(id: number, data: Partial<InsertAgentSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(agentSessions).set(data).where(eq(agentSessions.id, id));
}

export async function updateSessionTokens(sessionId: number, tokens: number, credits: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(agentSessions).set({
    totalTokensUsed: sql`${agentSessions.totalTokensUsed} + ${tokens}`,
    totalCreditsCharged: sql`${agentSessions.totalCreditsCharged} + ${credits}`,
  }).where(eq(agentSessions.id, sessionId));
}

// ─── Agent Messages ──────────────────────────────────────────────────────────

export async function addAgentMessage(data: InsertAgentMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(agentMessages).values(data);
  return result[0].insertId;
}

export async function getSessionMessages(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentMessages)
    .where(eq(agentMessages.sessionId, sessionId))
    .orderBy(agentMessages.createdAt);
}

// ─── Admin Metrics ───────────────────────────────────────────────────────────

export async function getAgentUsageStats() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    agentSlug: agentSessions.agentSlug,
    totalSessions: sql<number>`count(*)`,
    totalTokens: sql<number>`COALESCE(sum(${agentSessions.totalTokensUsed}), 0)`,
    totalCredits: sql<number>`COALESCE(sum(${agentSessions.totalCreditsCharged}), 0)`,
  }).from(agentSessions).groupBy(agentSessions.agentSlug);
}

export async function getTotalUsers() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users);
  return result[0]?.count ?? 0;
}

export async function getTotalSessions() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(agentSessions);
  return result[0]?.count ?? 0;
}

export async function getUsersByRole() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    role: users.role,
    count: sql<number>`count(*)`,
  }).from(users).groupBy(users.role);
}

// ─── Seed Default Access Levels ──────────────────────────────────────────────

export async function seedDefaultAccessLevels() {
  const db = await getDb();
  if (!db) return;

  const existing = await getAllAccessLevels();
  if (existing.length > 0) return; // Already seeded

  const levels: InsertAccessLevel[] = [
    {
      slug: "free",
      name: "Gratuito",
      description: "Acesso básico para experimentar a plataforma",
      priceMonthly: 0,
      priceYearly: 0,
      monthlyCredits: 100,
      maxSessionsPerMonth: 3,
      maxMessagesPerSession: 10,
      maxTokensPerMessage: 2048,
      allowedAgents: ["entrevista"],
      features: { basicChat: true, exportPdf: false, prioritySupport: false, customPrompts: false },
      sortOrder: 0,
      active: true,
      highlighted: false,
    },
    {
      slug: "premium",
      name: "Premium",
      description: "Acesso completo a todos os agentes com créditos generosos",
      priceMonthly: 4990,
      priceYearly: 49900,
      monthlyCredits: 5000,
      maxSessionsPerMonth: 50,
      maxMessagesPerSession: 100,
      maxTokensPerMessage: 8192,
      allowedAgents: ["*"],
      features: { basicChat: true, exportPdf: true, prioritySupport: true, customPrompts: false },
      sortOrder: 1,
      active: true,
      highlighted: true,
    },
    {
      slug: "editor",
      name: "Editor",
      description: "Acesso de edição e manutenção do site",
      priceMonthly: 0,
      priceYearly: 0,
      monthlyCredits: 10000,
      maxSessionsPerMonth: -1,
      maxMessagesPerSession: -1,
      maxTokensPerMessage: 16384,
      allowedAgents: ["*"],
      features: { basicChat: true, exportPdf: true, prioritySupport: true, customPrompts: true, editSite: true },
      sortOrder: 2,
      active: true,
      highlighted: false,
    },
    {
      slug: "admin",
      name: "Administrador",
      description: "Acesso total sem limites - proprietário da plataforma",
      priceMonthly: 0,
      priceYearly: 0,
      monthlyCredits: -1,
      maxSessionsPerMonth: -1,
      maxMessagesPerSession: -1,
      maxTokensPerMessage: -1,
      allowedAgents: ["*"],
      features: { basicChat: true, exportPdf: true, prioritySupport: true, customPrompts: true, editSite: true, manageUsers: true, manageAccess: true },
      sortOrder: 3,
      active: true,
      highlighted: false,
    },
  ];

  for (const level of levels) {
    await db.insert(accessLevels).values(level);
  }
  console.log("[Database] Default access levels seeded");
}

// ─── Stripe Support Functions ─────────────────────────────────────────────────

export async function getUserByStripeCustomerId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId)).limit(1);
  return result[0];
}

export async function updateUserStripeInfo(
  userId: number,
  data: { stripeCustomerId?: string | null; stripeSubscriptionId?: string | null; role?: "user" | "admin" | "editor" | "premium" | "free" }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function grantCreditsToUser(
  userId: number,
  credits: number,
  type: "purchase" | "subscription_grant" | "refund" | "admin_grant",
  description: string
): Promise<number> {
  return addUserCredits(userId, credits, type, description);
}

export async function upsertUserSubscription(
  userId: number,
  data: {
    accessLevelId: number;
    status: "active" | "cancelled" | "expired" | "past_due";
    billingCycle: "monthly" | "yearly";
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId)).limit(1);

  if (existing.length > 0) {
    await db.update(userSubscriptions).set({
      ...data,
      sessionsUsedThisPeriod: 0,
      creditsUsedThisPeriod: 0,
    }).where(eq(userSubscriptions.userId, userId));
  } else {
    await db.insert(userSubscriptions).values({
      userId,
      ...data,
      sessionsUsedThisPeriod: 0,
      creditsUsedThisPeriod: 0,
    });
  }
}

export async function updateSubscriptionPeriod(
  subscriptionId: number,
  periodStart: Date,
  periodEnd: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userSubscriptions).set({
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    sessionsUsedThisPeriod: 0,
    creditsUsedThisPeriod: 0,
  }).where(eq(userSubscriptions.id, subscriptionId));
}

export async function updateSubscriptionStatus(
  subscriptionId: number,
  status: "active" | "cancelled" | "expired" | "past_due"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userSubscriptions).set({ status }).where(eq(userSubscriptions.id, subscriptionId));
}

export async function recordPayment(data: {
  userId: number;
  amountCents: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  paymentMethod?: string;
  externalId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
  description?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(paymentHistory).values({
    userId: data.userId,
    amountCents: data.amountCents,
    currency: data.currency,
    status: data.status,
    paymentMethod: data.paymentMethod,
    externalId: data.externalId ?? undefined,
    stripePaymentIntentId: data.stripePaymentIntentId ?? undefined,
    stripeInvoiceId: data.stripeInvoiceId ?? undefined,
    description: data.description,
  });
}

export async function getAllPayments(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentHistory).orderBy(desc(paymentHistory.createdAt)).limit(limit);
}
