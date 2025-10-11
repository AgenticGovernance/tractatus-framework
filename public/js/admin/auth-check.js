/**
 * Admin Authentication Check Utility
 * Protects admin pages by redirecting unauthenticated users to login
 *
 * Usage: Include at top of every admin page HTML:
 * <script src="/js/admin/auth-check.js"></script>
 */

(function() {
  'use strict';

  // Skip auth check on login page itself
  if (window.location.pathname === '/admin/login.html') {
    return;
  }

  /**
   * Check if user has valid authentication token
   */
  function checkAuthentication() {
    const token = localStorage.getItem('admin_token');

    // No token found - redirect to login
    if (!token) {
      redirectToLogin('No authentication token found');
      return false;
    }

    // Parse token to check expiration
    try {
      const payload = parseJWT(token);
      const now = Math.floor(Date.now() / 1000);

      // Token expired - redirect to login
      if (payload.exp && payload.exp < now) {
        localStorage.removeItem('admin_token');
        redirectToLogin('Session expired');
        return false;
      }

      // Check if admin role
      if (payload.role !== 'admin' && payload.role !== 'moderator') {
        redirectToLogin('Insufficient permissions');
        return false;
      }

      // Token valid
      return true;

    } catch (error) {
      console.error('Token validation error:', error);
      localStorage.removeItem('admin_token');
      redirectToLogin('Invalid authentication token');
      return false;
    }
  }

  /**
   * Parse JWT token without verification (client-side validation only)
   */
  function parseJWT(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  }

  /**
   * Redirect to login page with reason
   */
  function redirectToLogin(reason) {
    const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
    const loginUrl = `/admin/login.html?redirect=${currentPath}&reason=${encodeURIComponent(reason)}`;

    // Show brief message before redirect
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, -apple-system, sans-serif;">
        <div style="text-align: center;">
          <svg style="width: 64px; height: 64px; margin: 0 auto 16px; color: #3B82F6;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 8px;">Authentication Required</h2>
          <p style="color: #6B7280; margin-bottom: 16px;">${reason}</p>
          <p style="color: #9CA3AF; font-size: 14px;">Redirecting to login...</p>
        </div>
      </div>
    `;

    setTimeout(() => {
      window.location.href = loginUrl;
    }, 1500);
  }

  /**
   * Add authentication headers to fetch requests
   */
  function getAuthHeaders() {
    const token = localStorage.getItem('admin_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Handle API authentication errors
   */
  function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('admin_token');
      redirectToLogin('Session expired or invalid');
      return true;
    }
    return false;
  }

  // Run authentication check immediately
  checkAuthentication();

  // Export utilities for admin pages to use
  window.AdminAuth = {
    getAuthHeaders,
    handleAuthError,
    checkAuthentication,
    redirectToLogin
  };

  // Periodically check token validity (every 5 minutes)
  setInterval(checkAuthentication, 5 * 60 * 1000);

})();
