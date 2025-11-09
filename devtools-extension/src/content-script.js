/**
 * Content script - bridges between injected script and DevTools panel
 * Runs in isolated context with access to both page and extension
 */

(function() {
  'use strict';

  // Inject the script into the page context
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/injected.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  // Listen for messages from injected script
  window.addEventListener('message', function(event) {
    // Only accept messages from same window
    if (event.source !== window) return;

    // Only handle PAN messages
    if (event.data && event.data.type === 'PAN_MESSAGE') {
      // Forward to DevTools panel via background script
      chrome.runtime.sendMessage({
        type: 'PAN_MESSAGE',
        data: event.data.data,
        tabId: chrome.devtools?.inspectedWindow?.tabId
      });
    }
  });

  // Listen for requests from DevTools panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_HISTORY') {
      // Get history from injected script
      window.postMessage({ type: 'PAN_GET_HISTORY' }, '*');

      // Set up listener for response
      const listener = (event) => {
        if (event.data && event.data.type === 'PAN_HISTORY_RESPONSE') {
          window.removeEventListener('message', listener);
          sendResponse(event.data.data);
        }
      };
      window.addEventListener('message', listener);

      return true; // Async response
    }

    if (message.type === 'GET_COMPONENTS') {
      // Get components from injected script
      window.postMessage({ type: 'PAN_GET_COMPONENTS' }, '*');

      // Set up listener for response
      const listener = (event) => {
        if (event.data && event.data.type === 'PAN_COMPONENTS_RESPONSE') {
          window.removeEventListener('message', listener);
          sendResponse(event.data.data);
        }
      };
      window.addEventListener('message', listener);

      return true; // Async response
    }

    if (message.type === 'CLEAR_HISTORY') {
      window.postMessage({ type: 'PAN_CLEAR_HISTORY' }, '*');
      sendResponse({ success: true });
    }

    if (message.type === 'REPLAY_MESSAGE') {
      window.postMessage({
        type: 'PAN_REPLAY_MESSAGE',
        messageId: message.messageId
      }, '*');
      sendResponse({ success: true });
    }
  });

  // Enhanced injected script with response handlers
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;

    const { type } = event.data || {};

    if (type === 'PAN_GET_HISTORY') {
      const history = window.__panDevTools?.getHistory() || [];
      window.postMessage({
        type: 'PAN_HISTORY_RESPONSE',
        data: history
      }, '*');
    }

    if (type === 'PAN_GET_COMPONENTS') {
      const components = window.__panDevTools?.getComponents() || [];
      window.postMessage({
        type: 'PAN_COMPONENTS_RESPONSE',
        data: components
      }, '*');
    }

    if (type === 'PAN_CLEAR_HISTORY') {
      window.__panDevTools?.clearHistory();
    }

    if (type === 'PAN_REPLAY_MESSAGE') {
      window.__panDevTools?.replay(event.data.messageId);
    }
  });

  console.log('[PAN DevTools] Content script loaded');
})();
