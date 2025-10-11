/**
 * API Client for Tractatus Platform
 * Handles all HTTP requests to the backend API
 */

const API_BASE = '/api';

/**
 * Generic API request handler
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

/**
 * Documents API
 */
const Documents = {
  /**
   * List all documents with optional filtering
   */
  async list(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/documents${query ? '?' + query : ''}`);
  },

  /**
   * Get document by ID or slug
   */
  async get(identifier) {
    return apiRequest(`/documents/${identifier}`);
  },

  /**
   * Search documents
   */
  async search(query, params = {}) {
    const searchParams = new URLSearchParams({ q: query, ...params }).toString();
    return apiRequest(`/documents/search?${searchParams}`);
  }
};

/**
 * Authentication API
 */
const Auth = {
  /**
   * Login
   */
  async login(email, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  /**
   * Get current user
   */
  async getCurrentUser() {
    const token = localStorage.getItem('auth_token');
    return apiRequest('/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  },

  /**
   * Logout
   */
  async logout() {
    const token = localStorage.getItem('auth_token');
    const result = await apiRequest('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    localStorage.removeItem('auth_token');
    return result;
  }
};

// Export as global API object
window.API = {
  Documents,
  Auth
};
