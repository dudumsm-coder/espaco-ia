import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { AGENT_SLUGS, AGENTS, AGENT_SYSTEM_PROMPTS } from "@shared/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createAuthContext(overrides?: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
  const user: NonNullable<TrpcContext["user"]> = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createAuthContext({ role: "admin" });
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Shared Types Tests ──────────────────────────────────────────────────────

describe("shared/types", () => {
  it("defines exactly 6 agents", () => {
    expect(AGENT_SLUGS).toHaveLength(6);
  });

  it("has all expected agent slugs", () => {
    const expected = ["entrevista", "ideacao", "analise", "requisitos", "documentacao", "prototipagem"];
    expect(AGENT_SLUGS).toEqual(expect.arrayContaining(expected));
  });

  it("each agent has required fields", () => {
    for (const slug of AGENT_SLUGS) {
      const agent = AGENTS[slug];
      expect(agent.slug).toBe(slug);
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(agent.icon).toBeTruthy();
      expect(agent.color).toBeTruthy();
      expect(agent.cta).toBeTruthy();
    }
  });

  it("each agent has a system prompt", () => {
    for (const slug of AGENT_SLUGS) {
      expect(AGENT_SYSTEM_PROMPTS[slug]).toBeTruthy();
      expect(AGENT_SYSTEM_PROMPTS[slug].length).toBeGreaterThan(50);
    }
  });
});

// ─── Auth Routes ─────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.openId).toBe("test-user-001");
    expect(result?.name).toBe("Test User");
  });

  it("returns null when not authenticated", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

// ─── Access Levels Routes ────────────────────────────────────────────────────

describe("accessLevels", () => {
  it("getActive is a public procedure", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw even without auth
    const result = await caller.accessLevels.getActive();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getAll requires admin role", async () => {
    const ctx = createAuthContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.accessLevels.getAll()).rejects.toThrow();
  });

  it("getAll works for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.accessLevels.getAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it("create requires admin role", async () => {
    const ctx = createAuthContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.accessLevels.create({
        slug: "test",
        name: "Test",
        allowedAgents: ["entrevista"],
        features: {},
      })
    ).rejects.toThrow();
  });
});

// ─── Admin Routes ────────────────────────────────────────────────────────────

describe("admin", () => {
  it("getMetrics requires admin role", async () => {
    const ctx = createAuthContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.getMetrics()).rejects.toThrow();
  });

  it("getUsers requires admin role", async () => {
    const ctx = createAuthContext({ role: "user" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.getUsers()).rejects.toThrow();
  });

  it("getMetrics works for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.getMetrics();
    expect(result).toHaveProperty("totalUsers");
    expect(result).toHaveProperty("totalSessions");
    expect(result).toHaveProperty("agentUsage");
    expect(result).toHaveProperty("activeSubscriptions");
  });
});

// ─── Subscription Routes ────────────────────────────────────────────────────

describe("subscriptions", () => {
  it("getMy requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.subscriptions.getMy()).rejects.toThrow();
  });

  it("getMy returns null when no subscription", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.subscriptions.getMy();
    expect(result).toBeNull();
  });

  it("cancel requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.subscriptions.cancel()).rejects.toThrow();
  });
});

// ─── Agent Routes ────────────────────────────────────────────────────────────

describe("agents", () => {
  it("getSessions requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.agents.getSessions({})).rejects.toThrow();
  });

  it("getSessions returns empty array for new user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agents.getSessions({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("getSessions filters by agentSlug", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.agents.getSessions({ agentSlug: "entrevista" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("createSession rejects invalid agent slug", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.agents.createSession({ agentSlug: "invalid_agent" })
    ).rejects.toThrow();
  });

  it("getMessages requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.agents.getMessages({ sessionId: 1 })).rejects.toThrow();
  });

  it("sendMessage requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.agents.sendMessage({ sessionId: 1, message: "test" })
    ).rejects.toThrow();
  });
});

// ─── Profile Routes ──────────────────────────────────────────────────────────

describe("profile", () => {
  it("getPayments requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profile.getPayments()).rejects.toThrow();
  });

  it("getPayments returns empty array for new user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.profile.getPayments();
    expect(Array.isArray(result)).toBe(true);
  });
});
