"use client";
import { useCallback, useEffect, useState } from "react";

// Read-aloud with the browser's built-in voices. Only voices that run on this device
// (localService) are used: online voices would send the lesson text to a speech service.
export function useSpeech() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => {
      const local = speechSynthesis.getVoices().filter((v) => v.localService && /^en([-_]|$)/i.test(v.lang));
      setVoice(local.find((v) => /en[-_]US/i.test(v.lang)) ?? local[0] ?? null);
    };
    pick();
    speechSynthesis.addEventListener("voiceschanged", pick); // some browsers load voices late
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", pick);
      speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voice) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95;
      speechSynthesis.speak(u);
    },
    [voice]
  );

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
  }, []);

  return { available: !!voice, speak, stop };
}
