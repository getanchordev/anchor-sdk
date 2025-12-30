/**
 * Anonymous telemetry for Anchor SDK.
 *
 * Opt-out tracking of SDK usage to help improve the product.
 *
 * Disable via environment variable: ANCHOR_TELEMETRY=0
 * @module
 */

const TELEMETRY_ENDPOINT = process.env.ANCHOR_TELEMETRY_ENDPOINT || 
  'https://api.getanchor.dev/telemetry';

const TELEMETRY_ENABLED = process.env.ANCHOR_TELEMETRY !== '0' && 
  process.env.ANCHOR_TELEMETRY !== 'false' && 
  process.env.ANCHOR_TELEMETRY !== 'off' && 
  process.env.ANCHOR_TELEMETRY !== 'no' && 
  process.env.ANCHOR_TELEMETRY !== 'disabled';

interface TelemetryProperties {
  [key: string]: any;
}

/**
 * Anonymous telemetry tracker for SDK usage.
 */
export class Telemetry {
  private baseUrl: string;
  private apiKey?: string;
  private enabled: boolean;
  private sdkVersion = '1.0.0';
  private language = 'typescript';
  private languageVersion = process.version;
  private platform: string;
  private platformVersion: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.enabled = TELEMETRY_ENABLED;
    
    // Detect platform
    if (typeof process !== 'undefined' && process.platform) {
      this.platform = process.platform;
      this.platformVersion = process.version;
    } else {
      this.platform = 'unknown';
      this.platformVersion = 'unknown';
    }

    // Track initialization
    if (this.enabled) {
      this.trackAsync('sdk.initialized', {
        sdk_version: this.sdkVersion,
        language: this.language,
        language_version: this.languageVersion,
        platform: this.platform,
        platform_version: this.platformVersion,
        has_api_key: !!apiKey
      });
    }
  }

  /**
   * Track an event asynchronously (non-blocking).
   */
  private async trackAsync(event: string, properties?: TelemetryProperties): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const payload: any = {
        event,
        properties: properties || {},
        sdk_version: this.sdkVersion,
        language: this.language,
        timestamp: Date.now()
      };

      // Don't send API key or any sensitive data
      // Only send base_url domain (not full URL)
      if (this.baseUrl) {
        try {
          const url = new URL(this.baseUrl);
          payload.base_url_domain = url.hostname || 'localhost';
        } catch {
          // Invalid URL, skip
        }
      }

      const fetchFn = getFetch();
      await fetchFn(TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `anchor-sdk-typescript/${this.sdkVersion}`
        },
        body: JSON.stringify(payload),
        // Don't wait for response - fire and forget
      }).catch(() => {
        // Silently fail - never interrupt user experience
      });
    } catch (error) {
      // Silently fail - never interrupt user experience
    }
  }

  /**
   * Track a method call.
   */
  trackMethodCall(methodName: string, success: boolean = true, errorType?: string): void {
    if (!this.enabled) {
      return;
    }

    const properties: TelemetryProperties = {
      method: methodName,
      success
    };

    if (errorType) {
      properties.error_type = errorType;
    }

    // Fire and forget
    this.trackAsync('sdk.method_called', properties).catch(() => {});
  }

  /**
   * Track an error.
   */
  trackError(errorType: string, methodName?: string): void {
    if (!this.enabled) {
      return;
    }

    const properties: TelemetryProperties = {
      error_type: errorType
    };

    if (methodName) {
      properties.method = methodName;
    }

    // Fire and forget
    this.trackAsync('sdk.error', properties).catch(() => {});
  }
}

// Use native fetch if available (Node.js 18+, modern browsers)
const getFetch = (): typeof fetch => {
  if (typeof fetch !== 'undefined') {
    return fetch;
  }
  // Try to use node-fetch if available (for older Node.js)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('node-fetch') as typeof fetch;
  } catch {
    throw new Error(
      'fetch is not available. Please use Node.js 18+, install node-fetch, or provide a fetch polyfill.'
    );
  }
};

// Global telemetry instances (created per client)
const telemetryInstances: Map<string, Telemetry> = new Map();

/**
 * Get or create telemetry instance for a client.
 */
export function getTelemetry(baseUrl: string, apiKey?: string): Telemetry {
  const key = `${baseUrl}:${apiKey || 'no-key'}`;
  if (!telemetryInstances.has(key)) {
    telemetryInstances.set(key, new Telemetry(baseUrl, apiKey));
  }
  return telemetryInstances.get(key)!;
}

