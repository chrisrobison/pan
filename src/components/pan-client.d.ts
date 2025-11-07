/**
 * TypeScript definitions for pan-client.mjs
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

export interface SubscribeOptions {
  retained?: boolean;
  signal?: AbortSignal;
}

export interface RequestOptions {
  timeoutMs?: number;
}

export type UnsubscribeFunction = () => void;
export type MessageHandler<T = unknown> = (message: PanMessage<T>) => void;

export class PanClient {
  constructor(host?: HTMLElement | Document, busSelector?: string);

  ready(): Promise<void>;

  publish<T = unknown>(message: PanMessage<T>): void;

  subscribe<T = unknown>(
    topics: string | string[],
    handler: MessageHandler<T>,
    options?: SubscribeOptions
  ): UnsubscribeFunction;

  request<TReq = unknown, TRes = unknown>(
    topic: string,
    data: TReq,
    options?: RequestOptions
  ): Promise<PanMessage<TRes>>;

  static matches(topic: string, pattern: string): boolean;
}

export default PanClient;
