/**
 * Scroll Utilities
 * Common scroll functions used across the application
 */

/**
 * Scroll to top of the page
 * Works on all browsers including older Safari, iOS, Android
 */
export const scrollToTop = () => {
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    // Fallback for older browsers
    window.scrollTo(0, 0);
  }
  // Additional fallback for some edge cases
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0; // For Safari
};







