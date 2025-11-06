class PanFiles extends HTMLElement {
  static observedAttributes = ["path", "filter", "show-hidden"];
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._currentPath = "/";
    this._filter = "";
    this._showHidden = false;
    this._files = [];
    this._rootHandle = null;
  }
  async connectedCallback() {
    await this._initFileSystem();
    this.render();
    this._setupEventListeners();
    this._setupPanListeners();
    await this._loadFiles();
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    switch (name) {
      case "path":
        this._currentPath = newValue || "/";
        this._loadFiles();
        break;
      case "filter":
        this._filter = newValue || "";
        this._loadFiles();
        break;
      case "show-hidden":
        this._showHidden = newValue === "true";
        this._loadFiles();
        break;
    }
  }
  async _initFileSystem() {
    try {
      this._rootHandle = await navigator.storage.getDirectory();
      console.log("\u2713 OPFS initialized");
    } catch (error) {
      console.error("Failed to initialize OPFS:", error);
    }
  }
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
        }

        .files-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        /* Header */
        .files-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          border-bottom: 1px solid var(--color-border, #e2e8f0);
          background: var(--color-bg-alt, #f8fafc);
        }

        .files-title {
          font-weight: 600;
          color: var(--color-text, #1e293b);
          font-size: 0.875rem;
        }

        .header-actions {
          display: flex;
          gap: 0.5rem;
        }

        .icon-btn {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e2e8f0);
          color: var(--color-text, #1e293b);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.15s ease;
        }

        .icon-btn:hover {
          background: var(--color-primary-soft, #e0f2fe);
          border-color: var(--color-primary, #006699);
        }

        /* Path breadcrumb */
        .path-breadcrumb {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--color-border, #e2e8f0);
          font-size: 0.75rem;
          color: var(--color-text-muted, #64748b);
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .breadcrumb-item {
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .breadcrumb-item:hover {
          color: var(--color-primary, #006699);
        }

        .breadcrumb-separator {
          color: var(--color-text-subtle, #94a3b8);
        }

        /* Search */
        .search-box {
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--color-border, #e2e8f0);
        }

        .search-input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 0.25rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .search-input:focus {
          border-color: var(--color-primary, #006699);
        }

        /* File list */
        .files-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: background 0.15s ease;
          font-size: 0.875rem;
        }

        .file-item:hover {
          background: var(--color-bg-alt, #f8fafc);
        }

        .file-item.selected {
          background: var(--color-primary-soft, #e0f2fe);
          color: var(--color-primary, #006699);
        }

        .file-icon {
          font-size: 1.125rem;
        }

        .file-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size {
          font-size: 0.75rem;
          color: var(--color-text-muted, #64748b);
        }

        .file-actions {
          display: none;
          gap: 0.25rem;
        }

        .file-item:hover .file-actions {
          display: flex;
        }

        .file-action-btn {
          background: transparent;
          border: none;
          color: var(--color-text-muted, #64748b);
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875rem;
          transition: all 0.15s ease;
        }

        .file-action-btn:hover {
          background: var(--color-surface, #ffffff);
          color: var(--color-primary, #006699);
        }

        /* Empty state */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--color-text-muted, #64748b);
          text-align: center;
          padding: 2rem;
        }

        .empty-state-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        /* Loading */
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--color-text-muted, #64748b);
        }
      </style>

      <div class="files-container">
        <div class="files-header">
          <div class="files-title">\u{1F4C1} Files</div>
          <div class="header-actions">
            <button class="icon-btn" data-action="new-file" title="New File">\u{1F4C4} New</button>
            <button class="icon-btn" data-action="new-folder" title="New Folder">\u{1F4C1} New</button>
            <button class="icon-btn" data-action="refresh" title="Refresh">\u{1F504}</button>
          </div>
        </div>

        <div class="path-breadcrumb">
          <span class="breadcrumb-item" data-path="/">Home</span>
        </div>

        <div class="search-box">
          <input type="text" class="search-input" placeholder="Search files..." />
        </div>

        <div class="files-list">
          <div class="loading">Loading files...</div>
        </div>
      </div>
    `;
  }
  _setupEventListeners() {
    const container = this.shadowRoot.querySelector(".files-container");
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (btn) {
        const action = btn.dataset.action;
        this._handleAction(action);
      }
      const fileItem = e.target.closest(".file-item");
      if (fileItem) {
        const path = fileItem.dataset.path;
        const isDir = fileItem.dataset.isdir === "true";
        this._handleFileClick(path, isDir);
      }
      const actionBtn = e.target.closest(".file-action-btn");
      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        const path = actionBtn.closest(".file-item").dataset.path;
        this._handleFileAction(action, path);
      }
    });
    const searchInput = this.shadowRoot.querySelector(".search-input");
    searchInput?.addEventListener("input", (e) => {
      this._filterFiles(e.target.value);
    });
  }
  _setupPanListeners() {
    const bus = document.querySelector("pan-bus");
    if (!bus) return;
    bus.subscribe("file.save", async (data) => {
      if (data.path && data.content !== void 0) {
        await this.writeFile(data.path, data.content);
      }
    });
    bus.subscribe("file.load", async (data) => {
      if (data.path) {
        const content = await this.readFile(data.path);
        bus.publish("file.content-loaded", { path: data.path, content });
      }
    });
    bus.subscribe("file.delete", async (data) => {
      if (data.path) {
        await this.deleteFile(data.path);
      }
    });
    bus.subscribe("file.create", async (data) => {
      if (data.path) {
        await this.writeFile(data.path, data.content || "");
      }
    });
  }
  async _loadFiles() {
    if (!this._rootHandle) return;
    const list = this.shadowRoot.querySelector(".files-list");
    if (!list) return;
    try {
      const files = [];
      for await (const entry of this._rootHandle.values()) {
        const isDirectory = entry.kind === "directory";
        const name = entry.name;
        if (this._filter && !isDirectory) {
          const ext = name.substring(name.lastIndexOf("."));
          if (!this._filter.split(",").includes(ext)) {
            continue;
          }
        }
        if (!this._showHidden && name.startsWith(".")) {
          continue;
        }
        let size = 0;
        if (!isDirectory) {
          try {
            const file = await entry.getFile();
            size = file.size;
          } catch (e) {
            console.warn("Could not get file size:", e);
          }
        }
        files.push({
          name,
          path: "/" + name,
          isDirectory,
          size,
          entry
        });
      }
      files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      this._files = files;
      this._renderFiles(files);
    } catch (error) {
      console.error("Failed to load files:", error);
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">\u26A0\uFE0F</div><div>Failed to load files</div></div>';
    }
  }
  _renderFiles(files) {
    const list = this.shadowRoot.querySelector(".files-list");
    if (!list) return;
    if (files.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">\u{1F4C2}</div>
          <div>No files yet</div>
          <div style="font-size: 0.875rem; margin-top: 0.5rem;">Click "New" to create a file</div>
        </div>
      `;
      return;
    }
    list.innerHTML = files.map((file) => {
      const icon = file.isDirectory ? "\u{1F4C1}" : this._getFileIcon(file.name);
      const sizeStr = file.isDirectory ? "" : this._formatSize(file.size);
      return `
        <div class="file-item" data-path="${file.path}" data-isdir="${file.isDirectory}">
          <span class="file-icon">${icon}</span>
          <span class="file-name">${file.name}</span>
          <span class="file-size">${sizeStr}</span>
          <div class="file-actions">
            <button class="file-action-btn" data-action="rename" title="Rename">\u270F\uFE0F</button>
            <button class="file-action-btn" data-action="delete" title="Delete">\u{1F5D1}\uFE0F</button>
          </div>
        </div>
      `;
    }).join("");
  }
  _filterFiles(query) {
    if (!query.trim()) {
      this._renderFiles(this._files);
      return;
    }
    const filtered = this._files.filter(
      (file) => file.name.toLowerCase().includes(query.toLowerCase())
    );
    this._renderFiles(filtered);
  }
  _handleAction(action) {
    switch (action) {
      case "new-file":
        this._createNewFile();
        break;
      case "new-folder":
        this._createNewFolder();
        break;
      case "refresh":
        this._loadFiles();
        break;
    }
  }
  async _createNewFile() {
    const name = prompt("Enter file name:");
    if (!name) return;
    await this.writeFile("/" + name, "");
    await this._loadFiles();
    const bus = document.querySelector("pan-bus");
    if (bus) {
      bus.publish("file.created", { path: "/" + name, name });
    }
  }
  async _createNewFolder() {
    const name = prompt("Enter folder name:");
    if (!name) return;
    try {
      await this._rootHandle.getDirectoryHandle(name, { create: true });
      await this._loadFiles();
      const bus = document.querySelector("pan-bus");
      if (bus) {
        bus.publish("file.created", { path: "/" + name, name, isDirectory: true });
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
      alert("Failed to create folder");
    }
  }
  _handleFileClick(path, isDirectory) {
    if (isDirectory) {
      console.log("Navigate to:", path);
      return;
    }
    this._selectFile(path);
    const bus = document.querySelector("pan-bus");
    if (bus) {
      bus.publish("file.selected", {
        path,
        name: path.split("/").pop(),
        isDirectory: false
      });
    }
  }
  _selectFile(path) {
    const items = this.shadowRoot.querySelectorAll(".file-item");
    items.forEach((item) => {
      if (item.dataset.path === path) {
        item.classList.add("selected");
      } else {
        item.classList.remove("selected");
      }
    });
  }
  async _handleFileAction(action, path) {
    switch (action) {
      case "rename":
        await this._renameFile(path);
        break;
      case "delete":
        await this._deleteFile(path);
        break;
    }
  }
  async _renameFile(path) {
    const oldName = path.split("/").pop();
    const newName = prompt("Enter new name:", oldName);
    if (!newName || newName === oldName) return;
    try {
      const content = await this.readFile(path);
      await this.writeFile("/" + newName, content);
      await this.deleteFile(path);
      await this._loadFiles();
      const bus = document.querySelector("pan-bus");
      if (bus) {
        bus.publish("file.renamed", { oldPath: path, newPath: "/" + newName });
      }
    } catch (error) {
      console.error("Failed to rename file:", error);
      alert("Failed to rename file");
    }
  }
  async _deleteFile(path) {
    if (!confirm(`Delete ${path}?`)) return;
    await this.deleteFile(path);
    await this._loadFiles();
  }
  _getFileIcon(filename) {
    const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
    const icons = {
      ".md": "\u{1F4DD}",
      ".txt": "\u{1F4C4}",
      ".js": "\u{1F4DC}",
      ".json": "\u{1F4CB}",
      ".html": "\u{1F310}",
      ".css": "\u{1F3A8}",
      ".jpg": "\u{1F5BC}\uFE0F",
      ".png": "\u{1F5BC}\uFE0F",
      ".gif": "\u{1F5BC}\uFE0F",
      ".pdf": "\u{1F4D5}"
    };
    return icons[ext] || "\u{1F4C4}";
  }
  _formatSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + " " + sizes[i];
  }
  // Public API
  async writeFile(path, content) {
    if (!this._rootHandle) return;
    try {
      const filename = path.replace(/^\//, "");
      const fileHandle = await this._rootHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      console.log("\u2713 Saved:", path);
    } catch (error) {
      console.error("Failed to write file:", error);
      throw error;
    }
  }
  async readFile(path) {
    if (!this._rootHandle) return "";
    try {
      const filename = path.replace(/^\//, "");
      const fileHandle = await this._rootHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (error) {
      console.error("Failed to read file:", error);
      throw error;
    }
  }
  async deleteFile(path) {
    if (!this._rootHandle) return;
    try {
      const filename = path.replace(/^\//, "");
      await this._rootHandle.removeEntry(filename);
      console.log("\u2713 Deleted:", path);
      const bus = document.querySelector("pan-bus");
      if (bus) {
        bus.publish("file.deleted", { path });
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
      throw error;
    }
  }
  async listFiles() {
    return this._files;
  }
  refresh() {
    return this._loadFiles();
  }
}
customElements.define("pan-files", PanFiles);
var pan_files_default = PanFiles;
export {
  PanFiles,
  pan_files_default as default
};
//# sourceMappingURL=pan-files.js.map
