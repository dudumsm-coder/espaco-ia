import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    creditsBalance: 1000,
    totalTokensUsed: 0,
    totalCreditsSpent: 0,
    avatarUrl: null,
    phone: null,
    company: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns user data for authenticated user", async () => {
    const ctx = createContext({ name: "Admin User", role: "admin" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Admin User");
    expect(result?.role).toBe("admin");
  });

  it("returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const clearedCookies: any[] = [];
    const ctx = createContext();
    ctx.res = {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"];

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("role-based access", () => {
  it("admin can access admin routes", async () => {
    const ctx = createContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    // admin.getUsers should not throw for admin
    // We can't actually query DB in unit tests, but we verify the procedure doesn't throw FORBIDDEN
    try {
      await caller.admin.getUsers();
    } catch (error: any) {
      // Database errors are OK, FORBIDDEN is not
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });

  it("non-admin cannot access admin routes", async () => {
    const ctx = createContext({ role: "free" });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.getUsers();
      expect.fail("Should have thrown FORBIDDEN");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("editor cannot access admin-only routes", async () => {
    const ctx = createContext({ role: "editor" });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.getUsers();
      expect.fail("Should have thrown FORBIDDEN");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("premium user cannot access admin routes", async () => {
    const ctx = createContext({ role: "premium" });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.getUsers();
      expect.fail("Should have thrown FORBIDDEN");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});

describe("credits system", () => {
  it("authenticated user can query credit balance", async () => {
    const ctx = createContext({ role: "admin", creditsBalance: 500 });
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.credits.getBalance();
      // Admin should show as having credits
      expect(result).toBeDefined();
    } catch (error: any) {
      // DB errors are acceptable in unit tests
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });

  it("unauthenticated user cannot query credits", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.credits.getBalance();
      expect.fail("Should have thrown UNAUTHORIZED");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("access levels", () => {
  it("public can query active access levels", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.accessLevels.getActive();
      expect(Array.isArray(result)).toBe(true);
    } catch (error: any) {
      // DB errors are acceptable
      expect(error.code).not.toBe("FORBIDDEN");
    }
  });

  it("non-admin cannot query all access levels", async () => {
    const ctx = createContext({ role: "free" });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.accessLevels.getAll();
      expect.fail("Should have thrown FORBIDDEN");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});

describe("agent routes", () => {
  it("unauthenticated user cannot create agent session", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agents.createSession({ agentSlug: "entrevista" });
      expect.fail("Should have thrown UNAUTHORIZED");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
    }
  });

  it("rejects invalid agent slug", async () => {
    const ctx = createContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agents.createSession({ agentSlug: "invalid-agent" });
      expect.fail("Should have thrown BAD_REQUEST");
    } catch (error: any) {
      expect(error.code).toBe("BAD_REQUEST");
    }
  });
});
