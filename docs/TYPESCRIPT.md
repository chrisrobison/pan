# TypeScript Guide for PAN

PAN (Page Area Network) includes complete TypeScript definitions for full type safety without requiring a build step. This guide shows you how to use PAN with TypeScript.

## Table of Contents

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Type Safety Benefits](#type-safety-benefits)
- [Common Patterns](#common-patterns)
- [Configuration](#configuration)
- [Examples](#examples)
- [Tips & Best Practices](#tips--best-practices)

## Installation

PAN's TypeScript definitions are included automatically. No additional packages needed!

```bash
npm install larc
```

## Basic Setup

### 1. TypeScript Configuration

Create or update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2. Import PAN

```typescript
import { PanClient, PanMessage } from 'larc';
```

### 3. Your First Typed Message

```typescript
interface UserLoginData {
  userId: number;
  username: string;
  timestamp: Date;
}

const client = new PanClient();
await client.ready();

// Type-safe publishing
client.publish<UserLoginData>({
  topic: 'user.login',
  data: {
    userId: 123,
    username: 'alice',
    timestamp: new Date()
  }
});

// Type-safe subscription
client.subscribe<UserLoginData>(
  'user.*',
  (msg: PanMessage<UserLoginData>) => {
    console.log(`User ${msg.data.username} logged in`);
    // TypeScript knows msg.data is UserLoginData!
  }
);
```

## Type Safety Benefits

### 1. **Auto-completion**

Your IDE will suggest available methods and properties:

```typescript
const client = new PanClient();
client.  // IDE suggests: ready(), publish(), subscribe(), request()
```

### 2. **Compile-Time Type Checking**

TypeScript catches errors before runtime:

```typescript
interface User {
  id: number;
  name: string;
}

client.publish<User>({
  topic: 'user.created',
  data: {
    id: 123,
    name: 'Alice',
    age: 30  // ❌ Error: 'age' does not exist in type 'User'
  }
});
```

### 3. **Type Inference**

TypeScript infers types automatically:

```typescript
client.subscribe<User>('user.*', (msg) => {
  // msg.data is automatically typed as User
  console.log(msg.data.name);  // ✅ TypeScript knows this is a string
});
```

### 4. **Refactoring Safety**

Rename types confidently - TypeScript finds all usages:

```typescript
// Rename UserLoginData → UserAuthEvent
// TypeScript will flag all locations that need updating
```

## Common Patterns

### Pattern 1: Request/Reply with Types

```typescript
interface GetUserRequest {
  userId: number;
}

interface GetUserResponse {
  userId: number;
  username: string;
  email: string;
}

// Requester
const response = await client.request<GetUserRequest, GetUserResponse>(
  'api.user.get',
  { userId: 123 }
);

console.log(response.data.username); // ✅ Type-safe!

// Responder
client.subscribe<GetUserRequest>('api.user.get', (msg) => {
  const user: GetUserResponse = {
    userId: msg.data.userId,
    username: 'alice',
    email: 'alice@example.com'
  };

  if (msg.replyTo) {
    client.publish<GetUserResponse>({
      topic: msg.replyTo,
      data: user,
      correlationId: msg.correlationId
    });
  }
});
```

### Pattern 2: Union Types for Event Variants

```typescript
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

client.subscribe<UserEvent>('user.*', (msg) => {
  // Discriminated union - TypeScript narrows the type
  switch (msg.data.type) {
    case 'created':
      console.log(`Created user: ${msg.data.username}`);
      break;
    case 'updated':
      console.log(`Updated user: ${msg.data.userId}`);
      break;
    case 'deleted':
      console.log(`Deleted user: ${msg.data.userId}`);
      break;
  }
});
```

### Pattern 3: Generic Data Provider

```typescript
class DataProvider<T> {
  constructor(
    private client: PanClient,
    private resource: string
  ) {}

  async list(): Promise<T[]> {
    const response = await this.client.request<void, T[]>(
      `${this.resource}.list.get`,
      undefined
    );
    return response.data;
  }

  async get(id: number | string): Promise<T> {
    const response = await this.client.request<{ id: number | string }, T>(
      `${this.resource}.item.get`,
      { id }
    );
    return response.data;
  }
}

// Usage with full type safety
interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

const todoProvider = new DataProvider<Todo>(client, 'todos');
const todos: Todo[] = await todoProvider.list();
```

### Pattern 4: Type Guards for Runtime Validation

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data && typeof (data as any).id === 'number' &&
    'name' in data && typeof (data as any).name === 'string' &&
    'email' in data && typeof (data as any).email === 'string'
  );
}

client.subscribe('user.*', (msg: PanMessage) => {
  if (isUser(msg.data)) {
    // TypeScript now knows msg.data is User
    console.log(`User: ${msg.data.name}`);
  } else {
    console.error('Invalid user data');
  }
});
```

### Pattern 5: Const Assertions for Topics

```typescript
// Define topics as const for type safety
const TOPICS = {
  user: {
    list: {
      get: 'users.list.get',
      state: 'users.list.state'
    },
    item: {
      get: 'users.item.get',
      save: 'users.item.save',
      state: (id: number) => `users.item.state.${id}` as const
    }
  }
} as const;

// Usage with autocomplete
client.publish({
  topic: TOPICS.user.list.state,
  data: [...]
});
```

## Configuration

### Strict Mode (Recommended)

Enable strict mode in `tsconfig.json` for maximum safety:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Module Resolution

PAN works with both Node and Bundler module resolution:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"  // or "node"
  }
}
```

### Path Aliases (Optional)

For cleaner imports:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/pan": ["./node_modules/larc/index.js"],
      "@/types": ["./src/types/*"]
    }
  }
}
```

Then import as:

```typescript
import { PanClient } from '@/pan';
```

## Examples

### Web Component with TypeScript

```typescript
interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
}

class TodoList extends HTMLElement {
  private client: PanClient;
  private unsubscribe?: () => void;

  constructor() {
    super();
    this.client = new PanClient(this);
  }

  async connectedCallback() {
    await this.client.ready();

    this.unsubscribe = this.client.subscribe<TodoItem[]>(
      'todos.list.state',
      (msg) => this.render(msg.data),
      { retained: true }
    );

    // Request initial data
    this.client.publish({ topic: 'todos.list.get', data: {} });
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private render(todos: TodoItem[]) {
    this.innerHTML = `
      <ul>
        ${todos.map(t => `
          <li>${t.title} ${t.completed ? '✓' : ''}</li>
        `).join('')}
      </ul>
    `;
  }
}

customElements.define('todo-list', TodoList);
```

### Service Layer with Types

```typescript
interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

class UserService {
  constructor(
    private client: PanClient,
    private config: ApiConfig
  ) {}

  async getUser(userId: number): Promise<User> {
    const response = await this.client.request<
      { userId: number },
      User
    >('api.user.get', { userId }, {
      timeoutMs: this.config.timeout
    });

    return response.data;
  }

  async listUsers(): Promise<User[]> {
    const response = await this.client.request<void, User[]>(
      'api.user.list',
      undefined
    );

    return response.data;
  }

  subscribeToUserChanges(callback: (users: User[]) => void): () => void {
    return this.client.subscribe<User[]>(
      'api.user.state',
      (msg) => callback(msg.data),
      { retained: true }
    );
  }
}

// Usage
const service = new UserService(client, {
  baseUrl: 'https://api.example.com',
  timeout: 5000
});

const user = await service.getUser(123);
console.log(user.name);
```

### Error Handling with Typed Errors

```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Global error handler
client.subscribe<ApiError>('*.error', (msg) => {
  console.error(`Error on ${msg.topic}:`, msg.data.message);

  if (msg.data.code === 'AUTH_FAILED') {
    // Handle authentication error
    redirectToLogin();
  }
});

// Publish typed errors
try {
  // some operation
} catch (err) {
  client.publish<ApiError>({
    topic: 'api.error',
    data: {
      code: 'OPERATION_FAILED',
      message: err instanceof Error ? err.message : 'Unknown error',
      details: { originalError: err }
    }
  });
}
```

## Tips & Best Practices

### 1. **Define Interfaces at the Top**

Keep all message type definitions in a central location:

```typescript
// types/messages.ts
export interface UserLoginData {
  userId: number;
  username: string;
}

export interface UserLogoutData {
  userId: number;
  reason?: string;
}

// Import and use everywhere
import { UserLoginData } from './types/messages';
```

### 2. **Use Generic Constraints**

Constrain generic types for better type safety:

```typescript
interface BaseEntity {
  id: number | string;
}

class EntityProvider<T extends BaseEntity> {
  async get(id: T['id']): Promise<T> {
    // TypeScript knows id is number | string
    const response = await this.client.request<{ id: T['id'] }, T>(
      `${this.resource}.get`,
      { id }
    );
    return response.data;
  }
}
```

### 3. **Leverage Type Inference**

Don't over-annotate - let TypeScript infer when possible:

```typescript
// ❌ Too verbose
const client: PanClient = new PanClient();

// ✅ Let TypeScript infer
const client = new PanClient();

// ❌ Redundant type
client.subscribe<User>('user.*', (msg: PanMessage<User>) => {
  // ...
});

// ✅ Infer from generic
client.subscribe<User>('user.*', (msg) => {
  // msg is automatically PanMessage<User>
});
```

### 4. **Use `unknown` for Dynamic Data**

When you don't know the shape, use `unknown` and validate:

```typescript
client.subscribe('external.*', (msg: PanMessage<unknown>) => {
  // Validate before using
  if (isValidData(msg.data)) {
    processData(msg.data);
  }
});
```

### 5. **AbortSignal for Cleanup**

Use AbortController with TypeScript for automatic cleanup:

```typescript
const controller = new AbortController();

client.subscribe<User>(
  'user.*',
  (msg) => console.log(msg.data),
  { signal: controller.signal }
);

// Later: cleanup all subscriptions
controller.abort();
```

### 6. **Avoid `any`**

Never use `any` - it defeats the purpose of TypeScript:

```typescript
// ❌ Bad
client.publish({ topic: 'foo', data: someData as any });

// ✅ Good - define proper types
interface FooData {
  value: string;
}
client.publish<FooData>({ topic: 'foo', data: { value: 'bar' } });

// ✅ Good - use unknown if truly dynamic
client.publish<unknown>({ topic: 'foo', data: someData });
```

## IDE Setup

### VS Code

PAN works great with VS Code out of the box! Install these extensions for the best experience:

- **TypeScript** (built-in)
- **ESLint** for code quality
- **Path Intellisense** for import autocomplete

### WebStorm / IntelliJ IDEA

TypeScript support is built-in. Enable:

- Settings → Languages & Frameworks → TypeScript → Enable TypeScript Language Service

## Advanced: Custom Type Utilities

```typescript
// Extract data type from PanMessage
type MessageData<T> = T extends PanMessage<infer D> ? D : never;

// Create typed topic constants
type TopicPattern = `${string}.${string}` | `${string}.${string}.${string}`;

const createTopic = <T extends TopicPattern>(topic: T): T => topic;

const USER_TOPICS = {
  login: createTopic('user.login'),
  logout: createTopic('user.logout'),
  state: createTopic('user.list.state')
} as const;

// Typed message creator
function createMessage<T>(
  topic: string,
  data: T,
  options?: Partial<Omit<PanMessage<T>, 'topic' | 'data'>>
): PanMessage<T> {
  return {
    topic,
    data,
    ...options
  };
}

// Usage
const msg = createMessage('user.login', { userId: 123, username: 'alice' });
```

## Migration from JavaScript

If you're migrating existing JavaScript code:

1. **Rename files** from `.js` to `.ts`
2. **Add type annotations** gradually:
   ```typescript
   // Before (JS)
   function handleMessage(msg) {
     console.log(msg.data);
   }

   // After (TS)
   function handleMessage(msg: PanMessage<User>) {
     console.log(msg.data.username);
   }
   ```
3. **Fix type errors** one at a time
4. **Enable strict mode** when ready

## Getting Help

- See [examples/18-typescript-usage.ts](../examples/18-typescript-usage.ts) for complete examples
- Check [src/types/index.d.ts](../src/types/index.d.ts) for all available types
- Report issues: [GitHub Issues](https://github.com/chrisrobison/pan/issues)

## Summary

TypeScript with PAN provides:

- ✅ **Full type safety** without build overhead
- ✅ **Excellent IDE support** with autocomplete
- ✅ **Catch errors at compile-time** instead of runtime
- ✅ **Better refactoring** with confidence
- ✅ **Self-documenting code** with type signatures

Start using TypeScript with PAN today for a better development experience!
