import { useState, useEffect } from 'react';

export const useFadeIn = (duration: number = 500, delay: number = 50) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay to ensure the initial render with opacity 0 happens
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return {
    opacity: isVisible ? 1 : 0,
    transition: `opacity ${duration}ms ease-in-out`
  };
};
