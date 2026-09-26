import { describe, expect, it } from "vitest";
import { createHimotokiAccount, type HimotokiSession, SignInRequiredError } from "./himotokiAccount";
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  MAX_FAVORITES,
  toSavedBlob,
  upsertFavorite,
  type FirestoreFields,
  type SavedBlob,
} from "./himotokiSavedBlob";

const REDIRECT = "https://abcdefghijklmnop.chromiumapp.org/";
const DOC = "https://firestore.googleapis.com/v1/projects/himotoki/databases/(default)/documents/saved/u1";

type Call = { url: string; init: RequestInit };

/**
 * Fake Google APIs: Firebase Auth (signInWithIdp, token refresh) and one Firestore document with
 * `updateTime` preconditions, like the real REST API.
 */
function fakeBackend(initial: SavedBlob | null = null) {
  let doc: { fields: FirestoreFields; updateTime: string } | null = initial
    ? { fields: encodeFirestoreFields(initial as unknown as Record<string, unknown>), updateTime: "t0" }
    : null;
  let version = 0;
  const calls: Call[] = [];
  /** Runs once before the next write is applied — simulates another device writing first. */
  let beforeNextWrite: (() => void) | null = null;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp")) {
      return json(200, {
        localId: "u1",
        email: "a@example.com",
        displayName: "A",
        photoUrl: "",
        idToken: "id-1",
        refreshToken: "refresh-1",
        expiresIn: "3600",
      });
    }
    if (url.startsWith("https://securetoken.googleapis.com/v1/token")) {
      return json(200, { id_token: "id-2", refresh_token: "refresh-2", expires_in: "3600" });
    }
    if (url.startsWith(DOC)) {
      const u = new URL(url);
      if (!init.method || init.method === "GET") {
        return doc ? json(200, doc) : json(404, { error: { message: "not found", status: "NOT_FOUND" } });
      }
      if (beforeNextWrite) {
        const run = beforeNextWrite;
        beforeNextWrite = null;
        run();
      }
      const mustNotExist = u.searchParams.get("currentDocument.exists") === "false";
      const expected = u.searchParams.get("currentDocument.updateTime");
      if ((mustNotExist && doc) || (expected !== null && doc?.updateTime !== expected)) {
        return json(400, { error: { message: "precondition", status: "FAILED_PRECONDITION" } });
      }
      version += 1;
      doc = { fields: JSON.parse(String(init.body)).fields, updateTime: `t${version}` };
      return json(200, doc);
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;

  return {
    fetchImpl,
    calls,
    blob: (): SavedBlob | null => (doc ? toSavedBlob(decodeFirestoreFields(doc.fields), 0) : null),
    /** Another device writes this blob before our next write lands. */
    concurrentWrite(blob: SavedBlob) {
      beforeNextWrite = () => {
        version += 1;
        doc = { fields: encodeFirestoreFields(blob as unknown as Record<string, unknown>), updateTime: `t${version}` };
      };
    },
  };
}

function setup(opts: { session?: HimotokiSession | null; initial?: SavedBlob | null; now?: number } = {}) {
  const backend = fakeBackend(opts.initial ?? null);
  let stored: unknown = opts.session ?? null;
  const authUrls: string[] = [];
  const account = createHimotokiAccount({
    apiKey: "KEY",
    projectId: "himotoki",
    fetch: backend.fetchImpl,
    storage: {
      get: async () => stored,
      set: async (s) => {
        stored = s;
      },
      remove: async () => {
        stored = null;
      },
    },
    launchAuthFlow: async (url) => {
      authUrls.push(url);
      return `${REDIRECT}#id_token=google-id-token`;
    },
    redirectUrl: REDIRECT,
    now: () => opts.now ?? 1_000_000,
  });
  return { account, backend, authUrls, stored: () => stored };
}

const session = (overrides: Partial<HimotokiSession> = {}): HimotokiSession => ({
  uid: "u1",
  email: "a@example.com",
  displayName: "A",
  photoUrl: "",
  idToken: "id-1",
  refreshToken: "refresh-1",
  expiresAt: 1_000_000 + 3_600_000,
  ...overrides,
});

const blobWith = (...words: { seq: number; headword: string; folderIds?: string[] }[]): SavedBlob => ({
  version: 1,
  folders: [{ id: "f1", name: "Anime" }],
  favorites: words.map((w) => ({
    source: "jitendex",
    seq: w.seq,
    headword: w.headword,
    reading: "",
    gloss: "",
    pitch: "",
    folderIds: w.folderIds ?? [],
    savedAt: 1,
  })),
  likes: [],
  lastFolderId: "",
  updatedAt: 1,
});

describe("Himotoki account", () => {
  it("signs in with Google through the extension redirect and stores a Firebase session", async () => {
    const { account, backend, authUrls, stored } = setup();
    const user = await account.signIn("client-123");

    expect(user).toEqual({ id: "u1", email: "a@example.com", name: "A", picture: null });
    const auth = new URL(authUrls[0]);
    expect(auth.searchParams.get("client_id")).toBe("client-123");
    expect(auth.searchParams.get("redirect_uri")).toBe(REDIRECT);
    expect(auth.searchParams.get("response_type")).toBe("id_token");
    const exchange = JSON.parse(String(backend.calls[0].init.body));
    expect(exchange.postBody).toContain("id_token=google-id-token");
    expect(exchange.requestUri).toBe(REDIRECT);
    expect(stored()).toMatchObject({ uid: "u1", idToken: "id-1", refreshToken: "refresh-1" });
  });

  it("refuses to sign in without a client ID", async () => {
    const { account } = setup();
    await expect(account.signIn("")).rejects.toThrow(/not configured/);
  });

  it("creates the saved document on the first save, with the mined sentence", async () => {
    const { account, backend } = setup({ session: session() });
    const result = await account.addFavorite({
      seq: "1358280",
      headword: "食べる",
      reading: "たべる",
      gloss: "to eat",
      contextSentence: "寿司を食べる。",
      sourceUrl: "https://www.youtube.com/watch?v=x",
      videoTitle: "Video",
      timestampMs: 61234.7,
    });
    expect(result).toEqual({ added: true });
    const saved = backend.blob()!;
    expect(saved.favorites).toHaveLength(1);
    expect(saved.favorites[0]).toMatchObject({
      source: "jitendex",
      seq: 1358280, // numeric, like the website stores it
      headword: "食べる",
      contextSentence: "寿司を食べる。",
      videoTitle: "Video",
      timestampMs: 61234,
      savedAt: 1_000_000,
    });
    const write = backend.calls.find((c) => c.init.method === "PATCH")!;
    expect(new URL(write.url).searchParams.get("currentDocument.exists")).toBe("false");
    expect((write.init.headers as Record<string, string>).Authorization).toBe("Bearer id-1");
  });

  it("merges into a word already saved elsewhere: keeps its folders and savedAt", async () => {
    const { account, backend } = setup({
      session: session(),
      initial: blobWith({ seq: 1, headword: "猫", folderIds: ["f1"] }),
    });
    const result = await account.addFavorite({ seq: 1, headword: "猫", contextSentence: "猫がいる。" });
    expect(result).toEqual({ added: false });
    expect(backend.blob()!.favorites).toEqual([
      expect.objectContaining({ seq: 1, folderIds: ["f1"], savedAt: 1, contextSentence: "猫がいる。" }),
    ]);
  });

  it("never overwrites a word the website saved at the same moment", async () => {
    const { account, backend } = setup({ session: session(), initial: blobWith({ seq: 1, headword: "猫" }) });
    backend.concurrentWrite(blobWith({ seq: 1, headword: "猫" }, { seq: 2, headword: "犬" }));

    await account.addFavorite({ seq: 3, headword: "鳥" });

    expect(backend.blob()!.favorites.map((f) => f.headword).sort()).toEqual(["犬", "猫", "鳥"]);
    expect(backend.calls.filter((c) => c.init.method === "PATCH")).toHaveLength(2);
  });

  it("refreshes an expiring token before saving", async () => {
    const { account, backend, stored } = setup({ session: session({ expiresAt: 1_000_000 + 10_000 }) });
    await account.addFavorite({ seq: 1, headword: "猫" });
    expect(backend.calls[0].url).toMatch(/securetoken\.googleapis\.com/);
    const write = backend.calls.find((c) => c.init.method === "PATCH")!;
    expect((write.init.headers as Record<string, string>).Authorization).toBe("Bearer id-2");
    expect(stored()).toMatchObject({ idToken: "id-2", refreshToken: "refresh-2" });
  });

  it("asks for sign-in when nobody is signed in", async () => {
    const { account } = setup();
    await expect(account.addFavorite({ seq: 1, headword: "猫" })).rejects.toBeInstanceOf(SignInRequiredError);
    expect(await account.getUser()).toBeNull();
  });

  it("sign-out forgets the session", async () => {
    const { account, stored } = setup({ session: session() });
    expect(await account.getUser()).toMatchObject({ id: "u1" });
    await account.signOut();
    expect(stored()).toBeNull();
  });
});

describe("upsertFavorite", () => {
  it("refuses a new word when the library is full, but still merges existing ones", () => {
    const full = blobWith(...Array.from({ length: MAX_FAVORITES }, (_, i) => ({ seq: i + 1, headword: `w${i}` })));
    expect(() => upsertFavorite(full, { seq: 99_999, headword: "new" }, 5)).toThrow(/full/);
    expect(upsertFavorite(full, { seq: 1, headword: "w0", gloss: "g" }, 5).added).toBe(false);
  });

  it("drops folder IDs the library doesn't have", () => {
    const { blob } = upsertFavorite(blobWith(), { seq: 1, headword: "猫", folderIds: ["f1", "nope"] }, 5);
    expect(blob.favorites[0].folderIds).toEqual(["f1"]);
  });
});
