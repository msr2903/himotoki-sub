import { FC, useEffect, useState } from "react";

type HimotokiUser = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

type SessionState = {
  accessToken: string | null;
  user: HimotokiUser | null;
};

/** Himotoki account sign-in / sign-out. Used by the popup and the options page. */
export const AccountPanel: FC = () => {
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

  const handleSignIn = async () => {
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

  const handleSignOut = async () => {
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

  return (
    <div className="es-account-panel">
      {signedIn ? (
        <>
          <div className="es-popup-user">
            {session.user?.picture ? <img className="es-popup-avatar" src={session.user.picture} alt="" /> : null}
            <div>
              <div className="es-popup-user-name">{session.user?.name || "Signed in"}</div>
              <div className="es-popup-user-email">{session.user?.email || ""}</div>
            </div>
          </div>
          <button className="es-popup-btn" disabled={busy} onClick={handleSignOut}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="es-popup-hint">Sign in to save subtitle words to your Himotoki account.</p>
          <button className="es-popup-btn es-popup-btn-primary" disabled={busy} onClick={handleSignIn}>
            {busy ? "Signing in…" : "Sign in with Google"}
          </button>
        </>
      )}
      {error ? <div className="es-popup-error">{error}</div> : null}
    </div>
  );
};
