// Cookie Consent Management - GDPR Compliant
// This script handles cookie consent and tracking

(function() {
    'use strict';

    // Cookie consent states
    const CONSENT_STATES = {
        NOT_SET: 'not_set',
        ESSENTIAL_ONLY: 'essential_only',
        ALL_COOKIES: 'all_cookies',
        CUSTOM: 'custom'
    };

    // Cookie names
    const COOKIE_NAMES = {
        CONSENT: 'cookie_consent',
        CONSENT_DATE: 'cookie_consent_date',
        TRACKING_ID: 'user_tracking_id',
        SESSION_ID: 'user_session_id'
    };

    // Cookie utilities
    const CookieManager = {
        // Set a cookie
        set: function(name, value, days = 365, path = '/') {
            const expires = new Date();
            expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=${path};SameSite=Lax`;
        },

        // Get a cookie
        get: function(name) {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        },

        // Delete a cookie
        delete: function(name, path = '/') {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=${path};`;
        },

        // Check if consent is given
        hasConsent: function() {
            const consent = this.get(COOKIE_NAMES.CONSENT);
            return consent === CONSENT_STATES.ALL_COOKIES || consent === CONSENT_STATES.CUSTOM;
        },

        // Check if essential cookies are allowed (always true)
        hasEssentialConsent: function() {
            const consent = this.get(COOKIE_NAMES.CONSENT);
            return consent !== null && consent !== CONSENT_STATES.NOT_SET;
        }
    };

    // Generate unique tracking ID
    function generateTrackingId() {
        return 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Generate session ID
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Initialize tracking IDs (only if consent given)
    function initializeTracking() {
        if (!CookieManager.hasConsent()) {
            return;
        }

        // Get or create tracking ID (persistent across sessions)
        let trackingId = CookieManager.get(COOKIE_NAMES.TRACKING_ID);
        if (!trackingId) {
            trackingId = generateTrackingId();
            CookieManager.set(COOKIE_NAMES.TRACKING_ID, trackingId, 365); // 1 year
        }

        // Get or create session ID (new each session)
        let sessionId = CookieManager.get(COOKIE_NAMES.SESSION_ID);
        if (!sessionId) {
            sessionId = generateSessionId();
            CookieManager.set(COOKIE_NAMES.SESSION_ID, sessionId, 1); // 1 day (session)
        }

        // Store in window for easy access
        window.trackingId = trackingId;
        window.sessionId = sessionId;

        console.log('[Cookie Tracking] Initialized:', { trackingId, sessionId });
    }

    // Track page view
    function trackPageView() {
        if (!CookieManager.hasConsent()) {
            return;
        }

        const trackingId = CookieManager.get(COOKIE_NAMES.TRACKING_ID);
        const sessionId = CookieManager.get(COOKIE_NAMES.SESSION_ID);
        const page = window.location.pathname;
        const referrer = document.referrer || 'direct';

        // Send to backend tracking API
        fetch('/api/track/page-view', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tracking_id: trackingId,
                session_id: sessionId,
                page: page,
                referrer: referrer,
                timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent,
                screen_width: window.screen.width,
                screen_height: window.screen.height
            })
        }).catch(err => {
            console.warn('[Cookie Tracking] Failed to send page view:', err);
        });
    }

    // Track user interactions
    function trackInteraction(type, data = {}) {
        if (!CookieManager.hasConsent()) {
            return;
        }

        const trackingId = CookieManager.get(COOKIE_NAMES.TRACKING_ID);
        const sessionId = CookieManager.get(COOKIE_NAMES.SESSION_ID);

        fetch('/api/track/interaction', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tracking_id: trackingId,
                session_id: sessionId,
                interaction_type: type,
                interaction_data: data,
                timestamp: new Date().toISOString(),
                page: window.location.pathname
            })
        }).catch(err => {
            console.warn('[Cookie Tracking] Failed to send interaction:', err);
        });
    }

    // Show cookie consent banner
    function showCookieBanner() {
        const banner = document.getElementById('cookieConsentBanner');
        if (banner) {
            banner.style.display = 'block';
        }
    }

    // Hide cookie consent banner
    function hideCookieBanner() {
        const banner = document.getElementById('cookieConsentBanner');
        if (banner) {
            banner.style.display = 'none';
        }
    }

    // Handle consent acceptance
    function acceptCookies(consentType) {
        CookieManager.set(COOKIE_NAMES.CONSENT, consentType, 365);
        CookieManager.set(COOKIE_NAMES.CONSENT_DATE, new Date().toISOString(), 365);
        
        hideCookieBanner();
        
        // Initialize tracking if all cookies accepted
        if (consentType === CONSENT_STATES.ALL_COOKIES) {
            initializeTracking();
            trackPageView();
        }

        // Track consent given
        fetch('/api/track/cookie-consent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                consent_type: consentType,
                timestamp: new Date().toISOString()
            })
        }).catch(() => {});
    }

    // Initialize on page load
    function init() {
        // Check if consent already given
        const consent = CookieManager.get(COOKIE_NAMES.CONSENT);
        
        if (!consent || consent === CONSENT_STATES.NOT_SET) {
            // Show banner if consent not given
            showCookieBanner();
        } else {
            // Initialize tracking if consent already given
            initializeTracking();
            trackPageView();
        }

        // Set up event listeners
        const acceptAllBtn = document.getElementById('acceptAllCookies');
        const acceptEssentialBtn = document.getElementById('acceptEssentialCookies');
        const customizeBtn = document.getElementById('customizeCookies');

        if (acceptAllBtn) {
            acceptAllBtn.addEventListener('click', () => {
                acceptCookies(CONSENT_STATES.ALL_COOKIES);
            });
        }

        if (acceptEssentialBtn) {
            acceptEssentialBtn.addEventListener('click', () => {
                acceptCookies(CONSENT_STATES.ESSENTIAL_ONLY);
            });
        }

        if (customizeBtn) {
            customizeBtn.addEventListener('click', () => {
                // TODO: Show cookie customization modal
                alert('Cookie customization coming soon. For now, please use "Accept All" or "Essential Only".');
            });
        }
    }

    // Export functions to window for use in other scripts
    window.CookieManager = CookieManager;
    window.trackInteraction = trackInteraction;
    window.trackPageView = trackPageView;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


