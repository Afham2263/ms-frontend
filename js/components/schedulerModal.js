// js/components/schedulerModal.js
// Announcement Scheduler — UI only (SAFE, BACKWARD-COMPATIBLE)

export class SchedulerModal {
  constructor({ mount = document.body } = {}) {
    this.el = null;
    this.onSave = null;
    this.mount = mount;
  }


  // ✅ SAFE SIGNATURE — works with open() or open({...})
  open(options = {}) {
    if (this.el) return;

    const { scheduledAt = null, onSave = null } = options;
    this.onSave = onSave;

    this.el = document.createElement("div");
    this.el.className = "scheduler-overlay";

    this.el.innerHTML = `
      <div class="scheduler-modal">
        <div class="scheduler-header">
          <h2>Schedule announcement</h2>
          <p>Choose when this announcement should be delivered.</p>
        </div>

        <div class="scheduler-body">
          <div class="scheduler-field">
            <label>Date</label>
            <input type="date" id="scheduleDate" />
          </div>

          <div class="scheduler-field">
            <label>Time</label>
            <input type="time" id="scheduleTime" />
          </div>
        </div>

        <div class="scheduler-footer">
          <span class="scheduler-hint">
            Uses your local timezone
          </span>

          <div class="scheduler-actions">
            <button class="scheduler-cancel" id="cancelSchedule">
              Cancel
            </button>
            <button class="scheduler-confirm" id="confirmSchedule">
              Schedule
            </button>
          </div>
        </div>
      </div>
    `;

    this.mount.appendChild(this.el);

    this.bind(scheduledAt);
  }

  bind(scheduledAt) {
    const dateEl = this.el.querySelector("#scheduleDate");
    const timeEl = this.el.querySelector("#scheduleTime");

    // Block past dates
    const today = new Date().toISOString().split("T")[0];
    dateEl.min = today;

    // Pre-fill only when editing
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      dateEl.value = d.toISOString().split("T")[0];
      timeEl.value = d.toTimeString().slice(0, 5);
    }

    this.el.querySelector("#cancelSchedule").onclick = () => this.close();

    this.el.querySelector("#confirmSchedule").onclick = () => {
      if (!dateEl.value || !timeEl.value) {
        alert("Select date and time");
        return;
      }

      const scheduled = new Date(`${dateEl.value}T${timeEl.value}`);
      const now = new Date();

      if (scheduled <= now) {
        alert("Scheduled time must be in the future");
        return;
      }

      if (typeof this.onSave === "function") {
        this.onSave(scheduled.toISOString());
      }

      this.close();
    };
  }

  close() {
    this.el?.remove();
    this.el = null;
    this.onSave = null;
  }
}
