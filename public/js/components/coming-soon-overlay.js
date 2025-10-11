/**
 * Coming Soon Overlay
 * Displays over Koha pages until Stripe is configured
 */

(function() {
  'use strict';

  // Check if we should show the overlay
  const shouldShowOverlay = () => {
    // Only show on Koha pages
    const isKohaPage = window.location.pathname.includes('/koha');
    return isKohaPage;
  };

  // Create and inject overlay
  if (shouldShowOverlay()) {
    const overlayHTML = `
      <div id="coming-soon-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
      ">
        <div style="
          background: white;
          padding: 3rem;
          border-radius: 1rem;
          max-width: 600px;
          text-align: center;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        ">
          <h1 style="
            font-size: 2.5rem;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 1rem;
          ">
            Koha Donation System
          </h1>
          <p style="
            font-size: 1.25rem;
            color: #6b7280;
            margin-bottom: 2rem;
          ">
            Coming Soon
          </p>
          <div style="
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 1.5rem;
            margin-bottom: 2rem;
            text-align: left;
          ">
            <p style="color: #1e40af; margin-bottom: 0.5rem;">
              <strong>What is Koha?</strong>
            </p>
            <p style="color: #1e3a8a; font-size: 0.875rem; margin: 0;">
              Koha (Māori for "gift") is our upcoming donation system to support the Tractatus Framework.
              We're currently finalizing payment processing integration and will launch soon.
            </p>
          </div>
          <p style="
            color: #6b7280;
            font-size: 0.875rem;
            margin-bottom: 1.5rem;
          ">
            Infrastructure deployed and ready. Payment processing activation in progress.
          </p>
          <a href="/" style="
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-weight: 600;
            transition: background 0.2s;
          ">
            Return to Homepage
          </a>
          <p style="
            margin-top: 1.5rem;
            font-size: 0.75rem;
            color: #9ca3af;
          ">
            Questions? Contact <a href="mailto:support@agenticgovernance.digital" style="color: #3b82f6;">support@agenticgovernance.digital</a>
          </p>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', overlayHTML);
  }
})();
