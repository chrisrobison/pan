import { PanClient } from "./pan-client.mjs";

/**
 * PanWebSocket - Bidirectional WebSocket integration for the Pan message bus.
 *
 * Establishes WebSocket connections with automatic reconnection, heartbeat monitoring,
 * and bidirectional message routing. Supports topic-based filtering for both inbound
 * and outbound messages.
 *
 * @class PanWebSocket
 * @extends HTMLElement
 *
 * @fires ws.connected - When WebSocket connection is established
 * @fires ws.disconnected - When WebSocket connection is closed
 * @fires ws.error - When a WebSocket error occurs
 * @fires ws.message - For all incoming WebSocket messages
 * @fires {string} topic - Publishes inbound messages to their specific topics
 *
 * @example
 * <!-- Basic WebSocket connection -->
 * <pan-websocket
 *   url="ws://localhost:8080"
 *   inbound-topics="updates notifications"
 *   outbound-topics="commands">
 * </pan-websocket>
 *
 * @example
 * <!-- With heartbeat and custom reconnection -->
 * <pan-websocket
 *   url="wss://api.example.com/ws"
 *   protocols="v1.websocket"
 *   inbound-topics="*"
 *   outbound-topics="user.* system.*"
 *   auto-reconnect="true"
 *   reconnect-delay="2000,30000"
 *   heartbeat="30"
 *   heartbeat-topic="ping">
 * </pan-websocket>
 */
class PanWebSocket extends HTMLElement {
  /**
   * Observes changes to WebSocket configuration attributes.
   * @returns {string[]} Array of attribute names to observe
   */
  static get observedAttributes() {
    return [
      "url",
      "protocols",
      "outbound-topics",
      "inbound-topics",
      "auto-reconnect",
      "reconnect-delay",
      "heartbeat",
      "heartbeat-topic"
    ];
  }

  /**
   * Creates a new PanWebSocket instance.
   * Initializes the PanClient and connection state.
   */
  constructor() {
    super();
    /** @private {PanClient} Pan message bus client */
    this.pc = new PanClient(this);
    /** @private {WebSocket|null} Active WebSocket connection */
    this.ws = null;
    /** @private {number|null} Reconnection timer ID */
    this.reconnectTimer = null;
    /** @private {number|null} Heartbeat interval ID */
    this.heartbeatTimer = null;
    /** @private {number} Count of reconnection attempts for backoff calculation */
    this.reconnectAttempts = 0;
    /** @private {boolean} Indicates if component has been disconnected */
    this.stopped = false;
    /** @private {Function[]} Array of subscription cleanup functions */
    this.subscriptions = [];
  }
  /**
   * Lifecycle callback when element is added to the DOM.
   * Initiates WebSocket connection and sets up outbound subscriptions.
   */
  connectedCallback() {
    this.#connect();
    this.#setupOutboundSubscriptions();
  }

  /**
   * Lifecycle callback when element is removed from the DOM.
   * Closes connection and cleans up subscriptions.
   */
  disconnectedCallback() {
    this.stopped = true;
    this.#disconnect();
    this.#clearSubscriptions();
  }

  /**
   * Lifecycle callback when observed attributes change.
   * @param {string} name - The name of the changed attribute
   * @param {string|null} oldValue - The previous attribute value
   * @param {string|null} newValue - The new attribute value
   */
  attributeChangedCallback(name) {
    if (name === "url" && this.isConnected) {
      this.#reconnect();
    } else if (name === "outbound-topics" && this.isConnected) {
      this.#clearSubscriptions();
      this.#setupOutboundSubscriptions();
    }
  }

  /**
   * Gets the WebSocket server URL.
   * @returns {string} The WebSocket URL
   */
  get url() {
    return this.getAttribute("url") || "";
  }

  /**
   * Gets the WebSocket subprotocols.
   * Multiple protocols can be specified comma-separated.
   * @returns {string} Comma-separated protocol names
   */
  get protocols() {
    return this.getAttribute("protocols") || "";
  }

  /**
   * Gets topics to forward from Pan bus to WebSocket.
   * Messages matching these patterns will be sent over the WebSocket.
   * @returns {string[]} Array of topic patterns to send
   */
  get outboundTopics() {
    const t = (this.getAttribute("outbound-topics") || "").trim();
    return t ? t.split(/\s+/) : [];
  }

  /**
   * Gets topics to accept from WebSocket to Pan bus.
   * Only messages matching these patterns will be published locally.
   * @returns {string[]} Array of topic patterns to receive
   * @default ["*"] - Accepts all topics
   */
  get inboundTopics() {
    const t = (this.getAttribute("inbound-topics") || "").trim();
    return t ? t.split(/\s+/) : ["*"];
  }

  /**
   * Gets whether to automatically reconnect on connection loss.
   * @returns {boolean} True if auto-reconnect is enabled
   * @default true
   */
  get autoReconnect() {
    return this.getAttribute("auto-reconnect") !== "false";
  }

  /**
   * Gets the reconnection delay configuration with exponential backoff.
   * Format: "min,max" in milliseconds.
   * @returns {{min: number, max: number}} Reconnection delay configuration
   * @default {min: 1000, max: 15000}
   */
  get reconnectDelay() {
    const s = (this.getAttribute("reconnect-delay") || "1000,15000").split(",").map((x) => Number(x) || 0);
    const [min, max] = [Math.max(100, s[0] || 1e3), Math.max(s[1] || s[0] || 15e3, s[0] || 1e3)];
    return { min, max };
  }

  /**
   * Gets the heartbeat interval in seconds.
   * Set to 0 to disable heartbeat.
   * @returns {number} Heartbeat interval in seconds
   * @default 30
   */
  get heartbeat() {
    return Number(this.getAttribute("heartbeat")) || 30;
  }

  /**
   * Gets the topic name for heartbeat messages.
   * @returns {string} Topic name for ping messages
   * @default "sys.ping"
   */
  get heartbeatTopic() {
    return this.getAttribute("heartbeat-topic") || "sys.ping";
  }

  /**
   * Sends data through the WebSocket connection.
   * Automatically stringifies objects to JSON.
   * @param {string|Object} data - Data to send (string or object)
   * @example
   * ws.send({topic: "chat.message", data: {text: "Hello"}});
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }

  /**
   * Manually closes the WebSocket connection and prevents reconnection.
   * @example
   * document.querySelector('pan-websocket').close();
   */
  close() {
    this.stopped = true;
    this.#disconnect();
  }

  /**
   * Manually triggers a reconnection attempt.
   * Resets reconnection attempt counter.
   * @example
   * document.querySelector('pan-websocket').reconnect();
   */
  reconnect() {
    this.#reconnect();
  }
  /**
   * Establishes WebSocket connection and sets up event handlers.
   * @private
   */
  #connect() {
    if (!this.url || this.stopped) return;
    try {
      const ws = this.protocols ? new WebSocket(this.url, this.protocols.split(",").map((p) => p.trim())) : new WebSocket(this.url);
      this.ws = ws;
      ws.addEventListener("open", () => this.#handleOpen());
      ws.addEventListener("message", (e) => this.#handleMessage(e));
      ws.addEventListener("close", (e) => this.#handleClose(e));
      ws.addEventListener("error", (e) => this.#handleError(e));
    } catch (error) {
      this.#handleError(error);
      this.#scheduleReconnect();
    }
  }

  /**
   * Closes WebSocket connection, stops heartbeat, and cancels reconnection.
   * @private
   */
  #disconnect() {
    this.#stopHeartbeat();
    this.#cancelReconnect();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
      }
      this.ws = null;
    }
  }

  /**
   * Reconnects by disconnecting and establishing a new connection.
   * Resets reconnection attempt counter.
   * @private
   */
  #reconnect() {
    this.#disconnect();
    this.reconnectAttempts = 0;
    this.stopped = false;
    this.#connect();
  }

  /**
   * Schedules a reconnection attempt with exponential backoff.
   * Delay increases with each attempt up to the configured maximum.
   * @private
   */
  #scheduleReconnect() {
    if (!this.autoReconnect || this.stopped) return;
    this.#cancelReconnect();
    const { min, max } = this.reconnectDelay;
    const delay = Math.min(
      max,
      min * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 1e3
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.#connect();
    }, delay);
  }

  /**
   * Cancels any pending reconnection attempt.
   * @private
   */
  #cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Starts sending periodic heartbeat messages.
   * @private
   */
  #startHeartbeat() {
    this.#stopHeartbeat();
    if (this.heartbeat <= 0) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ topic: this.heartbeatTopic, ts: Date.now() });
      }
    }, this.heartbeat * 1e3);
  }

  /**
   * Stops sending heartbeat messages.
   * @private
   */
  #stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handles WebSocket connection open event.
   * Starts heartbeat and publishes connection event.
   * @private
   */
  #handleOpen() {
    this.reconnectAttempts = 0;
    this.#startHeartbeat();
    this.pc.publish({
      topic: "ws.connected",
      data: { url: this.url, timestamp: Date.now() }
    });
  }

  /**
   * Handles incoming WebSocket messages.
   * Parses JSON and publishes to matching topics.
   * @private
   * @param {MessageEvent} event - WebSocket message event
   */
  #handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.pc.publish({
        topic: "ws.message",
        data: { message: data, timestamp: Date.now() }
      });
      if (data.topic) {
        const shouldPublish = this.inboundTopics.some(
          (pattern) => this.#matchTopic(data.topic, pattern)
        );
        if (shouldPublish) {
          const msg = {
            topic: data.topic,
            data: data.data || data.payload || data
          };
          if (typeof data.retain === "boolean") {
            msg.retain = data.retain;
          }
          this.pc.publish(msg);
        }
      }
    } catch (error) {
      this.pc.publish({
        topic: "ws.message",
        data: { raw: event.data, timestamp: Date.now() }
      });
    }
  }

  /**
   * Handles WebSocket connection close event.
   * Stops heartbeat, publishes disconnect event, and schedules reconnection.
   * @private
   * @param {CloseEvent} event - WebSocket close event
   */
  #handleClose(event) {
    this.#stopHeartbeat();
    this.pc.publish({
      topic: "ws.disconnected",
      data: {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        timestamp: Date.now()
      }
    });
    if (!this.stopped) {
      this.#scheduleReconnect();
    }
  }

  /**
   * Handles WebSocket error events.
   * Publishes error event to Pan bus.
   * @private
   * @param {Event|Error} error - WebSocket error event or Error object
   */
  #handleError(error) {
    this.pc.publish({
      topic: "ws.error",
      data: {
        error: error.message || "WebSocket error",
        timestamp: Date.now()
      }
    });
  }

  /**
   * Sets up subscriptions to forward outbound topics to WebSocket.
   * @private
   */
  #setupOutboundSubscriptions() {
    for (const pattern of this.outboundTopics) {
      const unsub = this.pc.subscribe(pattern, (msg) => {
        if (msg.topic.startsWith("ws.")) return;
        this.send({
          topic: msg.topic,
          data: msg.data,
          ts: msg.ts,
          id: msg.id
        });
      });
      this.subscriptions.push(unsub);
    }
  }

  /**
   * Clears all outbound topic subscriptions.
   * @private
   */
  #clearSubscriptions() {
    for (const unsub of this.subscriptions) {
      if (typeof unsub === "function") unsub();
    }
    this.subscriptions = [];
  }

  /**
   * Matches a topic against a pattern with wildcard support.
   * @private
   * @param {string} topic - Topic to match
   * @param {string} pattern - Pattern with optional wildcards (*)
   * @returns {boolean} True if topic matches pattern
   */
  #matchTopic(topic, pattern) {
    if (pattern === "*" || topic === pattern) return true;
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, "[^.]+") + "$"
      );
      return regex.test(topic);
    }
    return false;
  }
}
customElements.define("pan-websocket", PanWebSocket);
var pan_websocket_default = PanWebSocket;
export {
  PanWebSocket,
  pan_websocket_default as default
};
//# sourceMappingURL=pan-websocket.js.map
