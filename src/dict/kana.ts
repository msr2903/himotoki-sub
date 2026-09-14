/** Hiragana ↔ katakana conversion and fuzzy kana matching for search. */

const SMALL_TSU = "っッ";
const LONG = "ー";

export function toHiragana(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

export function toKatakana(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x3041 && code <= 0x3096) {
      out += String.fromCodePoint(code + 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

export function kanaSearchVariants(text: string): string[] {
  if (!text) return [];
  const variants = [text];
  for (const form of [toHiragana(text), toKatakana(text)]) {
    if (form && !variants.includes(form)) {
      variants.push(form);
    }
  }
  return variants;
}

function isMostlyKatakana(text: string): boolean {
  let kata = 0;
  let hira = 0;
  for (const ch of text) {
    if ((ch >= "ァ" && ch <= "ヶ") || ch === "ー" || ch === "・") kata += 1;
    if (ch >= "ぁ" && ch <= "ん") hira += 1;
  }
  return kata >= hira;
}

export function fuzzyKanaKey(text: string): string {
  let t = toHiragana(text);
  t = t.replaceAll(LONG, "");
  for (const ch of SMALL_TSU) {
    t = t.replaceAll(ch, "");
  }
  return t;
}

export function fuzzyKanaExpansions(
  text: string,
  maxVariants = 96,
): string[] {
  if (!text) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  const add = (s: string): void => {
    if (!s || seen.has(s) || out.length >= maxVariants) return;
    seen.add(s);
    out.push(s);
  };

  for (const base of kanaSearchVariants(text)) {
    add(base);
  }

  for (let round = 0; round < 2; round++) {
    const snapshot = [...out];
    const useKataTsu = isMostlyKatakana(text);
    const small = useKataTsu ? "ッ" : "っ";

    for (const form of snapshot) {
      add(form.replaceAll(LONG, ""));
      add(form.replaceAll("っ", "").replaceAll("ッ", ""));

      for (let i = 0; i < form.length; i++) {
        const ch = form[i]!;
        if (ch === "ツ") {
          add(form.slice(0, i) + "ッ" + form.slice(i + 1));
        } else if (ch === "ッ") {
          add(form.slice(0, i) + "ツ" + form.slice(i + 1));
        } else if (ch === "つ") {
          add(form.slice(0, i) + "っ" + form.slice(i + 1));
        } else if (ch === "っ") {
          add(form.slice(0, i) + "つ" + form.slice(i + 1));
        }
      }

      for (let i = 1; i < form.length; i++) {
        if (form[i] === LONG || form[i - 1] === LONG) continue;
        add(form.slice(0, i) + LONG + form.slice(i));
      }

      for (let i = 1; i < form.length; i++) {
        const ch = form[i]!;
        const prev = form[i - 1]!;
        if (SMALL_TSU.includes(ch) || ch === LONG || SMALL_TSU.includes(prev)) {
          continue;
        }
        add(form.slice(0, i) + small + form.slice(i));
      }
    }
  }

  return out;
}
