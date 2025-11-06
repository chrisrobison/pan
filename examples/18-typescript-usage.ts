/**
 * TypeScript Usage Examples for PAN (Page Area Network)
 *
 * This file demonstrates how to use PAN with TypeScript for full type safety.
 * Compile with: tsc --target es2022 --module es2022 --moduleResolution bundler
 */

import { PanClient, PanMessage, SubscribeOptions, RequestOptions } from '../src/index.js';

// ============================================================================
// 1. Basic Usage - Type-Safe Publishing and Subscribing
// ============================================================================

async function basicExample() {
  const client = new PanClient();
  await client.ready();

  // Type-safe message publishing
  interface UserLoginData {
    userId: number;
    username: string;
    timestamp: Date;
  }

  client.publish<UserLoginData>({
    topic: 'user.login',
    data: {
      userId: 123,
      username: 'alice',
      timestamp: new Date()
    },
    retain: true
  });

  // Type-safe subscription with typed handler
  const unsubscribe = client.subscribe<UserLoginData>(
    'user.*',
    (msg: PanMessage<UserLoginData>) => {
      console.log(`User ${msg.data.username} (ID: ${msg.data.userId}) logged in`);
      console.log(`Timestamp: ${msg.data.timestamp}`);
    }
  );

  // Cleanup
  unsubscribe();
}

// ============================================================================
// 2. Request/Reply Pattern with Types
// ============================================================================

async function requestReplyExample() {
  const client = new PanClient();
  await client.ready();

  // Define request and response types
  interface UserGetRequest {
    userId: number;
  }

  interface UserGetResponse {
    userId: number;
    username: string;
    email: string;
    role: 'admin' | 'user' | 'guest';
  }

  // Service provider (responder)
  client.subscribe<UserGetRequest>(
    'api.user.get',
    (msg: PanMessage<UserGetRequest>) => {
      const userId = msg.data.userId;

      // Simulate database lookup
      const response: UserGetResponse = {
        userId: userId,
        username: 'alice',
        email: 'alice@example.com',
        role: 'user'
      };

      if (msg.replyTo) {
        client.publish<UserGetResponse>({
          topic: msg.replyTo,
          data: response,
          correlationId: msg.correlationId
        });
      }
    }
  );

  // Service consumer (requester)
  try {
    const response = await client.request<UserGetRequest, UserGetResponse>(
      'api.user.get',
      { userId: 123 },
      { timeoutMs: 3000 }
    );

    console.log(`Got user: ${response.data.username} (${response.data.role})`);
  } catch (error) {
    console.error('Request failed:', error);
  }
}

// ============================================================================
// 3. Wildcard Subscriptions with Union Types
// ============================================================================

async function wildcardExample() {
  const client = new PanClient();
  await client.ready();

  // Define multiple event types
  interface UserCreatedEvent {
    type: 'created';
    userId: number;
    username: string;
  }

  interface UserUpdatedEvent {
    type: 'updated';
    userId: number;
    changes: Record<string, unknown>;
  }

  interface UserDeletedEvent {
    type: 'deleted';
    userId: number;
  }

  type UserEvent = UserCreatedEvent | UserUpdatedEvent | UserDeletedEvent;

  // Subscribe to all user events with discriminated union
  client.subscribe<UserEvent>(
    'user.*',
    (msg: PanMessage<UserEvent>) => {
      switch (msg.data.type) {
        case 'created':
          console.log(`User created: ${msg.data.username}`);
          break;
        case 'updated':
          console.log(`User ${msg.data.userId} updated:`, msg.data.changes);
          break;
        case 'deleted':
          console.log(`User ${msg.data.userId} deleted`);
          break;
      }
    }
  );

  // Publish typed events
  client.publish<UserCreatedEvent>({
    topic: 'user.created',
    data: { type: 'created', userId: 456, username: 'bob' }
  });

  client.publish<UserUpdatedEvent>({
    topic: 'user.updated',
    data: { type: 'updated', userId: 456, changes: { email: 'bob@example.com' } }
  });
}

// ============================================================================
// 4. Generic Data Provider Pattern
// ============================================================================

/**
 * Type-safe data provider using PAN
 */
class DataProvider<T> {
  constructor(
    private client: PanClient,
    private resource: string
  ) {}

  async list(): Promise<T[]> {
    const response = await this.client.request<void, T[]>(
      `${this.resource}.list.get`,
      undefined,
      { timeoutMs: 5000 }
    );
    return response.data;
  }

  async get(id: number | string): Promise<T> {
    const response = await this.client.request<{ id: number | string }, T>(
      `${this.resource}.item.get`,
      { id },
      { timeoutMs: 5000 }
    );
    return response.data;
  }

  async save(item: T): Promise<T> {
    const response = await this.client.request<T, T>(
      `${this.resource}.item.save`,
      item,
      { timeoutMs: 5000 }
    );
    return response.data;
  }

  async delete(id: number | string): Promise<void> {
    await this.client.request<{ id: number | string }, void>(
      `${this.resource}.item.delete`,
      { id },
      { timeoutMs: 5000 }
    );
  }

  subscribe(handler: (items: T[]) => void): () => void {
    return this.client.subscribe<T[]>(
      `${this.resource}.list.state`,
      (msg) => handler(msg.data),
      { retained: true }
    );
  }
}

// Usage example
interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

async function dataProviderExample() {
  const client = new PanClient();
  await client.ready();

  const todoProvider = new DataProvider<Todo>(client, 'todos');

  // Subscribe to changes
  const unsubscribe = todoProvider.subscribe((todos) => {
    console.log('Todos updated:', todos);
  });

  // CRUD operations with full type safety
  const todos = await todoProvider.list();
  const todo = await todoProvider.get(1);
  const saved = await todoProvider.save({ id: 2, title: 'New task', completed: false });
  await todoProvider.delete(2);

  unsubscribe();
}

// ============================================================================
// 5. Custom Message Headers with Type Safety
// ============================================================================

async function headersExample() {
  const client = new PanClient();
  await client.ready();

  interface ApiRequest {
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  }

  // Publish with typed headers
  client.publish<ApiRequest>({
    topic: 'api.request',
    data: { endpoint: '/users', method: 'GET' },
    headers: {
      'x-request-id': crypto.randomUUID(),
      'x-user-id': '123',
      'x-tenant': 'acme-corp'
    }
  });

  // Subscribe and access headers
  client.subscribe<ApiRequest>(
    'api.request',
    (msg: PanMessage<ApiRequest>) => {
      const requestId = msg.headers?.['x-request-id'];
      const userId = msg.headers?.['x-user-id'];

      console.log(`API Request [${requestId}]`);
      console.log(`User: ${userId}, Endpoint: ${msg.data.endpoint}`);
    }
  );
}

// ============================================================================
// 6. AbortSignal for Automatic Cleanup
// ============================================================================

async function abortSignalExample() {
  const client = new PanClient();
  await client.ready();

  const controller = new AbortController();

  // Subscribe with AbortSignal - will auto-unsubscribe when aborted
  const options: SubscribeOptions = {
    retained: true,
    signal: controller.signal
  };

  client.subscribe<{ status: string }>(
    'app.status',
    (msg) => console.log('Status:', msg.data.status),
    options
  );

  // Later: abort all subscriptions at once
  setTimeout(() => {
    controller.abort();
    console.log('All subscriptions cleaned up');
  }, 5000);
}

// ============================================================================
// 7. Type Guards for Runtime Safety
// ============================================================================

function isValidUserData(data: unknown): data is { userId: number; username: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'userId' in data &&
    'username' in data &&
    typeof (data as any).userId === 'number' &&
    typeof (data as any).username === 'string'
  );
}

async function typeGuardExample() {
  const client = new PanClient();
  await client.ready();

  client.subscribe(
    'user.login',
    (msg: PanMessage) => {
      // Runtime validation with type guard
      if (isValidUserData(msg.data)) {
        // TypeScript knows msg.data is { userId: number; username: string }
        console.log(`User ${msg.data.username} logged in`);
        console.log(`User ID: ${msg.data.userId}`);
      } else {
        console.error('Invalid user data received');
      }
    }
  );
}

// ============================================================================
// 8. Const Assertions for Topic Patterns
// ============================================================================

// Define topic patterns as const for type safety
const TOPICS = {
  user: {
    list: {
      get: 'users.list.get',
      state: 'users.list.state'
    },
    item: {
      get: 'users.item.get',
      save: 'users.item.save',
      delete: 'users.item.delete',
      state: (id: number) => `users.item.state.${id}` as const
    },
    error: 'users.error'
  }
} as const;

async function topicConstantsExample() {
  const client = new PanClient();
  await client.ready();

  // Type-safe topic references
  client.publish({
    topic: TOPICS.user.list.state,
    data: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
  });

  client.subscribe(TOPICS.user.item.get, (msg) => {
    console.log('Item get request:', msg.data);
  });

  // Dynamic topic with type safety
  const userId = 123;
  client.subscribe(TOPICS.user.item.state(userId), (msg) => {
    console.log(`User ${userId} state updated:`, msg.data);
  });
}

// ============================================================================
// 9. Error Handling with Typed Errors
// ============================================================================

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

async function errorHandlingExample() {
  const client = new PanClient();
  await client.ready();

  // Subscribe to errors
  client.subscribe<ApiError>(
    '*.error',
    (msg: PanMessage<ApiError>) => {
      console.error(`Error on ${msg.topic}:`, msg.data.message);
      console.error(`Code: ${msg.data.code}`);
      if (msg.data.details) {
        console.error('Details:', msg.data.details);
      }
    }
  );

  // Publish typed error
  client.publish<ApiError>({
    topic: 'api.error',
    data: {
      code: 'AUTH_FAILED',
      message: 'Authentication failed',
      details: { reason: 'invalid_token' }
    }
  });
}

// ============================================================================
// 10. Component Integration with TypeScript
// ============================================================================

/**
 * Custom element with PAN integration
 */
class UserListElement extends HTMLElement {
  private client: PanClient;
  private unsubscribe?: () => void;

  constructor() {
    super();
    this.client = new PanClient(this);
  }

  async connectedCallback() {
    await this.client.ready();

    // Subscribe to user list updates with type safety
    interface User {
      id: number;
      name: string;
      email: string;
    }

    this.unsubscribe = this.client.subscribe<User[]>(
      'users.list.state',
      (msg: PanMessage<User[]>) => {
        this.render(msg.data);
      },
      { retained: true }
    );

    // Request initial data
    this.client.publish({
      topic: 'users.list.get',
      data: {}
    });
  }

  disconnectedCallback() {
    // Cleanup subscription
    this.unsubscribe?.();
  }

  private render(users: { id: number; name: string; email: string }[]) {
    this.innerHTML = `
      <ul>
        ${users.map(u => `<li>${u.name} (${u.email})</li>`).join('')}
      </ul>
    `;
  }
}

// Register the custom element
if (typeof customElements !== 'undefined') {
  customElements.define('user-list', UserListElement);
}

// ============================================================================
// Run Examples
// ============================================================================

export {
  basicExample,
  requestReplyExample,
  wildcardExample,
  dataProviderExample,
  headersExample,
  abortSignalExample,
  typeGuardExample,
  topicConstantsExample,
  errorHandlingExample,
  UserListElement
};
