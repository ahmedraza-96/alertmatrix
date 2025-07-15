const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add video file extensions
config.resolver.assetExts.push(
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'flv',
  'm4v',
  '3gp'
);

// Enable require.context support
config.transformer.unstable_allowRequireContext = true;

// Fix web-streams-polyfill resolution
config.resolver.alias = {
  'web-streams-polyfill/ponyfill/es6': 'web-streams-polyfill/dist/ponyfill.js',
};

module.exports = config;
