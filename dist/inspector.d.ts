/**
 * PAN Inspector - TypeScript Definitions
 *
 * DevTools-style traffic inspector for PAN messages
 */

// ============================================================================
// Inspector Element
// ============================================================================

export class PanInspector extends HTMLElement {
  /**
   * Set to 'true' to collapse the inspector initially
   */
  collapsed?: boolean;

  /**
   * Maximum number of messages to retain
   */
  maxMessages?: number;

  connectedCallback(): void;
  disconnectedCallback(): void;
}

// ============================================================================
// Global Augmentation
// ============================================================================

declare global {
  interface HTMLElementTagNameMap {
    'pan-inspector': PanInspector;
  }
}

export default PanInspector;
