/**
 * Contact Manager Component
 *
 * Modal dialog for managing contacts.
 * Can be used to select a contact for billing or manage the contact list.
 */

import { PanClient } from '../../../src/core/pan-client.mjs';
import db from '../lib/invoice-db.mjs';

class PanContactManager extends HTMLElement {
  constructor() {
    super();
    this.client = new PanClient(this);
    this.contacts = [];
    this.mode = 'select'; // 'select' or 'manage'
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
    this.subscribeToMessages();
  }

  render() {
    this.innerHTML = `
      <div class="modal-overlay" style="display: none;">
        <div class="modal-dialog">
          <div class="modal-header">
            <h2>📇 Contacts</h2>
            <button class="btn-close" data-action="close">×</button>
          </div>

          <div class="modal-body">
            <!-- Search -->
            <div class="search-box">
              <input
                type="text"
                class="search-input"
                placeholder="Search contacts..."
                data-field="search"
              />
            </div>

            <!-- Contact List -->
            <div class="contact-list">
              <div class="loading-state">Loading contacts...</div>
            </div>

            <!-- Add Contact Form -->
            <div class="add-contact-form" style="display: none;">
              <h3>Add New Contact</h3>
              <div class="form-grid">
                <div class="form-group">
                  <label>Name *</label>
                  <input type="text" data-field="name" required />
                </div>
                <div class="form-group">
                  <label>Company</label>
                  <input type="text" data-field="company" />
                </div>
                <div class="form-group">
                  <label>Email *</label>
                  <input type="email" data-field="email" required />
                </div>
                <div class="form-group">
                  <label>Phone</label>
                  <input type="tel" data-field="phone" />
                </div>
                <div class="form-group">
                  <label>Address</label>
                  <input type="text" data-field="address" />
                </div>
                <div class="form-group">
                  <label>City</label>
                  <input type="text" data-field="city" />
                </div>
              </div>
              <div class="form-actions">
                <button class="btn" data-action="cancel-add">Cancel</button>
                <button class="btn btn-primary" data-action="save-contact">Save Contact</button>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn" data-action="close">Close</button>
            <button class="btn btn-primary" data-action="add">+ Add Contact</button>
          </div>
        </div>
      </div>

      <style>
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-dialog {
          background: white;
          border-radius: 12px;
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h2 {
          font-size: 1.5rem;
          margin: 0;
          color: #333;
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 2rem;
          line-height: 1;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .btn-close:hover {
          background: #f5f5f5;
          color: #333;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .search-box {
          margin-bottom: 1rem;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
        }

        .search-input:focus {
          outline: none;
          border-color: #667eea;
        }

        .contact-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .loading-state {
          text-align: center;
          padding: 2rem;
          color: #666;
        }

        .contact-item {
          padding: 1rem;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .contact-item:hover {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.05);
          transform: translateX(4px);
        }

        .contact-info {
          flex: 1;
        }

        .contact-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 0.25rem;
        }

        .contact-company {
          color: #666;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }

        .contact-email {
          color: #667eea;
          font-size: 0.875rem;
        }

        .contact-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-icon-sm {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.25rem;
          padding: 0.25rem;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .btn-icon-sm:hover {
          opacity: 1;
        }

        .btn-icon-sm.delete {
          color: #dc3545;
        }

        .add-contact-form {
          border-top: 2px solid #e0e0e0;
          padding-top: 1.5rem;
          margin-top: 1rem;
        }

        .add-contact-form h3 {
          margin-bottom: 1rem;
          color: #333;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .form-group label {
          font-size: 0.875rem;
          font-weight: 600;
          color: #666;
        }

        .form-group input {
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
        }

        .form-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          color: #333;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .btn:hover {
          background: #f5f5f5;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-color: transparent;
        }

        .btn-primary:hover {
          opacity: 0.9;
        }

        @media (max-width: 768px) {
          .modal-dialog {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;
  }

  attachEventListeners() {
    // Close modal
    this.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    // Click outside to close
    this.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.hide();
      }
    });

    // Search
    this.querySelector('[data-field="search"]')?.addEventListener('input', (e) => {
      this.filterContacts(e.target.value);
    });

    // Add contact button
    this.querySelector('[data-action="add"]')?.addEventListener('click', () => {
      this.showAddForm();
    });

    // Cancel add
    this.querySelector('[data-action="cancel-add"]')?.addEventListener('click', () => {
      this.hideAddForm();
    });

    // Save contact
    this.querySelector('[data-action="save-contact"]')?.addEventListener('click', () => {
      this.saveNewContact();
    });
  }

  subscribeToMessages() {
    // Show modal
    this.client.subscribe('contacts.manager.show', (msg) => {
      this.mode = msg.data.mode || 'select';
      this.show();
    });

    // Show picker (alias)
    this.client.subscribe('contacts.picker.show', (msg) => {
      this.mode = 'select';
      this.show();
    });
  }

  async show() {
    await this.loadContacts();
    this.querySelector('.modal-overlay').style.display = 'flex';
  }

  hide() {
    this.querySelector('.modal-overlay').style.display = 'none';
    this.hideAddForm();
  }

  async loadContacts() {
    try {
      this.contacts = await db.getAllContacts();
      this.renderContacts();
    } catch (err) {
      this.showError('Failed to load contacts: ' + err.message);
    }
  }

  renderContacts(filtered = null) {
    const list = this.querySelector('.contact-list');
    const contacts = filtered || this.contacts;

    if (contacts.length === 0) {
      list.innerHTML = '<div class="loading-state">No contacts yet. Add your first contact!</div>';
      return;
    }

    list.innerHTML = contacts.map(contact => `
      <div class="contact-item" data-contact-id="${contact.id}">
        <div class="contact-info">
          <div class="contact-name">${this.escapeHtml(contact.name)}</div>
          ${contact.company ? `<div class="contact-company">${this.escapeHtml(contact.company)}</div>` : ''}
          <div class="contact-email">${this.escapeHtml(contact.email)}</div>
        </div>
        <div class="contact-actions">
          <button class="btn-icon-sm delete" data-action="delete" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');

    // Attach event listeners
    list.querySelectorAll('.contact-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('[data-action="delete"]')) {
          const contactId = parseInt(item.dataset.contactId);
          this.selectContact(contactId);
        }
      });
    });

    list.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.contact-item');
        const contactId = parseInt(item.dataset.contactId);
        this.deleteContact(contactId);
      });
    });
  }

  filterContacts(query) {
    if (!query) {
      this.renderContacts();
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = this.contacts.filter(contact =>
      contact.name.toLowerCase().includes(lowerQuery) ||
      contact.email.toLowerCase().includes(lowerQuery) ||
      (contact.company && contact.company.toLowerCase().includes(lowerQuery))
    );

    this.renderContacts(filtered);
  }

  selectContact(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return;

    this.client.publish({
      topic: 'contacts.selected',
      data: { contact }
    });

    this.hide();
  }

  async deleteContact(contactId) {
    if (!confirm('Delete this contact?')) return;

    try {
      await db.deleteContact(contactId);
      await this.loadContacts();
      this.showSuccess('Contact deleted');
    } catch (err) {
      this.showError('Failed to delete contact: ' + err.message);
    }
  }

  showAddForm() {
    this.querySelector('.add-contact-form').style.display = 'block';
    this.querySelector('.contact-list').style.display = 'none';
    this.querySelector('[data-action="add"]').style.display = 'none';
  }

  hideAddForm() {
    this.querySelector('.add-contact-form').style.display = 'none';
    this.querySelector('.contact-list').style.display = 'flex';
    this.querySelector('[data-action="add"]').style.display = 'block';

    // Clear form
    this.querySelectorAll('.add-contact-form input').forEach(input => {
      input.value = '';
    });
  }

  async saveNewContact() {
    const form = this.querySelector('.add-contact-form');
    const contact = {
      name: form.querySelector('[data-field="name"]').value.trim(),
      company: form.querySelector('[data-field="company"]').value.trim(),
      email: form.querySelector('[data-field="email"]').value.trim(),
      phone: form.querySelector('[data-field="phone"]').value.trim(),
      address: form.querySelector('[data-field="address"]').value.trim(),
      city: form.querySelector('[data-field="city"]').value.trim(),
      type: 'client'
    };

    if (!contact.name || !contact.email) {
      alert('Name and email are required');
      return;
    }

    try {
      await db.saveContact(contact);
      await this.loadContacts();
      this.hideAddForm();
      this.showSuccess('Contact saved');
    } catch (err) {
      this.showError('Failed to save contact: ' + err.message);
    }
  }

  showSuccess(message) {
    this.client.publish({
      topic: 'ui.toast.show',
      data: { message, type: 'success', duration: 3000 }
    });
  }

  showError(message) {
    this.client.publish({
      topic: 'ui.toast.show',
      data: { message, type: 'error', duration: 5000 }
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('pan-contact-manager', PanContactManager);

export default PanContactManager;
