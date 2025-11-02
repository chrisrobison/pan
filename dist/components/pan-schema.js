import { PanClient } from "./pan-client.mjs";

/**
 * Custom element that manages and broadcasts JSON Schema definitions for data resources.
 *
 * This element loads a JSON Schema from either an external source (via src attribute)
 * or from an inline script tag, then publishes it to the Pan message bus for use by
 * other components like pan-schema-form.
 *
 * @class PanSchema
 * @extends HTMLElement
 * @fires {CustomEvent} Publishes to topic: `{resource}.schema.state` when schema is loaded
 *
 * @example
 * // Load schema from external file
 * <pan-schema resource="users" src="/schemas/user.json"></pan-schema>
 *
 * @example
 * // Define schema inline
 * <pan-schema resource="users">
 *   <script type="application/json">
 *   {
 *     "type": "object",
 *     "properties": {
 *       "name": { "type": "string", "title": "Name" },
 *       "email": { "type": "string", "format": "email" }
 *     },
 *     "required": ["name", "email"]
 *   }
 *   </script>
 * </pan-schema>
 */
class PanSchema extends HTMLElement {
  /**
   * Defines which attributes trigger attributeChangedCallback when modified.
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["resource", "src"];
  }

  /**
   * Initializes the element with PanClient connection and empty state.
   */
  constructor() {
    super();
    /** @type {PanClient} Pan message bus client instance */
    this.pc = new PanClient(this);
    /** @type {Object|null} The loaded JSON Schema object */
    this.schema = null;
    /** @type {Function[]} Array of unsubscribe functions for cleanup */
    this._offs = [];
  }

  /**
   * Called when element is added to the DOM. Initializes schema loading and subscriptions.
   */
  connectedCallback() {
    this.#init();
  }

  /**
   * Called when element is removed from the DOM. Cleans up all subscriptions.
   */
  disconnectedCallback() {
    this._offs.forEach((f) => f && f());
    this._offs = [];
  }

  /**
   * Called when observed attributes change. Re-initializes the component.
   */
  attributeChangedCallback() {
    this.#init();
  }

  /**
   * Gets the resource name for this schema (used in topic names).
   * @returns {string} The resource name, defaults to "items"
   */
  get resource() {
    return (this.getAttribute("resource") || "items").trim();
  }

  /**
   * Gets the external source URL for loading the schema.
   * @returns {string} The URL to fetch schema from, or empty string if not set
   */
  get src() {
    return (this.getAttribute("src") || "").trim();
  }

  /**
   * Initializes the component by setting up subscriptions and loading the schema.
   * Subscribes to schema.get requests and publishes the schema when loaded.
   * @private
   */
  async #init() {
    this._offs.forEach((f) => f && f());
    this._offs = [];
    this._offs.push(this.pc.subscribe(`${this.resource}.schema.get`, (m) => {
      this.#ensure().then(() => {
        const ok = !!this.schema;
        if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok, schema: this.schema } });
        if (ok) this.#publish();
      });
    }));
    await this.#ensure();
    this.#publish();
  }

  /**
   * Ensures the schema is loaded from either external source or inline script tag.
   * First attempts to load from the src attribute, then falls back to inline script.
   * @private
   * @returns {Promise<void>}
   */
  async #ensure() {
    if (this.schema) return;
    if (this.src) {
      try {
        const res = await fetch(this.src, { credentials: "same-origin" });
        const json = await res.json();
        this.schema = json || null;
      } catch {
      }
    }
    if (!this.schema) {
      const script = this.querySelector('script[type="application/json"]');
      if (script && script.textContent?.trim()) {
        try {
          this.schema = JSON.parse(script.textContent.trim());
        } catch {
        }
      }
    }
  }

  /**
   * Publishes the loaded schema to the Pan message bus as a retained message.
   * Other components can subscribe to `{resource}.schema.state` to receive this schema.
   * @private
   * @fires Publishes to topic: `{resource}.schema.state` with schema data
   */
  #publish() {
    if (!this.schema) return;
    this.pc.publish({ topic: `${this.resource}.schema.state`, data: { schema: this.schema }, retain: true });
  }
}
customElements.define("pan-schema", PanSchema);
var pan_schema_default = PanSchema;
export {
  PanSchema,
  pan_schema_default as default
};
//# sourceMappingURL=pan-schema.js.map
