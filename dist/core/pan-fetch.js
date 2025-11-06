import { PanClient } from "./pan-client.mjs";
class PanFetch {
  constructor() {
    this.pc = new PanClient();
    this.authState = null;
    this.pc.subscribe("auth.internal.state", (msg) => {
      this.authState = msg.data;
    }, { retained: true });
  }
  /**
   * Fetch with automatic auth header injection
   * @param {string|Request} input - URL or Request object
   * @param {RequestInit} init - fetch options
   * @returns {Promise<Response>}
   */
  async fetch(input, init = {}) {
    const options = { ...init };
    options.headers = new Headers(options.headers || {});
    if (!options.credentials) {
      options.credentials = "include";
    }
    if (this.authState?.authenticated && this.authState?.token) {
      if (!options.headers.has("Authorization")) {
        options.headers.set("Authorization", `Bearer ${this.authState.token}`);
        console.warn("\u26A0 Using token from localStorage - vulnerable to XSS. Use HttpOnly cookies instead.");
      }
    }
    return fetch(input, options);
  }
  /**
   * Convenience method for JSON requests
   * @param {string} url - URL to fetch
   * @param {RequestInit} init - fetch options
   * @returns {Promise<any>} - Parsed JSON response
   */
  async fetchJson(url, init = {}) {
    const options = { ...init };
    options.headers = new Headers(options.headers || {});
    if (!options.headers.has("Content-Type")) {
      options.headers.set("Content-Type", "application/json");
    }
    const response = await this.fetch(url, options);
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      try {
        error.data = await response.json();
      } catch {
        error.data = await response.text();
      }
      throw error;
    }
    return response.json();
  }
  /**
   * GET request with JSON response
   */
  async get(url, init = {}) {
    return this.fetchJson(url, { ...init, method: "GET" });
  }
  /**
   * POST request with JSON body and response
   */
  async post(url, body, init = {}) {
    return this.fetchJson(url, {
      ...init,
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body)
    });
  }
  /**
   * PUT request with JSON body and response
   */
  async put(url, body, init = {}) {
    return this.fetchJson(url, {
      ...init,
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body)
    });
  }
  /**
   * PATCH request with JSON body and response
   */
  async patch(url, body, init = {}) {
    return this.fetchJson(url, {
      ...init,
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body)
    });
  }
  /**
   * DELETE request with JSON response
   */
  async delete(url, init = {}) {
    return this.fetchJson(url, { ...init, method: "DELETE" });
  }
  /**
   * Get current auth state
   */
  getAuthState() {
    return this.authState;
  }
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.authState?.authenticated === true;
  }
}
const panFetch = new PanFetch();
var pan_fetch_default = panFetch;
export {
  PanFetch,
  pan_fetch_default as default,
  panFetch
};
//# sourceMappingURL=pan-fetch.js.map
