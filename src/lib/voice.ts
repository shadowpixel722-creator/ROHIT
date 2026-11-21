/**
 * The read-aloud voice, shared by lessons, Read aloud and the tutor (browser speech synthesis, on the device).
 * Matches Knowa: a bright English voice (female US voices first, Indian English skipped unless chosen),
 * spoken a little fast and at a high pitch. The person can pick another voice and pitch in Settings;
 * the choice is kept in this browser only.
 */
export type VoicePitch = "knowa" | "high" | "normal";
export type VoicePrefs = { name: string; pitch: VoicePitch };

const KEY = "ep-voice";
export const PITCH: Record<VoicePitch, { value: number; label: string }> = {
  knowa: { value: 1.75, label: "Bright (Knowa)" },
  high: { value: 2, label: "Extra high" },
  normal: { value: 1, label: "Normal" },
};
export const VOICE_TEST = "Hello! I am Knowa. Can you hear me?";

export function voicePrefs(): VoicePrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<VoicePrefs>;
    return { name: typeof p.name === "string" ? p.name : "", pitch: p.pitch && p.pitch in PITCH ? p.pitch : "knowa" };
  } catch {
    return { name: "", pitch: "knowa" };
  }
}

export function saveVoicePrefs(p: VoicePrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: keep defaults */ }
}

export function englishVoices(): SpeechSynthesisVoice[] {
  try { return window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); } catch { return []; }
}

const BRIGHT = /female|samantha|zira|aria|jenny|susan|karen|moira|tessa|serena|victoria|fiona|google us english|google uk english female/i;

export function pickVoice(name = voicePrefs().name): SpeechSynthesisVoice | null {
  const all = englishVoices();
  if (name) { const chosen = all.find((v) => v.name === name); if (chosen) return chosen; }
  const vs = all.filter((v) => !/en[-_]IN/i.test(v.lang));
  return vs.find((v) => BRIGHT.test(v.name) && /en[-_]US/i.test(v.lang)) ?? vs.find((v) => BRIGHT.test(v.name)) ?? vs.find((v) => /en[-_]US/i.test(v.lang)) ?? vs[0] ?? all[0] ?? null;
}

/** Sets voice, language, rate and pitch on an utterance. `rate` is the player's speed (1 = normal). */
export function tuneUtterance(u: SpeechSynthesisUtterance, rate = 1, prefs = voicePrefs()) {
  const v = pickVoice(prefs.name);
  if (v) u.voice = v;
  u.lang = v ? v.lang : "en-US";
  u.rate = rate * 1.05;
  u.pitch = PITCH[prefs.pitch].value;
  u.volume = 1;
}
