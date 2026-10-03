import { describe, expect, it, vi } from "vitest";
import {
  AccountChangedError,
  createHimotokiAccount,
  HimotokiApiError,
  isInvalidSessionError,
  SignInRequiredError,
  type HimotokiSession,
} from "./himotokiAccount";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const session = (uid = "a", expired = false): HimotokiSession => ({
  uid,
  email: `${uid}@example.test`,
  displayName: uid,
  photoUrl: "",
  idToken: `id-${uid}`,
  refreshToken: `refresh-${uid}`,
  expiresAt: expired ? 0 : 1_000_000 + 3_600_000,
});

function deferred() {
  let resolve!: (r: Response) => void;
  const promise = new Promise<Response>((r) => (resolve = r));
  return { promise, resolve };
}

type Call = { url: string; init: RequestInit };

function setup(fetcher: (url: string, init: RequestInit) => Promise<Response>, expired = false) {
  let current: HimotokiSession | null = session("a", expired);
  const calls: Call[] = [];
  const account = createHimotokiAccount({
    apiKey: "test",
    projectId: "himotoki",
    fetch: (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push({ url: String(input), init });
      return fetcher(String(input), init);
    }) as typeof fetch,
    storage: {
      get: async () => current,
      set: async (s) => {
        current = s;
      },
      remove: async () => {
        current = null;
      },
    },
    launchAuthFlow: async () => "https://test.chromiumapp.org/#id_token=google",
    redirectUrl: "https://test.chromiumapp.org/",
    now: () => 1_000_000,
  });
  return { account, calls, get: () => current, set: (s: HimotokiSession | null) => (current = s) };
}

const signInResponse = (uid: string) =>
  json({ localId: uid, idToken: `id-${uid}`, refreshToken: `refresh-${uid}`, expiresIn: "3600" });

describe("account lifecycle (#102)", () => {
  it("a late refresh success after sign-out does not restore the old session", async () => {
    const refresh = deferred();
    const s = setup(async (url) => (url.includes("securetoken") ? refresh.promise : json({ fields: {}, updateTime: "t" })), true);
    const save = s.account.addFavorite({ seq: 1, headword: "猫" }).catch((e) => e);
    await vi.waitFor(() => expect(s.calls).toHaveLength(1));
    await s.account.signOut();
    refresh.resolve(json({ id_token: "renewed-a", refresh_token: "new-a", expires_in: "3600" }));
    expect(await save).toBeInstanceOf(AccountChangedError);
    expect(s.get()).toBeNull();
    expect(s.calls).toHaveLength(1); // no Firestore request after sign-out
  });

  it("an old refresh failure keeps the newer account B (sign-in through the account)", async () => {
    const refresh = deferred();
    const s = setup(async (url) => {
      if (url.includes("securetoken")) return refresh.promise;
      if (url.includes("signInWithIdp")) return signInResponse("b");
      throw new Error(`unexpected ${url}`);
    }, true);
    const save = s.account.addFavorite({ seq: 1, headword: "猫" }).catch((e) => e);
    await vi.waitFor(() => expect(s.calls).toHaveLength(1));
    await s.account.signIn("client");
    refresh.resolve(json({ error: { message: "INVALID_REFRESH_TOKEN" } }, 400));
    expect(await save).toBeInstanceOf(AccountChangedError);
    expect(s.get()?.uid).toBe("b");
  });

  it("an old refresh failure keeps account B stored by another context", async () => {
    const refresh = deferred();
    const s = setup(async () => refresh.promise, true);
    const save = s.account.addFavorite({ seq: 1, headword: "猫" }).catch((e) => e);
    await vi.waitFor(() => expect(s.calls).toHaveLength(1));
    s.set(session("b"));
    refresh.resolve(json({ error: { message: "INVALID_REFRESH_TOKEN" } }, 400));
    expect(await save).toBeInstanceOf(AccountChangedError);
    expect(s.get()?.uid).toBe("b");
  });

  it("a late refresh success does not overwrite account B", async () => {
    const refresh = deferred();
    const s = setup(async () => refresh.promise, true);
    const save = s.account.addFavorite({ seq: 1, headword: "猫" }).catch((e) => e);
    await vi.waitFor(() => expect(s.calls).toHaveLength(1));
    s.set(session("b"));
    refresh.resolve(json({ id_token: "renewed-a", refresh_token: "new-a", expires_in: "3600" }));
    expect(await save).toBeInstanceOf(AccountChangedError);
    expect(s.get()).toEqual(session("b"));
  });

  it("a save begun under A never writes into B after an account switch during the read", async () => {
    const read = deferred();
    const s = setup(async (url, init) => {
      if (!init.method || init.method === "GET") return url.includes("/saved/a") ? read.promise : json({}, 404);
      return json({ fields: {}, updateTime: "t1" });
    });
    const save = s.account
      .addFavorite({ seq: 123, headword: "猫", contextSentence: "Private sentence selected under A" })
      .catch((e) => e);
    await vi.waitFor(() => expect(s.calls).toHaveLength(1));
    s.set(session("b"));
    read.resolve(json({ error: { message: "NOT_FOUND" } }, 404));
    expect(await save).toBeInstanceOf(AccountChangedError);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].url).toContain("/saved/a");
  });

  it("a conflict retry stays bound to the original account", async () => {
    let patches = 0;
    const s: ReturnType<typeof setup> = setup(async (_url, init) => {
      if (!init.method || init.method === "GET") return json({}, 404);
      patches += 1;
      s.set(session("b")); // switch accounts while the first write is rejected
      return json({ error: { message: "precondition", status: "FAILED_PRECONDITION" } }, 400);
    });
    expect(await s.account.addFavorite({ seq: 1, headword: "猫" }).catch((e) => e)).toBeInstanceOf(
      AccountChangedError,
    );
    expect(patches).toBe(1);
    expect(s.calls.every((c) => c.url.includes("/saved/a"))).toBe(true);
  });

  it("a save after re-signing in uses the new account", async () => {
    const s = setup(async (url, init) => {
      if (url.includes("signInWithIdp")) return signInResponse("b");
      if (!init.method || init.method === "GET") return json({}, 404);
      return json({ fields: {}, updateTime: "t1" });
    });
    await s.account.signOut();
    await s.account.signIn("client");
    expect(await s.account.addFavorite({ seq: 1, headword: "猫" })).toEqual({ added: true });
    expect(s.calls.filter((c) => c.url.includes("firestore")).every((c) => c.url.includes("/saved/b"))).toBe(true);
  });
});

describe("token refresh failures (#103)", () => {
  it("keeps the session on HTTP 429 and recovers on a later refresh", async () => {
    let limited = true;
    const s = setup(async (url, init) => {
      if (url.includes("securetoken")) {
        return limited
          ? json({ error: { code: 429, message: "TOO_MANY_REQUESTS", status: "RESOURCE_EXHAUSTED" } }, 429)
          : json({ id_token: "id-a2", refresh_token: "refresh-a2", expires_in: "3600" });
      }
      if (!init.method || init.method === "GET") return json({}, 404);
      return json({ fields: {}, updateTime: "t1" });
    }, true);
    const error = await s.account.addFavorite({ seq: 1, headword: "猫" }).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SignInRequiredError);
    expect(s.get()?.uid).toBe("a");

    limited = false;
    expect(await s.account.addFavorite({ seq: 1, headword: "猫" })).toEqual({ added: true });
    expect(s.get()).toMatchObject({ uid: "a", idToken: "id-a2", refreshToken: "refresh-a2" });
  });

  it("keeps the session on a configuration error", async () => {
    const s = setup(
      async () => json({ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } }, 400),
      true,
    );
    const error = await s.account.addFavorite({ seq: 1, headword: "猫" }).catch((e) => e);
    expect(error).not.toBeInstanceOf(SignInRequiredError);
    expect(s.get()?.uid).toBe("a");
  });

  it.each(["INVALID_REFRESH_TOKEN", "TOKEN_EXPIRED", "USER_DISABLED", "USER_NOT_FOUND"])(
    "clears the session when the refresh token is invalid (%s)",
    async (code) => {
      const s = setup(async () => json({ error: { code: 400, message: code, status: "INVALID_ARGUMENT" } }, 400), true);
      expect(await s.account.addFavorite({ seq: 1, headword: "猫" }).catch((e) => e)).toBeInstanceOf(
        SignInRequiredError,
      );
      expect(s.get()).toBeNull();
    },
  );

  it("classifies refresh errors", () => {
    expect(isInvalidSessionError(new HimotokiApiError("USER_DISABLED : gone", 400, "INVALID_ARGUMENT"))).toBe(true);
    expect(isInvalidSessionError(new HimotokiApiError("Bad Request", 400, "invalid_grant"))).toBe(true);
    expect(isInvalidSessionError(new HimotokiApiError("TOO_MANY_REQUESTS", 429, "RESOURCE_EXHAUSTED"))).toBe(false);
    expect(isInvalidSessionError(new HimotokiApiError("PROJECT_NUMBER_MISMATCH", 400, "INVALID_ARGUMENT"))).toBe(false);
    expect(isInvalidSessionError(new HimotokiApiError("Forbidden", 403, "PERMISSION_DENIED"))).toBe(false);
    expect(isInvalidSessionError(new Error("network"))).toBe(false);
  });
});
