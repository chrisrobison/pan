import { PanClient } from "./pan-client.mjs";
class PanAuth extends HTMLElement {
  static get observedAttributes() {
    return ["storage", "token-key", "refresh-key", "auto-refresh", "refresh-before", "login-endpoint", "refresh-endpoint"];
  }
  constructor() {
    super();
    this.pc = new PanClient(this);
    this.authState = {
      authenticated: false,
      token: null,
      // Token is in HttpOnly cookie, this is just for state tracking
      refreshToken: null,
      // Refresh token is in HttpOnly cookie
      user: null,
      expiresAt: null
    };
    this.refreshTimer = null;
    this.useHttpOnlyCookies = true;
  }
  connectedCallback() {
    this.config = {
      storage: this.getAttribute("storage") || "localStorage",
      // localStorage, sessionStorage, memory
      tokenKey: this.getAttribute("token-key") || "pan_jwt",
      refreshKey: this.getAttribute("refresh-key") || "pan_refresh_jwt",
      autoRefresh: this.getAttribute("auto-refresh") !== "false",
      refreshBefore: parseInt(this.getAttribute("refresh-before") || "300", 10),
      // seconds before expiry
      loginEndpoint: this.getAttribute("login-endpoint") || "/api/auth/login",
      refreshEndpoint: this.getAttribute("refresh-endpoint") || "/api/auth/refresh",
      logoutEndpoint: this.getAttribute("logout-endpoint") || "/api/auth/logout"
    };
    this.loadTokens();
    this.setupHandlers();
    this.publishAuthState();
    if (this.config.autoRefresh && this.authState.authenticated) {
      this.scheduleRefresh();
    }
  }
  disconnectedCallback() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }
  setupHandlers() {
    this.pc.subscribe("auth.login", async (msg) => {
      await this.handleLogin(msg);
    });
    this.pc.subscribe("auth.logout", async (msg) => {
      await this.handleLogout(msg);
    });
    this.pc.subscribe("auth.refresh", async (msg) => {
      await this.handleRefresh(msg);
    });
    this.pc.subscribe("auth.setToken", (msg) => {
      this.setToken(msg.data);
    });
    this.pc.subscribe("auth.check", (msg) => {
      this.publishAuthState();
    });
  }
  async handleLogin(msg) {
    const { email, password, username, credentials, endpoint } = msg.data;
    const loginUrl = endpoint || this.config.loginEndpoint;
    try {
      const payload = credentials || { email, password, username };
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok && data.token) {
        this.setToken({
          token: data.token,
          refreshToken: data.refreshToken || data.refresh_token,
          user: data.user
        });
        if (msg.replyTo) {
          this.pc.publish({
            topic: msg.replyTo,
            data: { ok: true, user: this.authState.user },
            correlationId: msg.correlationId
          });
        }
        this.pc.publish({
          topic: "auth.login.success",
          data: { user: this.authState.user }
        });
      } else {
        const error = data.error || data.message || "Login failed";
        if (msg.replyTo) {
          this.pc.publish({
            topic: msg.replyTo,
            data: { ok: false, error },
            correlationId: msg.correlationId
          });
        }
        this.pc.publish({
          topic: "auth.login.error",
          data: { error }
        });
      }
    } catch (error) {
      if (msg.replyTo) {
        this.pc.publish({
          topic: msg.replyTo,
          data: { ok: false, error: error.message },
          correlationId: msg.correlationId
        });
      }
      this.pc.publish({
        topic: "auth.login.error",
        data: { error: error.message }
      });
    }
  }
  async handleLogout(msg) {
    const endpoint = msg.data?.endpoint || this.config.logoutEndpoint;
    try {
      if (endpoint && this.authState.token) {
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.authState.token}`
          }
        });
      }
    } catch (error) {
      console.warn("Logout endpoint failed:", error);
    }
    this.clearTokens();
    if (msg.replyTo) {
      this.pc.publish({
        topic: msg.replyTo,
        data: { ok: true },
        correlationId: msg.correlationId
      });
    }
    this.pc.publish({
      topic: "auth.logout.success",
      data: {}
    });
  }
  async handleRefresh(msg) {
    if (!this.authState.refreshToken) {
      if (msg.replyTo) {
        this.pc.publish({
          topic: msg.replyTo,
          data: { ok: false, error: "No refresh token available" },
          correlationId: msg.correlationId
        });
      }
      return;
    }
    const endpoint = msg.data?.endpoint || this.config.refreshEndpoint;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.authState.refreshToken}`
        },
        body: JSON.stringify({
          refreshToken: this.authState.refreshToken
        })
      });
      const data = await response.json();
      if (response.ok && data.token) {
        this.setToken({
          token: data.token,
          refreshToken: data.refreshToken || data.refresh_token || this.authState.refreshToken,
          user: data.user || this.authState.user
        });
        if (msg.replyTo) {
          this.pc.publish({
            topic: msg.replyTo,
            data: { ok: true },
            correlationId: msg.correlationId
          });
        }
        this.pc.publish({
          topic: "auth.refresh.success",
          data: {}
        });
      } else {
        this.clearTokens();
        if (msg.replyTo) {
          this.pc.publish({
            topic: msg.replyTo,
            data: { ok: false, error: "Token refresh failed" },
            correlationId: msg.correlationId
          });
        }
        this.pc.publish({
          topic: "auth.refresh.error",
          data: { error: "Token refresh failed" }
        });
      }
    } catch (error) {
      this.clearTokens();
      if (msg.replyTo) {
        this.pc.publish({
          topic: msg.replyTo,
          data: { ok: false, error: error.message },
          correlationId: msg.correlationId
        });
      }
      this.pc.publish({
        topic: "auth.refresh.error",
        data: { error: error.message }
      });
    }
  }
  setToken({ token, refreshToken, user }) {
    const decoded = this.decodeJWT(token);
    const expiresAt = decoded?.exp ? decoded.exp * 1e3 : null;
    this.authState = {
      authenticated: true,
      token,
      refreshToken: refreshToken || this.authState.refreshToken,
      user: user || decoded || this.authState.user,
      expiresAt
    };
    this.storeTokens();
    this.publishAuthState();
    if (this.config.autoRefresh && expiresAt) {
      this.scheduleRefresh();
    }
  }
  clearTokens() {
    this.authState = {
      authenticated: false,
      token: null,
      refreshToken: null,
      user: null,
      expiresAt: null
    };
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(this.config.tokenKey);
      storage.removeItem(this.config.refreshKey);
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.publishAuthState();
  }
  loadTokens() {
    if (this.useHttpOnlyCookies) {
      fetch(this.config.loginEndpoint.replace("/login", "/check"), {
        credentials: "include"
      }).then((res) => res.json()).then((data) => {
        if (data.authenticated) {
          this.authState = {
            authenticated: true,
            token: null,
            // Not accessible from JS (in HttpOnly cookie)
            refreshToken: null,
            // Not accessible from JS
            user: data.user,
            expiresAt: null
            // Set by server
          };
          this.publishAuthState();
        }
      }).catch((err) => {
        console.error("Failed to check auth status:", err);
      });
      return;
    }
    const storage = this.getStorage();
    if (!storage) return;
    const token = storage.getItem(this.config.tokenKey);
    const refreshToken = storage.getItem(this.config.refreshKey);
    if (token) {
      const decoded = this.decodeJWT(token);
      const expiresAt = decoded?.exp ? decoded.exp * 1e3 : null;
      if (expiresAt && Date.now() > expiresAt) {
        this.clearTokens();
        return;
      }
      this.authState = {
        authenticated: true,
        token,
        refreshToken,
        user: decoded,
        expiresAt
      };
      console.warn("\u26A0 Loading tokens from localStorage - vulnerable to XSS");
    }
  }
  storeTokens() {
    if (this.useHttpOnlyCookies) {
      console.log("\u2713 Tokens stored in HttpOnly cookies (server-side)");
      return;
    }
    const storage = this.getStorage();
    if (!storage) return;
    if (this.authState.token) {
      storage.setItem(this.config.tokenKey, this.authState.token);
      console.warn("\u26A0 Token stored in localStorage - vulnerable to XSS. Use HttpOnly cookies instead.");
    }
    if (this.authState.refreshToken) {
      storage.setItem(this.config.refreshKey, this.authState.refreshToken);
      console.warn("\u26A0 Refresh token stored in localStorage - vulnerable to XSS. Use HttpOnly cookies instead.");
    }
  }
  getStorage() {
    switch (this.config.storage) {
      case "localStorage":
        return typeof window !== "undefined" ? window.localStorage : null;
      case "sessionStorage":
        return typeof window !== "undefined" ? window.sessionStorage : null;
      case "memory":
        return null;
      // Memory only - already in this.authState
      default:
        return typeof window !== "undefined" ? window.localStorage : null;
    }
  }
  publishAuthState() {
    this.pc.publish({
      topic: "auth.state",
      data: {
        authenticated: this.authState.authenticated,
        user: this.authState.user,
        expiresAt: this.authState.expiresAt,
        hasRefreshToken: !!this.authState.refreshToken,
        useHttpOnlyCookies: this.useHttpOnlyCookies
      },
      retain: true
    });
    this.pc.publish({
      topic: "auth.internal.state",
      data: {
        authenticated: this.authState.authenticated,
        user: this.authState.user,
        expiresAt: this.authState.expiresAt,
        // NEVER include token/refreshToken here - use HttpOnly cookies
        token: null,
        refreshToken: null
      },
      retain: true
    });
  }
  scheduleRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    if (!this.authState.expiresAt) return;
    const now = Date.now();
    const expiresAt = this.authState.expiresAt;
    const refreshAt = expiresAt - this.config.refreshBefore * 1e3;
    const delay = refreshAt - now;
    if (delay > 0) {
      this.refreshTimer = setTimeout(() => {
        this.pc.publish({ topic: "auth.refresh", data: {} });
      }, delay);
    }
  }
  decodeJWT(token) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error("Failed to decode JWT:", error);
      return null;
    }
  }
}
customElements.define("pan-auth", PanAuth);
var pan_auth_default = PanAuth;
export {
  pan_auth_default as default
};
//# sourceMappingURL=pan-auth.js.map
