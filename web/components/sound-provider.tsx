"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";

type SoundType = "shutter" | "stamp" | "paper" | "error";

interface SoundContextType {
  playSound: (type: SoundType) => void;
  isSoundEnabled: boolean;
  toggleSound: () => void;
}

const SoundContext = createContext<SoundContextType | null>(null);

// Base64 encoded minimal sounds (to avoid external files for now)
// These are tiny placeholder sounds - can be replaced with real audio files later
const SOUNDS: Record<SoundType, string> = {
  // Very short click sound
  shutter: "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV////////////////////////////////////////////AAAAAExhdmM1OC4xMwAAAAAAAAAAAAAAACQAAAAAAAAAAQGwKzpWAAAAAAAAAAAAAAAAAAAAAAD/4zDAAAJYAUBQAAABG7yzLggJxuD7ygGH7xiDDD/gYPg+D7/+UBh/lAYf5QGH+UBh/lAYPg+D4Pg+D4Pg+f/BwfBAEDvKAwfygMP8oDD/KAw/ygMHwfB8HwfB8HwfP/g4PggCB3/4zDEEQO4AUADAAAE4ODkGCMDA4Jh+fBwfBB/4PggCAI/y4ODg+CAIAj/lAYf5QGD4Pg+Dg+D5/8HB8EH/g+CAIAj/+UBh/lAYPg+D4OD4Pn/wcHwQf+D4IAgCP/+M4xBgD+AHAAAACB8HwfB8HwfB8HwfB8EH/g+CAIHf8HB8HwQf+D4IAgd/wcHwfBAEDv+Dg+D4IAgd/wcHwfBAEDv+Dg+D4IAgCP/jMMQPA8ABQFAAAAT/g4Pg+CAIHf8HB8HwQBA7/g4Pg+CAIHf8HB8HwQBA7/g4Pg+CAIAj/+Dg+D4IAgCP/4ODg+D4IAggAAAD/4zjEFAOoAUAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  // Short stamp/thud sound
  stamp: "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV////////////////////////////////////////////AAAAAExhdmM1OC4xMwAAAAAAAAAAAAAAACQAAAAAAAAAAQGwJC99AAAAAAAAAAAAAAAAAAAAAP/jMMAAAoABQFAAAAHsYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY/+MwxBsDqAFAAAAABGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGD/4zDEHgOYAUAAAAFAYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
  // Soft paper rustle
  paper: "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV////////////////////////////////////////////AAAAAExhdmM1OC4xMwAAAAAAAAAAAAAAACQAAAAAAAAAAQGwHUGBAAAAAAAAAAAAAAAAAAAAAAD/4zDAAAGwAUBQAAABLyxRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRT/4zDEJAO4AUAAAAACiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiij/4zjEJgOoAUAAAAFAooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
  // Soft error tone
  error: "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV////////////////////////////////////////////AAAAAExhdmM1OC4xMwAAAAAAAAAAAAAAACQAAAAAAAAAAQGwLEn6AAAAAAAAAAAAAAAAAAAAAP/jMMAAAoABQFAAAAHv/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+MwxBwDqAFAAAAABP/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////4zjEHQOYAUAAAAFA////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////",
};

export function SoundProvider({ children }: { children: ReactNode }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    shutter: null,
    stamp: null,
    paper: null,
    error: null,
  });

  // Initialize audio elements
  useEffect(() => {
    // Check localStorage for sound preference
    const savedPref = localStorage.getItem("cloaked-sound-enabled");
    if (savedPref === "true") {
      setIsSoundEnabled(true);
    }

    // Pre-load audio elements
    (Object.keys(SOUNDS) as SoundType[]).forEach((type) => {
      const audio = new Audio(SOUNDS[type]);
      audio.volume = 0.3; // Keep sounds subtle
      audioRefs.current[type] = audio;
    });

    return () => {
      // Cleanup
      (Object.keys(audioRefs.current) as SoundType[]).forEach((type) => {
        audioRefs.current[type] = null;
      });
    };
  }, []);

  const playSound = useCallback(
    (type: SoundType) => {
      if (!isSoundEnabled) return;

      const audio = audioRefs.current[type];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Ignore autoplay errors
        });
      }
    },
    [isSoundEnabled]
  );

  const toggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => {
      const newValue = !prev;
      localStorage.setItem("cloaked-sound-enabled", String(newValue));
      return newValue;
    });
  }, []);

  return (
    <SoundContext.Provider value={{ playSound, isSoundEnabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    // Return a no-op version if used outside provider
    return {
      playSound: () => {},
      isSoundEnabled: false,
      toggleSound: () => {},
    };
  }
  return context;
}

// Sound toggle button component
export function SoundToggle() {
  const { isSoundEnabled, toggleSound } = useSound();

  return (
    <button
      onClick={toggleSound}
      className="p-2 rounded-full hover:bg-[var(--vintage-brown)]/5 transition-colors"
      title={isSoundEnabled ? "Mute sounds" : "Enable sounds"}
    >
      {isSoundEnabled ? (
        <svg
          className="w-5 h-5 text-[var(--vintage-brown)]/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-[var(--vintage-brown)]/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
          />
        </svg>
      )}
    </button>
  );
}
