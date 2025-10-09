// <pan-form> — Basic CRUD form for a named resource.
// Listens for `${resource}.item.select`, requests `${resource}.item.get`,
// and submits via `${resource}.item.save` / deletes via `${resource}.item.delete`.

import { PanClient } from './pan-client.js';

export class PanForm extends HTMLElement {
  static get observedAttributes(){ return ['resource','fields']; }
  constructor(){ super(); this.attachShadow({mode:'open'}); this.pc = new PanClient(this); this.value = {}; }
  connectedCallback(){ this.render(); this.#wire(); }
  disconnectedCallback(){ this.off && this.off(); }
  attributeChangedCallback(){ this.render(); this.#wire(); }

  get resource(){ return (this.getAttribute('resource')||'items').trim(); }
  get fields(){ const f=(this.getAttribute('fields')||'').trim(); return f? f.split(/\s*,\s*/): []; }

  #wire(){
    this.off && this.off();
    this.off = this.pc.subscribe(`${this.resource}.item.select`, async (m)=>{
      const id = m?.data?.id; if (!id) return;
      try { const { data } = await this.pc.request(`${this.resource}.item.get`, { id }); this.#setValue(data?.item || {}); }
      catch { /* ignore */ }
    });
    const form = this.shadowRoot.getElementById('f');
    if (form) form.onsubmit = (e)=>{ e.preventDefault(); this.#save(); };
    const del = this.shadowRoot.getElementById('del');
    if (del) del.onclick = (e)=>{ e.preventDefault(); this.#delete(); };
  }

  async #save(){
    const item = this.#collect();
    try {
      const { data } = await this.pc.request(`${this.resource}.item.save`, { item });
      this.#setValue(data?.item || item);
    } catch {}
  }

  async #delete(){
    const id = this.value?.id || this.value?.[this.getAttribute('key')||'id'];
    if (!id) return;
    try {
      await this.pc.request(`${this.resource}.item.delete`, { id });
      this.#setValue({});
    } catch {}
  }

  #collect(){
    const out = Object.assign({}, this.value);
    for (const name of this.fields){
      const input = this.shadowRoot.querySelector(`[name="${name}"]`);
      if (!input) continue;
      const v = input.value;
      out[name] = v;
    }
    return out;
  }

  #setValue(v){ this.value = v || {}; this.render(); this.#wire(); }

  render(){
    const h = String.raw; const v = this.value || {};
    this.shadowRoot.innerHTML = h`
      <style>
        :host{display:block; border:1px solid #ddd; border-radius:8px; padding:12px; font:13px/1.4 system-ui, sans-serif}
        form{ display:grid; gap:8px }
        label{ display:grid; gap:4px }
        input,button{ padding:8px 10px }
        .row{ display:flex; gap:8px; align-items:center }
        .spacer{ flex:1 }
      </style>
      <form id="f">
        ${this.fields.map(name=>`
          <label>
            <span>${name}</span>
            <input name="${name}" value="${this.#escape(v[name] ?? '')}" />
          </label>`).join('')}
        <div class="row">
          <button id="save" type="submit">Save</button>
          <span class="spacer"></span>
          <button id="del" type="button">Delete</button>
        </div>
      </form>
    `;
  }

  #escape(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
}

customElements.define('pan-form', PanForm);
export default PanForm;

