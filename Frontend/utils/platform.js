// utils/platform.js
// Safe Platform utility with fallbacks

let Platform;

try {
  // Try to import Platform from react-native
  Platform = require('react-native').Platform;
} catch (error) {
  console.warn('❌ Failed to import Platform from react-native:', error.message);
  
  // Fallback Platform object
  Platform = {
    OS: typeof window !== 'undefined' ? 'web' : 'android',
    Version: '0.0.0',
    select: (obj) => {
      const platform = Platform.OS;
      return obj[platform] || obj.default;
    }
  };
}

// Ensure Platform is available globally
if (typeof globalThis.Platform === 'undefined') {
  globalThis.Platform = Platform;
}

// Support both CommonJS and ES6 exports
module.exports = { Platform };
module.exports.Platform = Platform;
module.exports.default = Platform; 