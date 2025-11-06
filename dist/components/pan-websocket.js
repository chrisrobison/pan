import { PanClient } from "./pan-client.mjs";
class PanWebSocket extends HTMLElement {
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
  constructor() {
    super();
    this.pc = new PanClient(this);
    this.ws = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.reconnectAttempts = 0;
    this.stopped = false;
    this.subscriptions = [];
  }
  connectedCallback() {
    this.#connect();
    this.#setupOutboundSubscriptions();
  }
  disconnectedCallback() {
    this.stopped = true;
    this.#disconnect();
    this.#clearSubscriptions();
  }
  attributeChangedCallback(name) {
    if (name === "url" && this.isConnected) {
      this.#reconnect();
    } else if (name === "outbound-topics" && this.isConnected) {
      this.#clearSubscriptions();
      this.#setupOutboundSubscriptions();
    }
  }
  get url() {
    return this.getAttribute("url") || "";
  }
  get protocols() {
    return this.getAttribute("protocols") || "";
  }
  get outboundTopics() {
    const t = (this.getAttribute("outbound-topics") || "").trim();
    return t ? t.split(/\s+/) : [];
  }
  get inboundTopics() {
    const t = (this.getAttribute("inbound-topics") || "").trim();
    return t ? t.split(/\s+/) : ["*"];
  }
  get autoReconnect() {
    return this.getAttribute("auto-reconnect") !== "false";
  }
  get reconnectDelay() {
    const s = (this.getAttribute("reconnect-delay") || "1000,15000").split(",").map((x) => Number(x) || 0);
    const [min, max] = [Math.max(100, s[0] || 1e3), Math.max(s[1] || s[0] || 15e3, s[0] || 1e3)];
    return { min, max };
  }
  get heartbeat() {
    return Number(this.getAttribute("heartbeat")) || 30;
  }
  get heartbeatTopic() {
    return this.getAttribute("heartbeat-topic") || "sys.ping";
  }
  // Public API
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }
  close() {
    this.stopped = true;
    this.#disconnect();
  }
  reconnect() {
    this.#reconnect();
  }
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
  #reconnect() {
    this.#disconnect();
    this.reconnectAttempts = 0;
    this.stopped = false;
    this.#connect();
  }
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
  #cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  #startHeartbeat() {
    this.#stopHeartbeat();
    if (this.heartbeat <= 0) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ topic: this.heartbeatTopic, ts: Date.now() });
      }
    }, this.heartbeat * 1e3);
  }
  #stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  #handleOpen() {
    this.reconnectAttempts = 0;
    this.#startHeartbeat();
    this.pc.publish({
      topic: "ws.connected",
      data: { url: this.url, timestamp: Date.now() }
    });
  }
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
  #handleError(error) {
    this.pc.publish({
      topic: "ws.error",
      data: {
        error: error.message || "WebSocket error",
        timestamp: Date.now()
      }
    });
  }
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
  #clearSubscriptions() {
    for (const unsub of this.subscriptions) {
      if (typeof unsub === "function") unsub();
    }
    this.subscriptions = [];
  }
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
