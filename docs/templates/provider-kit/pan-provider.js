// <pan-provider> — minimal in-memory CRUD provider
// Attributes: resource (default "items")
import { PanClient } from '../../dist/pan-client.js';

export class PanProvider extends HTMLElement {
  constructor(){ super(); this.pc = new PanClient(this); this.items=[]; this.key='id'; this.resource=(this.getAttribute('resource')||'items'); }
  connectedCallback(){ this.#wire(); this.#snapshot(); }
  #topic(s){ return `${this.resource}.${s}`; }
  #wire(){
    const pc=this.pc; const R=this.resource; const key=this.key;
    pc.subscribe(this.#topic('list.get'), ()=> this.#snapshot());
    pc.subscribe(this.#topic('item.get'), (m)=>{
      const id=m.data?.id; const item=this.items.find(x=>x[key]===id)||null;
      if (m.replyTo) pc.publish({ topic:m.replyTo, data:{ ok:!!item, item }, correlationId:m.correlationId });
    });
    pc.subscribe(this.#topic('item.save'), (m)=>{
      const it = Object.assign({}, m.data?.item||{});
      if (!it[key]) it[key] = crypto.randomUUID();
      const i=this.items.findIndex(x=>x[key]===it[key]);
      if (i>=0) this.items[i]=it; else this.items.push(it);
      if (m.replyTo) pc.publish({ topic:m.replyTo, data:{ ok:true, item:it }, correlationId:m.correlationId });
      this.#broadcastList(); this.#broadcastItem(it[key]);
    });
    pc.subscribe(this.#topic('item.delete'), (m)=>{
      const id=m.data?.id; const i=this.items.findIndex(x=>x[key]===id);
      const ok = i>=0; if (ok) this.items.splice(i,1);
      if (m.replyTo) pc.publish({ topic:m.replyTo, data:{ ok, id }, correlationId:m.correlationId });
      this.#broadcastList(); if (ok) pc.publish({ topic:this.#topic(`item.state.${id}`), data:{ id, deleted:true } });
    });
  }
  #snapshot(){ this.pc.publish({ topic:this.#topic('list.state'), data:{ items:this.items.slice() }, retain:true }); }
  #broadcastList(){ this.#snapshot(); }
  #broadcastItem(id){ const it=this.items.find(x=>x[this.key]===id); if (it) this.pc.publish({ topic:this.#topic(`item.state.${id}`), data:{ item:it }, retain:true }); }
}

customElements.define('pan-provider', PanProvider);
export default PanProvider;

