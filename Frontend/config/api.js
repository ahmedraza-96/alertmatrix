import Constants from 'expo-constants';
import { Platform } from '../utils/platform';
import { ENV_CONFIG } from './env';

// Get API URL based on platform and environment
const getApiUrl = () => {
  // Check if running in a web browser
  const isWeb = Platform.OS === 'web';
  
  if (isWeb) {
    return 'http://localhost:8000';
  }
  
  // Use configured URL from environment variables first
  const configuredUrl = Constants?.expoConfig?.extra?.API_URL || process.env.EXPO_PUBLIC_API_URL;
  if (configuredUrl) return configuredUrl;
  
  // For development, try localhost first for better reliability
  if (__DEV__) {
    return 'http://localhost:8000';
  }
  
  // Use environment configuration with current IP
  return ENV_CONFIG.API_URL;
};

export const API_URL = getApiUrl();

// For debugging
console.log('🌐 Using API URL:', API_URL);
console.log('🔧 Current IP from ENV_CONFIG:', ENV_CONFIG.CURRENT_IP);

export const TIMEOUT = 30000; // 30 seconds for report queries
export const RETRY_ATTEMPTS = 2; // Reduce retries since we increased timeout

export default {
  API_URL,
  TIMEOUT,
  RETRY_ATTEMPTS,
}; 