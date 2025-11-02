import { PanClient } from "./pan-client.mjs";

/**
 * Date picker component with calendar dropdown and date range constraints.
 *
 * This component provides a user-friendly date selection interface with a calendar popup,
 * date formatting options, min/max date constraints, and Pan message bus integration
 * for programmatic control.
 *
 * @class PanDatePicker
 * @extends HTMLElement
 * @fires Publishes to topic: `{topic}.change` when date is selected or cleared
 *
 * @example
 * <pan-date-picker
 *   value="2025-01-15"
 *   format="YYYY-MM-DD"
 *   min="2025-01-01"
 *   max="2025-12-31"
 *   placeholder="Select a date">
 * </pan-date-picker>
 *
 * @example
 * // Programmatic date selection via Pan bus
 * const bus = document.querySelector('pan-bus');
 * bus.publish('datepicker.setValue', { date: '2025-02-14' });
 */
class PanDatePicker extends HTMLElement {
  /**
   * Defines which attributes trigger attributeChangedCallback when modified.
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["value", "format", "min", "max", "topic", "placeholder"];
  }

  /**
   * Initializes the date picker with shadow DOM and default state.
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    /** @type {PanClient} Pan message bus client instance */
    this.pc = new PanClient(this);
    /** @type {boolean} Whether calendar dropdown is open */
    this.isOpen = false;
    /** @type {Date} Currently displayed month in calendar */
    this.currentMonth = /* @__PURE__ */ new Date();
    /** @type {Date|null} Currently selected date */
    this.selectedDate = null;
  }
  /**
   * Called when element is added to the DOM. Initializes date, rendering, and events.
   */
  connectedCallback() {
    if (this.value) {
      this.selectedDate = new Date(this.value);
      this.currentMonth = new Date(this.selectedDate);
    }
    this.render();
    this.setupTopics();
    this.setupEvents();
  }

  /**
   * Called when observed attributes change. Updates date and re-renders.
   * @param {string} name - The attribute name
   * @param {string} oldVal - Previous attribute value
   * @param {string} newVal - New attribute value
   */
  attributeChangedCallback(name, oldVal, newVal) {
    if (name === "value" && newVal && !this.isOpen) {
      this.selectedDate = new Date(newVal);
      this.currentMonth = new Date(this.selectedDate);
    }
    if (this.isConnected) this.render();
  }

  /**
   * Gets the selected date value as ISO date string.
   * @returns {string} ISO date string (YYYY-MM-DD)
   */
  get value() {
    return this.getAttribute("value") || "";
  }

  /**
   * Sets the selected date value.
   * @param {string} val - ISO date string to set
   */
  set value(val) {
    this.setAttribute("value", val);
  }

  /**
   * Gets the date format string.
   * @returns {string} Date format, defaults to "YYYY-MM-DD"
   */
  get format() {
    return this.getAttribute("format") || "YYYY-MM-DD";
  }

  /**
   * Gets the minimum selectable date.
   * @returns {Date|null} Minimum date or null if not set
   */
  get min() {
    return this.getAttribute("min") ? new Date(this.getAttribute("min")) : null;
  }

  /**
   * Gets the maximum selectable date.
   * @returns {Date|null} Maximum date or null if not set
   */
  get max() {
    return this.getAttribute("max") ? new Date(this.getAttribute("max")) : null;
  }

  /**
   * Gets the topic name for Pan message bus events.
   * @returns {string} Topic name, defaults to "datepicker"
   */
  get topic() {
    return this.getAttribute("topic") || "datepicker";
  }

  /**
   * Gets the placeholder text for the input.
   * @returns {string} Placeholder text, defaults to "Select date"
   */
  get placeholder() {
    return this.getAttribute("placeholder") || "Select date";
  }

  /**
   * Sets up Pan message bus topic subscriptions for programmatic date selection.
   */
  setupTopics() {
    this.pc.subscribe(`${this.topic}.setValue`, (msg) => {
      if (msg.data.date) {
        this.selectDate(new Date(msg.data.date));
      }
    });
  }
  /**
   * Sets up event listeners for input, calendar navigation, and outside clicks.
   */
  setupEvents() {
    const input = this.shadowRoot.querySelector(".date-input");
    const calendar = this.shadowRoot.querySelector(".calendar");
    const prevBtn = this.shadowRoot.querySelector(".prev-month");
    const nextBtn = this.shadowRoot.querySelector(".next-month");
    const todayBtn = this.shadowRoot.querySelector(".today-btn");
    const clearBtn = this.shadowRoot.querySelector(".clear-btn");
    if (input) {
      input.addEventListener("click", () => this.toggleCalendar());
      input.addEventListener("focus", () => this.openCalendar());
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", () => this.changeMonth(-1));
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.changeMonth(1));
    }
    if (todayBtn) {
      todayBtn.addEventListener("click", () => this.selectDate(/* @__PURE__ */ new Date()));
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectDate(null);
      });
    }
    this.shadowRoot.querySelectorAll(".day-cell[data-date]").forEach((cell) => {
      cell.addEventListener("click", () => {
        const date = new Date(cell.dataset.date);
        this.selectDate(date);
      });
    });
    this.handleOutsideClick = (e) => {
      if (!this.contains(e.target) && this.isOpen) {
        this.closeCalendar();
      }
    };
    document.addEventListener("click", this.handleOutsideClick);
  }
  disconnectedCallback() {
    document.removeEventListener("click", this.handleOutsideClick);
  }
  toggleCalendar() {
    this.isOpen ? this.closeCalendar() : this.openCalendar();
  }
  openCalendar() {
    this.isOpen = true;
    const calendar = this.shadowRoot.querySelector(".calendar");
    if (calendar) calendar.classList.add("active");
  }
  closeCalendar() {
    this.isOpen = false;
    const calendar = this.shadowRoot.querySelector(".calendar");
    if (calendar) calendar.classList.remove("active");
  }
  changeMonth(delta) {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + delta, 1);
    this.renderCalendar();
  }
  /**
   * Selects a date and closes the calendar. Publishes change event to Pan bus.
   * @param {Date|null} date - The date to select, or null to clear
   * @fires Publishes to topic: `{topic}.change` with selected date
   */
  selectDate(date) {
    this.selectedDate = date;
    if (date) {
      const isoDate = this.toISODate(date);
      this.value = isoDate;
      this.pc.publish({
        topic: `${this.topic}.change`,
        data: {
          date: isoDate,
          formatted: this.formatDate(date)
        }
      });
    } else {
      this.value = "";
      this.pc.publish({
        topic: `${this.topic}.change`,
        data: { date: null, formatted: "" }
      });
    }
    this.closeCalendar();
    this.render();
  }
  toISODate(date) {
    return date.toISOString().split("T")[0];
  }
  formatDate(date) {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return this.format.replace("YYYY", year).replace("MM", month).replace("DD", day).replace("M", date.getMonth() + 1).replace("D", date.getDate());
  }
  isDateDisabled(date) {
    if (this.min && date < this.min) return true;
    if (this.max && date > this.max) return true;
    return false;
  }
  getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }
  getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
  }
  renderCalendar() {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const daysInMonth = this.getDaysInMonth(year, month);
    const firstDay = this.getFirstDayOfMonth(year, month);
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    const calendarGrid = this.shadowRoot.querySelector(".calendar-grid");
    const monthDisplay = this.shadowRoot.querySelector(".month-display");
    if (monthDisplay) {
      monthDisplay.textContent = `${monthNames[month]} ${year}`;
    }
    if (!calendarGrid) return;
    let html = '<div class="weekdays">';
    ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach((day) => {
      html += `<div class="weekday">${day}</div>`;
    });
    html += '</div><div class="days">';
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="day-cell empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isoDate = this.toISODate(date);
      const isSelected = this.selectedDate && this.toISODate(this.selectedDate) === isoDate;
      const isToday = this.toISODate(/* @__PURE__ */ new Date()) === isoDate;
      const isDisabled = this.isDateDisabled(date);
      let classes = "day-cell";
      if (isSelected) classes += " selected";
      if (isToday) classes += " today";
      if (isDisabled) classes += " disabled";
      html += `<div class="${classes}" data-date="${isoDate}">${day}</div>`;
    }
    html += "</div>";
    calendarGrid.innerHTML = html;
    setTimeout(() => {
      this.shadowRoot.querySelectorAll(".day-cell[data-date]").forEach((cell) => {
        cell.addEventListener("click", () => {
          const date = new Date(cell.dataset.date);
          if (!this.isDateDisabled(date)) {
            this.selectDate(date);
          }
        });
      });
    }, 0);
  }
  /**
   * Renders the date picker UI with input field, calendar dropdown, and navigation.
   */
  render() {
    const displayValue = this.selectedDate ? this.formatDate(this.selectedDate) : "";
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          position: relative;
        }

        .date-input-wrapper {
          position: relative;
        }

        .date-input {
          width: 100%;
          padding: 0.625rem 2.5rem 0.625rem 0.75rem;
          border: 1px solid var(--date-border, #e2e8f0);
          border-radius: 0.5rem;
          font-family: inherit;
          font-size: 0.95rem;
          background: var(--date-bg, #ffffff);
          color: var(--date-color, #1e293b);
          cursor: pointer;
          transition: all 0.2s;
        }

        .date-input:focus {
          outline: none;
          border-color: var(--date-focus-border, #6366f1);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .date-input.empty {
          color: var(--date-placeholder-color, #94a3b8);
        }

        .input-icons {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          gap: 0.25rem;
        }

        .icon-btn {
          display: flex;
          align-items: center;
          padding: 0.25rem;
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--date-icon-color, #64748b);
          font-size: 0.875rem;
          transition: color 0.2s;
        }

        .icon-btn:hover {
          color: var(--date-icon-hover, #1e293b);
        }

        .calendar {
          position: absolute;
          top: calc(100% + 0.5rem);
          left: 0;
          background: var(--calendar-bg, #ffffff);
          border: 1px solid var(--calendar-border, #e2e8f0);
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          padding: 1rem;
          z-index: 100;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.2s;
          min-width: 280px;
        }

        .calendar.active {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .month-display {
          font-weight: 600;
          color: var(--calendar-header-color, #1e293b);
        }

        .month-nav {
          display: flex;
          gap: 0.5rem;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          border-radius: 0.375rem;
          cursor: pointer;
          color: var(--calendar-nav-color, #64748b);
          transition: all 0.2s;
        }

        .nav-btn:hover {
          background: var(--calendar-nav-hover, #f1f5f9);
          color: var(--calendar-nav-hover-color, #1e293b);
        }

        .weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.25rem;
          margin-bottom: 0.5rem;
        }

        .weekday {
          text-align: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--calendar-weekday-color, #64748b);
          padding: 0.25rem;
        }

        .days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.25rem;
        }

        .day-cell {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--calendar-day-color, #1e293b);
          transition: all 0.2s;
        }

        .day-cell:not(.empty):not(.disabled):hover {
          background: var(--calendar-day-hover, #f1f5f9);
        }

        .day-cell.empty {
          cursor: default;
        }

        .day-cell.today {
          font-weight: 600;
          color: var(--calendar-today-color, #6366f1);
        }

        .day-cell.selected {
          background: var(--calendar-selected-bg, #6366f1);
          color: white;
          font-weight: 600;
        }

        .day-cell.disabled {
          color: var(--calendar-disabled-color, #cbd5e1);
          cursor: not-allowed;
        }

        .calendar-footer {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--calendar-border, #e2e8f0);
        }

        .footer-btn {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid var(--calendar-border, #e2e8f0);
          background: transparent;
          border-radius: 0.375rem;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.875rem;
          color: var(--calendar-btn-color, #64748b);
          transition: all 0.2s;
        }

        .footer-btn:hover {
          background: var(--calendar-btn-hover, #f1f5f9);
          border-color: var(--calendar-btn-hover-border, #cbd5e1);
        }
      </style>

      <div class="date-input-wrapper">
        <input
          type="text"
          class="date-input ${!displayValue ? "empty" : ""}"
          value="${displayValue}"
          placeholder="${this.placeholder}"
          readonly
        >
        <div class="input-icons">
          ${displayValue ? `<button class="icon-btn clear-btn" title="Clear">\u2715</button>` : ""}
          <span class="icon-btn">\u{1F4C5}</span>
        </div>
      </div>

      <div class="calendar">
        <div class="calendar-header">
          <span class="month-display"></span>
          <div class="month-nav">
            <button class="nav-btn prev-month">\u2039</button>
            <button class="nav-btn next-month">\u203A</button>
          </div>
        </div>
        <div class="calendar-grid"></div>
        <div class="calendar-footer">
          <button class="footer-btn today-btn">Today</button>
        </div>
      </div>
    `;
    this.renderCalendar();
    if (this.isConnected) {
      setTimeout(() => this.setupEvents(), 0);
    }
  }
}
customElements.define("pan-date-picker", PanDatePicker);
var pan_date_picker_default = PanDatePicker;
export {
  PanDatePicker,
  pan_date_picker_default as default
};
//# sourceMappingURL=pan-date-picker.js.map
