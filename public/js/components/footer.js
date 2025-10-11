/**
 * Footer Component
 * Shared footer for all Tractatus pages
 */

(function() {
  'use strict';

  // Create footer HTML
  const footerHTML = `
    <footer class="bg-gray-900 text-gray-300 mt-16" role="contentinfo">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <!-- Main Footer Content -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          <!-- About -->
          <div>
            <h3 class="text-white font-semibold mb-4">Tractatus Framework</h3>
            <p class="text-sm text-gray-400">
              Architectural constraints for AI safety that preserve human agency through structural, not aspirational, guarantees.
            </p>
          </div>

          <!-- Documentation -->
          <div>
            <h3 class="text-white font-semibold mb-4">Documentation</h3>
            <ul class="space-y-2 text-sm">
              <li><a href="/docs.html" class="hover:text-white transition">Framework Docs</a></li>
              <li><a href="/about.html" class="hover:text-white transition">About</a></li>
              <li><a href="/about/values.html" class="hover:text-white transition">Core Values</a></li>
              <li><a href="/demos/27027-demo.html" class="hover:text-white transition">Interactive Demo</a></li>
            </ul>
          </div>

          <!-- Support -->
          <div>
            <h3 class="text-white font-semibold mb-4">Support</h3>
            <ul class="space-y-2 text-sm">
              <li><a href="/koha.html" class="hover:text-white transition">Donate (Koha)</a></li>
              <li><a href="/koha/transparency.html" class="hover:text-white transition">Transparency</a></li>
              <li><a href="/media-inquiry.html" class="hover:text-white transition">Media Inquiries</a></li>
              <li><a href="/case-submission.html" class="hover:text-white transition">Submit Case Study</a></li>
            </ul>
          </div>

          <!-- Legal & Contact -->
          <div>
            <h3 class="text-white font-semibold mb-4">Legal</h3>
            <ul class="space-y-2 text-sm">
              <li><a href="/privacy.html" class="hover:text-white transition">Privacy Policy</a></li>
              <li><a href="mailto:hello@agenticgovernance.digital" class="hover:text-white transition">Contact Us</a></li>
              <li><a href="https://github.com/yourusername/tractatus" class="hover:text-white transition" target="_blank" rel="noopener">GitHub</a></li>
            </ul>
          </div>

        </div>

        <!-- Divider -->
        <div class="border-t border-gray-800 pt-8">

          <!-- Te Tiriti Acknowledgement -->
          <div class="mb-6">
            <p class="text-sm text-gray-400">
              <strong class="text-gray-300">Te Tiriti o Waitangi:</strong> We acknowledge Te Tiriti o Waitangi and our commitment to partnership, protection, and participation. This project respects Māori data sovereignty (rangatiratanga) and collective guardianship (kaitiakitanga).
            </p>
          </div>

          <!-- Bottom Row -->
          <div class="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <p class="text-gray-400">
              © ${new Date().getFullYear()} Tractatus AI Safety Framework. Licensed under <a href="https://www.apache.org/licenses/LICENSE-2.0" class="text-blue-400 hover:text-blue-300 transition" target="_blank" rel="noopener">Apache 2.0</a>.
            </p>
            <p class="text-gray-400">
              Made in Aotearoa New Zealand 🇳🇿
            </p>
          </div>

        </div>

      </div>
    </footer>
  `;

  // Insert footer at end of body
  if (document.body) {
    document.body.insertAdjacentHTML('beforeend', footerHTML);
  } else {
    // If body not ready, wait for DOM
    document.addEventListener('DOMContentLoaded', function() {
      document.body.insertAdjacentHTML('beforeend', footerHTML);
    });
  }

})();
