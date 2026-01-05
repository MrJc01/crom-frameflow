import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
const ENV = import.meta.env.MODE;

export const ErrorMonitor = {
    /**
     * Initialize Sentry
     */
    init: () => {
        if (!SENTRY_DSN) {
            console.log('[ErrorMonitor] Sentry DSN not found, skipping initialization.');
            return;
        }

        Sentry.init({
            dsn: SENTRY_DSN,
            environment: ENV,
            release: `frameflow@${APP_VERSION}`,
            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration(),
            ],
            // Performance Monitoring
            tracesSampleRate: 1.0, 
            // Session Replay
            replaysSessionSampleRate: 0.1, 
            replaysOnErrorSampleRate: 1.0, 
            
            beforeSend(event) {
                // Don't send errors in dev unless explicitly wanted
                if (ENV === 'development' && !import.meta.env.VITE_ENABLE_SENTRY_DEV) {
                    return null;
                }
                return event;
            },
        });
        
        console.log('[ErrorMonitor] Sentry initialized.');
    },

    /**
     * Capture an exception manually
     */
    captureError: (error: any, context?: Record<string, any>) => {
        if (!SENTRY_DSN) {
            console.error('[ErrorMonitor] Error captured (local):', error, context);
            return;
        }

        Sentry.captureException(error, {
            extra: context
        });
    },

    /**
     * Set user context for better error tracking
     */
    setUser: (id: string, email?: string) => {
        if (!SENTRY_DSN) return;
        Sentry.setUser({ id, email });
    },

    /**
     * Clear user context
     */
    clearUser: () => {
        if (!SENTRY_DSN) return;
        Sentry.setUser(null);
    },

    /**
     * Add breadcrumb for debugging trail
     */
    addBreadcrumb: (message: string, category: string = 'app', level: Sentry.SeverityLevel = 'info') => {
        if (!SENTRY_DSN) return;
        Sentry.addBreadcrumb({
            message,
            category,
            level,
            timestamp: Date.now() / 1000
        });
    }
};
