// <pan-demo-viewer> — Displays an example page selected via PAN navigation
//
// Attributes:
// - mode: 'iframe' | 'inline' (default: 'iframe')
// - base: optional base path to prefix to hrefs
//
// Subscribes:
// - `nav.state` (retained) with `{ href }` and loads content accordingly.

import { PanClient } from '../../components/pan-client.mjs';

export class PanDemoViewer extends HTMLElement {
  static get observedAttributes(){ return ['mode','base']; }
  constructor(){ super(); this.attachShadow({mode:'open'}); this.pc = new PanClient(this); this._off=null; this._href=''; }
  connectedCallback(){ this.render(); this.#subscribe(); }
  disconnectedCallback(){ try { this._off && this._off(); } catch {} this._off=null; }
  attributeChangedCallback(){ this.render(); }

  get mode(){ const v=(this.getAttribute('mode')||'iframe').toLowerCase(); return v==='inline' ? 'inline' : 'iframe'; }
  get base(){ return (this.getAttribute('base')||'').replace(/\/$/,''); }

  #url(href){ const h = (href||'').replace(/^\//,''); return this.base ? `${this.base}/${h}` : h; }

  #subscribe(){ this._off = this.pc.subscribe('nav.state', (m)=> this.#load(m?.data?.href), { retained:true }); }

  async #load(href){ if (!href || href===this._href) return; this._href = href; const url = this.#url(href); if (this.mode==='iframe') this.#loadIframe(url); else await this.#loadInline(url); }

  #loadIframe(url){ const frame = this.shadowRoot.getElementById('frame'); if (frame) frame.src = url; }

  async #loadInline(url){
    const host = this.shadowRoot.getElementById('host'); if (!host) return;
    host.innerHTML = `<div style="padding:10px;color:#888">Loading ${this.#esc(url)}…</div>`;
    try {
      const res = await fetch(url, { credentials: 'same-origin' }); const html = await res.text();
      // Note: executing scripts from fetched HTML inline is non-trivial; iframe mode is recommended for full demos.
      // Here we insert the raw HTML into a sandboxed shadow host for static preview.
      host.innerHTML = html;
    } catch (e){ host.innerHTML = `<div style="padding:10px;color:#c33">Failed to load ${this.#esc(url)}: ${this.#esc(String(e&&e.message||e))}</div>`; }
  }

  render(){
    const h = String.raw;
    this.shadowRoot.innerHTML = h`
      <style>
        :host{ display:block; border:1px solid #ddd; border-radius:12px; overflow:hidden; background:#fff; }
        iframe{ display:block; width:100%; height:calc(100vh - 120px); border:0 }
        .inline-host{ display:block; width:100%; min-height:300px; background:var(--bg,#fff); color:var(--fg,#111) }
      </style>
      ${this.mode==='iframe' ? '<iframe id="frame" title="Demo Viewer"></iframe>' : '<div id="host" class="inline-host"></div>'}
    `;
    if (this._href) { const url = this.#url(this._href); if (this.mode==='iframe') this.#loadIframe(url); else this.#loadInline(url); }
  }

  #esc(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
}

customElements.define('pan-demo-viewer', PanDemoViewer);
export default PanDemoViewer;

