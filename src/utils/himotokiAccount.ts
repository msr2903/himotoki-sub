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

export function createHimotokiAccount(deps: HimotokiAccountDeps) {
  const now = deps.now ?? (() => Date.now());
  let refreshing: Promise<HimotokiSession> | null = null;

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

  async function refresh(session: HimotokiSession): Promise<HimotokiSession> {
    let response: { id_token: string; refresh_token: string; expires_in: string };
    try {
      response = await callGoogleApi(`https://securetoken.googleapis.com/v1/token?key=${deps.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken }).toString(),
      });
    } catch (error) {
      if (error instanceof HimotokiApiError && error.status >= 400 && error.status < 500) {
        // Revoked or expired: drop the session so the popup offers sign-in again.
        await deps.storage.remove();
        throw new SignInRequiredError("Your Himotoki sign-in expired. Sign in again from the extension popup.");
      }
      throw error;
    }
    const next: HimotokiSession = {
      ...session,
      idToken: response.id_token,
      refreshToken: response.refresh_token,
      expiresAt: now() + Number(response.expires_in) * 1000,
    };
    await deps.storage.set(next);
    return next;
  }

  /** A session with an unexpired ID token; concurrent callers share one refresh. */
  async function activeSession(): Promise<HimotokiSession> {
    const session = await storedSession();
    if (!session) throw new SignInRequiredError();
    if (session.expiresAt - now() > TOKEN_REFRESH_MARGIN_MS) return session;
    if (!refreshing) {
      refreshing = refresh(session).finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  function documentUrl(uid: string): string {
    return `https://firestore.googleapis.com/v1/projects/${deps.projectId}/databases/(default)/documents/saved/${encodeURIComponent(uid)}`;
  }

  async function readSaved(): Promise<{ blob: SavedBlob; updateTime: string | null }> {
    const { uid, idToken } = await activeSession();
    try {
      const document = await callGoogleApi<{ fields?: FirestoreFields; updateTime?: string }>(documentUrl(uid), {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      return {
        blob: toSavedBlob(decodeFirestoreFields(document.fields ?? {}), now()),
        updateTime: document.updateTime ?? null,
      };
    } catch (error) {
      if (error instanceof HimotokiApiError && error.status === 404) {
        return { blob: createEmptySavedBlob(now()), updateTime: null };
      }
      throw error;
    }
  }

  /** Replaces the document only if it is unchanged since `updateTime` (or still absent). */
  async function writeSaved(blob: SavedBlob, updateTime: string | null): Promise<void> {
    const { uid, idToken } = await activeSession();
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
      await deps.storage.set(session);
      return sessionUser(session);
    },

    async signOut(): Promise<void> {
      await deps.storage.remove();
    },

    /**
     * Add or merge a word in the user's library. Reads the document, applies Himotoki's upsert,
     * and writes it back only if nobody wrote in between — otherwise re-reads and retries, so a
     * word saved at the same moment on the website is never overwritten.
     */
    async addFavorite(input: FavoriteInput): Promise<{ added: boolean }> {
      for (let attempt = 1; ; attempt += 1) {
        const { blob, updateTime } = await readSaved();
        const result = upsertFavorite(blob, input, now());
        try {
          await writeSaved(result.blob, updateTime);
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
