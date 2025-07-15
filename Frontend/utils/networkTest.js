import { Platform } from './platform';
import { ENV_CONFIG } from '../config/env';

const getApiUrl = () => {
  const isWeb = Platform.OS === 'web';
  
  if (isWeb) {
    return 'http://localhost:8000';
  }
  
  if (Platform.OS === 'android') {
    return ENV_CONFIG.API_URL;
  }
  
  return 'http://localhost:8000';
};

export const testNetworkConnectivity = async () => {
  const apiUrl = getApiUrl();
  const results = {
    platform: Platform.OS,
    apiUrl,
    tests: []
  };

  // Test 1: Basic server health check
  try {
    console.log('🧪 Testing basic server connectivity...');
    const response = await fetch(`${apiUrl}/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      timeout: 5000
    });
    
    results.tests.push({
      test: 'Server Health Check',
      status: response.ok ? 'PASS' : 'FAIL',
      statusCode: response.status,
      response: await response.text()
    });
  } catch (error) {
    results.tests.push({
      test: 'Server Health Check',
      status: 'FAIL',
      error: error.message
    });
  }

  // Test 2: Login endpoint availability
  try {
    console.log('🧪 Testing login endpoint...');
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { 'Accept': 'application/json' },
      timeout: 5000
    });
    
    results.tests.push({
      test: 'Login Endpoint (OPTIONS)',
      status: response.ok ? 'PASS' : 'FAIL',
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries())
    });
  } catch (error) {
    results.tests.push({
      test: 'Login Endpoint (OPTIONS)',
      status: 'FAIL',
      error: error.message
    });
  }

  // Test 3: DNS resolution test
  try {
    console.log('🧪 Testing DNS resolution...');
    const testUrls = [
      'http://google.com',
      'http://httpbin.org/ip'
    ];
    
    for (const url of testUrls) {
      try {
        const response = await fetch(url, { 
          method: 'GET', 
          timeout: 5000 
        });
        results.tests.push({
          test: `DNS Resolution (${url})`,
          status: 'PASS',
          statusCode: response.status
        });
      } catch (error) {
        results.tests.push({
          test: `DNS Resolution (${url})`,
          status: 'FAIL',
          error: error.message
        });
      }
    }
  } catch (error) {
    results.tests.push({
      test: 'DNS Resolution',
      status: 'FAIL',
      error: error.message
    });
  }

  console.log('🔍 Network Test Results:', results);
  return results;
};

export const logNetworkInfo = () => {
  const apiUrl = getApiUrl();
  console.log('🌐 Network Configuration:');
  console.log(`  Platform: ${Platform.OS}`);
  console.log(`  API URL: ${apiUrl}`);
  console.log(`  User Agent: ${navigator.userAgent || 'Not available'}`);
  
  if (Platform.OS === 'android') {
    console.log('📱 Android Emulator Network Info:');
    console.log('  - 10.0.2.2 maps to host machine localhost');
    console.log('  - 10.0.2.3 maps to host machine first DNS server');
    console.log('  - Make sure server binds to 0.0.0.0, not just 127.0.0.1');
  }
}; 