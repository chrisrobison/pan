/**
 * PAN Inspector Panel
 * Main UI logic for the DevTools panel
 */

(function() {
  'use strict';

  // State
  const state = {
    messages: [],
    filteredMessages: [],
    selectedMessage: null,
    isPaused: false,
    filters: {
      text: '',
      showDeliver: true,
      showPublish: true,
      showSubscribe: true
    }
  };

  // DOM Elements
  const elements = {
    clearBtn: document.getElementById('clear-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    pauseText: document.getElementById('pause-text'),
    filterInput: document.getElementById('filter-input'),
    showDeliver: document.getElementById('show-deliver'),
    showPublish: document.getElementById('show-publish'),
    showSubscribe: document.getElementById('show-subscribe'),
    messageCount: document.getElementById('message-count'),
    exportBtn: document.getElementById('export-btn'),
    importBtn: document.getElementById('import-btn'),
    messagesBody: document.getElementById('messages-body'),
    emptyState: document.getElementById('empty-state'),
    componentsBody: document.getElementById('components-body'),
    componentsEmpty: document.getElementById('components-empty'),
    detailsPanel: document.getElementById('details-panel'),
    closeDetailsBtn: document.getElementById('close-details-btn'),
    replayBtn: document.getElementById('replay-btn'),
    copyBtn: document.getElementById('copy-btn'),
    fileInput: document.getElementById('file-input')
  };

  // Connect to background script
  const port = chrome.runtime.connect({ name: 'devtools-panel' });

  // Listen for messages from background
  port.onMessage.addListener((message) => {
    if (message.type === 'PAN_MESSAGE' && !state.isPaused) {
      addMessage(message.data);
    }
  });

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      // Update tab buttons
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update tab content
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Load components if switching to components tab
      if (tabName === 'components') {
        loadComponents();
      }
    });
  });

  // Event Listeners
  elements.clearBtn.addEventListener('click', clearMessages);
  elements.pauseBtn.addEventListener('click', togglePause);
  elements.filterInput.addEventListener('input', applyFilters);
  elements.showDeliver.addEventListener('change', applyFilters);
  elements.showPublish.addEventListener('change', applyFilters);
  elements.showSubscribe.addEventListener('change', applyFilters);
  elements.exportBtn.addEventListener('click', exportMessages);
  elements.importBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', importMessages);
  elements.closeDetailsBtn.addEventListener('click', closeDetails);
  elements.replayBtn.addEventListener('click', replayMessage);
  elements.copyBtn.addEventListener('click', copyMessageJSON);

  // Functions
  function addMessage(message) {
    state.messages.push(message);

    // Limit history
    if (state.messages.length > 10000) {
      state.messages.shift();
    }

    applyFilters();
  }

  function applyFilters() {
    // Update filter state
    state.filters.text = elements.filterInput.value.toLowerCase();
    state.filters.showDeliver = elements.showDeliver.checked;
    state.filters.showPublish = elements.showPublish.checked;
    state.filters.showSubscribe = elements.showSubscribe.checked;

    // Filter messages
    state.filteredMessages = state.messages.filter(msg => {
      // Type filter
      if (msg.type === 'pan:deliver' && !state.filters.showDeliver) return false;
      if (msg.type === 'pan:publish' && !state.filters.showPublish) return false;
      if (msg.type === 'pan:subscribe' && !state.filters.showSubscribe) return false;

      // Text filter
      if (state.filters.text) {
        const searchText = JSON.stringify(msg).toLowerCase();
        if (!searchText.includes(state.filters.text)) return false;
      }

      return true;
    });

    render();
  }

  function render() {
    // Update count
    elements.messageCount.textContent = `${state.filteredMessages.length} messages`;

    // Show/hide empty state
    if (state.filteredMessages.length === 0) {
      elements.emptyState.classList.remove('hidden');
      elements.messagesBody.innerHTML = '';
      return;
    }

    elements.emptyState.classList.add('hidden');

    // Render messages (latest first, limited to last 1000 for performance)
    const messagesToRender = state.filteredMessages.slice(-1000).reverse();

    elements.messagesBody.innerHTML = messagesToRender.map(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      });

      const type = msg.type.replace('pan:', '');
      const typeBadge = `<span class="type-badge type-${type}">${type}</span>`;

      const topic = msg.detail?.topic || '-';
      const target = msg.target || '-';
      const size = estimateSize(msg);

      const isSelected = state.selectedMessage?.id === msg.id ? 'selected' : '';

      return `
        <tr class="${isSelected}" data-id="${msg.id}">
          <td class="col-time">${time}</td>
          <td class="col-type">${typeBadge}</td>
          <td class="col-topic">${escapeHtml(topic)}</td>
          <td class="col-target">${escapeHtml(target)}</td>
          <td class="col-size">${size}</td>
          <td class="col-actions">
            <button class="action-btn" onclick="window.viewMessage('${msg.id}')">View</button>
            <button class="action-btn" onclick="window.replayMessageById('${msg.id}')">Replay</button>
          </td>
        </tr>
      `;
    }).join('');

    // Add click handlers
    elements.messagesBody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', (e) => {
        if (!e.target.classList.contains('action-btn')) {
          const id = row.dataset.id;
          viewMessage(id);
        }
      });
    });
  }

  function viewMessage(id) {
    const message = state.messages.find(m => m.id === id);
    if (!message) return;

    state.selectedMessage = message;

    // Update details panel
    const time = new Date(message.timestamp).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'medium'
    });

    document.getElementById('detail-type').textContent = message.type;
    document.getElementById('detail-topic').textContent = message.detail?.topic || '-';
    document.getElementById('detail-timestamp').textContent = time;
    document.getElementById('detail-target').textContent = message.target || '-';
    document.getElementById('detail-size').textContent = estimateSize(message);
    document.getElementById('detail-payload').textContent = JSON.stringify(message.detail, null, 2);

    // Show panel
    elements.detailsPanel.classList.remove('hidden');

    // Update selected row
    render();
  }

  function closeDetails() {
    state.selectedMessage = null;
    elements.detailsPanel.classList.add('hidden');
    render();
  }

  function replayMessage() {
    if (!state.selectedMessage) return;

    // Send message to content script to replay
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'REPLAY_MESSAGE',
          messageId: state.selectedMessage.id
        });

        console.log('Replaying message:', state.selectedMessage.id);
      }
    });
  }

  function replayMessageById(id) {
    const message = state.messages.find(m => m.id === id);
    if (!message) return;

    state.selectedMessage = message;
    replayMessage();
  }

  function copyMessageJSON() {
    if (!state.selectedMessage) return;

    const json = JSON.stringify(state.selectedMessage, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      // Visual feedback
      const btn = elements.copyBtn;
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1000);
    });
  }

  function clearMessages() {
    if (confirm('Clear all messages?')) {
      state.messages = [];
      state.filteredMessages = [];
      state.selectedMessage = null;
      closeDetails();
      render();

      // Also clear in page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'CLEAR_HISTORY' });
        }
      });
    }
  }

  function togglePause() {
    state.isPaused = !state.isPaused;

    if (state.isPaused) {
      elements.pauseText.textContent = 'Resume';
      document.body.classList.add('paused');
    } else {
      elements.pauseText.textContent = 'Pause';
      document.body.classList.remove('paused');
    }
  }

  function exportMessages() {
    const data = {
      version: '1.0',
      exported: new Date().toISOString(),
      messages: state.messages
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pan-messages-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  function importMessages(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.messages && Array.isArray(data.messages)) {
          state.messages = data.messages;
          applyFilters();
          console.log(`Imported ${data.messages.length} messages`);
        }
      } catch (err) {
        alert('Failed to import messages: ' + err.message);
      }
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
  }

  function estimateSize(message) {
    try {
      const bytes = new Blob([JSON.stringify(message)]).size;
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    } catch (e) {
      return '-';
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load components from page
  function loadComponents() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_COMPONENTS' }, (response) => {
          if (response && Array.isArray(response)) {
            renderComponents(response);
          }
        });
      }
    });
  }

  // Render components table
  function renderComponents(components) {
    if (components.length === 0) {
      elements.componentsEmpty.classList.remove('hidden');
      elements.componentsBody.innerHTML = '';
      return;
    }

    elements.componentsEmpty.classList.add('hidden');

    elements.componentsBody.innerHTML = components.map(comp => {
      const statusBadge = comp.isDefined
        ? '<span class="status-badge status-defined">Defined</span>'
        : '<span class="status-badge status-undefined">Undefined</span>';

      return `
        <tr>
          <td><code>${escapeHtml(comp.tagName)}</code></td>
          <td><code>${escapeHtml(comp.constructorName)}</code></td>
          <td>${comp.instances}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }

  // Expose functions for inline handlers
  window.viewMessage = viewMessage;
  window.replayMessageById = replayMessageById;

  // Load existing messages from page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_HISTORY' }, (response) => {
        if (response && Array.isArray(response)) {
          state.messages = response;
          applyFilters();
          console.log(`Loaded ${response.length} messages from page`);
        }
      });
    }
  });

  console.log('[PAN Inspector] Panel loaded');
})();
