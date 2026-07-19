/**
 * Tag helper utilities
 */

/**
 * Map tag type to CSS class for badge styling
 * @param {string} type - The tag type label
 * @returns {string} - CSS class name for the badge
 */
export const getTagBadgeClass = (type) => {
  const typeMap = {
    'Google Tag': 'google-tag',
    'Google Analytics: GA4 Event': 'ga4-event',
    'Google Ads Conversion Tracking': 'google-ads',
    'Google Ads User Data Event': 'google-ads',
    'Facebook Pixel': 'facebook',
    'TikTok Pixel': 'tiktok',
    'Custom HTML': 'custom-html',
    'Conversion Linker': 'conversion',
  };
  return typeMap[type] || 'default';
};

