// src/hooks/useTime.js
import { useState, useRef, useCallback } from "react";

export default function useTime() {
  const [timeLeft, setTimeLeft] = useState(null);
  const [status, setStatus] = useState("disconnected");
  const timerRef = useRef(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimeLeft(null);
  }, []);

  const startTimer = useCallback((seconds) => {
    console.log(`⏳ Timer started for ${seconds}s`);
    stopTimer();
    setTimeLeft(seconds);
    setStatus("waiting");

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          console.warn("⌛ Timer expired");
          clearInterval(timerRef.current);
          timerRef.current = null;
          setStatus("disconnected");
          alert("No one joined within 2 minutes. Call ended.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  return { timeLeft, status, setStatus, startTimer, stopTimer };
}
