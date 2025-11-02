import { PanClient } from "./pan-client.mjs";

/**
 * A custom element that implements a simple counter with synchronized state.
 * Demonstrates basic PanClient pub/sub functionality with retained messages.
 *
 * @class XCounter
 * @extends HTMLElement
 * @fires {CustomEvent} demo:click - Fires when the counter button is clicked
 *
 * @example
 * // Basic usage
 * <x-counter></x-counter>
 *
 * @example
 * // Multiple counters stay in sync via PanClient
 * <x-counter></x-counter>
 * <x-counter></x-counter>
 *
 * @example
 * // Subscribing to counter updates
 * const pc = new PanClient();
 * pc.subscribe('demo:click', (msg) => {
 *   console.log('Counter value:', msg.data.n);
 * });
 *
 * @example
 * // Setting counter value programmatically
 * pc.publish({
 *   topic: 'demo:click',
 *   data: { n: 42 },
 *   retain: true
 * });
 */
class XCounter extends HTMLElement {
  /**
   * PanClient instance for pub/sub communication
   * @type {PanClient}
   */
  pc = new PanClient(this);

  /**
   * Current counter value
   * @type {number}
   */
  n = 0;

  /**
   * Lifecycle callback invoked when element is added to the DOM.
   * Creates the button element and sets up click and subscription handlers.
   */
  connectedCallback() {
    this.innerHTML = `<button class="button-link" style="font-size:1.1rem;padding:0.75rem 1.2rem;">Clicked 0</button>`;
    this.querySelector("button")?.addEventListener("click", () => {
      this.pc.publish({
        topic: "demo:click",
        data: { n: ++this.n },
        retain: true
      });
    });
    this.pc.subscribe("demo:click", (m) => {
      const btn = this.querySelector("button");
      if (btn) btn.textContent = `Clicked ${m.data.n}`;
    }, { retained: true });
  }
}
customElements.define("x-counter", XCounter);
var x_counter_default = XCounter;
export {
  x_counter_default as default
};
//# sourceMappingURL=x-counter.js.map
