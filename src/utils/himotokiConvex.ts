export type HimotokiSessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export type HimotokiSignInResult = {
  access_token: string;
  token_type: string;
  user: HimotokiSessionUser;
};

export type HimotokiFavoriteArgs = {
  source?: string;
  seq: string | number;
  headword: string;
  reading?: string;
  gloss?: string;
  pitch?: string;
  contextSentence?: string;
  sourceUrl?: string;
  videoTitle?: string;
  timestampMs?: number;
};

async function convexCall<T>(
  convexUrl: string,
  path: string,
  args: Record<string, unknown>,
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${convexUrl.replace(/\/$/, "")}/api/mutation`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      path,
      args,
      format: "json",
    }),
  });
  const json = (await res.json()) as {
    status?: string;
    value?: T;
    errorMessage?: string;
  };
  if (!res.ok || json.status === "error") {
    throw new Error(json.errorMessage || `Convex call failed (${res.status})`);
  }
  return json.value as T;
}

async function convexAction<T>(
  convexUrl: string,
  path: string,
  args: Record<string, unknown>,
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(`${convexUrl.replace(/\/$/, "")}/api/action`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      path,
      args,
      format: "json",
    }),
  });
  const json = (await res.json()) as {
    status?: string;
    value?: T;
    errorMessage?: string;
  };
  if (!res.ok || json.status === "error") {
    throw new Error(json.errorMessage || `Convex action failed (${res.status})`);
  }
  return json.value as T;
}

export async function signInWithGoogleIdToken(
  convexUrl: string,
  idToken: string,
): Promise<HimotokiSignInResult> {
  return convexAction<HimotokiSignInResult>(convexUrl, "authActions:signInWithGoogle", {
    idToken,
  });
}

export async function addHimotokiFavorite(
  convexUrl: string,
  accessToken: string,
  favorite: HimotokiFavoriteArgs,
): Promise<{ added: boolean }> {
  return convexCall<{ added: boolean }>(
    convexUrl,
    "saved:addFavorite",
    favorite as unknown as Record<string, unknown>,
    accessToken,
  );
}
