/**
 * Injected script - runs in page context to intercept PAN messages
 * This has access to the actual PAN bus and can intercept events
 */

(function() {
  'use strict';

  // Don't inject twice
  if (window.__panDevToolsInjected) return;
  window.__panDevToolsInjected = true;

  // Storage for message history
  const messageHistory = [];
  const maxHistory = 10000;

  // Intercept CustomEvents to capture PAN traffic
  const originalDispatchEvent = EventTarget.prototype.dispatchEvent;

  EventTarget.prototype.dispatchEvent = function(event) {
    // Check if this is a PAN event
    if (event instanceof CustomEvent && event.type && event.type.startsWith('pan:')) {
      const message = {
        type: event.type,
        detail: event.detail,
        timestamp: Date.now(),
        target: this.tagName || this.constructor.name,
        id: crypto.randomUUID()
      };

      // Store in history (with limit)
      messageHistory.push(message);
      if (messageHistory.length > maxHistory) {
        messageHistory.shift();
      }

      // Send to content script
      window.postMessage({
        type: 'PAN_MESSAGE',
        data: message
      }, '*');
    }

    // Call original
    return originalDispatchEvent.call(this, event);
  };

  // Get all custom elements (components) on the page
  function getComponents() {
    const components = [];
    const seen = new Set();

    // Get all defined custom elements
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const tagName = el.tagName.toLowerCase();
      // Check if it's a custom element (contains hyphen)
      if (tagName.includes('-') && !seen.has(tagName)) {
        seen.add(tagName);
        const constructor = customElements.get(tagName);
        components.push({
          tagName,
          isDefined: !!constructor,
          constructorName: constructor?.name || 'Unknown',
          instances: document.querySelectorAll(tagName).length
        });
      }
    });

    return components.sort((a, b) => a.tagName.localeCompare(b.tagName));
  }

  // Expose API for DevTools
  window.__panDevTools = {
    getHistory: () => messageHistory,
    clearHistory: () => {
      messageHistory.length = 0;
    },
    getComponents: () => getComponents(),
    getStats: () => {
      const stats = {
        total: messageHistory.length,
        byType: {},
        byTopic: {}
      };

      messageHistory.forEach(msg => {
        stats.byType[msg.type] = (stats.byType[msg.type] || 0) + 1;
        if (msg.detail && msg.detail.topic) {
          stats.byTopic[msg.detail.topic] = (stats.byTopic[msg.detail.topic] || 0) + 1;
        }
      });

      return stats;
    },
    replay: (messageId) => {
      const msg = messageHistory.find(m => m.id === messageId);
      if (msg) {
        const event = new CustomEvent(msg.type, {
          detail: msg.detail,
          bubbles: true,
          composed: true
        });
        document.dispatchEvent(event);
        return true;
      }
      return false;
    }
  };

  console.log('[PAN DevTools] Injected and monitoring PAN messages');
})();
