import PanDataTable from "./pan-data-table.js";
try {
  if (!customElements.get("pan-table")) customElements.define(
    "pan-table",
    /** @type {any} */
    PanDataTable
  );
} catch {
}
var pan_table_default = PanDataTable;
export {
  PanDataTable,
  pan_table_default as default
};
//# sourceMappingURL=pan-table.js.map
