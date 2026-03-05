import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  accessLevels, InsertAccessLevel,
  userSubscriptions, InsertUserSubscription,
  paymentHistory, InsertPaymentRecord,
  agentSessions, InsertAgentSession,
  agentMessages, InsertAgentMessage,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
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

// ─── Agent Messages ──────────────────────────────────────────────────────────

export async function addAgentMessage(data: InsertAgentMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(agentMessages).values(data);
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
