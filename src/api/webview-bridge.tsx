import React, {
  useEffect,
  useRef,
  type PropsWithChildren,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { NetworkError, ServerError, AuthError } from './errors';

// ============================================================
// Types
// ============================================================

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface BridgeMessage {
  id: string;
  type: 'response' | 'error' | 'ready';
  data?: unknown;
  error?: string;
  status?: number;
}

// ============================================================
// Module-level bridge state
// ============================================================

let webViewRef: WebView | null = null;
let bridgeReady = false;
let pendingRequests = new Map<string, PendingRequest>();
let readyPromiseResolve: (() => void) | null = null;
let readyPromise = createReadyPromise();

function createReadyPromise(): Promise<void> {
  return new Promise<void>((resolve) => {
    readyPromiseResolve = resolve;
  });
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const REQUEST_TIMEOUT_MS = 15000;

// ============================================================
// JS injected into the WebView
// ============================================================

/**
 * This script runs inside the WebView on the myffbad.fr origin.
 * It loads CryptoJS from CDN, then implements:
 * 1. Verify-Token generation using MD5 + AES (matching myffbad.fr's algorithm)
 * 2. Required headers: Caller-URL, accessToken, currentpersonid, apiseasonid
 * 3. Message handling for API requests from React Native
 * 4. Response forwarding via postMessage
 */
const INJECTED_JS = `
(function() {
  if (window.__bridgeReady) return;

  var cryptoReady = false;
  var CryptoJS = null;

  // Session state set after login
  var sessionPersonId = null;
  var sessionAccessToken = null;
  var sessionSeasonId = null;

  function loadCryptoJS() {
    return new Promise(function(resolve, reject) {
      if (window.CryptoJS) {
        CryptoJS = window.CryptoJS;
        cryptoReady = true;
        resolve();
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js';
      script.onload = function() {
        CryptoJS = window.CryptoJS;
        cryptoReady = true;
        resolve();
      };
      script.onerror = function() { reject(new Error('Failed to load CryptoJS')); };
      document.head.appendChild(script);
    });
  }

  var TOKEN_SALT = '93046758d21048ae10e9fa249537aa79';

  function generateVerifyToken(serviceBaseURL) {
    var t = (new Date()).getTime();
    var encrypted = CryptoJS.AES.encrypt(t.toString(), TOKEN_SALT).toString();
    var hash = CryptoJS.SHA256(encrypted + '.' + serviceBaseURL + '.' + TOKEN_SALT).toString();
    return hash + '.' + encrypted;
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var d = new Date();
      d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + d.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/';
  }

  function getServiceBaseURL(path) {
    var match = path.match(/^\\/api\\/[^\\/]+\\//);
    return match ? match[0] : '/api/auth/';
  }

  function sendResponse(id, data) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      id: id, type: 'response', data: data
    }));
  }

  function sendError(id, error, status) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      id: id, type: 'error', error: error, status: status || 0
    }));
  }

  async function handleRequest(msg) {
    var id = msg.id;
    try {
      if (!cryptoReady) { await loadCryptoJS(); }

      var baseURL = getServiceBaseURL(msg.path);
      var token = generateVerifyToken(baseURL);

      var headers = {
        'Content-Type': 'application/json',
        'Verify-Token': token,
        'Caller-URL': baseURL
      };

      // Add accessToken from session state, cookie, or message
      var accessToken = msg.accessToken || sessionAccessToken || getCookie('accessToken');
      if (accessToken) {
        headers['accessToken'] = accessToken;
      }

      // Add currentpersonid header (required by myffbad.fr for authenticated endpoints)
      var personId = msg.personId || sessionPersonId || getCookie('personId');
      if (personId) {
        headers['currentpersonid'] = String(personId);
      }

      // Add apiseasonid header if available
      if (sessionSeasonId) {
        headers['apiseasonid'] = String(sessionSeasonId);
      }

      var fetchOptions = {
        method: msg.method || 'GET',
        headers: headers,
        credentials: 'include'
      };

      if (msg.body && (msg.method === 'POST' || msg.method === 'PUT')) {
        fetchOptions.body = JSON.stringify(msg.body);
      }

      var url = msg.path;
      if (!url.startsWith('http')) {
        url = window.location.origin + url;
      }

      var response = await fetch(url, fetchOptions);

      // For login response, store session info and set cookies
      if (msg.path.includes('/api/auth/login') && response.ok) {
        var cloned = response.clone();
        try {
          var loginData = await cloned.json();
          if (loginData && loginData.personId) {
            sessionPersonId = loginData.personId;
            setCookie('personId', String(loginData.personId), 21);
            if (loginData.accessToken) {
              sessionAccessToken = loginData.accessToken;
              setCookie('accessToken', loginData.accessToken, 21);
            }
            if (loginData.currentSeason && loginData.currentSeason.seasonId) {
              sessionSeasonId = loginData.currentSeason.seasonId;
            }
          }
          sendResponse(id, loginData);
          return;
        } catch(e) {
          // Fall through to normal handling
        }
      }

      if (!response.ok) {
        var errorText = '';
        try { errorText = await response.text(); } catch(e) {}
        sendError(id, errorText || response.statusText, response.status);
        return;
      }

      var contentType = response.headers.get('content-type') || '';
      var data;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      sendResponse(id, data);
    } catch (e) {
      sendError(id, e.message || 'Unknown error', 0);
    }
  }

  window.addEventListener('message', function(event) {
    try {
      var msg = JSON.parse(event.data);
      if (msg && msg.id) { handleRequest(msg); }
    } catch(e) {}
  });

  document.addEventListener('message', function(event) {
    try {
      var msg = JSON.parse(event.data);
      if (msg && msg.id) { handleRequest(msg); }
    } catch(e) {}
  });

  loadCryptoJS().then(function() {
    window.__bridgeReady = true;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  }).catch(function() {
    window.__bridgeReady = true;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  });
})();
true;
`;

// ============================================================
// Message handler (called from WebView onMessage)
// ============================================================

function handleMessage(event: WebViewMessageEvent) {
  try {
    const raw = event.nativeEvent.data;
    console.warn('[Bridge] onMessage:', raw.substring(0, 200));

    const msg: BridgeMessage = JSON.parse(raw);

    if (msg.type === 'ready') {
      console.warn('[Bridge] WebView ready');
      bridgeReady = true;
      if (readyPromiseResolve) {
        readyPromiseResolve();
        readyPromiseResolve = null;
      }
      return;
    }

    const pending = pendingRequests.get(msg.id);
    if (!pending) {
      console.warn('[Bridge] No pending request for id:', msg.id);
      return;
    }

    clearTimeout(pending.timer);
    pendingRequests.delete(msg.id);

    if (msg.type === 'error') {
      const status = msg.status ?? 0;
      console.warn('[Bridge] Error response:', status, msg.error?.substring(0, 200));
      if (status === 400 || status === 401 || status === 403) {
        pending.reject(new AuthError(msg.error ?? 'Authentication failed'));
      } else if (status >= 500) {
        pending.reject(new ServerError(status, msg.error));
      } else if (status === 0) {
        pending.reject(new NetworkError(msg.error ?? 'Network error'));
      } else {
        pending.reject(new ServerError(status, msg.error));
      }
    } else {
      console.warn('[Bridge] Success response:', JSON.stringify(msg.data).substring(0, 200));
      pending.resolve(msg.data);
    }
  } catch {
    // Ignore unparseable messages
  }
}

// ============================================================
// Internal: send a request to the WebView
// ============================================================

async function sendRequest(
  method: string,
  path: string,
  body?: object,
  accessToken?: string,
  personId?: string
): Promise<unknown> {
  console.warn('[Bridge] sendRequest:', method, path, 'ready:', bridgeReady);

  if (!bridgeReady) {
    console.warn('[Bridge] Waiting for bridge to be ready...');
    await readyPromise;
    console.warn('[Bridge] Bridge is now ready');
  }

  if (!webViewRef) {
    throw new NetworkError('WebView bridge not mounted');
  }

  const id = generateId();

  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      console.warn('[Bridge] Request timed out:', id, path);
      reject(new NetworkError('Request timed out'));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, { resolve, reject, timer });

    const message = JSON.stringify({ id, method, path, body, accessToken, personId });

    const escapedMessage = message
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n');

    webViewRef!.injectJavaScript(`
      (function() {
        try {
          var msg = '${escapedMessage}';
          var event = new MessageEvent('message', { data: msg });
          window.dispatchEvent(event);
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            id: '${id}',
            type: 'error',
            error: 'JS injection error: ' + e.message,
            status: 0
          }));
        }
      })();
      true;
    `);
  });
}

// ============================================================
// Public API (module-level, callable from ffbad.ts)
// ============================================================

/**
 * Login via myffbad.fr. Returns user info including personId and accessToken.
 */
export async function bridgeLogin(
  licence: string,
  password: string
): Promise<{
  personId: number;
  accessToken: string;
  nom: string;
  prenom: string;
  licence: string;
}> {
  console.warn('[Bridge] bridgeLogin called for licence:', licence);

  const data = (await sendRequest('POST', '/api/auth/login', {
    login: licence,
    password: password,
    isEncrypted: false,
  })) as Record<string, unknown>;

  console.warn('[Bridge] bridgeLogin response:', JSON.stringify(data).substring(0, 300));

  if (!data || !data.personId) {
    const message =
      typeof data === 'object' && data?.message
        ? String(data.message)
        : 'Login failed';
    console.warn('[Bridge] bridgeLogin failed:', message);
    throw new AuthError(message);
  }

  console.warn('[Bridge] bridgeLogin success, personId:', data.personId);

  return {
    personId: data.personId as number,
    accessToken: (data.accessToken as string) ?? '',
    nom: (data.lastName as string) ?? (data.nom as string) ?? '',
    prenom: (data.firstName as string) ?? (data.prenom as string) ?? '',
    licence,
  };
}

/**
 * Make a GET request through the WebView bridge.
 */
export async function bridgeGet(
  path: string,
  accessToken?: string,
  personId?: string
): Promise<unknown> {
  return sendRequest('GET', path, undefined, accessToken, personId);
}

/**
 * Make a POST request through the WebView bridge.
 */
export async function bridgePost(
  path: string,
  body: object,
  accessToken?: string,
  personId?: string
): Promise<unknown> {
  return sendRequest('POST', path, body, accessToken, personId);
}

/**
 * Check if the bridge WebView is ready.
 */
export function isBridgeReady(): boolean {
  return bridgeReady;
}

/**
 * Wait for the bridge to become ready.
 */
export function waitForBridge(): Promise<void> {
  if (bridgeReady) return Promise.resolve();
  return readyPromise;
}

/**
 * Reset bridge state (for sign-out).
 */
export function resetBridge(): void {
  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new NetworkError('Bridge reset'));
  }
  pendingRequests.clear();

  bridgeReady = false;
  readyPromise = createReadyPromise();

  if (webViewRef) {
    webViewRef.reload();
  }
}

// ============================================================
// React Provider Component
// ============================================================

export function WebViewBridgeProvider({ children }: PropsWithChildren) {
  const ref = useRef<WebView>(null);

  useEffect(() => {
    return () => {
      webViewRef = null;
      bridgeReady = false;
    };
  }, []);

  return (
    <>
      <View style={styles.hidden} pointerEvents="none">
        <WebView
          ref={(r) => {
            ref.current = r;
            webViewRef = r;
          }}
          source={{ uri: 'https://myffbad.fr' }}
          injectedJavaScript={INJECTED_JS}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          originWhitelist={['*']}
          style={styles.webview}
        />
      </View>
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -1000,
    left: -1000,
  },
  webview: {
    width: 1,
    height: 1,
  },
});
