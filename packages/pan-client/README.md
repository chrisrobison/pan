# @pan/client

PanClient — tiny helper for publishing, subscribing, and request/reply on the PAN bus.

```js
import { PanClient } from '@pan/client';
const pc = new PanClient();
pc.publish({ topic:'demo.hello', data:{ text:'hi' } });
```

This package mirrors the repo’s `dist/pan-client.js`. During publish, `index.js` is synced from the repo’s `dist` folder.

