/**
 * TypeScript definitions for pan-bus.mjs
 */

export interface PanMessage<T = unknown> {
  topic: string;
  data: T;
  id?: string;
  ts?: number;
  retain?: boolean;
  replyTo?: string;
  correlationId?: string;
  headers?: Record<string, string>;
}

export interface Subscription {
  pattern: string;
  el: Element;
  clientId?: string;
  retained?: boolean;
}

export class PanBus extends HTMLElement {
  constructor();

  connectedCallback(): void;
  disconnectedCallback(): void;

  static matches(topic: string, pattern: string): boolean;
}

export default PanBus;
