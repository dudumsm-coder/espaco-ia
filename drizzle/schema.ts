import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json, bigint } from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "editor", "premium", "free"]).default("free").notNull(),
  // Credit system
  creditsBalance: int("creditsBalance").default(0).notNull(), // current credits in cents
  totalTokensUsed: bigint("totalTokensUsed", { mode: "number" }).default(0).notNull(),
  totalCreditsSpent: int("totalCreditsSpent").default(0).notNull(), // lifetime credits spent
  // Profile
  avatarUrl: text("avatarUrl"),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Access Levels (Plans) ───────────────────────────────────────────────────
export const accessLevels = mysqlTable("access_levels", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  priceMonthly: int("priceMonthly").default(0).notNull(),
  priceYearly: int("priceYearly").default(0).notNull(),
  monthlyCredits: int("monthlyCredits").default(0).notNull(), // credits granted per month
  maxSessionsPerMonth: int("maxSessionsPerMonth").default(5).notNull(),
  maxMessagesPerSession: int("maxMessagesPerSession").default(20).notNull(),
  maxTokensPerMessage: int("maxTokensPerMessage").default(4096).notNull(),
  allowedAgents: json("allowedAgents").$type<string[]>().notNull(),
  features: json("features").$type<Record<string, boolean>>().notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  highlighted: boolean("highlighted").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccessLevel = typeof accessLevels.$inferSelect;
export type InsertAccessLevel = typeof accessLevels.$inferInsert;

// ─── User Subscriptions ──────────────────────────────────────────────────────
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  accessLevelId: int("accessLevelId").notNull(),
  status: mysqlEnum("status", ["active", "cancelled", "expired", "past_due"]).default("active").notNull(),
  billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).default("monthly").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
  sessionsUsedThisPeriod: int("sessionsUsedThisPeriod").default(0).notNull(),
  creditsUsedThisPeriod: int("creditsUsedThisPeriod").default(0).notNull(),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

// ─── Payment History ─────────────────────────────────────────────────────────
export const paymentHistory = mysqlTable("payment_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subscriptionId: int("subscriptionId"),
  amountCents: int("amountCents").notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  externalId: varchar("externalId", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentRecord = typeof paymentHistory.$inferSelect;
export type InsertPaymentRecord = typeof paymentHistory.$inferInsert;

// ─── Agent Sessions ──────────────────────────────────────────────────────────
export const agentSessions = mysqlTable("agent_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agentSlug: varchar("agentSlug", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }),
  status: mysqlEnum("status", ["active", "completed", "archived"]).default("active").notNull(),
  totalTokensUsed: int("totalTokensUsed").default(0).notNull(),
  totalCreditsCharged: int("totalCreditsCharged").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentSession = typeof agentSessions.$inferSelect;
export type InsertAgentSession = typeof agentSessions.$inferInsert;

// ─── Agent Messages ──────────────────────────────────────────────────────────
export const agentMessages = mysqlTable("agent_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  tokensUsed: int("tokensUsed").default(0).notNull(),
  creditsCharged: int("creditsCharged").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = typeof agentMessages.$inferInsert;

// ─── Credit Transactions ─────────────────────────────────────────────────────
export const creditTransactions = mysqlTable("credit_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["purchase", "subscription_grant", "usage", "refund", "admin_grant"]).notNull(),
  amount: int("amount").notNull(), // positive = credit, negative = debit
  balanceAfter: int("balanceAfter").notNull(),
  description: text("description"),
  relatedSessionId: int("relatedSessionId"),
  relatedMessageId: int("relatedMessageId"),
  tokensConsumed: int("tokensConsumed").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;
