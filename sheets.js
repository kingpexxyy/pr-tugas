/**
 * Google Sheets Integration — Auto-connected
 * Web App URL dan Spreadsheet URL sudah di-hardcode.
 * Sheet otomatis dibuat per siswa saat pertama kali kumpul tugas.
 */

const SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwh9xak9ZZGtmJUEdr69nOOMgFpf6vj8jFhdYhL9wcBGlyDWcKA2Jn8imToNK96SyMEaA/exec';
const SHEETS_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1ouPIpyzGLQgyXM9zlDjLe6MWZjE7mBeav7n2ZpDyuEY/edit';

const SheetsAPI = {
  getWebAppUrl() { return SHEETS_WEB_APP_URL; },
  setWebAppUrl(url) { /* hardcoded, no-op */ },
  getSpreadsheetUrl() { return SHEETS_SPREADSHEET_URL; },
  setSpreadsheetUrl(url) { /* hardcoded, no-op */ },
  isConnected() { return true; }, // always connected

  openSpreadsheet() {
    window.open(SHEETS_SPREADSHEET_URL, '_blank');
  },

  // Guru tambah tugas → masuk sheet "Tugas"
  async addTask(task) {
    const url = this.getWebAppUrl();
    if (!url) return false;
    try {
      const params = new URLSearchParams({
        action: 'addTask',
        id: task.id,
        title: task.title,
        subject: task.subject,
        description: task.description,
        deadline: task.deadline,
        createdBy: task.createdBy,
        createdAt: task.createdAt
      });
      const data = await this._fetchJsonp(`${url}?${params}`);
      return data.success;
    } catch (err) {
      console.error('addTask error:', err);
      return false;
    }
  },

  // Guru hapus tugas → hapus dari sheet "Tugas" + baris terkait di "Status"
  async deleteTask(taskId) {
    const url = this.getWebAppUrl();
    if (!url) return false;
    try {
      const data = await this._fetchJsonp(`${url}?action=deleteTask&taskId=${encodeURIComponent(taskId)}`);
      return data.success;
    } catch (err) {
      console.error('deleteTask error:', err);
      return false;
    }
  },

  // Siswa kumpul tugas → update/insert baris di sheet "Status"
  async updateStatus(submission) {
    const url = this.getWebAppUrl();
    if (!url) return false;
    try {
      const params = new URLSearchParams({
        action: 'updateStatus',
        taskId: submission.taskId,
        taskTitle: submission.taskTitle,
        subject: submission.subject,
        deadline: submission.deadline,
        studentName: submission.studentName,
        studentClass: submission.studentClass,
        status: submission.isLate ? 'Terlambat' : 'Sudah Dikumpulkan',
        submittedAt: submission.submittedAt,
        note: submission.note || ''
      });
      const data = await this._fetchJsonp(`${url}?${params}`);
      return data.success;
    } catch (err) {
      console.error('updateStatus error:', err);
      return false;
    }
  },

  // Test koneksi
  async ping() {
    const url = this.getWebAppUrl();
    if (!url) return false;
    try {
      const data = await this._fetchJsonp(`${url}?action=ping`);
      return data.ok === true;
    } catch (err) {
      return false;
    }
  },

  // Generate a shareable config link that encodes the Sheets URLs
  getShareLink() {
    return null; // hardcoded, no need to share
  },

  // Load config from URL hash if present (no-op, hardcoded)
  loadFromHash() { return false; },

  // JSONP helper — bypass CORS untuk Apps Script dari file lokal
  _fetchJsonp(url) {
    return new Promise((resolve, reject) => {
      const cbName = '_sheetsCb_' + Date.now();
      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        delete window[cbName];
        if (document.body.contains(script)) document.body.removeChild(script);
        reject(new Error('Timeout'));
      }, 10000);

      window[cbName] = (data) => {
        clearTimeout(timeout);
        delete window[cbName];
        if (document.body.contains(script)) document.body.removeChild(script);
        resolve(data);
      };

      script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cbName;
      script.onerror = () => {
        clearTimeout(timeout);
        delete window[cbName];
        reject(new Error('Script load error'));
      };
      document.body.appendChild(script);
    });
  }
};

window.SheetsAPI = SheetsAPI;

/**
 * ============================================================
 * COPY KODE INI KE GOOGLE APPS SCRIPT (Kode.gs) — GANTI SEMUA
 * ============================================================
 *
 * function doGet(e) {
 *   const p = e.parameter;
 *   const cb = p.callback;
 *   const ss = SpreadsheetApp.getActiveSpreadsheet();
 *   let result;
 *
 *   if (p.action === 'ping') {
 *     result = { ok: true };
 *   }
 *
 *   else if (p.action === 'addTask') {
 *     const sheet = ss.getSheetByName('Tugas');
 *     sheet.appendRow([p.id, p.title, p.subject, p.description, p.deadline, p.createdBy, p.createdAt]);
 *     result = { success: true };
 *   }
 *
 *   else if (p.action === 'deleteTask') {
 *     // Hapus dari sheet Tugas
 *     const sheetTugas = ss.getSheetByName('Tugas');
 *     const rowsTugas = sheetTugas.getDataRange().getValues();
 *     for (let i = 1; i < rowsTugas.length; i++) {
 *       if (String(rowsTugas[i][0]) === String(p.taskId)) {
 *         sheetTugas.deleteRow(i + 1); break;
 *       }
 *     }
 *     // Hapus baris terkait dari sheet Status
 *     const sheetStatus = ss.getSheetByName('Status');
 *     const rowsStatus = sheetStatus.getDataRange().getValues();
 *     for (let i = rowsStatus.length - 1; i >= 1; i--) {
 *       if (String(rowsStatus[i][0]) === String(p.taskId)) {
 *         sheetStatus.deleteRow(i + 1);
 *       }
 *     }
 *     result = { success: true };
 *   }
 *
 *   else if (p.action === 'updateStatus') {
 *     const sheet = ss.getSheetByName('Status');
 *     const rows = sheet.getDataRange().getValues();
 *     let found = false;
 *     // Cari baris yang sudah ada (taskId + studentName sama) → update
 *     for (let i = 1; i < rows.length; i++) {
 *       if (String(rows[i][0]) === String(p.taskId) && String(rows[i][4]) === String(p.studentName)) {
 *         sheet.getRange(i + 1, 1, 1, 9).setValues([[
 *           p.taskId, p.taskTitle, p.subject, p.deadline,
 *           p.studentName, p.studentClass, p.status, p.submittedAt, p.note
 *         ]]);
 *         found = true; break;
 *       }
 *     }
 *     // Kalau belum ada → tambah baris baru
 *     if (!found) {
 *       sheet.appendRow([
 *         p.taskId, p.taskTitle, p.subject, p.deadline,
 *         p.studentName, p.studentClass, p.status, p.submittedAt, p.note
 *       ]);
 *     }
 *     result = { success: true };
 *   }
 *
 *   else {
 *     result = { error: 'Unknown action' };
 *   }
 *
 *   const output = cb
 *     ? cb + '(' + JSON.stringify(result) + ')'
 *     : JSON.stringify(result);
 *   return ContentService.createTextOutput(output)
 *     .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
 * }
 *
 * ============================================================
 * Sheet "Tugas" header baris 1:
 * id | title | subject | description | deadline | createdBy | createdAt
 *
 * Sheet "Status" header baris 1:
 * taskId | taskTitle | subject | deadline | studentName | studentClass | status | submittedAt | note
 * ============================================================
 */
