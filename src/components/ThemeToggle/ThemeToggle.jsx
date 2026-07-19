/**
 * ThemeToggle Component
 * Reusable theme switch button with colorful sun/moon icons
 */

import { Sun, Moon } from 'lucide-react';

const ThemeToggle = ({ theme, onToggle }) => {
  return (
    <button 
      className="theme-toggle"
      onClick={onToggle}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
    >
      <span className="theme-toggle-icon sun-icon">
        <Sun size={16} />
      </span>
      <span className="theme-toggle-icon moon-icon">
        <Moon size={16} />
      </span>
    </button>
  );
};

export default ThemeToggle;


