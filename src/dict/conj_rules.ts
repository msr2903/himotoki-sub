// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated port, type-checked at its call sites
// @ts-nocheck — large auto-port; runtime-critical peels fixed below.
/** Port of conj_rules.py — pure conjugation rule tables and helpers. */

export type PeelRule = {
  ends_with: string;
  replace_with: string;
  conj_type: string;
  suffix: string;
  gloss?: string;
  neg?: boolean;
  fml?: boolean;
  transform?: string | null;
  alt_conj_type?: string | null;
};

export type ConjStep = {
  conj_type: string;
  suffix: string;
  gloss?: string;
  neg?: boolean;
  fml?: boolean;
  transform?: string | null;
  alt_conj_type?: string | null;
};

export function peelRule(p: PeelRule): PeelRule {
  return { gloss: "", neg: false, fml: false, transform: null, alt_conj_type: null, ...p };
}
export function conjStep(p: ConjStep): ConjStep {
  return { gloss: "", neg: false, fml: false, transform: null, alt_conj_type: null, ...p };
}

export const TIPS = { ["Causative"]: "Make or let someone do the action.", ["Passive"]: "The subject is affected by the action (is done / is made to…).", ["Causative-Passive"]: "Be made to do something (often unwillingly).", ["Past (~ta)"]: "Completed / past action.", ["Polite"]: "Polite (ます/です) speech level.", ["Negative"]: "Negates the verb/adjective.", ["Potential"]: "Ability: can do.", ["Potential/Passive"]: "Can do, or is done (ambiguous for ichidan られる).", ["Conjunctive (~te)"]: "Te-form: linking, requests, progressive with いる.", ["Conjunctive (~te, progressive)"]: "Progressive / ongoing action (～ている).", ["Desire (〜たい)"]: "Want to do; expresses the speaker's desire.", ["Conditional (ば)"]: "If/when condition (ば-form).", ["Provisional (たら)"]: "If/when; provisional conditional (たら).", ["Provisional (なら)"]: "Contextual conditional: if it is the case that…", ["Volitional"]: "Let's… / I shall… (volitional form).", ["Imperative"]: "Command or strong request.", ["Negative imperative"]: "Do not (prohibitive な).", ["Completion (しまう)"]: "Finish completely; often regret or thoroughness.", ["Preparatory (おく)"]: "Do in advance; leave something done for later.", ["Attempt (みる)"]: "Try doing (てみる).", ["Benefactive (くれる)"]: "Someone does the action for the speaker's benefit.", ["Benefactive (もらう)"]: "The speaker receives the benefit of an action.", ["Benefactive (あげる)"]: "Do for someone else; give the action to another.", ["Desiderative (ほしい)"]: "Want someone else to do (てほしい).", ["Te-shimau (てしまう)"]: "Te-form + しまう: completion or regret.", ["Progressive (ている)"]: "Ongoing action or resulting state (～ている).", ["Directional (ていく)"]: "Action continues away from the speaker (～ていく).", ["Directional (てくる)"]: "Action comes toward the speaker (～てくる).", ["Obligation"]: "Must / have to (〜なければならない, 〜なくてはいけない).", ["While (~ながら)"]: "While doing; simultaneous action (〜ながら).", ["Easy to (~やすい)"]: "Easy to do (〜やすい).", ["Hard to (~にくい)"]: "Hard to do (〜にくい).", ["Evidential (そう)"]: "Looks like; appears (〜そう for i-adjectives)." };
export const ICHIDAN_POS = new Set(["v1", "v1-s"]);
export const GODAN_POS = new Set(["v5u", "v5k", "v5g", "v5s", "v5t", "v5n", "v5b", "v5m", "v5r", "v5r-i", "v5aru", "v5k-s"]);
export const SURU_POS = new Set(["vs", "vs-i", "vs-s", "vs-c"]);
export const KURU_POS = new Set(["vk"]);
export const I_ADJ_POS = new Set(["adj-i", "adj-ix"]);
export const VERB_POS = new Set([...ICHIDAN_POS, ...GODAN_POS, ...SURU_POS, ...KURU_POS]);
export const CONJ_POS = new Set([...VERB_POS, ...I_ADJ_POS]);
export const GODAN_MASU_STEM = { ["う"]: "い", ["く"]: "き", ["ぐ"]: "ぎ", ["す"]: "し", ["つ"]: "ち", ["ぬ"]: "に", ["ぶ"]: "び", ["む"]: "み", ["る"]: "り" };
export const GODAN_TE_SUFFIX = { ["う"]: "って", ["つ"]: "って", ["る"]: "って", ["く"]: "いて", ["ぐ"]: "いで", ["す"]: "して", ["ぬ"]: "んで", ["ぶ"]: "んで", ["む"]: "んで" };
export const GODAN_A_STEM = { ["う"]: "わ", ["く"]: "か", ["ぐ"]: "が", ["す"]: "さ", ["つ"]: "た", ["ぬ"]: "な", ["ぶ"]: "ば", ["む"]: "ま", ["る"]: "ら" };
export const GODAN_E_STEM = { ["う"]: "え", ["く"]: "け", ["ぐ"]: "げ", ["す"]: "せ", ["つ"]: "て", ["ぬ"]: "ね", ["ぶ"]: "べ", ["む"]: "め", ["る"]: "れ" };
export const GODAN_O_STEM = { ["う"]: "お", ["く"]: "こ", ["ぐ"]: "ご", ["す"]: "そ", ["つ"]: "と", ["ぬ"]: "の", ["ぶ"]: "ぼ", ["む"]: "も", ["る"]: "ろ" };
export const GODAN_BA_STEM = { ["う"]: "え", ["く"]: "け", ["ぐ"]: "げ", ["す"]: "せ", ["つ"]: "て", ["ぬ"]: "ね", ["ぶ"]: "べ", ["む"]: "め", ["る"]: "れ" };
export const GODAN_NAI_STEM = GODAN_A_STEM;
export const GODAN_RE_STEM = GODAN_E_STEM;
export const TRANSFORM_POS_HINT = { ["godan_ku_ta"]: "v5k", ["godan_ku_te"]: "v5k", ["godan_gu_ta"]: "v5g", ["godan_gu_te"]: "v5g", ["godan_su_ta"]: "v5s", ["godan_su_te"]: "v5s", ["godan_tta"]: "v5u", ["godan_tte"]: "v5u", ["godan_bu_te"]: "v5b", ["godan_mu_te"]: "v5m", ["godan_n_ta"]: "v5n", ["godan_n_te"]: "v5n", ["godan_ke_potential"]: "v5k", ["godan_ge_potential"]: "v5g", ["godan_se_potential"]: "v5s", ["godan_te_potential"]: "v5t", ["godan_ne_potential"]: "v5n", ["godan_be_potential"]: "v5b", ["godan_me_potential"]: "v5m", ["godan_re_potential"]: "v5r", ["godan_e_potential"]: "v5u", ["godan_ke_potential_masu"]: "v5k", ["godan_ge_potential_masu"]: "v5g", ["godan_se_potential_masu"]: "v5s", ["godan_te_potential_masu"]: "v5t", ["godan_ne_potential_masu"]: "v5n", ["godan_be_potential_masu"]: "v5b", ["godan_me_potential_masu"]: "v5m", ["godan_re_potential_masu"]: "v5r", ["godan_e_potential_masu"]: "v5u", ["godan_a_passive"]: "v5", ["godan_a_passive_re"]: "v5", ["godan_a_passive_past"]: "v5", ["godan_a_causative"]: "v5", ["godan_a_causative_short"]: "v5", ["godan_a_causpass"]: "v5", ["godan_short_causpass"]: "v5", ["godan_imperative"]: "v5", ["godan_neg_imperative"]: "v5", ["godan_ba"]: "v5", ["godan_neg"]: "v5", ["godan_neg_past"]: "v5", ["godan_neg_cond"]: "v5", ["godan_masu"]: "v5", ["godan_mashita"]: "v5" };
export const SPECIAL_IKU = "行く";
export const SPECIAL_IKU_KANA = "いく";
export const SPECIAL_IKU_SET = new Set([SPECIAL_IKU, SPECIAL_IKU_KANA]);
export const SURU_ATEJI = new Set(["為る", "刷る", "擦る", "掏る", "剃る"]);
export const SPECIAL_II = new Set(["いい", "良い"]);
export const PARTICLE_LEMMAS = new Set(["は", "が", "を", "に", "で", "と", "も", "へ", "の", "か", "よ", "ね", "な"]);
export const PARADIGM_KEYS = ["Dictionary", "Polite", "Past", "Te-form", "Negative", "Potential", "Passive", "Causative", "Causative-Passive", "Volitional", "Conditional (ば)", "Imperative", "Desire (〜たい)", "Provisional (たら)", "Progressive (ている)", "Te-shimau (てしまう)"];
export function conjStepToDict(step: ConjStep, form: string = ""): Record<string, unknown> {
  let tip = (TIPS[step.conj_type] ?? "");
  if (step.alt_conj_type) {
    const alt_tip = (TIPS[step.alt_conj_type] ?? "");
    if ((alt_tip && (alt_tip !== tip))) {
      tip = `${tip} ${alt_tip}`.trim();
    }
  }
  return { ["conjType"]: step.conj_type, ["suffix"]: step.suffix, ["gloss"]: step.gloss, ["form"]: form, ["tip"]: tip, ["neg"]: step.neg, ["fml"]: step.fml };
}

function _te_aux_rules(): Array<PeelRule> {
  const aux = [];
  for (const [end, repl, suf, neg, fml] of [["てしまいました", "て", "しまいました", false, true], ["でしまいました", "で", "しまいました", false, true], ["てしまった", "て", "しまった", false, false], ["でしまった", "で", "しまった", false, false], ["てしまう", "て", "しまう", false, false], ["でしまう", "で", "しまう", false, false], ["ちゃった", "て", "ちゃった", false, false], ["じゃった", "で", "じゃった", false, false], ["ちゃう", "て", "ちゃう", false, false], ["じゃう", "で", "じゃう", false, false], ["しちゃった", "する", "しちゃった", false, false], ["しちゃう", "する", "しちゃう", false, false], ["されちゃった", "する", "されちゃった", false, false], ["されてしまった", "する", "されてしまった", false, false], ["されてしまう", "する", "されてしまう", false, false], ["された", "する", "された", false, false], ["しまいました", "", "しまいました", false, true], ["しまった", "", "しまった", false, false], ["しまう", "", "しまう", false, false]]) {
    const ctype = "Completion (しまう)";
    if ((end.startsWith("され") || ["された"].includes(end))) {
      aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Passive", suffix: (!end.includes("しま") ? suf : "され"), neg: neg, fml: fml, transform: "suru_passive" }));
      if ((end.includes("しま") || end.includes("ちゃ"))) {
        aux.push(peelRule({ ends_with: end, replace_with: "する", conj_type: "Completion (しまう)", suffix: suf, neg: neg, fml: fml }));
      }
      continue;
    }
    if (end.startsWith("しち")) {
      aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: ctype, suffix: suf, neg: neg, fml: fml }));
      continue;
    }
    aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: ctype, suffix: suf, neg: neg, fml: fml }));
  }
  for (const [end, repl, suf, neg, fml] of [["ていませんでした", "て", "いませんでした", true, true], ["でいませんでした", "で", "いませんでした", true, true], ["ていません", "て", "いません", true, true], ["でいません", "で", "いません", true, true], ["ていました", "て", "いました", false, true], ["でいました", "で", "いました", false, true], ["ていた", "て", "いた", false, false], ["でいた", "で", "いた", false, false], ["ている", "て", "いる", false, false], ["でいる", "で", "いる", false, false], ["ています", "て", "います", false, true], ["でいます", "で", "います", false, true], ["てる", "て", "る", false, false], ["でる", "で", "る", false, false], ["てます", "て", "ます", false, true], ["でます", "で", "ます", false, true]]) {
    aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Conjunctive (~te, progressive)", suffix: suf, gloss: "progressive", neg: neg, fml: fml }));
  }
  for (const [end, repl, suf] of [["ておきました", "て", "おきました"], ["でおきました", "で", "おきました"], ["ておいた", "て", "おいた"], ["でおいた", "で", "おいた"], ["ておく", "て", "おく"], ["でおく", "で", "おく"], ["ときました", "て", "きました"], ["といた", "て", "いた"], ["とく", "て", "く"]]) {
    aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Preparatory (おく)", suffix: suf, fml: suf.includes("ました") }));
  }
  for (const [end, repl, suf] of [["てみました", "て", "みました"], ["でみました", "で", "みました"], ["てみた", "て", "みた"], ["でみた", "で", "みた"], ["てみる", "て", "みる"], ["でみる", "で", "みる"]]) {
    aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Attempt (みる)", suffix: suf, fml: suf.includes("ました") }));
  }
  for (const [end, repl, suf] of [["てくれました", "て", "くれました"], ["でくれました", "で", "くれました"], ["てくれた", "て", "くれた"], ["でくれた", "で", "くれた"], ["てくれる", "て", "くれる"], ["でくれる", "で", "くれる"], ["てください", "て", "ください"], ["でください", "で", "ください"]]) {
    aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Benefactive (くれる)", suffix: suf, fml: suf.includes("ました") }));
  }
  for (const [end, repl, suf] of [["てもらいました", "て", "もらいました"], ["でもらいました", "で", "もらいました"], ["てもらった", "て", "もらった"], ["でもらった", "で", "もらった"], ["てもらう", "て", "もらう"], ["でもらう", "で", "もらう"]]) {
    aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Benefactive (もらう)", suffix: suf, fml: suf.includes("ました") }));
  }
  for (const [end, repl, suf] of [["てあげました", "て", "あげました"], ["であげました", "で", "あげました"], ["てあげた", "て", "あげた"], ["であげた", "で", "あげた"], ["てあげる", "て", "あげる"], ["であげる", "で", "あげる"]]) {
    aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Benefactive (あげる)", suffix: suf, fml: suf.includes("ました") }));
  }
  for (const [end, repl, suf] of [["てほしい", "て", "ほしい"], ["でほしい", "で", "ほしい"], ["て欲しい", "て", "欲しい"], ["で欲しい", "で", "欲しい"]]) {
    aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Desiderative (ほしい)", suffix: suf }));
  }
  for (const [end, repl, suf, ctype, fml] of [["ていきました", "て", "いきました", "Directional (ていく)", true], ["でいきました", "で", "いきました", "Directional (ていく)", true], ["ていった", "て", "いった", "Directional (ていく)", false], ["でいった", "で", "いった", "Directional (ていく)", false], ["ていく", "て", "いく", "Directional (ていく)", false], ["でいく", "で", "いく", "Directional (ていく)", false], ["てきました", "て", "きました", "Directional (てくる)", true], ["できました", "で", "きました", "Directional (てくる)", true], ["てきた", "て", "きた", "Directional (てくる)", false], ["できた", "で", "きた", "Directional (てくる)", false], ["てくる", "て", "くる", "Directional (てくる)", false], ["でくる", "で", "くる", "Directional (てくる)", false]]) {
    aux.push(peelRule({ ends_with: end, replace_with: repl, conj_type: ctype, suffix: suf, fml: fml }));
  }
  aux.push(peelRule({ ends_with: "てく", replace_with: "て", conj_type: "Conjunctive (~te)", suffix: "く", gloss: "colloquial ていく" }));
  return Array.from(aux);
}

function _desire_rules(): Array<PeelRule> {
  return [peelRule({ ends_with: "たくなかった", replace_with: "", conj_type: "Desire (〜たい)", suffix: "たくなかった", neg: true, transform: "masu_stem_to_dict" }), peelRule({ ends_with: "たくない", replace_with: "", conj_type: "Desire (〜たい)", suffix: "たくない", neg: true, transform: "masu_stem_to_dict" }), peelRule({ ends_with: "たかった", replace_with: "", conj_type: "Desire (〜たい)", suffix: "たかった", transform: "masu_stem_to_dict" }), peelRule({ ends_with: "たいです", replace_with: "", conj_type: "Desire (〜たい)", suffix: "たいです", fml: true, transform: "masu_stem_to_dict" }), peelRule({ ends_with: "たい", replace_with: "", conj_type: "Desire (〜たい)", suffix: "たい", transform: "masu_stem_to_dict" })];
}

function _conditional_rules(): Array<PeelRule> {
  const rules = [peelRule({ ends_with: "なければ", replace_with: "", conj_type: "Conditional (ば)", suffix: "なければ", neg: true, transform: "godan_neg_cond" }), peelRule({ ends_with: "なかったら", replace_with: "", conj_type: "Provisional (たら)", suffix: "なかったら", neg: true, transform: "ichidan_neg_past" }), peelRule({ ends_with: "だったら", replace_with: "", conj_type: "Provisional (たら)", suffix: "だったら", transform: "strip_da" }), peelRule({ ends_with: "したら", replace_with: "する", conj_type: "Provisional (たら)", suffix: "したら" }), peelRule({ ends_with: "きたら", replace_with: "来る", conj_type: "Provisional (たら)", suffix: "きたら" }), peelRule({ ends_with: "来たら", replace_with: "来る", conj_type: "Provisional (たら)", suffix: "来たら" }), peelRule({ ends_with: "たら", replace_with: "", conj_type: "Provisional (たら)", suffix: "たら", transform: "strip_ta" }), peelRule({ ends_with: "なら", replace_with: "", conj_type: "Provisional (なら)", suffix: "なら" })];
  for (const [end, repl, suf] of [["けば", "く", "けば"], ["げば", "ぐ", "げば"], ["せば", "す", "せば"], ["てば", "つ", "てば"], ["ねば", "ぬ", "ねば"], ["べば", "ぶ", "べば"], ["めば", "む", "めば"], ["えば", "う", "えば"], ["れば", "る", "れば"]]) {
    rules.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Conditional (ば)", suffix: suf }));
  }
  rules.push(peelRule({ ends_with: "れば", replace_with: "る", conj_type: "Conditional (ば)", suffix: "れば", transform: "ichidan_ba" }));
  return Array.from(rules);
}

function _negative_imperative_rules(): Array<PeelRule> {
  const rules = [peelRule({ ends_with: "るな", replace_with: "る", conj_type: "Negative imperative", suffix: "な", neg: true, transform: "ichidan_neg_imperative" })];
  for (const [end, repl] of [["うな", "う"], ["くな", "く"], ["ぐな", "ぐ"], ["すな", "す"], ["つな", "つ"], ["ぬな", "ぬ"], ["ぶな", "ぶ"], ["むな", "む"]]) {
    rules.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Negative imperative", suffix: "な", neg: true, transform: "godan_neg_imperative" }));
  }
  return Array.from(rules);
}

function _obligation_rules(): Array<PeelRule> {
  return [peelRule({ ends_with: "なければならない", replace_with: "", conj_type: "Obligation", suffix: "なければならない", neg: true, transform: "obligation_stem" }), peelRule({ ends_with: "なければいけない", replace_with: "", conj_type: "Obligation", suffix: "なければいけない", neg: true, transform: "obligation_stem" }), peelRule({ ends_with: "なくてはならない", replace_with: "", conj_type: "Obligation", suffix: "なくてはならない", neg: true, transform: "obligation_neg_te" }), peelRule({ ends_with: "なくてはいけない", replace_with: "", conj_type: "Obligation", suffix: "なくてはいけない", neg: true, transform: "obligation_neg_te" }), peelRule({ ends_with: "なくてはだめ", replace_with: "", conj_type: "Obligation", suffix: "なくてはだめ", neg: true, transform: "obligation_neg_te" })];
}

function _compound_suffix_rules(): Array<PeelRule> {
  return [peelRule({ ends_with: "ながら", replace_with: "", conj_type: "While (~ながら)", suffix: "ながら", transform: "masu_stem_to_dict" }), peelRule({ ends_with: "やすい", replace_with: "", conj_type: "Easy to (~やすい)", suffix: "やすい", transform: "masu_stem_to_dict" }), peelRule({ ends_with: "にくい", replace_with: "", conj_type: "Hard to (~にくい)", suffix: "にくい", transform: "masu_stem_to_dict" })];
}

function _volitional_imperative_rules(): Array<PeelRule> {
  const rules = [peelRule({ ends_with: "ましょうか", replace_with: "ます", conj_type: "Volitional", suffix: "ましょうか", fml: true }), peelRule({ ends_with: "ましょう", replace_with: "ます", conj_type: "Volitional", suffix: "ましょう", fml: true }), peelRule({ ends_with: "よう", replace_with: "る", conj_type: "Volitional", suffix: "よう", transform: "ichidan_volitional" }), peelRule({ ends_with: "ろ", replace_with: "る", conj_type: "Imperative", suffix: "ろ", transform: "ichidan_imperative" }), peelRule({ ends_with: "よ", replace_with: "る", conj_type: "Imperative", suffix: "よ", transform: "ichidan_imperative" })];
  for (const [end, repl] of [["おう", "う"], ["こう", "く"], ["ごう", "ぐ"], ["そう", "す"], ["とう", "つ"], ["のう", "ぬ"], ["ぼう", "ぶ"], ["もう", "む"], ["ろう", "る"]]) {
    rules.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Volitional", suffix: end }));
  }
  for (const [end, repl] of [["え", "う"], ["け", "く"], ["げ", "ぐ"], ["せ", "す"], ["て", "つ"], ["ね", "ぬ"], ["べ", "ぶ"], ["め", "む"], ["れ", "る"]]) {
    rules.push(peelRule({ ends_with: end, replace_with: repl, conj_type: "Imperative", suffix: end, transform: "godan_imperative" }));
  }
  return Array.from(rules);
}

export const PEEL_RULES = [..._te_aux_rules(), ..._obligation_rules(), ..._desire_rules(), peelRule({ ends_with: "ませんでした", replace_with: "ます", conj_type: "Past (~ta)", suffix: "でした", neg: true, fml: true }), peelRule({ ends_with: "ません", replace_with: "ます", conj_type: "Negative", suffix: "ません", neg: true, fml: true }), peelRule({ ends_with: "ではありません", replace_with: "だ", conj_type: "Negative", suffix: "ではありません", neg: true, fml: true }), peelRule({ ends_with: "じゃありません", replace_with: "だ", conj_type: "Negative", suffix: "じゃありません", neg: true, fml: true }), peelRule({ ends_with: "えます", replace_with: "え", conj_type: "Potential", suffix: "えます", fml: true, transform: "godan_e_potential_masu" }), peelRule({ ends_with: "けます", replace_with: "け", conj_type: "Potential", suffix: "けます", fml: true, transform: "godan_ke_potential_masu" }), peelRule({ ends_with: "げます", replace_with: "げ", conj_type: "Potential", suffix: "げます", fml: true, transform: "godan_ge_potential_masu" }), peelRule({ ends_with: "せます", replace_with: "せ", conj_type: "Potential", suffix: "せます", fml: true, transform: "godan_se_potential_masu" }), peelRule({ ends_with: "てます", replace_with: "て", conj_type: "Potential", suffix: "てます", fml: true, transform: "godan_te_potential_masu" }), peelRule({ ends_with: "ねます", replace_with: "ね", conj_type: "Potential", suffix: "ねます", fml: true, transform: "godan_ne_potential_masu" }), peelRule({ ends_with: "べます", replace_with: "べ", conj_type: "Potential", suffix: "べます", fml: true, transform: "godan_be_potential_masu" }), peelRule({ ends_with: "めます", replace_with: "め", conj_type: "Potential", suffix: "めます", fml: true, transform: "godan_me_potential_masu" }), peelRule({ ends_with: "れます", replace_with: "れ", conj_type: "Potential", suffix: "れます", fml: true, transform: "godan_re_potential_masu" }), peelRule({ ends_with: "ました", replace_with: "ます", conj_type: "Past (~ta)", suffix: "した", fml: true }), peelRule({ ends_with: "ます", replace_with: "", conj_type: "Polite", suffix: "ます", fml: true, transform: "polite_masu" }), peelRule({ ends_with: "せられました", replace_with: "", conj_type: "Causative-Passive", suffix: "せられました", fml: true, transform: "godan_a_causpass" }), peelRule({ ends_with: "せられた", replace_with: "", conj_type: "Causative-Passive", suffix: "せられた", transform: "godan_a_causpass" }), peelRule({ ends_with: "せられる", replace_with: "", conj_type: "Causative-Passive", suffix: "せられる", transform: "godan_a_causpass" }), peelRule({ ends_with: "されました", replace_with: "", conj_type: "Causative-Passive", suffix: "されました", fml: true, transform: "godan_short_causpass" }), peelRule({ ends_with: "された", replace_with: "", conj_type: "Causative-Passive", suffix: "された", transform: "godan_short_causpass" }), peelRule({ ends_with: "される", replace_with: "", conj_type: "Causative-Passive", suffix: "される", transform: "godan_short_causpass" }), peelRule({ ends_with: "られません", replace_with: "", conj_type: "Passive", suffix: "られません", neg: true, fml: true, transform: "ichidan_passive", alt_conj_type: "Potential/Passive" }), peelRule({ ends_with: "られない", replace_with: "", conj_type: "Passive", suffix: "られない", neg: true, transform: "ichidan_passive", alt_conj_type: "Potential/Passive" }), peelRule({ ends_with: "られた", replace_with: "", conj_type: "Passive", suffix: "られた", transform: "ichidan_passive_past", alt_conj_type: "Potential/Passive" }), peelRule({ ends_with: "られる", replace_with: "", conj_type: "Passive", suffix: "られる", transform: "ichidan_passive", alt_conj_type: "Potential/Passive" }), peelRule({ ends_with: "られ", replace_with: "", conj_type: "Passive", suffix: "られ", transform: "ichidan_passive_re", alt_conj_type: "Potential/Passive" }), peelRule({ ends_with: "えられる", replace_with: "", conj_type: "Potential", suffix: "えられる", transform: "ichidan_potential" }), peelRule({ ends_with: "える", replace_with: "", conj_type: "Potential", suffix: "える", transform: "ichidan_potential_short" }), peelRule({ ends_with: "させません", replace_with: "", conj_type: "Causative", suffix: "させません", neg: true, fml: true, transform: "ichidan_causative" }), peelRule({ ends_with: "させない", replace_with: "", conj_type: "Causative", suffix: "させない", neg: true, transform: "ichidan_causative" }), peelRule({ ends_with: "させる", replace_with: "", conj_type: "Causative", suffix: "させる", transform: "ichidan_causative" }), peelRule({ ends_with: "させ", replace_with: "", conj_type: "Causative", suffix: "させ", transform: "ichidan_causative_short" }), peelRule({ ends_with: "しませんでした", replace_with: "します", conj_type: "Past (~ta)", suffix: "でした", neg: true, fml: true }), peelRule({ ends_with: "しません", replace_with: "します", conj_type: "Negative", suffix: "ません", neg: true, fml: true }), peelRule({ ends_with: "しました", replace_with: "します", conj_type: "Past (~ta)", suffix: "した", fml: true }), peelRule({ ends_with: "します", replace_with: "する", conj_type: "Polite", suffix: "ます", fml: true }), peelRule({ ends_with: "しない", replace_with: "する", conj_type: "Negative", suffix: "しない", neg: true }), peelRule({ ends_with: "しなかった", replace_with: "する", conj_type: "Past (~ta)", suffix: "なかった", neg: true }), peelRule({ ends_with: "しなければ", replace_with: "する", conj_type: "Conditional (ば)", suffix: "なければ", neg: true }), peelRule({ ends_with: "しなくて", replace_with: "する", conj_type: "Conjunctive (~te)", suffix: "なくて", neg: true }), peelRule({ ends_with: "しないで", replace_with: "する", conj_type: "Negative", suffix: "ないで", neg: true }), peelRule({ ends_with: "した", replace_with: "する", conj_type: "Past (~ta)", suffix: "した" }), peelRule({ ends_with: "して", replace_with: "する", conj_type: "Conjunctive (~te)", suffix: "して" }), peelRule({ ends_with: "しよう", replace_with: "する", conj_type: "Volitional", suffix: "しよう" }), peelRule({ ends_with: "できる", replace_with: "する", conj_type: "Potential", suffix: "できる" }), peelRule({ ends_with: "できませんでした", replace_with: "できる", conj_type: "Past (~ta)", suffix: "ませんでした", neg: true, fml: true }), peelRule({ ends_with: "できません", replace_with: "できる", conj_type: "Negative", suffix: "ません", neg: true, fml: true }), peelRule({ ends_with: "できました", replace_with: "できる", conj_type: "Past (~ta)", suffix: "ました", fml: true }), peelRule({ ends_with: "できなかった", replace_with: "できる", conj_type: "Past (~ta)", suffix: "なかった", neg: true }), peelRule({ ends_with: "できない", replace_with: "できる", conj_type: "Negative", suffix: "ない", neg: true }), peelRule({ ends_with: "させる", replace_with: "する", conj_type: "Causative", suffix: "させる", transform: "suru_causative" }), peelRule({ ends_with: "される", replace_with: "する", conj_type: "Passive", suffix: "される", transform: "suru_passive" }), peelRule({ ends_with: "させられる", replace_with: "する", conj_type: "Causative-Passive", suffix: "させられる", transform: "suru_causpass" }), peelRule({ ends_with: "させられた", replace_with: "する", conj_type: "Causative-Passive", suffix: "させられた", transform: "suru_causpass" }), peelRule({ ends_with: "来ませんでした", replace_with: "来ます", conj_type: "Past (~ta)", suffix: "でした", neg: true, fml: true }), peelRule({ ends_with: "来ません", replace_with: "来ます", conj_type: "Negative", suffix: "ません", neg: true, fml: true }), peelRule({ ends_with: "来ました", replace_with: "来ます", conj_type: "Past (~ta)", suffix: "した", fml: true }), peelRule({ ends_with: "来ます", replace_with: "来る", conj_type: "Polite", suffix: "ます", fml: true }), peelRule({ ends_with: "来ない", replace_with: "来る", conj_type: "Negative", suffix: "ない", neg: true }), peelRule({ ends_with: "来た", replace_with: "来る", conj_type: "Past (~ta)", suffix: "た" }), peelRule({ ends_with: "来て", replace_with: "来る", conj_type: "Conjunctive (~te)", suffix: "て" }), peelRule({ ends_with: "来よう", replace_with: "来る", conj_type: "Volitional", suffix: "よう" }), peelRule({ ends_with: "来られる", replace_with: "来る", conj_type: "Passive", suffix: "られる", alt_conj_type: "Potential/Passive" }), peelRule({ ends_with: "来させる", replace_with: "来る", conj_type: "Causative", suffix: "させる" }), peelRule({ ends_with: "きませんでした", replace_with: "きます", conj_type: "Past (~ta)", suffix: "でした", neg: true, fml: true, transform: "kuru_kana" }), peelRule({ ends_with: "きません", replace_with: "きます", conj_type: "Negative", suffix: "ません", neg: true, fml: true, transform: "kuru_kana" }), peelRule({ ends_with: "きました", replace_with: "きます", conj_type: "Past (~ta)", suffix: "した", fml: true, transform: "kuru_kana" }), peelRule({ ends_with: "きます", replace_with: "く", conj_type: "Polite", suffix: "ます", fml: true, transform: "kuru_kana_masu" }), peelRule({ ends_with: "こない", replace_with: "く", conj_type: "Negative", suffix: "ない", neg: true, transform: "kuru_kana" }), peelRule({ ends_with: "こなかった", replace_with: "く", conj_type: "Past (~ta)", suffix: "なかった", neg: true, transform: "kuru_kana" }), peelRule({ ends_with: "こなくて", replace_with: "く", conj_type: "Conjunctive (~te)", suffix: "なくて", neg: true, transform: "kuru_kana" }), peelRule({ ends_with: "きた", replace_with: "く", conj_type: "Past (~ta)", suffix: "た", transform: "kuru_kana" }), peelRule({ ends_with: "きて", replace_with: "く", conj_type: "Conjunctive (~te)", suffix: "て", transform: "kuru_kana" }), peelRule({ ends_with: "こよう", replace_with: "く", conj_type: "Volitional", suffix: "よう", transform: "kuru_kana" }), peelRule({ ends_with: "こられる", replace_with: "く", conj_type: "Passive", suffix: "られる", transform: "kuru_kana", alt_conj_type: "Potential/Passive" }), peelRule({ ends_with: "こさせる", replace_with: "く", conj_type: "Causative", suffix: "させる", transform: "kuru_kana" }), ..._conditional_rules(), ..._volitional_imperative_rules(), ..._negative_imperative_rules(), peelRule({ ends_with: "行った", replace_with: "行く", conj_type: "Past (~ta)", suffix: "った", transform: "iku_past" }), peelRule({ ends_with: "行って", replace_with: "行く", conj_type: "Conjunctive (~te)", suffix: "って", transform: "iku_te" }), peelRule({ ends_with: "行かない", replace_with: "行く", conj_type: "Negative", suffix: "ない", neg: true }), peelRule({ ends_with: "行きます", replace_with: "行く", conj_type: "Polite", suffix: "ます", fml: true, transform: "iku_masu" }), peelRule({ ends_with: "行きました", replace_with: "行く", conj_type: "Past (~ta)", suffix: "ました", fml: true, transform: "iku_mashita" }), peelRule({ ends_with: "行こう", replace_with: "行く", conj_type: "Volitional", suffix: "こう" }), peelRule({ ends_with: "いきませんでした", replace_with: "いく", conj_type: "Past (~ta)", suffix: "ませんでした", neg: true, fml: true }), peelRule({ ends_with: "いきました", replace_with: "いく", conj_type: "Past (~ta)", suffix: "ました", fml: true }), peelRule({ ends_with: "いきません", replace_with: "いく", conj_type: "Negative", suffix: "ません", neg: true, fml: true }), peelRule({ ends_with: "いきます", replace_with: "いく", conj_type: "Polite", suffix: "ます", fml: true }), peelRule({ ends_with: "いかない", replace_with: "いく", conj_type: "Negative", suffix: "ない", neg: true }), peelRule({ ends_with: "いった", replace_with: "いく", conj_type: "Past (~ta)", suffix: "った", transform: "iku_past" }), peelRule({ ends_with: "いって", replace_with: "いく", conj_type: "Conjunctive (~te)", suffix: "って", transform: "iku_te" }), peelRule({ ends_with: "くありませんでした", replace_with: "い", conj_type: "Past (~ta)", suffix: "ありませんでした", neg: true, fml: true, transform: "adj_i" }), peelRule({ ends_with: "くありません", replace_with: "い", conj_type: "Negative", suffix: "ありません", neg: true, fml: true, transform: "adj_i" }), peelRule({ ends_with: "くなかった", replace_with: "い", conj_type: "Past (~ta)", suffix: "くなかった", neg: true, transform: "adj_i" }), peelRule({ ends_with: "くない", replace_with: "い", conj_type: "Negative", suffix: "くない", neg: true, transform: "adj_i" }), peelRule({ ends_with: "わなかった", replace_with: "う", conj_type: "Past (~ta)", suffix: "わなかった", neg: true }), peelRule({ ends_with: "かなかった", replace_with: "く", conj_type: "Past (~ta)", suffix: "かなかった", neg: true }), peelRule({ ends_with: "がなかった", replace_with: "ぐ", conj_type: "Past (~ta)", suffix: "がなかった", neg: true }), peelRule({ ends_with: "さなかった", replace_with: "す", conj_type: "Past (~ta)", suffix: "さなかった", neg: true }), peelRule({ ends_with: "たなかった", replace_with: "つ", conj_type: "Past (~ta)", suffix: "たなかった", neg: true }), peelRule({ ends_with: "ななかった", replace_with: "ぬ", conj_type: "Past (~ta)", suffix: "ななかった", neg: true }), peelRule({ ends_with: "ばなかった", replace_with: "ぶ", conj_type: "Past (~ta)", suffix: "ばなかった", neg: true }), peelRule({ ends_with: "まなかった", replace_with: "む", conj_type: "Past (~ta)", suffix: "まなかった", neg: true }), peelRule({ ends_with: "らなかった", replace_with: "る", conj_type: "Past (~ta)", suffix: "らなかった", neg: true }), peelRule({ ends_with: "わない", replace_with: "う", conj_type: "Negative", suffix: "わない", neg: true }), peelRule({ ends_with: "かない", replace_with: "く", conj_type: "Negative", suffix: "かない", neg: true }), peelRule({ ends_with: "がない", replace_with: "ぐ", conj_type: "Negative", suffix: "がない", neg: true }), peelRule({ ends_with: "さない", replace_with: "す", conj_type: "Negative", suffix: "さない", neg: true }), peelRule({ ends_with: "たない", replace_with: "つ", conj_type: "Negative", suffix: "たない", neg: true }), peelRule({ ends_with: "なない", replace_with: "ぬ", conj_type: "Negative", suffix: "なない", neg: true }), peelRule({ ends_with: "ばない", replace_with: "ぶ", conj_type: "Negative", suffix: "ばない", neg: true }), peelRule({ ends_with: "まない", replace_with: "む", conj_type: "Negative", suffix: "まない", neg: true }), peelRule({ ends_with: "らない", replace_with: "る", conj_type: "Negative", suffix: "らない", neg: true }), peelRule({ ends_with: "かった", replace_with: "い", conj_type: "Past (~ta)", suffix: "かった", transform: "adj_i_katta" }), peelRule({ ends_with: "くて", replace_with: "い", conj_type: "Conjunctive (~te)", suffix: "くて", transform: "adj_i" }), peelRule({ ends_with: "そう", replace_with: "い", conj_type: "Evidential (そう)", suffix: "そう", transform: "adj_i" }), peelRule({ ends_with: "です", replace_with: "い", conj_type: "Polite", suffix: "です", fml: true, transform: "adj_i" }), peelRule({ ends_with: "でした", replace_with: "い", conj_type: "Past (~ta)", suffix: "でした", fml: true, transform: "adj_i" }), peelRule({ ends_with: "いました", replace_with: "う", conj_type: "Past (~ta)", suffix: "いました", fml: true, transform: "godan_mashita" }), peelRule({ ends_with: "います", replace_with: "う", conj_type: "Polite", suffix: "います", fml: true, transform: "godan_masu" }), peelRule({ ends_with: "ないで", replace_with: "う", conj_type: "Negative", suffix: "ないで", neg: true, transform: "godan_neg" }), peelRule({ ends_with: "れません", replace_with: "", conj_type: "Passive", suffix: "れません", neg: true, fml: true, transform: "godan_a_passive_re" }), peelRule({ ends_with: "れない", replace_with: "", conj_type: "Passive", suffix: "れない", neg: true, transform: "godan_a_passive_re" }), peelRule({ ends_with: "られた", replace_with: "", conj_type: "Passive", suffix: "られた", transform: "godan_a_passive_past" }), peelRule({ ends_with: "られ", replace_with: "", conj_type: "Passive", suffix: "られ", transform: "godan_a_passive_re" }), peelRule({ ends_with: "れる", replace_with: "", conj_type: "Passive", suffix: "れる", transform: "godan_a_passive" }), peelRule({ ends_with: "れた", replace_with: "", conj_type: "Passive", suffix: "れた", transform: "godan_a_passive_past" }), peelRule({ ends_with: "れません", replace_with: "る", conj_type: "Potential", suffix: "れません", neg: true, fml: true, transform: "godan_re_potential" }), peelRule({ ends_with: "れなかった", replace_with: "る", conj_type: "Past (~ta)", suffix: "れなかった", neg: true, transform: "godan_re_potential" }), peelRule({ ends_with: "れない", replace_with: "る", conj_type: "Potential", suffix: "れない", neg: true, transform: "godan_re_potential" }), peelRule({ ends_with: "れた", replace_with: "る", conj_type: "Potential", suffix: "れた", transform: "godan_re_potential" }), peelRule({ ends_with: "れて", replace_with: "る", conj_type: "Conjunctive (~te)", suffix: "れて", transform: "godan_re_potential" }), peelRule({ ends_with: "れる", replace_with: "る", conj_type: "Potential", suffix: "れる", transform: "godan_re_potential" }), peelRule({ ends_with: "ける", replace_with: "く", conj_type: "Potential", suffix: "ける", transform: "godan_ke_potential" }), peelRule({ ends_with: "げる", replace_with: "ぐ", conj_type: "Potential", suffix: "げる", transform: "godan_ge_potential" }), peelRule({ ends_with: "せる", replace_with: "す", conj_type: "Potential", suffix: "せる", transform: "godan_se_potential" }), peelRule({ ends_with: "てる", replace_with: "つ", conj_type: "Potential", suffix: "てる", transform: "godan_te_potential" }), peelRule({ ends_with: "ねる", replace_with: "ぬ", conj_type: "Potential", suffix: "ねる", transform: "godan_ne_potential" }), peelRule({ ends_with: "べる", replace_with: "ぶ", conj_type: "Potential", suffix: "べる", transform: "godan_be_potential" }), peelRule({ ends_with: "める", replace_with: "む", conj_type: "Potential", suffix: "める", transform: "godan_me_potential" }), peelRule({ ends_with: "える", replace_with: "う", conj_type: "Potential", suffix: "える", transform: "godan_e_potential" }), peelRule({ ends_with: "せません", replace_with: "", conj_type: "Causative", suffix: "せません", neg: true, fml: true, transform: "godan_a_causative_short" }), peelRule({ ends_with: "せない", replace_with: "", conj_type: "Causative", suffix: "せない", neg: true, transform: "godan_a_causative_short" }), peelRule({ ends_with: "せる", replace_with: "す", conj_type: "Potential", suffix: "せる", transform: "godan_se_potential" }), peelRule({ ends_with: "せない", replace_with: "す", conj_type: "Potential", suffix: "せない", neg: true, transform: "godan_se_potential" }), peelRule({ ends_with: "せる", replace_with: "", conj_type: "Causative", suffix: "せる", transform: "godan_a_causative" }), peelRule({ ends_with: "せ", replace_with: "", conj_type: "Causative", suffix: "せ", transform: "godan_a_causative_short" }), peelRule({ ends_with: "なかった", replace_with: "", conj_type: "Past (~ta)", suffix: "なかった", neg: true, transform: "ichidan_neg_past" }), peelRule({ ends_with: "ない", replace_with: "", conj_type: "Negative", suffix: "ない", neg: true, transform: "ichidan_neg" }), peelRule({ ends_with: "た", replace_with: "", conj_type: "Past (~ta)", suffix: "た", transform: "strip_ta" }), peelRule({ ends_with: "て", replace_with: "", conj_type: "Conjunctive (~te)", suffix: "て", transform: "ichidan_te" }), peelRule({ ends_with: "んだ", replace_with: "ぶ", conj_type: "Past (~ta)", suffix: "んだ", transform: "godan_n_ta" }), peelRule({ ends_with: "んだ", replace_with: "む", conj_type: "Past (~ta)", suffix: "んだ", transform: "godan_n_ta" }), peelRule({ ends_with: "んだ", replace_with: "ぬ", conj_type: "Past (~ta)", suffix: "んだ", transform: "godan_n_ta" }), peelRule({ ends_with: "いた", replace_with: "く", conj_type: "Past (~ta)", suffix: "いた", transform: "godan_ku_ta" }), peelRule({ ends_with: "いだ", replace_with: "ぐ", conj_type: "Past (~ta)", suffix: "いだ", transform: "godan_gu_ta" }), peelRule({ ends_with: "した", replace_with: "す", conj_type: "Past (~ta)", suffix: "した", transform: "godan_su_ta" }), peelRule({ ends_with: "んで", replace_with: "ぶ", conj_type: "Conjunctive (~te)", suffix: "んで", transform: "godan_bu_te" }), peelRule({ ends_with: "んで", replace_with: "む", conj_type: "Conjunctive (~te)", suffix: "んで", transform: "godan_mu_te" }), peelRule({ ends_with: "んで", replace_with: "ぬ", conj_type: "Conjunctive (~te)", suffix: "んで", transform: "godan_n_te" }), peelRule({ ends_with: "いて", replace_with: "く", conj_type: "Conjunctive (~te)", suffix: "いて", transform: "godan_ku_te" }), peelRule({ ends_with: "いで", replace_with: "ぐ", conj_type: "Conjunctive (~te)", suffix: "いで", transform: "godan_gu_te" }), peelRule({ ends_with: "して", replace_with: "す", conj_type: "Conjunctive (~te)", suffix: "して", transform: "godan_su_te" }), peelRule({ ends_with: "って", replace_with: "", conj_type: "Conjunctive (~te)", suffix: "って", transform: "godan_tte" }), peelRule({ ends_with: "った", replace_with: "", conj_type: "Past (~ta)", suffix: "った", transform: "godan_tta" }), ..._compound_suffix_rules()];
export function pos_class(pos_tags: Array<string>): string | unknown {
  for (const tag of pos_tags) {
    if (ICHIDAN_POS.has(tag)) {
      return "ichidan";
    }
    if (GODAN_POS.has(tag)) {
      return "godan";
    }
    if (SURU_POS.has(tag)) {
      return "suru";
    }
    if (KURU_POS.has(tag)) {
      return "kuru";
    }
    if (I_ADJ_POS.has(tag)) {
      return "i_adj";
    }
    if (tag.startsWith("v5")) {
      return "godan";
    }
    if (tag.startsWith("vs")) {
      return "suru";
    }
  }
  return null;
}

export function godan_dict_ending(lemma: string): string | null {
  if (!lemma) {
    return null;
  }
  const last = lemma.at(-1) ?? "";
  return Object.prototype.hasOwnProperty.call(GODAN_MASU_STEM, last) ? last : null;
}

export function is_suru_lemma(lemma: string): boolean {
  return ((lemma === "する") || lemma.endsWith("する"));
}

export function normalize_i_adj_lemma(lemma: string): string {
  if (SPECIAL_II.has(lemma)) {
    return "いい";
  }
  return lemma;
}

function _godan_base(lemma: string): [string, string] | unknown {
  const ending = godan_dict_ending(lemma);
  if ((ending === null)) {
    return null;
  }
  return [lemma.slice(0, (-1)), ending];
}

export function forward_conjugate(lemma: string, pos_tags: Array<string>): Record<string, string> | unknown {
  const cls = pos_class(pos_tags);
  if ((cls === null)) {
    return null;
  }
  if ((cls === "ichidan")) {
    return _forward_ichidan(lemma);
  }
  if ((cls === "godan")) {
    return _forward_godan(lemma);
  }
  if ((cls === "suru")) {
    return _forward_suru(lemma);
  }
  if ((cls === "kuru")) {
    return _forward_kuru(lemma);
  }
  if ((cls === "i_adj")) {
    return _forward_i_adj(normalize_i_adj_lemma(lemma));
  }
  return null;
}

function _forward_ichidan(lemma: string): Record<string, string> {
  if ((!lemma.endsWith("る"))) {
    return { ["Dictionary"]: lemma };
  }
  const stem = lemma.slice(0, (-1));
  return { ["Dictionary"]: lemma, ["Polite"]: (stem + "ます"), ["Past"]: (stem + "た"), ["Te-form"]: (stem + "て"), ["Negative"]: (stem + "ない"), ["Potential"]: (stem + "られる"), ["Passive"]: (stem + "られる"), ["Causative"]: (stem + "させる"), ["Causative-Passive"]: (stem + "させられる"), ["Volitional"]: (stem + "よう"), ["Conditional (ば)"]: (stem + "れば"), ["Imperative"]: (stem + "ろ"), ["Desire (〜たい)"]: (stem + "たい"), ["Provisional (たら)"]: (stem + "たら"), ["Progressive (ている)"]: ((stem + "て") + "いる"), ["Te-shimau (てしまう)"]: ((stem + "て") + "しまう") };
}

function _forward_godan(lemma: string): Record<string, string> {
  const parsed = _godan_base(lemma);
  if (parsed === null) {
    return { Dictionary: lemma };
  }
  const [base, ending] = parsed as [string, string];
  const masu = base + GODAN_MASU_STEM[ending]!;
  let te = base + GODAN_TE_SUFFIX[ending]!;
  const nai = base + GODAN_A_STEM[ending]! + "ない";
  const potential = base + GODAN_E_STEM[ending]! + "る";
  const passive = base + GODAN_A_STEM[ending]! + "れる";
  const causative = base + GODAN_A_STEM[ending]! + "せる";
  const causpass = base + GODAN_A_STEM[ending]! + "せられる";
  const volitional = base + GODAN_O_STEM[ending]! + "う";
  const conditional = base + GODAN_BA_STEM[ending]! + "ば";
  const imperative = base + GODAN_E_STEM[ending]!;
  let past: string;
  if (SPECIAL_IKU_SET.has(lemma)) {
    te = lemma === SPECIAL_IKU_KANA ? "いって" : "行って";
    past = lemma === SPECIAL_IKU_KANA ? "いった" : "行った";
  } else {
    past = _godan_past(base, ending);
  }
  return {
    Dictionary: lemma,
    Polite: masu + "ます",
    Past: past,
    "Te-form": te,
    Negative: nai,
    Potential: potential,
    Passive: passive,
    Causative: causative,
    "Causative-Passive": causpass,
    Volitional: volitional,
    "Conditional (ば)": conditional,
    Imperative: imperative,
    "Desire (〜たい)": masu + "たい",
    "Provisional (たら)": past + "ら",
    "Progressive (ている)": te + "いる",
    "Te-shimau (てしまう)": te + "しまう",
  };
}

function _godan_past(base: string, ending: string): string {
  if (["う", "つ", "る"].includes(ending)) {
    return (base + "った");
  }
  if ((ending === "く")) {
    return (base + "いた");
  }
  if ((ending === "ぐ")) {
    return (base + "いだ");
  }
  if ((ending === "す")) {
    return (base + "した");
  }
  if (["ぶ", "む", "ぬ"].includes(ending)) {
    return (base + "んだ");
  }
  return (base + "た");
}

function _forward_suru(lemma: string): Record<string, string> {
  if ((lemma === "する") || SURU_ATEJI.has(lemma)) {
    const dict = SURU_ATEJI.has(lemma) ? lemma : "する";
    return { ["Dictionary"]: dict, ["Polite"]: "します", ["Past"]: "した", ["Te-form"]: "して", ["Negative"]: "しない", ["Potential"]: "できる", ["Passive"]: "される", ["Causative"]: "させる", ["Causative-Passive"]: "させられる", ["Volitional"]: "しよう", ["Conditional (ば)"]: "すれば", ["Imperative"]: "しろ", ["Desire (〜たい)"]: "したい", ["Provisional (たら)"]: "したら", ["Progressive (ている)"]: "している", ["Te-shimau (てしまう)"]: "してしまう" };
  }
  if (lemma.endsWith("する")) {
    const prefix = lemma.slice(0, (-2));
    return { ["Dictionary"]: lemma, ["Polite"]: (prefix + "します"), ["Past"]: (prefix + "した"), ["Te-form"]: (prefix + "して"), ["Negative"]: (prefix + "しない"), ["Potential"]: (prefix + "できる"), ["Passive"]: (prefix + "される"), ["Causative"]: (prefix + "させる"), ["Causative-Passive"]: (prefix + "させられる"), ["Volitional"]: (prefix + "しよう"), ["Conditional (ば)"]: (prefix + "すれば"), ["Imperative"]: (prefix + "しろ"), ["Desire (〜たい)"]: (prefix + "したい"), ["Provisional (たら)"]: (prefix + "したら"), ["Progressive (ている)"]: (prefix + "している"), ["Te-shimau (てしまう)"]: (prefix + "してしまう") };
  }
  return { ["Dictionary"]: lemma };
}

function _forward_kuru(lemma: string): Record<string, string> {
  if (!/[一-鿿]/.test(lemma)) {
    // Kana lemma (くる): keep the kana script so readings expose the き/こ/く stems.
    return { ["Dictionary"]: lemma, ["Polite"]: "きます", ["Past"]: "きた", ["Te-form"]: "きて", ["Negative"]: "こない", ["Potential"]: "こられる", ["Passive"]: "こられる", ["Causative"]: "こさせる", ["Causative-Passive"]: "こさせられる", ["Volitional"]: "こよう", ["Conditional (ば)"]: "くれば", ["Imperative"]: "こい", ["Desire (〜たい)"]: "きたい", ["Provisional (たら)"]: "きたら", ["Progressive (ている)"]: "きている", ["Te-shimau (てしまう)"]: "きてしまう" };
  }
  return { ["Dictionary"]: lemma, ["Polite"]: "来ます", ["Past"]: "来た", ["Te-form"]: "来て", ["Negative"]: "来ない", ["Potential"]: "来られる", ["Passive"]: "来られる", ["Causative"]: "来させる", ["Causative-Passive"]: "来させられる", ["Volitional"]: "来よう", ["Conditional (ば)"]: "来れば", ["Imperative"]: "来い", ["Desire (〜たい)"]: "来たい", ["Provisional (たら)"]: "来たら", ["Progressive (ている)"]: "来ている", ["Te-shimau (てしまう)"]: "来てしまう" };
}

function _forward_i_adj(lemma: string): Record<string, string> {
  let stem: string;
  let polite: string;
  let past: string;
  let te: string;
  let neg: string;
  if (SPECIAL_II.has(lemma)) {
    stem = "よ";
    polite = "いいです";
    past = "よかった";
    te = "よくて";
    neg = "よくない";
  } else if (lemma.endsWith("い")) {
    stem = lemma.slice(0, -1);
    polite = lemma + "です";
    past = stem + "かった";
    te = stem + "くて";
    neg = stem + "くない";
  } else {
    return { Dictionary: lemma };
  }
  return {
    Dictionary: lemma,
    Polite: polite,
    Past: past,
    "Te-form": te,
    Negative: neg,
    Potential: lemma,
    Passive: lemma,
    Causative: lemma,
    "Causative-Passive": lemma,
    Volitional: lemma,
    "Conditional (ば)": stem + "ければ",
    Imperative: lemma,
    "Desire (〜たい)": lemma,
    "Provisional (たら)": past + "ら",
    "Progressive (ている)": lemma,
    "Te-shimau (てしまう)": lemma,
  };
}

/** Python `a or b`: empty arrays are falsy — first non-empty list wins. */
function firstNonEmpty(...candidates: Array<string>[]): Array<string> {
  for (const c of candidates) {
    if (c.length > 0) return c;
  }
  return [];
}

function _a_stem_to_dict(stem: string): Array<string> {
  for (const [dict_end, a_end] of Object.entries(GODAN_A_STEM)) {
    if (stem.endsWith(a_end)) {
      return [stem.slice(0, -a_end.length) + dict_end];
    }
  }
  return [];
}

function _e_stem_to_dict(stem: string): Array<string> {
  for (const [dict_end, e_end] of Object.entries(GODAN_E_STEM)) {
    if (stem.endsWith(e_end)) {
      return [stem.slice(0, -e_end.length) + dict_end];
    }
  }
  return [];
}

function _godan_masu_to_dict(stem_masu: string): Array<string> {
  for (const [dict_end, masu_end] of Object.entries(GODAN_MASU_STEM)) {
    if (stem_masu.endsWith(masu_end)) {
      return [stem_masu.slice(0, -masu_end.length) + dict_end];
    }
  }
  return [];
}

function _godan_nai_to_dict(stem: string): Array<string> {
  return _a_stem_to_dict(stem);
}

function _godan_tta_to_dict(stem: string): Array<string> {
  return ["う", "つ", "る"].map((dict_end) => (stem + dict_end));
}

function _godan_tte_to_dict(stem: string): Array<string> {
  return ["う", "つ", "る"].map((dict_end) => (stem + dict_end));
}

function _godan_nta_to_dict(stem: string): Array<string> {
  return ["ぶ", "む", "ぬ"].map((dict_end) => (stem + dict_end));
}

function _ichidan_to_dict(form: string): Array<string> {
  if ((!form)) {
    return [];
  }
  if (form.endsWith("る")) {
    return [form];
  }
  return [(form + "る")];
}

function _masu_stem_to_dict(stem: string): Array<string> {
  return firstNonEmpty(_godan_masu_to_dict(stem), _ichidan_to_dict(stem));
}

function _polite_masu_to_dict(stem: string): Array<string> {
  return firstNonEmpty(_godan_masu_to_dict(stem), _ichidan_to_dict(stem));
}

function _obligation_stem_to_dict(stem: string): Array<string> {
  return firstNonEmpty(_godan_nai_to_dict(stem), _masu_stem_to_dict(stem));
}

function _obligation_neg_te_to_dict(stem: string): Array<string> {
  return firstNonEmpty(_godan_nai_to_dict(stem), _masu_stem_to_dict(stem));
}

function _apply_transform(form: string, rule: PeelRule): Array<string> {
  const t = rule.transform;
  if ((t === null)) {
    return [form];
  }
  if (["masu_to_dict", "polite_masu"].includes(t)) {
    return _polite_masu_to_dict(form);
  }
  if ((t === "masu_stem_to_dict")) {
    return _masu_stem_to_dict(form);
  }
  if ((t === "strip_ta")) {
    const out = [];
    if (["られ", "れ", "せ"].some((_s) => form.endsWith(_s))) {
      out.push(form);
    }
    if ((form && (!form.endsWith("る")))) {
      out.push((form + "る"));
    }
    if (form) {
      out.push(form);
    }
    return Array.from(new Set(out));
  }
  if ((t === "strip_da")) {
    return (form.endsWith("だ") ? [(form.slice(0, (-1)) + "だ")] : [form]);
  }
  if ((t === "adj_i_katta")) {
    return (form.endsWith("い") ? [form] : (form ? [(form + "い")] : []));
  }
  if (["ichidan_passive_re", "ichidan_te", "ichidan_neg", "ichidan_neg_past", "ichidan_passive", "ichidan_potential", "ichidan_potential_short", "ichidan_causative", "ichidan_causative_short", "ichidan_causative_passive", "ichidan_volitional", "ichidan_imperative", "ichidan_ba"].includes(t)) {
    return _ichidan_to_dict(form);
  }
  if ((t === "ichidan_passive_past")) {
    if (form.endsWith("られ")) {
      return [(form.slice(0, (-2)) + "る")];
    }
    return _ichidan_to_dict(form);
  }
  if ((t === "suru_causative")) {
    return ((form === "") ? ["する"] : [(form + "する")]);
  }
  if ((t === "suru_passive")) {
    return ((form === "") ? ["する"] : [(form + "する")]);
  }
  if ((t === "suru_causpass")) {
    return ((form === "") ? ["する"] : [(form + "する")]);
  }
  if (["adj_i"].includes(t)) {
    return ((form.endsWith("い") || SPECIAL_II.has(form)) ? [form] : [(form + "い")]);
  }
  if (["godan_masu", "godan_mashita"].includes(t)) {
    return firstNonEmpty(_godan_masu_to_dict((form + "い")), _godan_masu_to_dict((form + "り")), [form]);
  }
  if (["godan_neg", "godan_neg_past", "godan_neg_cond"].includes(t)) {
    return firstNonEmpty(_godan_nai_to_dict(form), [form]);
  }
  if ((t === "obligation_stem")) {
    return firstNonEmpty(_obligation_stem_to_dict(form), [form]);
  }
  if ((t === "obligation_neg_te")) {
    return firstNonEmpty(_obligation_neg_te_to_dict(form), [form]);
  }
  if (["godan_a_passive", "godan_a_passive_re", "godan_a_passive_past"].includes(t)) {
    // Godan passive stems must end in an a-row kana; guessing `form + "る"` misread
    // potential forms (帰れる, 待てる) as passives of made-up lemmas.
    return _a_stem_to_dict(form);
  }
  if (["godan_a_causative", "godan_a_causative_short"].includes(t)) {
    return firstNonEmpty(_a_stem_to_dict(form), [(form + "る")]);
  }
  if (["godan_a_causpass", "godan_short_causpass"].includes(t)) {
    return firstNonEmpty(_a_stem_to_dict(form), [(form + "る")]);
  }
  if (["godan_ke_potential", "godan_ge_potential", "godan_se_potential", "godan_te_potential", "godan_ne_potential", "godan_be_potential", "godan_me_potential", "godan_e_potential", "godan_re_potential"].includes(t)) {
    if ((form && godan_dict_ending(form))) {
      return [form];
    }
    return firstNonEmpty(_e_stem_to_dict(form), form ? [(form + "る")] : []);
  }
  if ((t.startsWith("godan_") && t.endsWith("_potential_masu"))) {
    if ((form && godan_dict_ending(form))) {
      return [form];
    }
    return firstNonEmpty(_e_stem_to_dict(form), _godan_masu_to_dict(form), [form]);
  }
  if ((t.startsWith("godan_") && t.endsWith("_potential"))) {
    if ((form && godan_dict_ending(form))) {
      return [form];
    }
    return firstNonEmpty(_e_stem_to_dict(form), form ? [(form + "る")] : []);
  }
  if ((t === "godan_ku_ta")) {
    if (form.endsWith("く")) return [form];
    return (form ? [(form + "く")] : []);
  }
  if ((t === "godan_gu_ta")) {
    if (form.endsWith("ぐ")) return [form];
    return (form ? [(form + "ぐ")] : []);
  }
  if ((t === "godan_su_ta")) {
    if (form.endsWith("す")) return [form];
    return (form ? [(form + "す")] : []);
  }
  if ((t === "godan_n_ta")) {
    if ((form && ["ぶ", "む", "ぬ"].includes(form.at(-1) ?? ""))) {
      return [form];
    }
    return firstNonEmpty(_godan_nta_to_dict(form), [(form + "む")]);
  }
  if ((t === "godan_tta")) {
    return firstNonEmpty(_godan_tta_to_dict(form), [(form + "う")]);
  }
  if ((t === "godan_ku_te")) {
    if (form.endsWith("く")) {
      return [form];
    }
    return (form ? [(form + "く")] : []);
  }
  if ((t === "godan_gu_te")) {
    if (form.endsWith("ぐ")) {
      return [form];
    }
    return (form ? [(form + "ぐ")] : []);
  }
  if ((t === "godan_su_te")) {
    if (form.endsWith("す")) {
      return [form];
    }
    return (form ? [(form + "す")] : []);
  }
  if ((t === "godan_bu_te")) {
    if (form.endsWith("ぶ")) {
      return [form];
    }
    return (form ? [(form + "ぶ")] : []);
  }
  if ((t === "godan_mu_te")) {
    if (form.endsWith("む")) {
      return [form];
    }
    return (form ? [(form + "む")] : []);
  }
  if ((t === "godan_n_te")) {
    if (form.endsWith("ぬ")) {
      return [form];
    }
    return (form ? [(form + "ぬ")] : []);
  }
  if ((t === "godan_tte")) {
    return firstNonEmpty(_godan_tte_to_dict(form), [(form + "う")]);
  }
  if ((t === "godan_ba")) {
    return firstNonEmpty(_e_stem_to_dict(form), [(form + rule.replace_with)]);
  }
  if (["godan_imperative", "godan_neg_imperative"].includes(t)) {
    if ((form && godan_dict_ending(form))) {
      return [form];
    }
    return firstNonEmpty(_e_stem_to_dict(form), form ? [(form + "る")] : []);
  }
  if ((t === "ichidan_neg_imperative")) {
    return _ichidan_to_dict(form);
  }
  if (["iku_past", "iku_te", "iku_masu", "iku_mashita"].includes(t)) {
    return ["行く"];
  }
  if (["kuru_kana", "kuru_kana_masu"].includes(t)) {
    return ["来る"];
  }
  return [form];
}

function _auxiliary_steps(rule: PeelRule, step: ConjStep): Array<ConjStep> {
  const steps = [step];
  const past_markers = ["た", "だ", "いた", "した", "った", "かった", "なかった", "りました", "ました", "れた", "られた"];
  if (!step.conj_type.includes("Past")) {
    // Python's str.endswith(tuple) means "ends with ANY of these markers".
    // Passing the array straight to String.prototype.endsWith coerces it to a
    // comma-joined string that never matches, so the past step was dead code.
    const ends_with_past = (s: string | undefined) => !!s && past_markers.some((m) => s.endsWith(m));
    if ((ends_with_past(rule.ends_with) || ends_with_past(rule.suffix))) {
      steps.push(conjStep({ conj_type: "Past (~ta)", suffix: "た", gloss: "past" }));
    }
  }
  if ((step.neg && (step.conj_type !== "Negative imperative"))) {
    if ((!steps.some((s) => (s.conj_type === "Negative")))) {
      const polite_neg = (step.fml || rule.ends_with.includes("ません") || (rule.suffix || "").includes("ません") || rule.ends_with.includes("ありません"));
      if ((!polite_neg)) {
        steps.push(conjStep({ conj_type: "Negative", suffix: "ない", gloss: "negative", neg: true }));
      }
    }
  }
  return steps;
}

export function apply_peel(surface: string, rule: PeelRule): Array<[string, Array<ConjStep>]> {
  if ((!surface.endsWith(rule.ends_with))) {
    return [];
  }
  if (((rule.ends_with === "れた") && surface.endsWith("られた"))) {
    return [];
  }
  if (((rule.ends_with === "れない") && surface.endsWith("られない"))) {
    return [];
  }
  if (((rule.ends_with === "れません") && surface.endsWith("られません"))) {
    return [];
  }
  if (((rule.ends_with === "れた") && surface.endsWith("させられた"))) {
    return [];
  }
  if (((rule.ends_with === "できた") && (surface === "できた"))) {
    return [];
  }
  if (((rule.ends_with === "できました") && (surface === "できました"))) {
    return [];
  }
  if (((rule.ends_with === "きません") && surface.startsWith("でき"))) {
    return [];
  }
  if (((rule.ends_with === "きました") && surface.startsWith("でき"))) {
    return [];
  }
  if (((rule.ends_with === "きます") && surface.startsWith("でき"))) {
    return [];
  }
  if (((rule.ends_with === "きませんでした") && surface.startsWith("でき"))) {
    return [];
  }
  if (((rule.ends_with === "きた") && (surface === "できた"))) {
    return [];
  }
  if (((rule.ends_with === "てきた") && (surface === "できた"))) {
    return [];
  }
  if (((rule.ends_with === "てきました") && (surface === "できました"))) {
    return [];
  }
  if (((rule.ends_with === "れる") && ["られる", "せられる", "される"].some((_s) => surface.endsWith(_s)))) {
    return [];
  }
  if (((rule.ends_with === "せる") && (rule.transform === "godan_se_potential"))) {
    if (["させる", "せられる", "せられた"].some((_s) => surface.endsWith(_s))) {
      return [];
    }
  }
  if (((rule.ends_with === "せない") && (rule.transform === "godan_a_causative_short"))) {
    const stem = surface.slice(0, (-("せない").length));
    if ((!_a_stem_to_dict(stem))) {
      return [];
    }
  }
  if (((rule.ends_with === "せません") && (rule.transform === "godan_a_causative_short"))) {
    const stem2 = surface.slice(0, (-("せません").length));
    if ((!_a_stem_to_dict(stem2))) {
      return [];
    }
  }
  if (((rule.ends_with === "かった") && surface.endsWith("なかった"))) {
    return [];
  }
  if (((rule.ends_with === "た") && ["ました", "だった", "なかった", "かった", "たかった", "たくなかった", "しまった", "すぎた", "すぎました", "せられた", "された", "られた", "させられた"].some((_s) => surface.endsWith(_s)))) {
    return [];
  }
  if (((rule.ends_with === "った") && ["行った"].some((_s) => surface.endsWith(_s)))) {
    /* pass */
  }
  if (((rule.ends_with === "た") && ((surface).length > 1) && "しだかっ".includes(surface.at(-2) ?? ""))) {
    return [];
  }
  if (((rule.ends_with === "ない") && ["くない", "しない", "来ない", "こない", "られない", "れない", "せない", "させない"].some((_s) => surface.endsWith(_s)))) {
    return [];
  }
  if (((rule.ends_with === "ません") && (surface.startsWith("でき") || ["られません", "れません", "せません", "させません"].some((_s) => surface.endsWith(_s))))) {
    return [];
  }
  if (((rule.ends_with === "ます") && ["ています", "でいます", "できます", "いません", "でいません"].some((_s) => surface.endsWith(_s)))) {
    return [];
  }
  if (((rule.conj_type === "Potential") && ["べる", "げる", "める", "ねる"].includes(rule.ends_with))) {
    const trial = (surface.slice(0, (-(rule.ends_with).length)) + rule.replace_with);
    if ((trial === surface)) {
      return [];
    }
  }
  if (((rule.ends_with === "います") && ((surface).length > 3) && "てで".includes(surface.at(-4) ?? ""))) {
    return [];
  }
  if (((rule.ends_with === "いました") && ((surface).length > 4) && "てで".includes(surface.at(-5) ?? ""))) {
    return [];
  }
  if (((rule.ends_with === "いません") && ((surface).length > 4) && "てで".includes(surface.at(-5) ?? ""))) {
    return [];
  }
  if (((rule.ends_with === "いませんでした") && ((surface).length > 7) && "てで".includes(surface.at(-8) ?? ""))) {
    return [];
  }
  if (((rule.ends_with === "て") && (rule.transform === "ichidan_te"))) {
    if ((!surface.endsWith("て"))) {
      return [];
    }
  }
  const base = (surface.slice(0, (-(rule.ends_with).length)) + rule.replace_with);
  const step = conjStep({ conj_type: rule.conj_type, suffix: rule.suffix, gloss: rule.gloss, neg: rule.neg, fml: rule.fml, transform: rule.transform, alt_conj_type: rule.alt_conj_type });
  const step_list = _auxiliary_steps(rule, step);
  const results = [];
  for (const new_form of _apply_transform(base, rule)) {
    if ((new_form !== surface)) {
      results.push([new_form, step_list]);
    }
  }
  return results;
}

export function peel_once(surface: string): Array<[string, Array<ConjStep>]> {
  const out: Array<[string, Array<ConjStep>]> = [];
  for (const rule of PEEL_RULES) {
    const hits = apply_peel(surface, rule);
    if (hits.length) {
      out.push(...hits);
    }
  }
  return out;
}

export function deconjugate_recursive(surface: string, max_depth: number = 16): Array<[string, Array<ConjStep>]> {
  const results: Array<[string, Array<ConjStep>]> = [];
  function recurse(form: string, steps: Array<ConjStep>, depth: number): void {
    if (depth > max_depth) return;
    if (depth > 0 && form) {
      results.push([form, [...steps]]);
    }
    const peels = peel_once(form);
    if (!peels.length) return;
    for (const [new_form, new_steps] of peels) {
      recurse(new_form, [...steps, ...new_steps], depth + 1);
    }
  }
  recurse(surface, [], 0);
  return results;
}

export function expected_pos_from_step(step: ConjStep): string | unknown {
  if (step.transform) {
    return (TRANSFORM_POS_HINT[step.transform] ?? null);
  }
  return null;
}

export const _SPEECH_CONJ_TYPES = new Set(["Polite", "Negative", "Past (~ta)"]);
export const _DERIV_LABEL_MAP = { ["Past (~ta)"]: "Past", ["Polite"]: "Polite", ["Negative"]: "Negative", ["Conjunctive (~te)"]: "Te-form", ["Conjunctive (~te, progressive)"]: "Progressive (ている)", ["Progressive (ている)"]: "Progressive (ている)", ["Completion (しまう)"]: "Te-shimau (てしまう)", ["Preparatory (おく)"]: null, ["Attempt (みる)"]: null, ["Benefactive (くれる)"]: null, ["Benefactive (もらう)"]: null, ["Benefactive (あげる)"]: null, ["Desiderative (ほしい)"]: null, ["Directional (ていく)"]: null, ["Directional (てくる)"]: null, ["Obligation"]: "Negative", ["While (~ながら)"]: "Te-form", ["Easy to (~やすい)"]: "Dictionary", ["Hard to (~にくい)"]: "Dictionary", ["Evidential (そう)"]: "Dictionary", ["Desire (〜たい)"]: "Desire (〜たい)", ["Conditional (ば)"]: "Conditional (ば)", ["Provisional (たら)"]: "Provisional (たら)", ["Volitional"]: "Volitional", ["Imperative"]: "Imperative", ["Passive"]: "Passive", ["Potential"]: "Potential", ["Causative"]: "Causative", ["Causative-Passive"]: "Causative-Passive" };
function _is_speech_step(step: ConjStep): boolean {
  return _SPEECH_CONJ_TYPES.has(step.conj_type);
}

function _speech_flags(steps: Array<ConjStep>): [boolean, boolean, boolean] {
  const fml = steps.some((s) => ((s.conj_type === "Polite") || (s.fml && _SPEECH_CONJ_TYPES.has(s.conj_type))));
  const neg = steps.some((s) => ((s.conj_type === "Negative") || (s.neg && _SPEECH_CONJ_TYPES.has(s.conj_type))));
  const past = steps.some((s) => s.conj_type.startsWith("Past"));
  return [fml, neg, past];
}

function _pos_tags_for_stem(stem: string, original: Array<string> | unknown): Array<string> {
  if (stem.endsWith("たい")) {
    return ["adj-i"];
  }
  if (["させる", "られる", "れる", "せる", "できる"].some((_s) => stem.endsWith(_s))) {
    return ["v1"];
  }
  if ((stem.endsWith("する") || (stem === "する"))) {
    return ["vs"];
  }
  if (["来る", "くる"].includes(stem)) {
    return ["vk"];
  }
  if (original) {
    return Array.from(original);
  }
  if (stem.endsWith("る")) {
    return ["v1"];
  }
  return ["v5"];
}

function _plain_neg_past(negative: string): string {
  if (negative.endsWith("ない")) {
    return (negative.slice(0, (-2)) + "なかった");
  }
  return (negative + "た");
}

function _masu_family(polite: string): Record<string, string> | unknown {
  if ((!polite.endsWith("ます"))) {
    return null;
  }
  const stem = polite.slice(0, (-2));
  return { ["polite"]: polite, ["neg"]: (stem + "ません"), ["past"]: (stem + "ました"), ["neg_past"]: (stem + "ませんでした") };
}

function _i_adj_polite_family(lemma: string, forms: Record<string, string>): Record<string, string> {
  const polite = ((forms["Polite"] ?? null) || (lemma + "です"));
  const neg = ((forms["Negative"] ?? null) || "");
  if (SPECIAL_II.has(lemma)) {
    return { ["polite"]: polite, ["neg"]: "よくありません", ["neg_desu"]: "よくないです", ["past"]: "よかったです", ["neg_past"]: "よくありませんでした", ["plain_neg"]: (neg || "よくない"), ["plain_past"]: ((forms["Past"] ?? null) || "よかった"), ["plain_neg_past"]: _plain_neg_past((neg || "よくない")) };
  }
  if (lemma.endsWith("い")) {
    const stem = lemma.slice(0, (-1));
    return { ["polite"]: polite, ["neg"]: (stem + "くありません"), ["neg_desu"]: ((neg || (stem + "くない")) + "です"), ["past"]: (((forms["Past"] ?? null) || (stem + "かった")) + "です"), ["neg_past"]: (stem + "くありませんでした"), ["plain_neg"]: (neg || (stem + "くない")), ["plain_past"]: ((forms["Past"] ?? null) || (stem + "かった")), ["plain_neg_past"]: _plain_neg_past((neg || (stem + "くない"))) };
  }
  return { ["polite"]: polite, ["neg"]: neg, ["neg_desu"]: neg, ["past"]: ((forms["Past"] ?? null) || lemma), ["neg_past"]: neg, ["plain_neg"]: neg, ["plain_past"]: ((forms["Past"] ?? null) || lemma), ["plain_neg_past"]: (neg ? _plain_neg_past(neg) : lemma) };
}


function _step_dict(
  conj_type: string,
  suffix: string,
  form: string,
  opts: { gloss?: string; neg?: boolean; fml?: boolean } = {},
): Record<string, unknown> {
  const tip = (TIPS as Record<string, string>)[conj_type] ?? "";
  return {
    conjType: conj_type,
    suffix,
    gloss: opts.gloss ?? "",
    form,
    tip,
    neg: opts.neg ?? false,
    fml: opts.fml ?? false,
  };
}

function _desire_adj_family(stem: string): Record<string, string> {
  const base = stem.endsWith("たい") ? stem.slice(0, -2) : stem;
  return {
    polite: stem + "です",
    neg: base + "たくありません",
    past: base + "たかったです",
    neg_past: base + "たくありませんでした",
    plain_neg: base + "たくない",
    plain_past: base + "たかった",
    plain_neg_past: base + "たくなかった",
  };
}

function _te_progressive_family(stem: string): Record<string, string> | null {
  let te: string | null = null;
  for (const suf of [
    "ていませんでした", "でいませんでした", "ていません", "でいません",
    "ていました", "でいました", "ています", "でいます", "ていない", "でいない",
    "ていた", "でいた", "ている", "でいる", "てません", "でません",
    "てます", "でます", "てる", "でる", "て", "で",
  ]) {
    if (stem.endsWith(suf)) {
      te = stem.slice(0, -suf.length) + suf[0]!;
      break;
    }
  }
  if (te == null || !"てで".includes(te[te.length - 1]!)) return null;
  return {
    plain: te + "いる",
    polite: te + "います",
    plain_neg: te + "いない",
    polite_neg: te + "いません",
    plain_past: te + "いた",
    polite_past: te + "いました",
    plain_neg_past: te + "いなかった",
    polite_neg_past: te + "いませんでした",
  };
}

function _build_progressive_speech_recipe(
  stem: string,
  fml: boolean,
  neg: boolean,
  past: boolean,
): Array<Record<string, unknown>> | null {
  const fam = _te_progressive_family(stem);
  if (fam == null) return null;
  const out: Array<Record<string, unknown>> = [
    _step_dict("Conjunctive (~te, progressive)", "いる", fam.plain, { gloss: "progressive" }),
  ];
  if (fml) {
    out.push(_step_dict("Polite", "ます", fam.polite, { fml: true }));
    if (neg) {
      out.push(_step_dict("Negative", "ません", fam.polite_neg, { gloss: "negative", neg: true, fml: true }));
      if (past) {
        out.push(_step_dict("Past (~ta)", "でした", fam.polite_neg_past, { gloss: "past", neg: true, fml: true }));
      }
    } else if (past) {
      out.push(_step_dict("Past (~ta)", "した", fam.polite_past, { gloss: "past", fml: true }));
    }
  } else if (neg) {
    out.push(_step_dict("Negative", "ない", fam.plain_neg, { gloss: "negative", neg: true }));
    if (past) {
      out.push(_step_dict("Past (~ta)", "た", fam.plain_neg_past, { gloss: "past", neg: true }));
    }
  } else if (past) {
    out.push(_step_dict("Past (~ta)", "た", fam.plain_past, { gloss: "past" }));
  }
  return out;
}

function _build_speech_recipe(
  stem: string,
  pos_tags: string[] | null,
  fml: boolean,
  neg: boolean,
  past: boolean,
): Array<Record<string, unknown>> {
  if (!(fml || neg || past)) return [];
  const prog = _build_progressive_speech_recipe(stem, fml, neg, past);
  if (prog != null) return prog;

  const tags = _pos_tags_for_stem(stem, pos_tags);
  const forms = (forward_conjugate(stem, tags) as Record<string, string> | null) || {};
  const cls = pos_class(tags);

  if (cls === "i_adj" || stem.endsWith("たい")) {
    const fam =
      stem.endsWith("たい") && (!forms || !("Polite" in forms))
        ? _desire_adj_family(stem)
        : _i_adj_polite_family(stem, forms);
    const out: Array<Record<string, unknown>> = [];
    if (fml) {
      out.push(_step_dict("Polite", "です", fam.polite, { fml: true }));
      if (neg) {
        out.push(_step_dict("Negative", "くありません", fam.neg, { gloss: "negative", neg: true, fml: true }));
        if (past) out.push(_step_dict("Past (~ta)", "でした", fam.neg_past, { gloss: "past", neg: true, fml: true }));
      } else if (past) {
        out.push(_step_dict("Past (~ta)", "でした", fam.past, { gloss: "past", fml: true }));
      }
    } else if (neg) {
      out.push(_step_dict("Negative", "ない", fam.plain_neg, { gloss: "negative", neg: true }));
      if (past) out.push(_step_dict("Past (~ta)", "た", fam.plain_neg_past, { gloss: "past", neg: true }));
    } else if (past) {
      out.push(_step_dict("Past (~ta)", "た", fam.plain_past, { gloss: "past" }));
    }
    return out;
  }

  const polite = forms["Polite"];
  let masu = polite ? _masu_family(polite) : null;
  if (fml && masu == null && stem.endsWith("る")) {
    masu = _masu_family(stem.slice(0, -1) + "ます");
  }
  const out: Array<Record<string, unknown>> = [];
  if (fml && masu) {
    out.push(_step_dict("Polite", "ます", masu.polite, { fml: true }));
    if (neg) {
      out.push(_step_dict("Negative", "ません", masu.neg, { gloss: "negative", neg: true, fml: true }));
      if (past) out.push(_step_dict("Past (~ta)", "でした", masu.neg_past, { gloss: "past", neg: true, fml: true }));
    } else if (past) {
      out.push(_step_dict("Past (~ta)", "した", masu.past, { gloss: "past", fml: true }));
    }
    return out;
  }
  if (neg) {
    const nai = forms["Negative"] || (stem.endsWith("る") ? stem.slice(0, -1) + "ない" : stem + "ない");
    out.push(_step_dict("Negative", "ない", nai, { gloss: "negative", neg: true }));
    if (past) out.push(_step_dict("Past (~ta)", "た", _plain_neg_past(nai), { gloss: "past", neg: true }));
    return out;
  }
  if (past) {
    out.push(_step_dict("Past (~ta)", "た", forms["Past"] || stem, { gloss: "past" }));
  }
  return out;
}

function _stem_replace(base: string, suffix: string): string {
  if (!suffix) return base;
  if (base.endsWith("る")) return base.slice(0, -1) + suffix;
  if (base === "だ" && suffix.startsWith("で")) return suffix;
  return base + suffix;
}

/** Heuristic forward step when POS/paradigm is unavailable. */
export function apply_step_heuristic(base: string, step: Record<string, unknown>): string {
  const suffix = String(step.suffix ?? "");
  const conj_type = String(step.conjType ?? step.conj_type ?? "");
  if (!suffix) {
    if (["しまう", "仕舞う", "いる", "居る", "おる", "くる", "来る", "ある", "有る", "おく", "いく", "行く", "くれる", "もらう", "とく"].includes(conj_type)) {
      if (base.endsWith("て") || base.endsWith("で")) return base + conj_type;
    }
    return base;
  }
  if (conj_type === "Polite") {
    if (suffix === "です") return base + "です";
    if (suffix === "ます") return _stem_replace(base, "ます");
    return _stem_replace(base, suffix);
  }
  if (conj_type === "Causative") {
    if (suffix === "させ") return _stem_replace(base, "させる");
    return _stem_replace(base, suffix);
  }
  if (["Passive", "Potential", "Potential/Passive"].includes(conj_type)) {
    return _stem_replace(base, suffix);
  }
  if (conj_type.startsWith("Past")) {
    return _stem_replace(base, suffix);
  }
  if (conj_type.includes("Conjunctive")) {
    if (suffix === "んで") {
      if (["ぶ", "む", "ぬ"].some((e) => base.endsWith(e))) return base.slice(0, -1) + "んで";
      if (base.endsWith("く") || base.endsWith("ぐ")) return base.slice(0, -1) + "いで";
      if (["う", "つ", "る"].some((e) => base.endsWith(e))) return base.slice(0, -1) + "って";
      if (base.endsWith("す")) return base.slice(0, -1) + "して";
    }
    return _stem_replace(base, suffix);
  }
  if (conj_type === "Negative") {
    return _stem_replace(base, suffix === "ない" ? "ない" : suffix);
  }
  return _stem_replace(base, suffix);
}

function _forward_apply_step(lemma: string, pos_tags: string[], step: ConjStep): string {
  const tags = _pos_tags_for_stem(lemma, pos_tags);
  const forms = forward_conjugate(lemma, tags) as Record<string, string> | null;
  if (!forms) return apply_step_heuristic(lemma, conjStepToDict(step));
  let ct = step.conj_type;
  if (ct === "Potential/Passive") ct = "Passive";
  const label = (_DERIV_LABEL_MAP as Record<string, string | null>)[ct];
  if (label == null) return apply_step_heuristic(lemma, conjStepToDict(step));
  const form = forms[label];
  if (form) return form;
  return apply_step_heuristic(lemma, conjStepToDict(step));
}

export function reconstruct_forms(
  root: string,
  steps: Array<ConjStep>,
  pos_tags: string[] | null = null,
  surface: string | null = null,
): Array<Record<string, unknown>> {
  if (!steps.length) return [];
  let [fml, neg, past] = _speech_flags(steps);
  const deriv_steps = steps.filter((s) => !_is_speech_step(s));
  let current = root;
  const out: Array<Record<string, unknown>> = [];
  let progressive_expanded = false;

  for (const step of deriv_steps) {
    const is_prog =
      step.conj_type === "Conjunctive (~te, progressive)" ||
      step.conj_type === "Progressive (ている)";
    if (
      is_prog &&
      (step.fml || step.neg || step.conj_type.includes("Past") || fml || neg || past)
    ) {
      let te_stem = current;
      if (!(te_stem.endsWith("て") || te_stem.endsWith("で"))) {
        const te_step = conjStep({ conj_type: "Conjunctive (~te)", suffix: "て" });
        te_stem = pos_tags
          ? _forward_apply_step(current, pos_tags, te_step)
          : apply_step_heuristic(current, conjStepToDict(te_step));
        if (!out.some((s) => s.conjType === "Conjunctive (~te)")) {
          out.push({ ...conjStepToDict(te_step), form: te_stem });
        }
      }
      const prog_fml = Boolean(step.fml || fml);
      const prog_neg = Boolean(step.neg || neg);
      const prog_past =
        past ||
        (step.suffix || "").includes("ました") ||
        (step.suffix || "").includes("でした") ||
        step.suffix === "た";
      const recipe = _build_progressive_speech_recipe(te_stem, prog_fml, prog_neg, prog_past);
      if (recipe) {
        out.push(...recipe);
        current = String(recipe[recipe.length - 1]!.form);
        progressive_expanded = true;
        fml = neg = past = false;
        continue;
      }
    }
    const step_dict = conjStepToDict(step);
    current = pos_tags
      ? _forward_apply_step(current, pos_tags, step)
      : apply_step_heuristic(current, step_dict);
    step_dict.form = current;
    out.push(step_dict);
  }

  if (!progressive_expanded && (fml || neg || past)) {
    let recipe = _build_speech_recipe(current, pos_tags, fml, neg, past);
    if (recipe.length) {
      if (
        out.length &&
        recipe[0]!.form === out[out.length - 1]!.form &&
        String(recipe[0]!.conjType).toLowerCase().includes("progressive")
      ) {
        recipe = recipe.slice(1);
      }
      out.push(...recipe);
    } else {
      for (const step of steps) {
        if (!_is_speech_step(step)) continue;
        const step_dict = conjStepToDict(step);
        current = pos_tags
          ? _forward_apply_step(current, pos_tags, step)
          : apply_step_heuristic(current, step_dict);
        step_dict.form = current;
        out.push(step_dict);
      }
    }
  } else if (!deriv_steps.length && !(fml || neg || past)) {
    for (const step of steps) {
      const step_dict = conjStepToDict(step);
      current = pos_tags
        ? _forward_apply_step(current, pos_tags, step)
        : apply_step_heuristic(current, step_dict);
      step_dict.form = current;
      out.push(step_dict);
    }
  }

  if (surface && out.length) {
    const last = out[out.length - 1]!;
    last.form = _prefer_kanji_tree_form(String(last.form ?? ""), surface);
  }
  return out;
}

export const _KANJI_RE = /[\u4e00-\u9fff]/u;
export const _KANA_ONLY_RE = /^[\u3040-\u309f\u30a0-\u30ffー]+$/u;

function _prefer_kanji_tree_form(recipe_form: string, surface: string): string {
  if (!surface) return recipe_form;
  if (!recipe_form) return surface;
  if (_KANJI_RE.test(recipe_form) && _KANA_ONLY_RE.test(surface)) return recipe_form;
  return surface;
}

export function reconstruct_forms_from_dicts(
  root: string,
  steps: Array<Record<string, unknown>>,
  pos_tags: string[] | null = null,
  surface: string | null = null,
): void {
  const conj_steps = steps.map((s) =>
    conjStep({
      conj_type: String(s.conjType ?? ""),
      suffix: String(s.suffix ?? ""),
      gloss: String(s.gloss ?? ""),
      neg: Boolean(s.neg),
      fml: Boolean(s.fml),
    }),
  );
  const rebuilt = reconstruct_forms(root, conj_steps, pos_tags, surface);
  steps.length = 0;
  steps.push(...rebuilt);
}
