/**
 * Himotoki account access for "Save to Himotoki": Google sign-in, a Firebase Auth session, and
 * the user's `saved/{uid}` Firestore document over REST. The same account and document as the
 * website and the mobile app, so a word saved here shows up there (and in the Raycast extension)
 * without any extra step.
 *
 * Runs in the background service worker. Everything browser-specific (fetch, storage, the
 * sign-in window) is injected so the flow is testable with fakes.
 */
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  toSavedBlob,
  upsertFavorite,
  createEmptySavedBlob,
  type FavoriteInput,
  type FirestoreFields,
  type SavedBlob,
} from "./himotokiSavedBlob";

export type HimotokiUser = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export type HimotokiSession = {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  idToken: string;
  refreshToken: string;
  /** Epoch ms when `idToken` expires. */
  expiresAt: number;
};

export type HimotokiAccountDeps = {
  /** Public Firebase web API key of the `himotoki` project. */
  apiKey: string;
  projectId: string;
  fetch: typeof fetch;
  storage: {
    get(): Promise<unknown>;
    set(session: HimotokiSession): Promise<void>;
    remove(): Promise<void>;
  };
  /** Opens Google's sign-in window and resolves with the final redirect URL (with the token). */
  launchAuthFlow(url: string): Promise<string | undefined>;
  /** `chrome.identity.getRedirectURL()` — must be an authorized redirect URI of the client. */
  redirectUrl: string;
  now?: () => number;
};

/** Refresh the Firebase ID token when it has less than this long left. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;
/** Attempts for a read-modify-write when another device writes the document in between. */
const MAX_WRITE_ATTEMPTS = 3;

export class HimotokiApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string,
  ) {
    super(message);
    this.name = "HimotokiApiError";
  }
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class SignInRequiredError extends Error {
  constructor(message = "Sign in to Himotoki from the extension popup first.") {
    super(message);
    this.name = "SignInRequiredError";
  }
}

/** The account signed in or out while an operation was running; its work was discarded. */
export class AccountChangedError extends Error {
  constructor(message = "Your Himotoki account changed while saving. Try again.") {
    super(message);
    this.name = "AccountChangedError";
  }
}

/** Token-refresh error codes that mean the session itself is no longer valid. */
const INVALID_SESSION_CODES = new Set([
  "TOKEN_EXPIRED",
  "USER_DISABLED",
  "USER_NOT_FOUND",
  "INVALID_REFRESH_TOKEN",
  "MISSING_REFRESH_TOKEN",
  "INVALID_GRANT_TYPE",
  "invalid_grant",
]);

/**
 * True only for refresh failures that revoke the session (revoked/expired token, disabled or
 * deleted user). Rate limits (429), server errors and configuration problems (bad API key,
 * project mismatch) keep the session so a later refresh can succeed without signing in again.
 */
export function isInvalidSessionError(error: unknown): boolean {
  if (!(error instanceof HimotokiApiError)) return false;
  if (error.status !== 400 && error.status !== 401) return false;
  // Firebase messages look like "TOKEN_EXPIRED" or "USER_DISABLED : details".
  const code = error.message.split(/[\s:]/, 1)[0];
  return INVALID_SESSION_CODES.has(code) || INVALID_SESSION_CODES.has(error.statusText);
}

function isSession(value: unknown): value is HimotokiSession {
  if (typeof value !== "object" || value === null) return false;
  const { uid, idToken, refreshToken, expiresAt } = value as Record<string, unknown>;
  return (
    typeof uid === "string" &&
    typeof idToken === "string" &&
    typeof refreshToken === "string" &&
    typeof expiresAt === "number"
  );
}

export function sessionUser(session: HimotokiSession): HimotokiUser {
  return {
    id: session.uid,
    email: session.email || null,
    name: session.displayName || null,
    picture: session.photoUrl || null,
  };
}

/** The account an operation started under; every later step must still match it. */
type Binding = { uid: string; generation: number };

export function createHimotokiAccount(deps: HimotokiAccountDeps) {
  const now = deps.now ?? (() => Date.now());
  /** Bumped on every sign-in/sign-out so in-flight work from the old session is discarded. */
  let generation = 0;
  let refreshing: { refreshToken: string; generation: number; promise: Promise<HimotokiSession> } | null = null;

  async function callGoogleApi<T>(url: string, init: RequestInit): Promise<T> {
    const response = await deps.fetch(url, { ...init, cache: "no-store", credentials: "omit" });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      /* handled below */
    }
    if (!response.ok) {
      const error = (body as { error?: unknown; error_description?: string } | null)?.error;
      let message = "";
      let status = "";
      if (typeof error === "object" && error !== null) {
        message = String((error as { message?: string }).message ?? "");
        status = String((error as { status?: string }).status ?? "");
      } else if (typeof error === "string") {
        message = (body as { error_description?: string }).error_description ?? error;
        status = error;
      }
      throw new HimotokiApiError(
        message || `Himotoki request failed (HTTP ${response.status})`,
        response.status,
        status,
      );
    }
    if (body === null) throw new Error(`Himotoki returned an invalid response (HTTP ${response.status})`);
    return body as T;
  }

  async function storedSession(): Promise<HimotokiSession | null> {
    const value = await deps.storage.get();
    return isSession(value) ? value : null;
  }

  /** The stored session, if it still belongs to `binding`; otherwise the operation is stale. */
  async function currentSession(binding: Binding): Promise<HimotokiSession> {
    if (binding.generation !== generation) throw new AccountChangedError();
    const session = await storedSession();
    if (binding.generation !== generation) throw new AccountChangedError();
    if (!session) throw new SignInRequiredError();
    if (session.uid !== binding.uid) throw new AccountChangedError();
    return session;
  }

  /** True while `session` (same refresh token) is still the stored, current one. */
  async function isStillStored(session: HimotokiSession, gen: number): Promise<boolean> {
    if (gen !== generation) return false;
    const stored = await storedSession();
    return gen === generation && stored?.uid === session.uid && stored.refreshToken === session.refreshToken;
  }

  async function refresh(session: HimotokiSession, gen: number): Promise<HimotokiSession> {
    let response: { id_token: string; refresh_token: string; expires_in: string };
    try {
      response = await callGoogleApi(`https://securetoken.googleapis.com/v1/token?key=${deps.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken }).toString(),
      });
    } catch (error) {
      // A newer sign-in/out happened meanwhile: never touch the session that replaced this one.
      if (!(await isStillStored(session, gen))) throw new AccountChangedError();
      if (isInvalidSessionError(error)) {
        // Revoked or expired: drop the session so the popup offers sign-in again.
        generation += 1;
        await deps.storage.remove();
        throw new SignInRequiredError("Your Himotoki sign-in expired. Sign in again from the extension popup.");
      }
      if (error instanceof HimotokiApiError && error.status === 429) {
        throw new Error("Himotoki sign-in is busy right now. Try again in a moment.");
      }
      throw error;
    }
    if (!(await isStillStored(session, gen))) throw new AccountChangedError();
    const next: HimotokiSession = {
      ...session,
      idToken: response.id_token,
      refreshToken: response.refresh_token,
      expiresAt: now() + Number(response.expires_in) * 1000,
    };
    // Re-check synchronously: a sign-in/out may have run while isStillStored resolved.
    if (gen !== generation) throw new AccountChangedError();
    await deps.storage.set(next);
    return next;
  }

  /** A session of `binding`'s account with an unexpired ID token; concurrent callers share one refresh. */
  async function activeSession(binding: Binding): Promise<HimotokiSession> {
    const session = await currentSession(binding);
    if (session.expiresAt - now() > TOKEN_REFRESH_MARGIN_MS) return session;
    if (!refreshing || refreshing.refreshToken !== session.refreshToken || refreshing.generation !== generation) {
      const entry = {
        refreshToken: session.refreshToken,
        generation,
        promise: refresh(session, generation).finally(() => {
          if (refreshing === entry) refreshing = null;
        }),
      };
      refreshing = entry;
    }
    const next = await refreshing.promise;
    if (binding.generation !== generation || next.uid !== binding.uid) throw new AccountChangedError();
    return next;
  }

  function documentUrl(uid: string): string {
    return `https://firestore.googleapis.com/v1/projects/${deps.projectId}/databases/(default)/documents/saved/${encodeURIComponent(uid)}`;
  }

  async function readSaved(binding: Binding): Promise<{ blob: SavedBlob; updateTime: string | null }> {
    const { uid, idToken } = await activeSession(binding);
    let result: { blob: SavedBlob; updateTime: string | null };
    try {
      const document = await callGoogleApi<{ fields?: FirestoreFields; updateTime?: string }>(documentUrl(uid), {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      result = {
        blob: toSavedBlob(decodeFirestoreFields(document.fields ?? {}), now()),
        updateTime: document.updateTime ?? null,
      };
    } catch (error) {
      if (!(error instanceof HimotokiApiError && error.status === 404)) throw error;
      result = { blob: createEmptySavedBlob(now()), updateTime: null };
    }
    // The account may have changed while the read was in flight.
    await currentSession(binding);
    return result;
  }

  /** Replaces the document only if it is unchanged since `updateTime` (or still absent). */
  async function writeSaved(binding: Binding, blob: SavedBlob, updateTime: string | null): Promise<void> {
    const { uid, idToken } = await activeSession(binding);
    const url = new URL(documentUrl(uid));
    if (updateTime === null) url.searchParams.set("currentDocument.exists", "false");
    else url.searchParams.set("currentDocument.updateTime", updateTime);
    try {
      await callGoogleApi(url.toString(), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: encodeFirestoreFields(blob as unknown as Record<string, unknown>) }),
      });
    } catch (error) {
      if (error instanceof HimotokiApiError) {
        if (
          error.status === 409 ||
          ["FAILED_PRECONDITION", "ALREADY_EXISTS", "ABORTED"].includes(error.statusText)
        ) {
          throw new ConflictError(error.message);
        }
        if (error.status === 403) {
          throw new Error("Himotoki rejected the save. Your library may be full, or your sign-in may have expired.");
        }
      }
      throw error;
    }
  }

  return {
    /** Signed-in user, or null. Never loads anything from the network. */
    async getUser(): Promise<HimotokiUser | null> {
      const session = await storedSession();
      return session ? sessionUser(session) : null;
    },

    /** Google account picker → Firebase session in the `himotoki` project. */
    async signIn(clientId: string): Promise<HimotokiUser> {
      if (!clientId) throw new Error("Himotoki sign-in is not configured (missing Google client ID).");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: clientId,
        response_type: "id_token",
        redirect_uri: deps.redirectUrl,
        scope: "openid email profile",
        nonce: crypto.randomUUID(),
        prompt: "select_account",
      }).toString();
      const responseUrl = await deps.launchAuthFlow(url.toString());
      if (!responseUrl) throw new Error("Google sign-in was cancelled");
      const result = new URLSearchParams(new URL(responseUrl).hash.slice(1));
      const error = result.get("error");
      if (error) throw new Error(`Google sign-in failed: ${error}`);
      const idToken = result.get("id_token");
      if (!idToken) throw new Error("Google sign-in returned no ID token");

      const response = await callGoogleApi<{
        localId: string;
        email?: string;
        displayName?: string;
        photoUrl?: string;
        idToken: string;
        refreshToken: string;
        expiresIn: string;
      }>(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${deps.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postBody: new URLSearchParams({ id_token: idToken, providerId: "google.com" }).toString(),
          requestUri: deps.redirectUrl,
          returnSecureToken: true,
        }),
      });
      const session: HimotokiSession = {
        uid: response.localId,
        email: response.email ?? "",
        displayName: response.displayName ?? "",
        photoUrl: response.photoUrl ?? "",
        idToken: response.idToken,
        refreshToken: response.refreshToken,
        expiresAt: now() + Number(response.expiresIn) * 1000,
      };
      generation += 1;
      await deps.storage.set(session);
      return sessionUser(session);
    },

    async signOut(): Promise<void> {
      generation += 1;
      await deps.storage.remove();
    },

    /**
     * Add or merge a word in the user's library. Reads the document, applies Himotoki's upsert,
     * and writes it back only if nobody wrote in between — otherwise re-reads and retries, so a
     * word saved at the same moment on the website is never overwritten.
     */
    async addFavorite(input: FavoriteInput): Promise<{ added: boolean }> {
      // Bind the whole operation, retries included, to the account that was signed in when it began.
      const gen = generation;
      const origin = await storedSession();
      if (gen !== generation) throw new AccountChangedError();
      if (!origin) throw new SignInRequiredError();
      const binding: Binding = { uid: origin.uid, generation: gen };
      for (let attempt = 1; ; attempt += 1) {
        const { blob, updateTime } = await readSaved(binding);
        const result = upsertFavorite(blob, input, now());
        try {
          await writeSaved(binding, result.blob, updateTime);
          return { added: result.added };
        } catch (error) {
          if (error instanceof ConflictError && attempt < MAX_WRITE_ATTEMPTS) continue;
          throw error;
        }
      }
    },
  };
}

export type HimotokiAccount = ReturnType<typeof createHimotokiAccount>;
