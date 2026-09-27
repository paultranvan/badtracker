import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform, View, StyleSheet } from 'react-native';
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
const BRIDGE_READY_TIMEOUT_MS = 8000;
const MAX_RELOAD_ATTEMPTS = 1;

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
    var relative = match ? match[0] : '/api/auth/';
    return window.location.origin + relative;
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

  function BridgeError(message, status) {
    this.message = message;
    this.status = status;
  }

  // ---- Next.js Server Actions ----
  // Action IDs change on every myffbad.fr deploy, so they are resolved by
  // name from the JS chunks and cached per build.

  var ACTION_CACHE_KEY = '__badtracker_actions';
  var actionIds = null;
  var discovering = null;
  var sessionLicence = null;

  try {
    var cached = JSON.parse(localStorage.getItem(ACTION_CACHE_KEY) || 'null');
    if (cached && cached.ids) actionIds = cached.ids;
  } catch(e) {}

  var CHUNK_RE = /static\\/chunks\\/[a-z0-9_\\-]+\\.js/g;
  var ACTION_RE = /createServerReference\\)\\("([0-9a-f]{40,44})",[^,]+,void 0,[^,]+,"([A-Za-z0-9_]+)"\\)/g;

  function discoveryPages() {
    // /connexion only exposes signInAction when fetched logged out.
    var pages = [
      ['/connexion', 'omit'],
      ['/', 'include'],
      ['/profil/joueur', 'include'],
      ['/recherche/joueur', 'include'],
      ['/recherche/club', 'include'],
      ['/recherche/les-tops', 'include']
    ];
    if (sessionLicence) {
      pages.push(['/joueur/' + sessionLicence, 'include']);
      pages.push(['/joueur/' + sessionLicence + '/mes-adversaires', 'include']);
      pages.push(['/joueur/' + sessionLicence + '/classement-historique', 'include']);
    }
    return pages;
  }

  async function fetchText(url, credentials) {
    try {
      var r = await fetch(url, { credentials: credentials || 'include' });
      return r.ok ? await r.text() : '';
    } catch(e) {
      return '';
    }
  }

  async function discoverActions() {
    var seen = {};
    var queue = [];
    function addChunks(text) {
      var m = text.match(CHUNK_RE) || [];
      for (var i = 0; i < m.length; i++) {
        var path = '/_next/' + m[i];
        if (!seen[path]) { seen[path] = true; queue.push(path); }
      }
    }

    var pages = discoveryPages();
    var htmls = await Promise.all(pages.map(function(p) { return fetchText(p[0], p[1]); }));
    htmls.forEach(addChunks);

    var ids = {};
    while (queue.length) {
      var batch = queue.splice(0, queue.length);
      var texts = await Promise.all(batch.map(function(c) { return fetchText(c); }));
      texts.forEach(function(t) {
        addChunks(t);
        var m;
        ACTION_RE.lastIndex = 0;
        while ((m = ACTION_RE.exec(t))) { ids[m[2]] = m[1]; }
      });
    }

    actionIds = ids;
    try { localStorage.setItem(ACTION_CACHE_KEY, JSON.stringify({ ids: ids })); } catch(e) {}
    return ids;
  }

  function ensureDiscovery() {
    if (!discovering) {
      discovering = discoverActions().finally(function() { discovering = null; });
    }
    return discovering;
  }

  function parseActionResponse(text) {
    var lines = text.split('\\n');
    var ref = '1';
    var head = lines[0] && lines[0].match(/"a":"\\$@([0-9a-f]+)"/);
    if (head) ref = head[1];
    var prefix = ref + ':';
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(prefix) === 0) {
        var raw = lines[i].slice(prefix.length);
        if (raw === '"$undefined"') return null;
        return JSON.parse(raw);
      }
    }
    return null;
  }

  async function postAction(route, actionId, args) {
    return fetch(route, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'next-action': actionId,
        'accept': 'text/x-component',
        'content-type': 'text/plain;charset=UTF-8'
      },
      body: JSON.stringify(args || [])
    });
  }

  async function callAction(name, args, route) {
    if (!actionIds || !actionIds[name]) await ensureDiscovery();
    if (!actionIds[name]) throw new BridgeError('Unknown server action: ' + name, 404);

    var response = await postAction(route || '/', actionIds[name], args);
    if (response.headers.get('x-nextjs-action-not-found')) {
      await ensureDiscovery();
      if (!actionIds[name]) throw new BridgeError('Unknown server action: ' + name, 404);
      response = await postAction(route || '/', actionIds[name], args);
    }
    var text = await response.text();
    if (!response.ok) throw new BridgeError(text || response.statusText, response.status);
    return parseActionResponse(text);
  }

  async function login(licence, password) {
    sessionLicence = licence;
    // The auth cookie is only set when the action is posted to /connexion.
    var result = await callAction(
      'signInAction',
      [{ licence: licence, password: password, rememberMe: true }],
      '/connexion'
    );
    if (!result || !result.success) {
      throw new BridgeError((result && result.error) || 'Login failed', 401);
    }
    var personId = await callAction('getCurrentPersonIdAction', []);
    if (!personId) throw new BridgeError('Login succeeded but no session cookie', 401);
    return { personId: String(personId), licence: licence };
  }

  async function handleRequest(msg) {
    var id = msg.id;
    try {
      if (msg.method === 'LOGIN') {
        sendResponse(id, await login(msg.body.licence, msg.body.password));
        return;
      }

      if (msg.method === 'ACTION') {
        sendResponse(id, await callAction(msg.path, msg.body, msg.route));
        return;
      }

      if (msg.method === 'RSC') {
        var rscResponse = await fetch(msg.path, { credentials: 'include', headers: { 'RSC': '1' } });
        var rscText = await rscResponse.text();
        if (!rscResponse.ok) {
          sendError(id, rscText || rscResponse.statusText, rscResponse.status);
          return;
        }
        sendResponse(id, rscText);
        return;
      }

      // Special "exec" type: evaluate JS and return result
      if (msg.method === 'EXEC') {
        try {
          var execResult = eval(msg.path);
          if (execResult && typeof execResult.then === 'function') {
            execResult = await execResult;
          }
          sendResponse(id, execResult);
        } catch(e) {
          sendError(id, 'Exec error: ' + e.message, 0);
        }
        return;
      }

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
      sendError(id, e.message || 'Unknown error', e.status || 0);
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
    const msg: BridgeMessage = JSON.parse(raw);

    if (msg.type === 'ready') {
      bridgeReady = true;
      if (readyPromiseResolve) {
        readyPromiseResolve();
        readyPromiseResolve = null;
      }
      return;
    }

    const pending = pendingRequests.get(msg.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    pendingRequests.delete(msg.id);

    if (msg.type === 'error') {
      const status = msg.status ?? 0;
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
  personId?: string,
  route?: string
): Promise<unknown> {
  if (!bridgeReady) {
    await readyPromise;
  }

  if (!webViewRef) {
    throw new NetworkError('WebView bridge not mounted');
  }

  const id = generateId();

  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new NetworkError('Request timed out'));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, { resolve, reject, timer });

    const message = JSON.stringify({ id, method, path, body, accessToken, personId, route });

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
): Promise<{ personId: string; licence: string }> {
  const data = (await sendRequest('LOGIN', '', { licence, password })) as {
    personId?: string;
  } | null;

  if (!data?.personId) {
    throw new AuthError('Login failed');
  }

  return { personId: data.personId, licence };
}

/**
 * Call a myffbad.fr Next.js Server Action by its exported name.
 * `route` is the page the action is posted to (defaults to `/`).
 */
export async function bridgeAction<T = unknown>(
  name: string,
  args: unknown[] = [],
  route?: string
): Promise<T> {
  return (await sendRequest('ACTION', name, args, undefined, undefined, route)) as T;
}

/**
 * Fetch the React Server Components payload of a myffbad.fr page.
 */
export async function bridgeRsc(path: string): Promise<string> {
  return (await sendRequest('RSC', path)) as string;
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
 * Force-resolve the ready promise without marking the bridge as functional.
 * This unblocks callers waiting on the bridge so they can hit their own
 * timeout/fallback logic instead of hanging forever.
 */
function forceResolveReady(): void {
  if (readyPromiseResolve) {
    readyPromiseResolve();
    readyPromiseResolve = null;
  }
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
  const reloadCount = useRef(0);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Changing the key forces React to unmount/remount the WebView entirely,
  // which is needed when Android kills the renderer process.
  const [webViewKey, setWebViewKey] = useState(0);

  const startReadyTimeout = useCallback(() => {
    if (readyTimer.current) clearTimeout(readyTimer.current);
    readyTimer.current = setTimeout(() => {
      if (bridgeReady) return;

      if (reloadCount.current < MAX_RELOAD_ATTEMPTS && webViewRef) {
        // First timeout: try reloading the WebView
        reloadCount.current++;
        webViewRef.reload();
        // Give it another chance with a fresh timer
        readyTimer.current = setTimeout(() => {
          if (!bridgeReady) {
            // Still not ready after reload — unblock waiters
            forceResolveReady();
          }
        }, BRIDGE_READY_TIMEOUT_MS);
      } else {
        // Already retried or no ref — unblock waiters
        forceResolveReady();
      }
    }, BRIDGE_READY_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    reloadCount.current = 0;
    startReadyTimeout();

    return () => {
      if (readyTimer.current) clearTimeout(readyTimer.current);
      webViewRef = null;
      bridgeReady = false;
    };
  }, [webViewKey, startReadyTimeout]);

  const handleError = useCallback(() => {
    if (bridgeReady) return;
    if (reloadCount.current < MAX_RELOAD_ATTEMPTS && webViewRef) {
      reloadCount.current++;
      webViewRef.reload();
    } else {
      forceResolveReady();
    }
  }, []);

  const handleRenderProcessGone = useCallback(() => {
    // Android killed the WebView renderer — reject pending requests and remount
    for (const [, pending] of pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new NetworkError('WebView render process gone'));
    }
    pendingRequests.clear();
    bridgeReady = false;
    readyPromise = createReadyPromise();
    reloadCount.current = 0;
    setWebViewKey((k) => k + 1);
  }, []);

  return (
    <>
      <View style={styles.hidden} pointerEvents="none">
        <WebView
          key={webViewKey}
          ref={(r) => {
            ref.current = r;
            webViewRef = r;
          }}
          source={{ uri: 'https://myffbad.fr' }}
          injectedJavaScript={INJECTED_JS}
          onMessage={handleMessage}
          onError={handleError}
          onHttpError={handleError}
          {...(Platform.OS === 'android' ? { onRenderProcessGone: handleRenderProcessGone } : {})}
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
