import { useCallback } from "react";
import confetti from "canvas-confetti";

export const useConfetti = () => {
  const fire = useCallback(() => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#1E2A44", "#C6A75E", "#2F5E4E", "#ffffff"],
    });
  }, []);
  return fire;
};
