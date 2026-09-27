/**
 * Pure helpers for Himotoki's `saved/{uid}` Firestore document — the same document the website,
 * the mobile app, the Raycast extension and the Yomitan fork read and write. The merge rules
 * follow `upsertFavorite` in Himotoki's `@msr2903/sync`, so a word saved here converges with the
 * same word saved anywhere else.
 */

/** Himotoki's Firestore rules reject documents with more favorites than this. */
export const MAX_FAVORITES = 500;

export type Folder = { id: string; name: string; [key: string]: unknown };

export type Favorite = {
  source: string;
  seq: number | string;
  headword: string;
  reading: string;
  gloss: string;
  pitch: string;
  folderIds: string[];
  savedAt: number;
  contextSentence?: string;
  sourceUrl?: string;
  videoTitle?: string;
  timestampMs?: number;
  [key: string]: unknown;
};

export type SavedBlob = {
  version: 1;
  folders: Folder[];
  favorites: Favorite[];
  likes: unknown[];
  lastFolderId: string;
  updatedAt: number;
};

export type FavoriteInput = {
  source?: string;
  seq: number | string;
  headword: string;
  reading?: string;
  gloss?: string;
  pitch?: string;
  folderIds?: string[];
  contextSentence?: string;
  sourceUrl?: string;
  videoTitle?: string;
  timestampMs?: number;
};

export function favoriteKey(source: string | undefined, seq: number | string): string {
  return `${source || "jitendex"}:${seq}`;
}

export function createEmptySavedBlob(now: number): SavedBlob {
  return { version: 1, folders: [], favorites: [], likes: [], lastFolderId: "", updatedAt: now };
}

/**
 * Coerces a decoded document into the blob shape, keeping list entries it doesn't recognise
 * untouched so a save never drops data written by a newer client.
 */
export function toSavedBlob(raw: unknown, now: number): SavedBlob {
  const blob = createEmptySavedBlob(now);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return blob;
  const { folders, favorites, likes, lastFolderId, updatedAt } = raw as Record<string, unknown>;
  if (Array.isArray(folders)) blob.folders = folders as Folder[];
  if (Array.isArray(favorites)) blob.favorites = favorites as Favorite[];
  if (Array.isArray(likes)) blob.likes = likes;
  if (typeof lastFolderId === "string") blob.lastFolderId = lastFolderId;
  if (typeof updatedAt === "number") blob.updatedAt = updatedAt;
  return blob;
}

/** Numeric dictionary sequence numbers are stored as numbers, like the website stores them. */
function normalizeSeq(seq: number | string): number | string {
  if (typeof seq === "number") return seq;
  const trimmed = String(seq).trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/**
 * Adds a favorite, or merges it into the existing one with the same `source:seq`. An existing
 * favorite keeps its `savedAt` and folders (new folders are added, never removed); non-empty
 * incoming fields win.
 * @throws When the favorite is new and the library is full.
 */
export function upsertFavorite(
  blob: SavedBlob,
  input: FavoriteInput,
  now: number,
): { blob: SavedBlob; added: boolean } {
  const knownFolderIds = new Set(blob.folders.map(({ id }) => id));
  const folderIds = (input.folderIds ?? []).filter((id) => knownFolderIds.has(id));

  const meta: Partial<Favorite> = {};
  if (input.contextSentence) meta.contextSentence = input.contextSentence.slice(0, 1000);
  if (input.sourceUrl) meta.sourceUrl = input.sourceUrl;
  if (input.videoTitle) meta.videoTitle = input.videoTitle;
  if (typeof input.timestampMs === "number" && Number.isFinite(input.timestampMs)) {
    meta.timestampMs = Math.trunc(input.timestampMs);
  }

  const source = input.source || "jitendex";
  const seq = normalizeSeq(input.seq);
  const key = favoriteKey(source, seq);
  const index = blob.favorites.findIndex((f) => favoriteKey(f.source, f.seq) === key);

  let favorites: Favorite[];
  if (index >= 0) {
    const existing = blob.favorites[index];
    favorites = [...blob.favorites];
    favorites[index] = {
      ...existing,
      ...meta,
      headword: input.headword || existing.headword,
      reading: input.reading || existing.reading,
      gloss: input.gloss || existing.gloss,
      pitch: input.pitch || existing.pitch,
      folderIds: [...new Set([...(existing.folderIds ?? []), ...folderIds])],
    };
  } else {
    if (blob.favorites.length >= MAX_FAVORITES) {
      throw new Error(
        `Your Himotoki library is full (${MAX_FAVORITES} saved words). Remove some words on Himotoki to save more.`,
      );
    }
    favorites = [
      {
        source,
        seq,
        headword: input.headword,
        reading: input.reading || "",
        gloss: input.gloss || "",
        pitch: input.pitch || "",
        folderIds,
        savedAt: now,
        ...meta,
      },
      ...blob.favorites,
    ];
  }

  return {
    blob: { ...blob, version: 1, favorites, updatedAt: Math.max(now, blob.updatedAt) },
    added: index < 0,
  };
}

/* ------------------------------------------------------------------ */
/* Firestore REST value encoding                                        */
/* ------------------------------------------------------------------ */

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: FirestoreFields } };

export type FirestoreFields = Record<string, FirestoreValue>;

export function encodeFirestoreValue(value: unknown): FirestoreValue {
  switch (typeof value) {
    case "boolean":
      return { booleanValue: value };
    case "number":
      return Number.isInteger(value) ? { integerValue: `${value}` } : { doubleValue: value };
    case "string":
      return { stringValue: value };
    case "object":
      if (value === null) return { nullValue: null };
      if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } };
      return { mapValue: { fields: encodeFirestoreFields(value as Record<string, unknown>) } };
    default:
      return { nullValue: null };
  }
}

/** `undefined` properties are omitted, like Firestore's `ignoreUndefinedProperties`. */
export function encodeFirestoreFields(object: Record<string, unknown>): FirestoreFields {
  const fields: FirestoreFields = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) fields[key] = encodeFirestoreValue(value);
  }
  return fields;
}

export function decodeFirestoreValue(value: FirestoreValue): unknown {
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeFirestoreValue);
  if ("mapValue" in value) return decodeFirestoreFields(value.mapValue.fields ?? {});
  return null;
}

export function decodeFirestoreFields(fields: FirestoreFields): Record<string, unknown> {
  const object: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) object[key] = decodeFirestoreValue(value);
  return object;
}
