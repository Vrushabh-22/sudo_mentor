import { useCallback, useRef, useState } from "react";

/**
 * Minimal browser-only TTS provider for the candidate portal standalone build.
 * The full ATS instance has a tenant-aware ElevenLabs/Groq pipeline; here we
 * fall back to the browser SpeechSynthesis API which works offline.
 */
export function useTTSProvider(_tenantId: string | null) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopSpeaking = useCallback(() => {
    try { window.speechSynthesis.cancel(); } catch {}
    utterRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) {
      onEnd?.();
      return;
    }
    try { window.speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    u.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find((v) => v.name.includes("Google") || v.name.includes("Samantha") || v.lang.startsWith("en"));
    if (pref) u.voice = pref;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => { setIsSpeaking(false); onEnd?.(); };
    u.onerror = () => { setIsSpeaking(false); onEnd?.(); };
    utterRef.current = u;
    window.speechSynthesis.speak(u);
  }, []);

  return { speak, stopSpeaking, isSpeaking };
}
