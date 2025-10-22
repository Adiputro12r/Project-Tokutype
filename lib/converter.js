// lib/converter.js
// wrapper to use global wanakana (wanakana.min.js must be loaded before modules)

export function toHiragana(romaji) {
  try {
    if (typeof wanakana !== "undefined") return wanakana.toHiragana(String(romaji || ""));
  } catch (e) { console.warn("wanakana unavailable", e); }
  return String(romaji || "");
}

export function toKatakana(romaji) {
  try {
    if (typeof wanakana !== "undefined") return wanakana.toKatakana(String(romaji || ""));
  } catch (e) { console.warn("wanakana unavailable", e); }
  return String(romaji || "");
}

export function toRomaji(kana) {
  try {
    if (typeof wanakana !== "undefined") return wanakana.toRomaji(String(kana || ""));
  } catch (e) { console.warn("wanakana unavailable", e); }
  return String(kana || "");
}
