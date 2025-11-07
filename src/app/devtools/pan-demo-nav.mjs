// <pan-demo-nav> — PAN-powered demo navigation sidebar
// Renders a list of examples and publishes retained nav.state on selection.
//
// Inputs:
// - Child <script type="application/json">[{ id, title, hint, href }...]</script>
// - Attributes: sync-url = "hash" | "" (default "hash")
//
// Topics:
// - Publishes retained `nav.state` with `{ href, id }`
// - Also publishes `nav.goto` with `{ href, id }` for consumers that act on imperative nav

import { PanClient } from '../../components/pan-client.mjs';

export class PanDemoNav extends HTMLElement {
  static get observedAttributes(){ return ['sync-url']; }
  constructor(){ super(); this.attachShadow({mode:'open'}); this.pc = new PanClient(this); this.items=[]; this.activeHref=''; }
  connectedCallback(){ this.#load(); this.render(); this.#wire(); this.#initFromUrl(); if (!this.activeHref && this.items.length) { this.#select(this.items[0].href, false); } }
  attributeChangedCallback(){ this.#initFromUrl(); }

  get syncUrl(){ const v=(this.getAttribute('sync-url')||'hash').toLowerCase(); return v==='hash' ? 'hash' : ''; }

  #load(){
    const s = this.querySelector('script[type="application/json"]');
    if (s && s.textContent?.trim()) { try { this.items = JSON.parse(s.textContent.trim()) || []; } catch { this.items = []; } }
  }

  #initFromUrl(){
    if (this.syncUrl !== 'hash') return;
    try { const href = (location.hash||'').replace(/^#/, ''); if (href) this.#select(href, false); } catch {}
  }

  render(){
    const h = String.raw;
    this.shadowRoot.innerHTML = h`
      <style>
        :host{ display:block; }
        nav{ display:flex; flex-direction:column; gap:4px; }
        a.item{ display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border-radius:10px; text-decoration:none; color:inherit; }
        a.item.active{ background: rgba(15,23,42,0.06); }
        .hint{ opacity:.6; font-size:.85em; }
      </style>
      <nav>
        ${this.items.map(x=>`<a class="item ${this.activeHref===x.href?'active':''}" data-href="${x.href}" href="#${x.href}"><span>${x.title}</span><span class="hint">${x.hint||''}</span></a>`).join('')}
      </nav>
    `;
  }

  #wire(){
    this.shadowRoot.addEventListener('click', (e)=>{
      const a = e.target?.closest?.('a.item');
      if (a){ e.preventDefault(); const href = a.getAttribute('data-href'); this.#select(href, true); }
    });
  }

  #select(href, fromClick){
    if (!href) return;
    this.activeHref = href;
    if (this.syncUrl === 'hash' && fromClick) { try { location.hash = href; } catch {} }
    this.render();
    const it = this.items.find(x=>x.href===href) || { href };
    this.pc.publish({ topic:'nav.state', data:{ href: it.href, id: it.id||it.href }, retain:true });
    this.pc.publish({ topic:'nav.goto', data:{ href: it.href, id: it.id||it.href } });
  }
}

customElements.define('pan-demo-nav', PanDemoNav);
export default PanDemoNav;
