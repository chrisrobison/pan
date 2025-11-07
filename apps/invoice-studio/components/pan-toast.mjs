/**
 * Toast Notification Component
 *
 * Shows temporary notification messages.
 */

import { PanClient } from '../../../src/components/pan-client.mjs';

class PanToast extends HTMLElement {
  constructor() {
    super();
    this.client = new PanClient(this);
    this.toasts = [];
  }

  connectedCallback() {
    this.render();
    this.subscribeToMessages();
  }

  render() {
    this.innerHTML = `
      <div class="toast-container"></div>

      <style>
        .toast-container {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          pointer-events: none;
        }

        .toast {
          background: white;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 300px;
          pointer-events: all;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .toast.removing {
          animation: slideOut 0.3s ease-in forwards;
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }

        .toast-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .toast-message {
          flex: 1;
          font-size: 0.875rem;
          color: #333;
        }

        .toast.success {
          border-left: 4px solid #28a745;
        }

        .toast.error {
          border-left: 4px solid #dc3545;
        }

        .toast.info {
          border-left: 4px solid #17a2b8;
        }

        .toast.warning {
          border-left: 4px solid #ffc107;
        }

        @media (max-width: 768px) {
          .toast-container {
            bottom: 1rem;
            right: 1rem;
            left: 1rem;
          }

          .toast {
            min-width: auto;
          }
        }
      </style>
    `;
  }

  subscribeToMessages() {
    this.client.subscribe('ui.toast.show', (msg) => {
      this.showToast(msg.data);
    });
  }

  showToast({ message, type = 'info', duration = 3000 }) {
    const container = this.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    // Remove after duration
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('pan-toast', PanToast);

export default PanToast;
