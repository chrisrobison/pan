// Minimal SSE + REST sidecar (no deps). Run: `node examples/server/sse-server.js`
// Endpoints:
//   GET  /events                      -> SSE stream (topics param optional)
//   GET  /api/users                   -> list users
//   GET  /api/users/:id               -> get item
//   POST /api/users                   -> create item (JSON {id?, name, email})
//   PUT  /api/users/:id               -> update item
//   DELETE /api/users/:id             -> delete item

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const clients = new Set(); // { res, topics:Set<string>, lastId }
let nextEventId = 1;

const users = (()=>{
  try {
    const p = path.join(__dirname, '..', 'data', 'users.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return [ { id:'u1', name:'Ada Lovelace', email:'ada@example.com' } ]; }
})();

function json(res, code, data){
  res.writeHead(code, {
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function sse(res){
  res.writeHead(200, {
    'Content-Type':'text/event-stream',
    'Cache-Control':'no-cache, no-transform',
    'Connection':'keep-alive',
    'Access-Control-Allow-Origin':'*',
  });
  res.write(': welcome\n\n');
}

function send(topic, data, retain=false){
  const id = String(nextEventId++);
  const payload = JSON.stringify({ topic, data, retain });
  for (const c of clients){
    if (c.topics.size && !matches(topic, c.topics)) continue;
    try { c.res.write(`id: ${id}\n`); c.res.write(`event: message\n`); c.res.write(`data: ${payload}\n\n`); } catch {}
  }
}

function matches(topic, patterns){
  for (const p of patterns){
    if (p==='*' || p===topic) return true;
    if (p.includes('*')){
      const rx = new RegExp('^'+p.replace(/[|\\{}()\[\]^$+?.]/g,'\\$&').replace(/\*/g,'[^.]+')+'$');
      if (rx.test(topic)) return true;
    }
  }
  return false;
}

function parseBody(req){
  return new Promise((resolve)=>{
    let s=''; req.on('data',c=>s+=c); req.on('end',()=>{ try{ resolve(JSON.parse(s||'{}')); } catch{ resolve({}); } });
  });
}

function notFound(res){ json(res, 404, { error:'NOT_FOUND' }); }

const server = http.createServer(async (req, res)=>{
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return json(res, 204, {});

  // SSE stream
  if (req.method==='GET' && url.pathname==='/events'){
    sse(res);
    const topics = new Set();
    const qTopics = (url.searchParams.get('topics')||'').split(',').map(s=>s.trim()).filter(Boolean);
    qTopics.forEach(t=>topics.add(t));
    const client = { res, topics };
    clients.add(client);
    req.on('close', ()=> clients.delete(client));
    // initial snapshot: list state
    try { send('users.list.state', { items: users.slice() }, true); } catch{}
    return;
  }

  // REST: users
  if (url.pathname === '/api/users' && req.method==='GET'){
    return json(res, 200, users);
  }
  if (url.pathname.startsWith('/api/users/') && req.method==='GET'){
    const id = url.pathname.split('/').pop();
    const it = users.find(u=>String(u.id)===String(id));
    if (!it) return notFound(res); else return json(res, 200, it);
  }
  if (url.pathname === '/api/users' && req.method==='POST'){
    const body = await parseBody(req);
    const id = body.id || `u${Date.now().toString(36)}`;
    const item = { id, name: body.name||'', email: body.email||'' };
    users.push(item);
    send(`users.item.state.${id}`, { item }, true);
    send('users.list.state', { items: users.slice() }, true);
    return json(res, 200, item);
  }
  if (url.pathname.startsWith('/api/users/') && req.method==='PUT'){
    const id = url.pathname.split('/').pop(); const body = await parseBody(req);
    const idx = users.findIndex(u=>String(u.id)===String(id));
    if (idx<0) return notFound(res);
    const item = users[idx] = Object.assign({}, users[idx], body, { id });
    send(`users.item.state.${id}`, { item }, true);
    send('users.list.state', { items: users.slice() }, true);
    return json(res, 200, item);
  }
  if (url.pathname.startsWith('/api/users/') && req.method==='DELETE'){
    const id = url.pathname.split('/').pop();
    const before = users.length;
    const left = users.filter(u=>String(u.id)!==String(id));
    if (left.length===before) return notFound(res);
    users.length = 0; users.push(...left);
    send(`users.item.state.${id}`, { id, deleted:true }, false);
    send('users.list.state', { items: users.slice() }, true);
    return json(res, 200, { ok:true, id });
  }

  return notFound(res);
});

server.listen(PORT, ()=>{
  console.log(`SSE sidecar listening on http://localhost:${PORT}`);
});

