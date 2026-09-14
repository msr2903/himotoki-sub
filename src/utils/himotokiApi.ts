import { HIMOTOKI_DICTS, HIMOTOKI_GLOSS_LANG, himotokiUrl } from "@src/shared/himotokiConfig";
import type { HimotokiEntry, HimotokiSearchResponse } from "@src/utils/himotokiTypes";

export async function himotokiSearch(
  q: string,
  lang: string = HIMOTOKI_GLOSS_LANG,
  limit = 5,
): Promise<HimotokiEntry[]> {
  const params = new URLSearchParams({
    q,
    page: "1",
    limit: String(limit),
    lang,
    dicts: HIMOTOKI_DICTS,
  });
  const res = await fetch(himotokiUrl(`/api/search?${params.toString()}`));
  if (!res.ok) {
    throw new Error(`Himotoki search failed (${res.status})`);
  }
  const data = (await res.json()) as HimotokiSearchResponse;
  return data.words?.results ?? data.results ?? [];
}

export async function himotokiEntry(
  source: string,
  seq: number | string,
  lang: string = HIMOTOKI_GLOSS_LANG,
): Promise<HimotokiEntry> {
  const params = new URLSearchParams({ lang });
  const res = await fetch(
    himotokiUrl(`/api/entry/${encodeURIComponent(source)}/${encodeURIComponent(String(seq))}?${params}`),
  );
  if (!res.ok) {
    throw new Error(`Himotoki entry failed (${res.status})`);
  }
  return (await res.json()) as HimotokiEntry;
}
