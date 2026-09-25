import { useEffect, useState } from "react";

export type HimotokiUser = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

type SessionState = {
  accessToken: string | null;
  user: HimotokiUser | null;
};

/** Himotoki account session with sign-in / sign-out through the background worker. */
export function useHimotokiSession() {
  const [session, setSession] = useState<SessionState>({ accessToken: null, user: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    const resp = await chrome.runtime.sendMessage({ type: "himotokiGetSession" });
    if (resp?.ok) {
      setSession({
        accessToken: resp.data?.accessToken ?? null,
        user: resp.data?.user ?? null,
      });
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const resp = await chrome.runtime.sendMessage({ type: "himotokiSignIn" });
      if (!resp?.ok) throw new Error(resp?.error || "Sign-in failed");
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await chrome.runtime.sendMessage({ type: "himotokiSignOut" });
      setSession({ accessToken: null, user: null });
    } finally {
      setBusy(false);
    }
  };

  const signedIn = Boolean(session.accessToken && session.user);
  return { user: signedIn ? session.user : null, busy, error, signIn, signOut };
}
