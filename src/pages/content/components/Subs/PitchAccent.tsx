import { FC } from "react";

/** Split a kana reading into morae (small ゃゅょ etc. attach to the preceding kana). */
const toMorae = (reading: string): string[] => {
  const small = "ゃゅょャュョぁぃぅぇぉァィゥェォ";
  const morae: string[] = [];
  for (const ch of reading) {
    if (small.includes(ch) && morae.length) morae[morae.length - 1] += ch;
    else morae.push(ch);
  }
  return morae;
};

/**
 * Tokyo-dialect pitch pattern for accent number `accent` over `moraCount` morae.
 * 0 = heiban (low, then high, particle high); 1 = atamadaka (high, then low);
 * n>=2 = nakadaka/odaka (low, high through mora n, then low).
 */
const pitchPattern = (moraCount: number, accent: number): { highs: boolean[]; particleHigh: boolean } => {
  const highs = new Array<boolean>(moraCount).fill(false);
  for (let i = 0; i < moraCount; i++) {
    const mora = i + 1;
    if (accent === 0) highs[i] = mora !== 1;
    else if (accent === 1) highs[i] = mora === 1;
    else highs[i] = mora !== 1 && mora <= accent;
  }
  return { highs, particleHigh: accent === 0 };
};

/**
 * Renders a reading with its Tokyo pitch-accent contour (overline over high morae, downstep mark
 * after the accented mora). Falls back to a numeric badge when no reading is available. `pitch` may
 * be one number or several joined by "/".
 */
export const PitchAccent: FC<{ pitch: string; reading?: string }> = ({ pitch, reading }) => {
  const values = pitch
    .split("/")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v));
  if (!values.length) return null;

  const morae = reading ? toMorae(reading) : [];
  if (!morae.length) {
    return (
      <span className="es-pitch">
        {values.map((v, i) => (
          <span key={i} className="es-pitch-num">
            {v}
          </span>
        ))}
      </span>
    );
  }

  const accent = values[0]!;
  const { highs, particleHigh } = pitchPattern(morae.length, accent);

  return (
    <span className="es-pitch" title={`pitch accent ${values.join(", ")}`}>
      <span className="es-pitch-diagram">
        {morae.map((mora, i) => {
          const high = highs[i]!;
          const drop = high && (i + 1 >= morae.length ? !particleHigh : !highs[i + 1]!);
          return (
            <span key={i} className={`es-pitch-mora ${high ? "high" : "low"} ${drop ? "drop" : ""}`}>
              {mora}
            </span>
          );
        })}
        <span className={`es-pitch-particle ${particleHigh ? "high" : "low"}`} aria-hidden />
      </span>
      {values.length > 1 && <span className="es-pitch-num">{values.join("/")}</span>}
    </span>
  );
};

/** Compact frequency-rank badge (smaller rank = more common). */
export const FrequencyBadge: FC<{ rank: number }> = ({ rank }) => {
  const label = rank >= 1000 ? `top ${Math.round(rank / 1000)}k` : `#${rank}`;
  return (
    <span className="es-tag es-tag-freq" title={`frequency rank ${rank}`}>
      {label}
    </span>
  );
};
