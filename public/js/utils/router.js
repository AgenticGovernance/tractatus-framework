/**
 * Simple client-side router for three audience paths
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentPath = null;

    // Initialize router
    window.addEventListener('popstate', () => this.handleRoute());
    document.addEventListener('DOMContentLoaded', () => this.handleRoute());

    // Handle link clicks
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-route]')) {
        e.preventDefault();
        const path = e.target.getAttribute('data-route') || e.target.getAttribute('href');
        this.navigateTo(path);
      }
    });
  }

  /**
   * Register a route
   */
  on(path, handler) {
    this.routes.set(path, handler);
    return this;
  }

  /**
   * Navigate to a path
   */
  navigateTo(path) {
    if (path === this.currentPath) return;

    history.pushState(null, '', path);
    this.handleRoute();
  }

  /**
   * Handle current route
   */
  async handleRoute() {
    const path = window.location.pathname;
    this.currentPath = path;

    // Try exact match
    if (this.routes.has(path)) {
      await this.routes.get(path)();
      return;
    }

    // Try pattern match
    for (const [pattern, handler] of this.routes) {
      const match = this.matchRoute(pattern, path);
      if (match) {
        await handler(match.params);
        return;
      }
    }

    // No match, show 404
    this.show404();
  }

  /**
   * Match route pattern
   */
  matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return { params };
  }

  /**
   * Show 404 page
   */
  show404() {
    const container = document.getElementById('app') || document.body;
    container.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="text-center">
          <h1 class="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <p class="text-xl text-gray-600 mb-8">Page not found</p>
          <a href="/" class="text-blue-600 hover:text-blue-700 font-semibold">
            ← Return to homepage
          </a>
        </div>
      </div>
    `;
  }
}

// Create global router instance
window.router = new Router();
