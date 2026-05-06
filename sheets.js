/**
 * Google Sheets Integration
 *
 * 2 Sheet:
 * 1. "Tugas"  → otomatis terisi saat guru tambah tugas
 *    Header: id | title | subject | description | deadline | createdBy | createdAt
 *
 * 2. "Status" → status pengumpulan per siswa per tugas
 *    Header: taskId | taskTitle | subject | deadline | studentName | studentClass | status | submittedAt | note
 *
 * Setup:
 * 1. Buat Google Sheet, buat 2 tab: "Tugas" dan "Status"
 * 2. Isi header masing-masing sesuai di atas
 * 3. Buka Ekstensi → Apps Script → paste kode di bawah → Deploy Web App (Anyone)
 * 4. Paste URL Web App + URL Spreadsheet di halaman Pengaturan guru
 */

const SheetsAPI = {
  getWebAppUrl() { return localStorage.getItem('sheetsWebAppUrl') || ''; },
  setWebAppUrl(url) { localStorage.setItem('sheetsWebAppUrl', url); },
  getSpreadsheetUrl() { return localStorage.getItem('sheetsSpreadsheetUrl') || ''; },
  setSpreadsheetUrl(url) { localStorage.setItem('sheetsSpreadsheetUrl', url); },
  isConnected() { return !!this.getWebAppUrl(); },

  openSpreadsheet() {
    const url = this.getSpreadsheetUrl();
    if (url) window.open(url, '_blank');
    else alert('URL Spreadsheet belum diatur. Masukkan di halaman Pengaturan.');
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
    const webUrl = this.getWebAppUrl();
    const spreadUrl = this.getSpreadsheetUrl();
    if (!webUrl) return null;
    const config = btoa(JSON.stringify({ w: webUrl, s: spreadUrl }));
    return window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'siswa.html#cfg=' + config;
  },

  // Load config from URL hash if present (call on page load)
  loadFromHash() {
    const hash = window.location.hash;
    if (!hash.startsWith('#cfg=')) return false;
    try {
      const config = JSON.parse(atob(hash.slice(5)));
      if (config.w) { this.setWebAppUrl(config.w); }
      if (config.s) { this.setSpreadsheetUrl(config.s); }
      // Clean hash from URL without reload
      history.replaceState(null, '', window.location.pathname);
      return true;
    } catch(e) { return false; }
  },

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
