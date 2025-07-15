// Environment Configuration for AlertMatrix Frontend
// This file contains environment variables for API endpoints and service URLs

// Get current IP address dynamically or use fallback
const getCurrentIP = () => {
  // Try to get from environment variables first
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl) {
    return envApiUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
  }
  
  // Fallback to current IP
  return '192.168.0.109';
};

const CURRENT_IP = getCurrentIP();

export const ENV_CONFIG = {
  // Current machine IP address - Update this when your IP changes
  CURRENT_IP,
  API_URL: `http://${CURRENT_IP}:8000`,
  YOLO_SERVICE_URL: `http://${CURRENT_IP}:5000`,
  
  // Service Ports
  API_PORT: 8000,
  YOLO_PORT: 5000,
  
  // Network Configuration
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  
  // Platform-specific configurations
  ANDROID_EMULATOR_IP: '10.0.2.2',
  LOCALHOST: 'localhost',
};

// Export individual values for convenience
export const API_URL = ENV_CONFIG.API_URL;
export const YOLO_SERVICE_URL = ENV_CONFIG.YOLO_SERVICE_URL;
export const TIMEOUT = ENV_CONFIG.TIMEOUT;
export const RETRY_ATTEMPTS = ENV_CONFIG.RETRY_ATTEMPTS;

export default ENV_CONFIG; 