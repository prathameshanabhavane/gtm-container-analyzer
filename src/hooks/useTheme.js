/**
 * useTheme Hook
 * Manages theme state (dark/light) with localStorage persistence and transition effects
 */

import { useState, useEffect } from 'react';

const useTheme = () => {
  // Theme state - persisted in localStorage
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('gtm-analyzer-theme');
    return saved || 'dark';
  });
  const [overlayActive, setOverlayActive] = useState(false);
  const [targetTheme, setTargetTheme] = useState(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gtm-analyzer-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTargetTheme(nextTheme);
    setOverlayActive(true);
    
    // Change theme after overlay fully covers screen
    setTimeout(() => {
      setTheme(nextTheme);
      
      // Wait for theme to fully apply, then fade out overlay
      setTimeout(() => {
        setOverlayActive(false);
        setTargetTheme(null);
      }, 400);
    }, 300);
  };

  return {
    theme,
    overlayActive,
    targetTheme,
    toggleTheme,
  };
};

export default useTheme;

