import { useCallback } from "react";
import confetti from "canvas-confetti";

export const useConfetti = () => {
  const fire = useCallback(() => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#4398BA", "#C3F0F7", "#22c55e", "#ffffff"],
    });
  }, []);
  return fire;
};
