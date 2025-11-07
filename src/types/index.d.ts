/**
 * TypeScript definitions for PAN (Page Area Network)
 *
 * Usage:
 * ```typescript
 * import type { PanMessage, PanClient } from './pan/types';
 * // or
 * import { PanClient } from './pan/components/pan-client.mjs';
 * ```
 */

/**
 * Core message type for PAN communication
 */
export interface PanMessage<T = unknown> {
  /** Topic identifier (e.g., "users.list.state") */
  topic: string;

  /** Message payload (must be JSON-serializable) */
  data: T;

  /** Unique message identifier (auto-generated if not provided) */
  id?: string;

  /** Timestamp in milliseconds since epoch (auto-generated if not provided) */
  ts?: number;

  /** If true, message is retained by bus for late subscribers */
  retain?: boolean;

  /** Topic to send reply to (for request/reply pattern) */
  replyTo?: string;

  /** Correlation ID for matching requests and replies */
  correlationId?: string;

  /** Optional metadata headers (all values must be strings) */
  headers?: Record<string, string>;
}

/**
 * Subscription options
 */
export interface SubscribeOptions {
  /** If true, immediately receive retained messages for matching topics */
  retained?: boolean;

  /** AbortSignal for automatic cleanup when aborted */
  signal?: AbortSignal;
}

/**
 * Request options for request/reply pattern
 */
export interface RequestOptions {
  /** Request timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
}

/**
 * Function to unsubscribe from topic(s)
 */
export type UnsubscribeFunction = () => void;

/**
 * Message handler callback
 */
export type MessageHandler<T = unknown> = (message: PanMessage<T>) => void;

/**
 * PAN Client - Main API for interacting with PAN bus
 *
 * @example
 * ```typescript
 * import { PanClient } from './pan/components/pan-client.mjs';
 *
 * const client = new PanClient();
 * await client.ready();
 *
 * // Publish
 * client.publish({
 *   topic: 'user.login',
 *   data: { userId: 123 }
 * });
 *
 * // Subscribe
 * client.subscribe('user.*', (msg) => {
 *   console.log(msg.data);
 * });
 *
 * // Request/reply
 * const response = await client.request('api.users.get', { id: 123 });
 * ```
 */
export class PanClient {
  /**
   * Creates a new PAN client
   * @param host - Element to dispatch/receive events from (default: document)
   * @param busSelector - CSS selector for bus element (default: 'pan-bus')
   */
  constructor(host?: HTMLElement | Document, busSelector?: string);

  /**
   * Returns a promise that resolves when the PAN bus is ready
   */
  ready(): Promise<void>;

  /**
   * Publishes a message to the PAN bus
   * @param message - Message to publish
   */
  publish<T = unknown>(message: PanMessage<T>): void;

  /**
   * Subscribes to one or more topic patterns
   * @param topics - Topic pattern(s) to subscribe to (supports wildcards)
   * @param handler - Function to handle received messages
   * @param options - Subscription options
   * @returns Function to unsubscribe
   */
  subscribe<T = unknown>(
    topics: string | string[],
    handler: MessageHandler<T>,
    options?: SubscribeOptions
  ): UnsubscribeFunction;

  /**
   * Sends a request and waits for a reply
   * @param topic - Request topic
   * @param data - Request payload
   * @param options - Request options
   * @returns Promise that resolves with reply message
   */
  request<TReq = unknown, TRes = unknown>(
    topic: string,
    data: TReq,
    options?: RequestOptions
  ): Promise<PanMessage<TRes>>;

  /**
   * Checks if a topic matches a pattern
   * @param topic - Topic to test
   * @param pattern - Pattern to match against (supports wildcards)
   * @returns True if topic matches pattern
   */
  static matches(topic: string, pattern: string): boolean;
}

/**
 * PAN Bus configuration options (for pan-bus-enhanced)
 */
export interface PanBusConfig {
  /** Maximum retained messages (LRU eviction) */
  maxRetained?: number;

  /** Maximum total message size in bytes */
  maxMessageSize?: number;

  /** Maximum payload size in bytes */
  maxPayloadSize?: number;

  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;

  /** Maximum messages per client per second */
  rateLimit?: number;

  /** Rate limit window in milliseconds */
  rateLimitWindow?: number;

  /** Allow global wildcard (*) subscriptions */
  allowGlobalWildcard?: boolean;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * PAN Bus statistics
 */
export interface PanBusStats {
  /** Total messages published */
  published: number;

  /** Total message deliveries */
  delivered: number;

  /** Total messages dropped (rate limit) */
  dropped: number;

  /** Current retained message count */
  retained: number;

  /** Total retained messages evicted (LRU) */
  retainedEvicted: number;

  /** Total dead subscriptions cleaned up */
  subsCleanedUp: number;

  /** Active subscription count */
  subscriptions: number;

  /** Registered client count */
  clients: number;

  /** Total errors */
  errors: number;

  /** Current configuration */
  config: PanBusConfig;
}

/**
 * PAN Bus error codes
 */
export type PanErrorCode =
  | 'RATE_LIMIT_EXCEEDED'
  | 'MESSAGE_INVALID'
  | 'SUBSCRIPTION_INVALID'
  | 'SCHEMA_VIOLATION';

/**
 * PAN error event data
 */
export interface PanErrorData {
  /** Error code */
  code: PanErrorCode;

  /** Error message */
  message: string;

  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** True if validation passed */
  valid: boolean;

  /** Error message if validation failed */
  error?: string;
}

/**
 * Validation utilities
 */
export namespace Validation {
  /**
   * Check if data is JSON-serializable
   */
  export function isSerializable(data: unknown): boolean;

  /**
   * Check if data is serializable with detailed error
   */
  export function checkSerializable(data: unknown): ValidationResult;

  /**
   * Estimate size of object in bytes
   */
  export function estimateSize(obj: unknown): number;

  /**
   * Validate topic string
   */
  export function validateTopic(topic: string): ValidationResult;

  /**
   * Validate subscription pattern
   */
  export function validatePattern(
    pattern: string,
    options?: {
      allowGlobalWildcard?: boolean;
      maxWildcards?: number;
    }
  ): ValidationResult;

  /**
   * Validate complete message
   */
  export function validateMessage(
    message: PanMessage,
    limits?: {
      maxMessageSize?: number;
      maxPayloadSize?: number;
    }
  ): ValidationResult;

  /**
   * Check if element is still in DOM
   */
  export function isElementAlive(el: Element): boolean;

  /**
   * Sanitize error message for safe display
   */
  export function sanitizeError(error: unknown): string;
}

/**
 * CRUD topic conventions
 */
export namespace Topics {
  /** List request: ${resource}.list.get */
  export function listGet(resource: string): string;

  /** List state: ${resource}.list.state */
  export function listState(resource: string): string;

  /** Item select: ${resource}.item.select */
  export function itemSelect(resource: string): string;

  /** Item get: ${resource}.item.get */
  export function itemGet(resource: string): string;

  /** Item save: ${resource}.item.save */
  export function itemSave(resource: string): string;

  /** Item delete: ${resource}.item.delete */
  export function itemDelete(resource: string): string;

  /** Item state: ${resource}.item.state.${id} */
  export function itemState(resource: string, id: string | number): string;

  /** Error event: ${resource}.error */
  export function error(resource: string): string;
}

/**
 * Component base types
 */
export namespace Components {
  /**
   * Data table configuration
   */
  export interface DataTableConfig {
    resource: string;
    columns: string | string[];
    key?: string;
    live?: boolean;
  }

  /**
   * Form configuration
   */
  export interface FormConfig {
    resource: string;
    fields: string | string[];
    key?: string;
    live?: boolean;
  }

  /**
   * Data provider configuration
   */
  export interface DataProviderConfig {
    resource: string;
    persist?: 'localStorage' | 'sessionStorage' | 'none';
    key?: string;
  }

  /**
   * REST connector configuration
   */
  export interface DataConnectorConfig {
    resource: string;
    baseUrl: string;
    listPath?: string;
    itemPath?: string;
    updateMethod?: 'PUT' | 'PATCH';
    credentials?: RequestCredentials;
  }
}

/**
 * Global types for window object extensions
 */
declare global {
  interface Window {
    /** Indicates PAN bus is ready */
    __panReady?: boolean;

    /** PAN DevTools API (injected by extension) */
    __panDevTools?: {
      getHistory(): Array<PanMessage & { timestamp: number; target: string; id: string }>;
      clearHistory(): void;
      getStats(): Record<string, unknown>;
      replay(messageId: string): boolean;
    };
  }
}

/**
 * Custom element types for PAN components
 */
declare global {
  interface HTMLElementTagNameMap {
    'pan-bus': HTMLElement;
    'pan-bus-enhanced': HTMLElement;
    'pan-client': HTMLElement;
    'pan-inspector': HTMLElement;
    'pan-data-table': HTMLElement;
    'pan-form': HTMLElement;
    'pan-data-provider': HTMLElement;
    'pan-data-connector': HTMLElement;
    'pan-markdown-renderer': HTMLElement;
    'pan-markdown-editor': HTMLElement;
    'todo-list': HTMLElement;
    'todo-provider': HTMLElement;
  }
}

export {};
