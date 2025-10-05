// src/hooks/useTime.js
import { useState, useRef, useCallback } from "react";

export default function useTime(onTimeout, onDisconnect) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [status, setStatus] = useState("disconnected");
  const timerRef = useRef(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimeLeft(null);
  }, []);

  const startTimer = useCallback(
    (seconds = 120) => {
      console.log(`⏳ [Timer] Waiting ${seconds}s`);
      stopTimer();
      setTimeLeft(seconds);
      setStatus("waiting");
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            console.warn("⌛ Timeout — disconnecting");
            clearInterval(timerRef.current);
            timerRef.current = null;
            setStatus("disconnected");
            onTimeout?.();
            onDisconnect?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [stopTimer, onTimeout, onDisconnect]
  );

  return { timeLeft, status, setStatus, startTimer, stopTimer };
}
