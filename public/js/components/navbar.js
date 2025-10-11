/**
 * Tractatus Framework - Responsive Navbar Component
 * Consistent, mobile-friendly navigation across all pages
 */

class TractatusNavbar {
  constructor() {
    this.mobileMenuOpen = false;
    this.audiencesDropdownOpen = false;
    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
  }

  render() {
    const navHTML = `
      <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">

            <!-- Left: Logo + Brand -->
            <div class="flex items-center">
              <a href="/" class="flex items-center space-x-3 hover:opacity-80 transition">
                <img src="/images/tractatus-icon.svg" alt="Tractatus Icon" class="w-8 h-8 text-blue-600">
                <span class="text-xl font-bold text-gray-900 hidden sm:inline">Tractatus Framework</span>
                <span class="text-xl font-bold text-gray-900 sm:hidden">Tractatus</span>
              </a>
            </div>

            <!-- Desktop Menu (hidden on mobile) -->
            <div class="hidden md:flex items-center space-x-8">
              <!-- Audiences Dropdown -->
              <div class="relative">
                <button id="audiences-dropdown-btn" class="text-gray-600 hover:text-gray-900 flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1">
                  <span>Audiences</span>
                  <svg class="w-4 h-4 transition-transform" id="audiences-dropdown-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div id="audiences-dropdown-menu" class="hidden absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  <a href="/researcher.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">Researcher</a>
                  <a href="/implementer.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">Implementer</a>
                  <a href="/leader.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700">Leader</a>
                </div>
              </div>

              <a href="/docs.html" class="text-gray-600 hover:text-gray-900 font-medium">Docs</a>
              <a href="/blog.html" class="text-gray-600 hover:text-gray-900 font-medium">Blog</a>
              <a href="/faq.html" class="text-gray-600 hover:text-gray-900 font-medium">FAQ</a>
              <a href="/about.html" class="text-gray-600 hover:text-gray-900">About</a>
            </div>

            <!-- Menu Button (always visible) -->
            <div class="flex items-center">
              <button id="mobile-menu-btn" class="text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-2 md:ml-4" aria-label="Toggle menu">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

          </div>
        </div>

        <!-- Navigation Drawer (overlay, doesn't push content) -->
        <div id="mobile-menu" class="hidden fixed inset-0 z-[9999]">
          <!-- Backdrop with blur -->
          <div id="mobile-menu-backdrop" class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"></div>

          <!-- Menu Panel (slides from right) -->
          <div id="mobile-menu-panel" class="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl transform transition-transform duration-300 ease-out">
            <div class="flex justify-between items-center px-5 h-16 border-b border-gray-200">
              <div class="flex items-center space-x-2">
                <img src="/images/tractatus-icon.svg" alt="Tractatus Icon" class="w-6 h-6">
                <span class="font-bold text-gray-900">Navigation</span>
              </div>
              <button id="mobile-menu-close-btn" class="text-gray-600 hover:text-gray-900 p-2 rounded hover:bg-gray-100 transition" aria-label="Close menu">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav class="p-5 space-y-3">
              <div class="pb-3 mb-3 border-b border-gray-200">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-3">Audiences</p>
                <a href="/researcher.html" class="block px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition font-medium">
                  <span class="text-sm">🔬 Researcher</span>
                </a>
                <a href="/implementer.html" class="block px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition font-medium">
                  <span class="text-sm">⚙️ Implementer</span>
                </a>
                <a href="/leader.html" class="block px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition font-medium">
                  <span class="text-sm">💼 Leader</span>
                </a>
              </div>
              <a href="/docs.html" class="block px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition">
                <span class="text-sm font-semibold">📚 Documentation</span>
              </a>
              <a href="/blog.html" class="block px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition">
                <span class="text-sm font-semibold">📝 Blog</span>
              </a>
              <a href="/faq.html" class="block px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition">
                <span class="text-sm font-semibold">❓ FAQ</span>
              </a>
              <a href="/about.html" class="block px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition">
                <span class="text-sm font-semibold">ℹ️ About</span>
              </a>
              <a href="/demos/27027-demo.html" class="block px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition">
                <span class="text-sm font-semibold">🎯 Interactive Demo</span>
              </a>
            </nav>
          </div>
        </div>

      </nav>
    `;

    // Insert navbar at the beginning of body (or replace existing nav)
    const existingNav = document.querySelector('nav');
    if (existingNav) {
      existingNav.outerHTML = navHTML;
    } else {
      document.body.insertAdjacentHTML('afterbegin', navHTML);
    }
  }

  attachEventListeners() {
    // Audiences Dropdown (Desktop)
    const audiencesBtn = document.getElementById('audiences-dropdown-btn');
    const audiencesMenu = document.getElementById('audiences-dropdown-menu');
    const audiencesArrow = document.getElementById('audiences-dropdown-arrow');

    if (audiencesBtn) {
      audiencesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audiencesDropdownOpen = !this.audiencesDropdownOpen;
        audiencesMenu.classList.toggle('hidden', !this.audiencesDropdownOpen);
        audiencesArrow.style.transform = this.audiencesDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', () => {
        if (this.audiencesDropdownOpen) {
          this.audiencesDropdownOpen = false;
          audiencesMenu.classList.add('hidden');
          audiencesArrow.style.transform = 'rotate(0deg)';
        }
      });
    }

    // Mobile Menu (Navigation Drawer)
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuCloseBtn = document.getElementById('mobile-menu-close-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuPanel = document.getElementById('mobile-menu-panel');
    const mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');

    const toggleMobileMenu = () => {
      this.mobileMenuOpen = !this.mobileMenuOpen;

      if (this.mobileMenuOpen) {
        // Open: Show menu and slide panel in from right
        mobileMenu.classList.remove('hidden');
        // Use setTimeout to ensure display change happens before animation
        setTimeout(() => {
          mobileMenuPanel.classList.remove('translate-x-full');
          mobileMenuPanel.classList.add('translate-x-0');
        }, 10);
        document.body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
      } else {
        // Close: Slide panel out to right
        mobileMenuPanel.classList.remove('translate-x-0');
        mobileMenuPanel.classList.add('translate-x-full');
        // Hide menu after animation completes (300ms)
        setTimeout(() => {
          mobileMenu.classList.add('hidden');
        }, 300);
        document.body.style.overflow = '';
      }
    };

    // Initialize panel in hidden state (off-screen to the right)
    if (mobileMenuPanel) {
      mobileMenuPanel.classList.add('translate-x-full');
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    if (mobileMenuCloseBtn) {
      mobileMenuCloseBtn.addEventListener('click', toggleMobileMenu);
    }

    if (mobileMenuBackdrop) {
      mobileMenuBackdrop.addEventListener('click', toggleMobileMenu);
    }

    // Close mobile menu on navigation
    const mobileLinks = document.querySelectorAll('#mobile-menu a');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (this.mobileMenuOpen) {
          toggleMobileMenu();
        }
      });
    });
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new TractatusNavbar());
} else {
  new TractatusNavbar();
}
