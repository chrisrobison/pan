import { PanClient } from "./pan-client.mjs";
class PanJWT extends HTMLElement {
  constructor() {
    super();
    this.client = new PanClient(this);
    this.token = null;
    this.refreshToken = null;
    this.tokenData = null;
    this.refreshTimer = null;
    this.memoryStorage = {};
  }
  connectedCallback() {
    this.storageType = this.getAttribute("storage") || "localStorage";
    this.tokenKey = this.getAttribute("token-key") || "jwt_token";
    this.refreshKey = this.getAttribute("refresh-key") || "jwt_refresh";
    this.autoRefresh = this.getAttribute("auto-refresh") !== "false";
    this.refreshBefore = parseInt(this.getAttribute("refresh-before") || "300");
    this.apiUrl = this.getAttribute("api-url") || "";
    this.loginEndpoint = this.getAttribute("login-endpoint") || "/auth/login";
    this.refreshEndpoint = this.getAttribute("refresh-endpoint") || "/auth/refresh";
    this.logoutEndpoint = this.getAttribute("logout-endpoint") || "/auth/logout";
    this.loadToken();
    this.subscribeToMessages();
    if (this.token) {
      this.scheduleRefresh();
    }
    this.publishState();
  }
  disconnectedCallback() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }
  /**
   * Subscribe to authentication-related PAN messages
   */
  subscribeToMessages() {
    this.client.subscribe("auth.login.request", async (msg) => {
      await this.login(msg.data.credentials);
    });
    this.client.subscribe("auth.logout.request", async () => {
      await this.logout();
    });
    this.client.subscribe("auth.token.refresh", async () => {
      await this.refresh();
    });
    this.client.subscribe("auth.state.get", () => {
      this.publishState();
    });
  }
  /**
   * Login with credentials
   * @param {Object} credentials - Login credentials (username, password, etc.)
   */
  async login(credentials) {
    try {
      const response = await fetch(`${this.apiUrl}${this.loginEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(credentials)
      });
      if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
      }
      const data = await response.json();
      this.setToken(data.token || data.access_token);
      if (data.refresh_token) {
        this.setRefreshToken(data.refresh_token);
      }
      this.client.publish({
        topic: "auth.login.success",
        data: {
          user: data.user,
          tokenData: this.tokenData
        }
      });
      this.publishState();
      if (this.autoRefresh) {
        this.scheduleRefresh();
      }
      return { success: true, data };
    } catch (err) {
      this.client.publish({
        topic: "auth.login.error",
        data: {
          error: err.message
        }
      });
      return { success: false, error: err.message };
    }
  }
  /**
   * Logout and clear tokens
   */
  async logout() {
    try {
      if (this.token && this.apiUrl) {
        await fetch(`${this.apiUrl}${this.logoutEndpoint}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.token}`
          }
        });
      }
    } catch (err) {
      console.warn("Logout endpoint failed:", err);
    }
    this.clearToken();
    this.clearRefreshToken();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.client.publish({
      topic: "auth.logout",
      data: {}
    });
    this.publishState();
  }
  /**
   * Refresh the access token using refresh token
   */
  async refresh() {
    if (!this.refreshToken) {
      console.warn("No refresh token available");
      return { success: false, error: "No refresh token" };
    }
    try {
      const response = await fetch(`${this.apiUrl}${this.refreshEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.refreshToken}`
        }
      });
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }
      const data = await response.json();
      this.setToken(data.token || data.access_token);
      this.client.publish({
        topic: "auth.token.refreshed",
        data: {
          tokenData: this.tokenData
        }
      });
      this.publishState();
      if (this.autoRefresh) {
        this.scheduleRefresh();
      }
      return { success: true, data };
    } catch (err) {
      this.client.publish({
        topic: "auth.token.expired",
        data: {
          error: err.message
        }
      });
      await this.logout();
      return { success: false, error: err.message };
    }
  }
  /**
   * Set the access token
   * @param {string} token - JWT token
   */
  setToken(token) {
    this.token = token;
    this.tokenData = this.parseToken(token);
    this.saveToStorage(this.tokenKey, token);
  }
  /**
   * Set the refresh token
   * @param {string} token - Refresh token
   */
  setRefreshToken(token) {
    this.refreshToken = token;
    this.saveToStorage(this.refreshKey, token);
  }
  /**
   * Clear the access token
   */
  clearToken() {
    this.token = null;
    this.tokenData = null;
    this.removeFromStorage(this.tokenKey);
  }
  /**
   * Clear the refresh token
   */
  clearRefreshToken() {
    this.refreshToken = null;
    this.removeFromStorage(this.refreshKey);
  }
  /**
   * Load token from storage
   */
  loadToken() {
    this.token = this.loadFromStorage(this.tokenKey);
    this.refreshToken = this.loadFromStorage(this.refreshKey);
    if (this.token) {
      this.tokenData = this.parseToken(this.token);
      if (this.isExpired()) {
        console.warn("Stored token is expired");
        this.clearToken();
      }
    }
  }
  /**
   * Parse JWT token
   * @param {string} token - JWT token
   * @returns {Object|null} Parsed token payload
   */
  parseToken(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(decoded);
    } catch (err) {
      console.error("Failed to parse token:", err);
      return null;
    }
  }
  /**
   * Check if token is expired
   * @returns {boolean} True if token is expired
   */
  isExpired() {
    if (!this.tokenData || !this.tokenData.exp) {
      return true;
    }
    const now = Math.floor(Date.now() / 1e3);
    return this.tokenData.exp < now;
  }
  /**
   * Get seconds until token expiry
   * @returns {number} Seconds until expiry, or 0 if expired
   */
  getTimeToExpiry() {
    if (!this.tokenData || !this.tokenData.exp) {
      return 0;
    }
    const now = Math.floor(Date.now() / 1e3);
    const remaining = this.tokenData.exp - now;
    return Math.max(0, remaining);
  }
  /**
   * Schedule automatic token refresh
   */
  scheduleRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    const timeToExpiry = this.getTimeToExpiry();
    const refreshTime = Math.max(0, (timeToExpiry - this.refreshBefore) * 1e3);
    if (refreshTime > 0 && this.autoRefresh) {
      this.refreshTimer = setTimeout(() => {
        this.refresh();
      }, refreshTime);
    }
  }
  /**
   * Get authorization header value
   * @returns {string|null} Authorization header value
   */
  getAuthHeader() {
    return this.token ? `Bearer ${this.token}` : null;
  }
  /**
   * Check if user is authenticated
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.token !== null && !this.isExpired();
  }
  /**
   * Publish current auth state
   */
  publishState() {
    this.client.publish({
      topic: "auth.state",
      data: {
        authenticated: this.isAuthenticated(),
        token: this.token,
        tokenData: this.tokenData,
        expiresIn: this.getTimeToExpiry()
      },
      retain: true
    });
  }
  /**
   * Save to storage
   */
  saveToStorage(key, value) {
    try {
      if (this.storageType === "localStorage") {
        localStorage.setItem(key, value);
      } else if (this.storageType === "sessionStorage") {
        sessionStorage.setItem(key, value);
      } else {
        this.memoryStorage[key] = value;
      }
    } catch (err) {
      console.error("Failed to save to storage:", err);
    }
  }
  /**
   * Load from storage
   */
  loadFromStorage(key) {
    try {
      if (this.storageType === "localStorage") {
        return localStorage.getItem(key);
      } else if (this.storageType === "sessionStorage") {
        return sessionStorage.getItem(key);
      } else {
        return this.memoryStorage[key] || null;
      }
    } catch (err) {
      console.error("Failed to load from storage:", err);
      return null;
    }
  }
  /**
   * Remove from storage
   */
  removeFromStorage(key) {
    try {
      if (this.storageType === "localStorage") {
        localStorage.removeItem(key);
      } else if (this.storageType === "sessionStorage") {
        sessionStorage.removeItem(key);
      } else {
        delete this.memoryStorage[key];
      }
    } catch (err) {
      console.error("Failed to remove from storage:", err);
    }
  }
}
customElements.define("pan-jwt", PanJWT);
var pan_jwt_default = PanJWT;
export {
  PanJWT,
  pan_jwt_default as default
};
//# sourceMappingURL=pan-jwt.js.map
