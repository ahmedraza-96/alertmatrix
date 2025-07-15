import { API_URL, TIMEOUT, RETRY_ATTEMPTS } from '../config/api';

class ApiClient {
  constructor() {
    this.baseURL = API_URL;
    this.timeout = TIMEOUT;
    this.retryAttempts = RETRY_ATTEMPTS;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    console.log(`🔄 API Request: ${config.method || 'GET'} ${url}`);
    console.log(`🔍 Request headers:`, config.headers);

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...config,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log(`✅ API Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ 
            message: `HTTP ${response.status}: ${response.statusText}` 
          }));
          throw new Error(errorData.message || `Request failed with status ${response.status}`);
        }

        return response;
      } catch (error) {
        console.warn(`❌ API Attempt ${attempt}/${this.retryAttempts} failed:`, error.message);
        console.warn(`🔍 Error details:`, error);

        if (attempt === this.retryAttempts) {
          console.error(`🚨 All ${this.retryAttempts} attempts failed for ${url}`);
          throw new NetworkError(error.message, url, attempt);
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async get(endpoint, headers = {}) {
    const response = await this.request(endpoint, { method: 'GET', headers });
    if (!response) {
      throw new Error('No response received from server');
    }
    return response.json();
  }

  async post(endpoint, data, headers = {}) {
    const response = await this.request(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response) {
      throw new Error('No response received from server');
    }
    return response.json();
  }

  async patch(endpoint, data, headers = {}) {
    const response = await this.request(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    if (!response) {
      throw new Error('No response received from server');
    }
    return response.json();
  }

  async delete(endpoint, headers = {}) {
    const response = await this.request(endpoint, { method: 'DELETE', headers });
    if (!response) {
      throw new Error('No response received from server');
    }
    return response.json();
  }
}

class NetworkError extends Error {
  constructor(message, url, attempts) {
    super(message);
    this.name = 'NetworkError';
    this.url = url;
    this.attempts = attempts;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export helper functions for common operations
export const createAuthHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
});

export const handleApiError = (error, context = '') => {
  if (error instanceof NetworkError) {
    console.error(`🚨 Network Error ${context}:`, {
      message: error.message,
      url: error.url,
      attempts: error.attempts,
    });
    return {
      title: 'Network Error',
      message: 'Please check your internet connection and try again.',
    };
  }

  console.error(`🚨 API Error ${context}:`, error);
  return {
    title: 'Error',
    message: error.message || 'An unexpected error occurred.',
  };
}; 