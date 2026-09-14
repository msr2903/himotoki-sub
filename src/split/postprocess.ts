/** Post-process segments: peel fused genitives; merge known compounds. */

const FORCE_SPLIT_STEMS = [
  "あなた",
  "あたし",
  "わたし",
  "ワタシ",
  "彼女",
  "我々",
  "みんな",
  "僕",
  "俺",
  "私",
  "君",
  "彼",
  "皆",
] as const;

const FORCE_SPLIT_PARTICLES = [
  "から",
  "まで",
  "より",
  "の",
  "は",
  "が",
  "を",
  "に",
  "と",
  "へ",
  "で",
  "も",
] as const;

const KNOWN_COMPOUNDS = [
  "お好み焼き",
  "味噌煮込みうどん",
  "とんこつラーメン",
  "豚骨ラーメン",
  "鍋焼きうどん",
  "味噌ラーメン",
  "醤油ラーメン",
  "塩ラーメン",
  "天ぷらそば",
  "きつねうどん",
  "かけうどん",
  "ざるうどん",
  "きつねそば",
  "月見そば",
  "かけそば",
  "ざるそば",
  "しゃぶしゃぶ",
  "すき焼き",
  "すきやき",
  "たこ焼き",
  "たい焼き",
  "焼きそば",
  "焼き肉",
  "焼肉",
  "焼き鳥",
  "焼鳥",
  "目玉焼き",
  "生姜焼き",
  "照り焼き",
  "かば焼き",
  "蒲焼き",
  "串焼き",
  "野菜炒め",
  "海鮮丼",
  "うなぎ丼",
  "マグロ丼",
  "親子丼",
  "カツ丼",
  "鉄火丼",
  "鰻丼",
  "牛丼",
  "天丼",
  "カレーライス",
  "ハヤシライス",
  "オムライス",
  "キムチ鍋",
  "お茶漬け",
  "から揚げ",
  "エビフライ",
  "味噌汁",
  "寄せ鍋",
  "水炊き",
  "肉じゃが",
  "唐揚げ",
  "とんかつ",
  "豚カツ",
  "茶漬け",
  "お雑煮",
  "湯豆腐",
  "豚汁",
  "おにぎり",
  "チャーハン",
  "冷奴",
].sort((a, b) => b.length - a.length);

export function splitFusedPronounParticles(segments: string[]): string[] {
  const out: string[] = [];
  for (const seg of segments) {
    let peeled = false;
    for (const stem of FORCE_SPLIT_STEMS) {
      if (!seg.startsWith(stem) || seg === stem) continue;
      const rest = seg.slice(stem.length);
      if ((FORCE_SPLIT_PARTICLES as readonly string[]).includes(rest)) {
        out.push(stem, rest);
        peeled = true;
        break;
      }
    }
    if (!peeled) out.push(seg);
  }
  return out;
}

function segmentCharSpans(segments: string[]): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let pos = 0;
  for (const seg of segments) {
    const end = pos + seg.length;
    spans.push([pos, end]);
    pos = end;
  }
  return spans;
}

export function mergeKnownCompounds(
  segments: string[],
  compounds: string[] = KNOWN_COMPOUNDS,
): string[] {
  let segs = [...segments];
  if (!segs.length) return segs;
  const text = segs.join("");
  for (const compound of compounds) {
    if (compound.length < 2 || !text.includes(compound)) continue;
    let searchFrom = 0;
    while (true) {
      const idx = text.indexOf(compound, searchFrom);
      if (idx < 0) break;
      const end = idx + compound.length;
      const spans = segmentCharSpans(segs);
      let first: number | null = null;
      let last: number | null = null;
      for (let i = 0; i < spans.length; i++) {
        const span = spans[i]!;
        if (span[1] > idx && span[0] < end) {
          if (first === null) first = i;
          last = i;
        }
      }
      if (first === null || last === null) break;
      if (first === last && segs[first] === compound) {
        searchFrom = end;
        continue;
      }
      const firstSpan = spans[first]!;
      const lastSpan = spans[last]!;
      const prefix = text.slice(firstSpan[0], idx);
      const suffix = text.slice(end, lastSpan[1]);
      const mid: string[] = [];
      if (prefix) mid.push(prefix);
      mid.push(compound);
      if (suffix) mid.push(suffix);
      segs = [...segs.slice(0, first), ...mid, ...segs.slice(last + 1)];
      searchFrom = end;
    }
  }
  return segs;
}

export function normalizeSegments(text: string, segments: string[]): string[] {
  const segs = [...segments];
  if (segs.join("") !== text) return segs;
  let fixed = mergeKnownCompounds(segs);
  if (fixed.join("") !== text) fixed = segs;
  fixed = splitFusedPronounParticles(fixed);
  if (fixed.join("") !== text) return segs;
  return fixed;
}
