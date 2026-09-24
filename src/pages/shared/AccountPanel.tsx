import { FC } from "react";

import { useHimotokiSession } from "./useHimotokiSession";

/** Himotoki account sign-in / sign-out. Used by the popup and the welcome page. */
export const AccountPanel: FC = () => {
  const { user, busy, error, signIn, signOut } = useHimotokiSession();

  return (
    <div className="es-account-panel">
      {user ? (
        <>
          <div className="es-popup-user">
            {user.picture ? <img className="es-popup-avatar" src={user.picture} alt="" /> : null}
            <div>
              <div className="es-popup-user-name">{user.name || "Signed in"}</div>
              <div className="es-popup-user-email">{user.email || ""}</div>
            </div>
          </div>
          <button className="es-popup-btn" disabled={busy} onClick={signOut}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="es-popup-hint">Sign in to save subtitle words to your Himotoki account.</p>
          <button className="es-popup-btn es-popup-btn-primary" disabled={busy} onClick={signIn}>
            {busy ? "Signing in…" : "Sign in with Google"}
          </button>
        </>
      )}
      {error ? <div className="es-popup-error">{error}</div> : null}
    </div>
  );
};
