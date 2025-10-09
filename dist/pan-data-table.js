// <pan-data-table> — Simple table that subscribes to `${resource}.list.state`
// and publishes row selection via `${resource}.item.select`.

import { PanClient } from './pan-client.js';

export class PanDataTable extends HTMLElement {
  static get observedAttributes(){ return ['resource','columns']; }
  constructor(){ super(); this.attachShadow({mode:'open'}); this.pc = new PanClient(this); this.items = []; }
  connectedCallback(){ this.render(); this.#subscribe(); this.#requestList(); }
  disconnectedCallback(){ this.off && this.off(); }
  attributeChangedCallback(){ this.render(); this.#subscribe(); this.#requestList(); }

  get resource(){ return (this.getAttribute('resource')||'items').trim(); }
  get columns(){ const c=(this.getAttribute('columns')||'').trim(); return c? c.split(/\s*,\s*/): null; }

  #subscribe(){
    this.off && this.off();
    this.off = this.pc.subscribe(`${this.resource}.list.state`, (m)=>{ this.items = m?.data?.items || []; this.renderBody(); }, { retained:true });
  }

  #requestList(){ this.pc.publish({ topic:`${this.resource}.list.get`, data:{} }); }

  render(){
    const h = String.raw; const cols = this.columns || (this.items[0] ? Object.keys(this.items[0]) : []);
    this.shadowRoot.innerHTML = h`
      <style>
        :host{display:block; border:1px solid #ddd; border-radius:8px; overflow:hidden; font:13px/1.4 system-ui, sans-serif}
        table{width:100%; border-collapse:collapse}
        th,td{padding:8px 10px; border-bottom:1px solid #eee; text-align:left}
        tr:hover{ background:#fafafa; cursor:pointer }
        thead th{ background:#f6f6f6; font-weight:600 }
        .empty{ padding:10px; color:#888 }
      </style>
      <table>
        <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody></tbody>
      </table>
      <div class="empty" id="empty" hidden>No records.</div>
    `;
    this.renderBody();
  }

  renderBody(){
    const tbody = this.shadowRoot.querySelector('tbody'); if (!tbody) return;
    const cols = this.columns || (this.items[0] ? Object.keys(this.items[0]) : []);
    tbody.innerHTML = this.items.map(it=>`<tr data-id="${it.id ?? it[this.getAttribute('key')||'id']}">`+
      cols.map(c=>`<td>${this.#escape(it[c])}</td>`).join('')+`</tr>`).join('');
    const empty = this.shadowRoot.getElementById('empty');
    if (empty) empty.hidden = this.items.length > 0;
    tbody.querySelectorAll('tr').forEach(tr=>{
      tr.addEventListener('click', ()=>{
        const id = tr.getAttribute('data-id');
        this.pc.publish({ topic:`${this.resource}.item.select`, data:{ id } });
      });
    });
  }

  #escape(v){ if (v==null) return ''; return String(v).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
}

customElements.define('pan-data-table', PanDataTable);
export default PanDataTable;

