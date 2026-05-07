// ===== AUTH =====
const currentUser = JSON.parse(sessionStorage.getItem('user') || 'null');
if (!currentUser || currentUser.role !== 'guru') window.location.href = 'index.html';

// ===== FIREBASE HELPERS (uses globals set by inline module in HTML) =====
function fbSaveTask(task) {
  return window._fbSet(window._fbRef(window._fbDB, `tasks/${task.id}`), task);
}
async function fbDeleteTask(id) {
  await window._fbRemove(window._fbRef(window._fbDB, `tasks/${id}`));
  const snap = await window._fbGet(window._fbRef(window._fbDB, 'submissions'));
  const subs = snap.val() || {};
  await Promise.all(
    Object.entries(subs)
      .filter(([,s]) => s.taskId === id)
      .map(([k]) => window._fbRemove(window._fbRef(window._fbDB, `submissions/${k}`)))
  );
}
function fbSaveSubmission(sub) {
  return window._fbSet(window._fbRef(window._fbDB, `submissions/${sub.id}`), sub);
}
function fbSaveFeedback(fb) {
  return window._fbSet(window._fbRef(window._fbDB, `feedbacks/${fb.subId}`), fb);
}
function fbAddActivity(entry) {
  return window._fbPush(window._fbRef(window._fbDB, 'activityLog'), entry);
}

// ===== STATE =====
// PENTING: Jangan baca dari localStorage untuk tasks/submissions
// karena Firebase adalah sumber kebenaran. localStorage hanya cache.
// Membaca dari localStorage bisa menyebabkan data stale antar device.
let tasks = [];
let submissions = [];
let feedbacks = [];
let activityLog = [];
let currentFeedbackSub = null;

const SUBJ_COLORS = {
  'Matematika':'#6366f1','Bahasa Indonesia':'#10b981','Bahasa Inggris':'#3b82f6',
  'IPA':'#8b5cf6','IPS':'#f59e0b','PKN':'#ef4444',
  'Seni Budaya':'#ec4899','Penjaskes':'#14b8a6','Informatika':'#6366f1'
};

// ===== INIT =====
document.getElementById('guruName').textContent = currentUser.name;
document.getElementById('sidebarName').textContent = currentUser.name;
document.getElementById('profileName').value = currentUser.name;
applyDark();
checkSheetsStatus();

// Load nama terbaru dari Firebase (sync antar device)
function loadUserProfile() {
  if (!window._fbDB) return;
  window._fbOnValue(window._fbRef(window._fbDB, `users/guru_${currentUser.username}`), snap => {
    const data = snap.val();
    if (!data) return;
    if (data.name && data.name !== currentUser.name) {
      currentUser.name = data.name;
      sessionStorage.setItem('user', JSON.stringify(currentUser));
      document.getElementById('guruName').textContent = data.name;
      document.getElementById('sidebarName').textContent = data.name;
      document.getElementById('profileName').value = data.name;
    }
  }, { onlyOnce: false });
}
if (window._fbReady) loadUserProfile();
else document.addEventListener('firebase-ready', loadUserProfile);

// Firebase realtime listeners — data sync otomatis ke semua device
function initFirebaseListeners() {
  // Loading state on first open
  const grid = document.getElementById('recentTasksGrid');
  if (grid && !tasks.length) grid.innerHTML = '<div class="empty-state"><div class="icon" style="font-size:2rem">⏳</div><p>Memuat data...</p></div>';

  window._fbOnValue(window._fbRef(window._fbDB, 'tasks'), snap => {
    const data = snap.val() || {};
    tasks = Object.values(data).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    localStorage.setItem('tasks', JSON.stringify(tasks));
    updateStats(); renderRecentTasks(); renderDeadlineBanner(); populateFilters();
    if (document.getElementById('page-tugas').style.display !== 'none') renderTaskTable();
  });
  window._fbOnValue(window._fbRef(window._fbDB, 'submissions'), snap => {
    const data = snap.val() || {};
    const newSubmissions = Object.values(data).sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Notif guru saat ada pengumpulan baru
    if (submissions.length > 0 && newSubmissions.length > submissions.length) {
      const latest = newSubmissions[0];
      if (latest && Notification.permission === 'granted') {
        try {
          new Notification('📥 Tugas Baru Dikumpulkan!', {
            body: `${latest.studentName} mengumpulkan "${latest.taskTitle}"`,
            tag: 'submission_' + latest.id
          });
        } catch(e) {}
      }
    }

    submissions = newSubmissions;
    localStorage.setItem('submissions', JSON.stringify(submissions));
    updateStats();
    // Always update recent tasks progress on dashboard
    renderRecentTasks();
    if (document.getElementById('page-pengumpulan').style.display !== 'none') { populateSubmissionFilter(); renderSubmissions(); }
    if (document.getElementById('page-statistik').style.display !== 'none') renderStatistik();
    if (document.getElementById('page-tugas').style.display !== 'none') renderTaskTable();
  });
  window._fbOnValue(window._fbRef(window._fbDB, 'feedbacks'), snap => {
    const data = snap.val() || {};
    feedbacks = Object.values(data);
    localStorage.setItem('feedbacks', JSON.stringify(feedbacks));
    if (document.getElementById('page-pengumpulan').style.display !== 'none') renderSubmissions();
  });
  window._fbOnValue(window._fbRef(window._fbDB, 'activityLog'), snap => {
    const data = snap.val() || {};
    activityLog = Object.values(data).sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0,20);
    localStorage.setItem('activityLog', JSON.stringify(activityLog));
    renderActivityFeed();
  });
}

if (window._fbReady) {
  initFirebaseListeners();
  initPresence();
} else {
  document.addEventListener('firebase-ready', () => { initFirebaseListeners(); initPresence(); });
}

startClock();

// Request notif permission untuk guru
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission().then(p => {
    if (p === 'granted') showToast('🔔 Notifikasi aktif!', 'success');
  });
}

// ===== DARK MODE =====
function applyDark() {
  const dark = localStorage.getItem('darkMode') === '1';
  document.body.classList.toggle('dark', dark);
  const ic = document.getElementById('darkIcon');
  if (ic) ic.textContent = dark ? '☀️' : '🌙';
  const icm = document.getElementById('darkIconMobile');
  if (icm) icm.textContent = dark ? '☀️' : '🌙';
}
function toggleDark() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  const ic = document.getElementById('darkIcon');
  if (ic) ic.textContent = isDark ? '☀️' : '🌙';
  // Update mobile topbar icon too
  const icm = document.getElementById('darkIconMobile');
  if (icm) icm.textContent = isDark ? '☀️' : '🌙';
}

// ===== NAVIGATION =====
function showPage(page, el) {
  document.querySelectorAll('[id^="page-"]').forEach(p => p.style.display = 'none');
  const target = document.getElementById('page-' + page);
  target.style.display = 'block';
  target.classList.remove('page'); void target.offsetWidth; target.classList.add('page');
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');
  if (page === 'tugas') renderTaskTable();
  if (page === 'pengumpulan') { populateSubmissionFilter(); renderSubmissions(); }
  if (page === 'statistik') renderStatistik();
  return false;
}

// ===== STATS =====
function getTotalSiswa() {
  // Hitung dari siswa unik yang pernah submit, minimum 1
  const unique = new Set(submissions.map(s => s.studentUsername)).size;
  return Math.max(unique, 1);
}

function updateStats() {
  const total = tasks.length;
  const terkumpul = submissions.length;
  const terlambat = submissions.filter(s => {
    const t = tasks.find(t => t.id === s.taskId);
    return t && new Date(s.submittedAt) > new Date(t.deadline);
  }).length;
  const belum = Math.max(0, total * 3 - terkumpul);
  animateCount('statTotalTugas', total);
  animateCount('statTerkumpul', terkumpul);
  animateCount('statBelum', belum);
  animateCount('statTerlambat', terlambat);
}

function animateCount(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const prev = parseInt(el.textContent) || 0;
  if (prev === val) return;
  let start = prev, step = val > prev ? 1 : -1;
  const iv = setInterval(() => { start += step; el.textContent = start; if (start === val) clearInterval(iv); }, 30);
}

// ===== DEADLINE BANNER =====
function renderDeadlineBanner() {
  const el = document.getElementById('deadlineBanner');
  if (!el) return;
  const now = new Date(), in24h = new Date(now.getTime() + 86400000);
  const urgent = tasks.filter(t => { const d = new Date(t.deadline); return d >= now && d <= in24h; });
  if (!urgent.length) { el.innerHTML = ''; return; }
  el.innerHTML = urgent.map(t => `
    <div class="deadline-banner">
      <div class="banner-icon">⚠️</div>
      <div class="banner-text">
        <strong>Tenggat dalam 24 jam: ${t.title}</strong>
        <span>${t.subject} · ${formatDate(t.deadline)}</span>
      </div>
    </div>`).join('');
}

// ===== ACTIVITY FEED =====
function addActivity(type, text, sub) {
  const entry = { type, text, sub: sub || '', time: new Date().toISOString() };
  fbAddActivity(entry); // Firebase listener will update activityLog + renderActivityFeed
}

function renderActivityFeed() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  if (!activityLog.length) {
    feed.innerHTML = '<div class="empty-state" style="padding:30px 10px"><div class="icon" style="font-size:2rem">📭</div><p>Belum ada aktivitas</p></div>';
    return;
  }
  const icons = { task: '📋', submit: '📥', delete: '🗑️' };
  const colors = { task: 'var(--primary-light)', submit: 'var(--success-light)', delete: 'var(--danger-light)' };
  feed.innerHTML = activityLog.slice(0, 8).map(a => `
    <div class="activity-item">
      <div class="act-icon" style="background:${colors[a.type] || 'var(--bg)'}">${icons[a.type] || '📌'}</div>
      <div class="act-text">
        <div class="act-main">${a.text}</div>
        <div class="act-time">${timeAgo(a.time)}</div>
      </div>
    </div>`).join('');
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
  if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
  return Math.floor(diff / 86400) + ' hari lalu';
}

// ===== TASK CARDS =====
function renderRecentTasks() {
  const grid = document.getElementById('recentTasksGrid');
  const recent = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
  if (!recent.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>Belum ada tugas. Klik "+ Tambah Tugas" untuk mulai.</p></div>';
    return;
  }
  grid.innerHTML = recent.map(t => taskCardHTML(t)).join('');
}

function taskCardHTML(t) {
  const now = new Date(), deadline = new Date(t.deadline);
  const isOverdue = deadline < now;
  const cnt = submissions.filter(s => s.taskId === t.id).length;
  const totalSiswa = getTotalSiswa();
  const pct = Math.min(100, Math.round((cnt / totalSiswa) * 100));
  const daysLeft = Math.ceil((deadline - now) / 86400000);
  const color = SUBJ_COLORS[t.subject] || '#6366f1';
  let chipClass = 'ok', chipText = `📅 ${daysLeft} hari lagi`;
  if (isOverdue) { chipClass = 'urgent'; chipText = '⚠️ Lewat tenggat'; }
  else if (daysLeft === 0) { chipClass = 'warning'; chipText = '🔴 Hari ini!'; }
  else if (daysLeft <= 3) { chipClass = 'warning'; chipText = `⏰ ${daysLeft} hari lagi`; }
  const est = t.estimate ? `<span class="est-chip">⏱ ${t.estimate}</span>` : '';
  return `
    <div class="task-card ${isOverdue ? 'overdue' : ''}" onclick="openTaskDetail('${t.id}')">
      <span class="task-subject" style="color:${color};background:${color}18">${t.subject}</span>
      <h3>${t.title}</h3>
      <p class="task-desc">${t.description.substring(0, 90)}${t.description.length > 90 ? '…' : ''}</p>
      <div class="task-progress">
        <div class="progress-label"><span>${cnt}/${totalSiswa} terkumpul</span><span>${pct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>
      <div class="task-footer">
        <span class="deadline-chip ${chipClass}">${chipText}</span>
        ${est}
      </div>
    </div>`;
}

// ===== TASK DETAIL =====
function openTaskDetail(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  const now = new Date(), deadline = new Date(t.deadline);
  const isOverdue = deadline < now;
  const daysLeft = Math.ceil((deadline - now) / 86400000);
  const cnt = submissions.filter(s => s.taskId === id).length;
  const color = SUBJ_COLORS[t.subject] || '#6366f1';
  const totalSiswa = getTotalSiswa();
  const pct = Math.min(100, Math.round((cnt / totalSiswa) * 100));

  document.getElementById('taskDetailContent').innerHTML = `
    <div class="task-detail-header">
      <div class="task-detail-icon" style="background:${color}20"><span style="font-size:1.6rem">📋</span></div>
      <div style="flex:1">
        <span class="task-subject" style="color:${color};background:${color}18">${t.subject}</span>
        <h2 style="margin-top:8px;font-size:1.2rem;font-weight:800">${t.title}</h2>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:4px">Dibuat oleh ${t.createdBy} · ${formatDate(t.createdAt)}</p>
      </div>
    </div>
    <div class="task-detail-meta">
      <div class="task-detail-row">
        <span class="label">📅 Tenggat</span>
        <span style="font-weight:600;color:${isOverdue ? 'var(--danger)' : 'var(--text)'}">
          ${formatDate(t.deadline)}
          ${isOverdue ? '<span style="color:var(--danger)"> (Sudah lewat)</span>' : daysLeft === 0 ? '<span style="color:var(--warning)"> (Hari ini!)</span>' : `<span style="color:var(--text-muted)"> (${daysLeft} hari lagi)</span>`}
        </span>
      </div>
      ${t.estimate ? `<div class="task-detail-row"><span class="label">⏱ Estimasi</span><span class="est-chip">${t.estimate}</span></div>` : ''}
      <div class="task-detail-row">
        <span class="label">📥 Progress</span>
        <div style="flex:1">
          <div class="progress-label" style="margin-bottom:4px"><span>${cnt}/${totalSiswa} siswa</span><span>${pct}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>
      </div>
      <div class="task-detail-row">
        <span class="label">📊 Status</span>
        ${isOverdue ? '<span class="badge badge-overdue">Lewat Tenggat</span>' : '<span class="badge badge-pending">Aktif</span>'}
      </div>
    </div>
    <p style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Deskripsi Tugas</p>
    <div class="task-detail-desc">${t.description}</div>
    ${cnt > 0 ? `
      <p style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 8px">Siswa yang Sudah Kumpul</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${submissions.filter(s => s.taskId === id).map(s => {
          const fb = feedbacks.find(f => f.subId === s.id);
          return `<div style="background:var(--success-light);color:#065f46;padding:6px 12px;border-radius:20px;font-size:0.8rem;font-weight:600;cursor:pointer" onclick="openFeedbackModal('${s.id}')">
            ✅ ${s.studentName} (${s.studentClass}) ${fb ? '💬' : '+ feedback'}
          </div>`;
        }).join('')}
      </div>` : ''}
  `;
  document.getElementById('detailDeleteBtn').onclick = () => deleteTask(id);
  document.getElementById('taskDetailModal').classList.add('open');
}
// ===== MODAL CLOSE HELPER =====
function closeModalAnimated(id, callback) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('closing');
  setTimeout(() => {
    el.classList.remove('open', 'closing');
    if (callback) callback();
  }, 280);
}

function closeDetailModal() { closeModalAnimated('taskDetailModal'); }
function closeModal() {
  closeModalAnimated('addTaskModal', () => {
    document.getElementById('addTaskModal').querySelector('form').reset();
  });
}
function closeFeedbackModal() {
  closeModalAnimated('feedbackModal', () => { currentFeedbackSub = null; });
}
function renderTaskTable() {
  const search = document.getElementById('searchTugas').value.toLowerCase();
  const mapel = document.getElementById('filterMapel').value;
  const tanggal = document.getElementById('filterTanggal').value;
  const tbody = document.getElementById('taskTableBody');
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86400000);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  let filtered = tasks.filter(t => {
    const d = new Date(t.deadline);
    const matchSearch = t.title.toLowerCase().includes(search) || t.subject.toLowerCase().includes(search);
    const matchMapel = !mapel || t.subject === mapel;
    const matchDate = !tanggal || (tanggal === 'week' && d <= weekEnd) || (tanggal === 'month' && d <= monthEnd);
    return matchSearch && matchMapel && matchDate;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">Tidak ada tugas ditemukan</td></tr>';
    return;
  }
  const totalSiswa = getTotalSiswa();
  tbody.innerHTML = filtered.map(t => {
    const isOverdue = new Date(t.deadline) < now;
    const cnt = submissions.filter(s => s.taskId === t.id).length;
    const pct = Math.min(100, Math.round((cnt / totalSiswa) * 100));
    const color = SUBJ_COLORS[t.subject] || '#6366f1';
    return `
      <tr style="cursor:pointer" onclick="openTaskDetail('${t.id}')">
        <td><strong>${t.title}</strong><br><span style="font-size:0.78rem;color:var(--text-muted)">${t.description.substring(0, 50)}…</span></td>
        <td data-label="Mapel"><span class="badge badge-graded">${t.subject}</span></td>
        <td data-label="Tenggat" style="font-size:0.85rem">${formatDate(t.deadline)}</td>
        <td data-label="Progress">
          <div style="flex:1">
            <div class="progress-label" style="font-size:0.75rem"><span>${cnt}/${totalSiswa}</span><span>${pct}%</span></div>
            <div class="progress-bar" style="margin-top:4px"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
          </div>
        </td>
        <td data-label="Status">${isOverdue ? '<span class="badge badge-overdue">Lewat</span>' : '<span class="badge badge-pending">Aktif</span>'}</td>
        <td data-label="" onclick="event.stopPropagation()"><button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')">🗑️ Hapus</button></td>
      </tr>`;
  }).join('');
}

function populateFilters() {
  const subjects = [...new Set(tasks.map(t => t.subject))];
  const sel = document.getElementById('filterMapel');
  sel.innerHTML = '<option value="">Semua Mapel</option>' + subjects.map(s => `<option>${s}</option>`).join('');
}

// ===== ADD / DELETE TASK =====
function openAddModal() {
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('taskDeadline').min = now.toISOString().slice(0, 16);
  document.getElementById('addTaskModal').classList.add('open');
}
// Remove old individual close functions — replaced by closeModalAnimated above

async function submitTask(e) {
  e.preventDefault();
  const task = {
    id: Date.now().toString(),
    title: document.getElementById('taskTitle').value.trim(),
    subject: document.getElementById('taskSubject').value,
    description: document.getElementById('taskDesc').value.trim(),
    deadline: document.getElementById('taskDeadline').value,
    estimate: document.getElementById('taskEstimate').value,
    createdBy: currentUser.name,
    createdAt: new Date().toISOString()
  };
  await fbSaveTask(task); // Firebase listener auto-updates tasks + UI
  addActivity('task', `Tugas baru: <strong>${task.title}</strong>`, task.subject);
  closeModal();
  showToast('✅ Tugas berhasil ditambahkan!', 'success');
  if (SheetsAPI.isConnected()) {
    const ok = await SheetsAPI.addTask(task);
    showToast(ok ? '🔗 Tersinkron ke Google Sheets' : '⚠️ Gagal sinkron Sheets', ok ? 'success' : 'error');
  }
}
async function deleteTask(id) {
  if (!confirm('Hapus tugas ini?')) return;
  await fbDeleteTask(id); // Firebase listener auto-updates tasks + submissions + UI
  closeDetailModal();
  showToast('🗑️ Tugas dihapus', 'success');
  if (SheetsAPI.isConnected()) await SheetsAPI.deleteTask(id);
}

// ===== SUBMISSIONS =====
function populateSubmissionFilter() {
  const sel = document.getElementById('filterTugasPengumpulan');
  sel.innerHTML = '<option value="">Semua Tugas</option>' + tasks.map(t => `<option value="${t.id}">${t.title}</option>`).join('');
}

function renderSubmissions() {
  const search = document.getElementById('searchPengumpulan').value.toLowerCase();
  const taskFilter = document.getElementById('filterTugasPengumpulan').value;
  const statusFilter = document.getElementById('filterStatusPengumpulan').value;
  const tbody = document.getElementById('submissionTableBody');

  let filtered = submissions.filter(s => {
    const task = tasks.find(t => t.id === s.taskId);
    const matchSearch = s.studentName.toLowerCase().includes(search) || (task && task.title.toLowerCase().includes(search));
    const matchTask = !taskFilter || s.taskId === taskFilter;
    const isLate = task && new Date(s.submittedAt) > new Date(task.deadline);
    const matchStatus = !statusFilter || (statusFilter === 'submitted' && !isLate) || (statusFilter === 'late' && isLate);
    return matchSearch && matchTask && matchStatus;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:40px">Belum ada pengumpulan</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(s => {
    const task = tasks.find(t => t.id === s.taskId);
    const isLate = task && new Date(s.submittedAt) > new Date(task.deadline);
    const fb = feedbacks.find(f => f.subId === s.id);
    const hasFile = s.fileURL || s.fileName;
    return `
      <tr style="cursor:pointer" onclick="openSubmissionDetail('${s.id}')">
        <td><strong>${s.studentName}</strong> <span style="font-size:.78rem;color:var(--text-muted)">${s.studentClass}</span></td>
        <td data-label="Tugas">${task ? task.title : '-'}</td>
        <td data-label="Mapel">${task ? task.subject : '-'}</td>
        <td data-label="Waktu Kumpul" style="font-size:0.85rem">${formatDate(s.submittedAt)}</td>
        <td data-label="Status">${isLate ? '<span class="badge badge-overdue">Terlambat</span>' : '<span class="badge badge-submitted">Tepat Waktu</span>'}</td>
        <td data-label="File">${hasFile ? `<span style="color:var(--primary);font-size:.8rem;font-weight:700">📎 ${s.fileName || 'File'}</span>` : '<span style="color:var(--text-muted);font-size:.8rem">—</span>'}</td>
        <td data-label="Feedback" onclick="event.stopPropagation()">${fb ? `<span class="feedback-chip" onclick="openFeedbackModal('${s.id}')">💬 Edit</span>` : `<span class="feedback-chip" onclick="openFeedbackModal('${s.id}')">+ Feedback</span>`}</td>
      </tr>`;
  }).join('');
}

// ===== SUBMISSION DETAIL =====
function openSubmissionDetail(subId) {
  const s = submissions.find(s => s.id === subId);
  if (!s) return;
  const task = tasks.find(t => t.id === s.taskId);
  const isLate = task && new Date(s.submittedAt) > new Date(task.deadline);
  const fb = feedbacks.find(f => f.subId === s.id);

  document.getElementById('submissionDetailContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
      <div style="width:52px;height:52px;border-radius:14px;background:rgba(99,102,241,.2);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">🎒</div>
      <div>
        <h2 style="font-size:1.15rem;font-weight:800;color:var(--text)">${s.studentName}</h2>
        <p style="font-size:.82rem;color:var(--text-muted)">${s.studentClass} · ${task ? task.subject : '-'}</p>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
      <div class="task-detail-row">
        <span class="label">📋 Tugas</span>
        <span style="font-weight:600">${task ? task.title : s.taskTitle || '-'}</span>
      </div>
      <div class="task-detail-row">
        <span class="label">📅 Tenggat</span>
        <span>${task ? formatDate(task.deadline) : '-'}</span>
      </div>
      <div class="task-detail-row">
        <span class="label">🕐 Dikumpulkan</span>
        <span>${formatDate(s.submittedAt)}</span>
      </div>
      <div class="task-detail-row">
        <span class="label">📊 Status</span>
        <span>${isLate ? '<span class="badge badge-overdue">Terlambat</span>' : '<span class="badge badge-submitted">Tepat Waktu</span>'}</span>
      </div>
      ${s.note ? `
      <div class="task-detail-row" style="align-items:flex-start">
        <span class="label">📝 Catatan</span>
        <span style="flex:1;line-height:1.6">${s.note}</span>
      </div>` : ''}
      ${fb ? `
      <div class="task-detail-row" style="align-items:flex-start">
        <span class="label">💬 Feedback</span>
        <span style="flex:1;color:var(--primary);font-weight:600">${fb.text}</span>
      </div>` : ''}
    </div>

    ${s.fileURL ? `
    <div style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);border-radius:14px;padding:16px;margin-bottom:8px">
      <div style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">📎 File Terlampir</div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.fileName || 'File'}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">Klik tombol untuk membuka</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <a href="${s.fileURL}" target="_blank" rel="noopener"
             style="padding:9px 16px;background:var(--primary);color:#fff;border-radius:10px;font-size:.82rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
            👁️ Buka
          </a>
          <a href="${s.fileURL}" download="${s.fileName || 'file'}"
             style="padding:9px 16px;background:rgba(255,255,255,.1);color:var(--text);border:1px solid var(--border);border-radius:10px;font-size:.82rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
            ⬇️ Download
          </a>
        </div>
      </div>
    </div>` : `
    <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;text-align:center;color:var(--text-muted);font-size:.85rem">
      📭 Tidak ada file yang dilampirkan
    </div>`}
  `;

  document.getElementById('submissionDetailActions').innerHTML = `
    <button class="btn btn-secondary" onclick="closeSubmissionDetail()">Tutup</button>
    <button class="btn btn-primary" onclick="closeSubmissionDetail();openFeedbackModal('${subId}')">
      ${fb ? '✏️ Edit Feedback' : '💬 Beri Feedback'}
    </button>
  `;

  document.getElementById('submissionDetailModal').classList.add('open');
}
function closeSubmissionDetail() { closeModalAnimated('submissionDetailModal'); }

// ===== FEEDBACK =====
function openFeedbackModal(subId) {
  currentFeedbackSub = subId;
  const s = submissions.find(s => s.id === subId);
  const fb = feedbacks.find(f => f.subId === subId);
  if (!s) return;
  document.getElementById('feedbackInfo').innerHTML = `<strong>${s.studentName}</strong> · ${s.taskTitle || '-'}`;
  document.getElementById('feedbackText').value = fb ? fb.text : '';
  document.getElementById('feedbackModal').classList.add('open');
}

function saveFeedback() {
  const text = document.getElementById('feedbackText').value.trim();
  if (!text) { showToast('Tulis feedback dulu', 'error'); return; }
  const fb = { subId: currentFeedbackSub, text, time: new Date().toISOString() };
  fbSaveFeedback(fb); // Firebase listener auto-updates feedbacks
  closeFeedbackModal();
  showToast('💬 Feedback tersimpan!', 'success');
}

// ===== EXPORT CSV =====
function exportCSV() {
  if (!submissions.length) { showToast('Belum ada data untuk diexport', 'error'); return; }
  const headers = ['Nama Siswa', 'Kelas', 'Judul Tugas', 'Mapel', 'Waktu Kumpul', 'Status', 'Catatan'];
  const rows = submissions.map(s => {
    const task = tasks.find(t => t.id === s.taskId);
    const isLate = task && new Date(s.submittedAt) > new Date(task.deadline);
    return [s.studentName, s.studentClass, task ? task.title : s.taskTitle, task ? task.subject : '-',
      formatDate(s.submittedAt), isLate ? 'Terlambat' : 'Tepat Waktu', s.note || ''].map(v => `"${v}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `rekap-pengumpulan-${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.csv`;
  a.click();
  showToast('⬇️ File CSV berhasil didownload!', 'success');
}

// ===== STATISTIK =====
function renderStatistik() {
  const subjectCount = {};
  const subjectSubmit = {};
  tasks.forEach(t => {
    subjectCount[t.subject] = (subjectCount[t.subject] || 0) + 1;
    subjectSubmit[t.subject] = subjectSubmit[t.subject] || 0;
  });
  submissions.forEach(s => {
    const t = tasks.find(t => t.id === s.taskId);
    if (t) subjectSubmit[t.subject] = (subjectSubmit[t.subject] || 0) + 1;
  });

  const maxCount = Math.max(...Object.values(subjectCount), 1);
  const maxSubmit = Math.max(...Object.values(subjectSubmit), 1);
  const colors = ['#6366f1','#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#ec4899','#14b8a6'];

  document.getElementById('subjectStats').innerHTML = Object.entries(subjectCount).map(([subj, cnt], i) => `
    <div class="subject-stat-row">
      <span class="subj-name">${subj}</span>
      <div class="subj-bar-wrap"><div class="subj-bar" style="width:${(cnt/maxCount)*100}%;background:${colors[i%colors.length]}"></div></div>
      <span class="subj-count">${cnt} tugas</span>
    </div>`).join('') || '<p style="color:var(--text-muted);font-size:0.85rem">Belum ada data</p>';

  document.getElementById('submissionStats').innerHTML = Object.entries(subjectSubmit).map(([subj, cnt], i) => `
    <div class="subject-stat-row">
      <span class="subj-name">${subj}</span>
      <div class="subj-bar-wrap"><div class="subj-bar" style="width:${(cnt/maxSubmit)*100}%;background:${colors[i%colors.length]}"></div></div>
      <span class="subj-count">${cnt} kumpul</span>
    </div>`).join('') || '<p style="color:var(--text-muted);font-size:0.85rem">Belum ada data</p>';

  // Top students
  const studentCount = {};
  submissions.forEach(s => { studentCount[s.studentName] = (studentCount[s.studentName] || 0) + 1; });
  const sorted = Object.entries(studentCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  document.getElementById('topStudents').innerHTML = sorted.length
    ? `<div style="display:flex;flex-direction:column;gap:10px">${sorted.map(([name, cnt], i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg);border-radius:10px">
          <span style="font-size:1.3rem">${medals[i]}</span>
          <span style="font-weight:700;flex:1">${name}</span>
          <span class="badge badge-submitted">${cnt} tugas</span>
        </div>`).join('')}</div>`
    : '<p style="color:var(--text-muted);font-size:0.85rem">Belum ada data pengumpulan</p>';
}

// ===== PROFIL =====
async function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  const pass = document.getElementById('profilePass').value;
  const confirm = document.getElementById('profilePassConfirm').value;
  if (!name) { showToast('Nama tidak boleh kosong', 'error'); return; }
  if (pass && pass !== confirm) { showToast('Password tidak cocok', 'error'); return; }

  currentUser.name = name;
  if (pass) currentUser.password = pass;
  sessionStorage.setItem('user', JSON.stringify(currentUser));

  // Simpan ke localStorage (fallback)
  const overrides = JSON.parse(localStorage.getItem('userOverrides') || '{}');
  const key = 'guru_' + currentUser.username;
  overrides[key] = { name, ...(pass ? { password: pass } : {}) };
  localStorage.setItem('userOverrides', JSON.stringify(overrides));

  // Simpan ke Firebase supaya sync ke semua device
  if (window._fbDB) {
    await window._fbSet(window._fbRef(window._fbDB, `users/guru_${currentUser.username}`), {
      name,
      username: currentUser.username,
      role: 'guru',
      updatedAt: new Date().toISOString()
    });
  }

  // Update UI
  document.getElementById('guruName').textContent = name;
  document.getElementById('sidebarName').textContent = name;
  document.getElementById('profilePass').value = '';
  document.getElementById('profilePassConfirm').value = '';
  showToast('✅ Profil berhasil disimpan!', 'success');
}

// ===== GLOBAL SEARCH =====
function globalSearchHandler() {
  const q = document.getElementById('globalSearch').value.toLowerCase().trim();
  const res = document.getElementById('searchResults');
  if (!q) { res.classList.remove('open'); return; }
  const matches = tasks.filter(t => t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)).slice(0, 6);
  if (!matches.length) { res.innerHTML = '<div class="search-result-item"><span class="result-sub">Tidak ada hasil</span></div>'; res.classList.add('open'); return; }
  res.innerHTML = matches.map(t => `
    <div class="search-result-item" onclick="openTaskDetail('${t.id}');closeSearch()">
      <span class="result-icon">📋</span>
      <div><div class="result-title">${t.title}</div><div class="result-sub">${t.subject}</div></div>
    </div>`).join('');
  res.classList.add('open');
}
function closeSearch() { const r = document.getElementById('searchResults'); if (r) r.classList.remove('open'); }

// ===== SHEETS =====
function checkSheetsStatus() { /* auto-connected, no-op */ }

async function testSheetsConnection() {
  const el = document.getElementById('sheetsTestResult');
  if (el) el.innerHTML = '<span style="color:var(--text-muted)">🔄 Menguji koneksi…</span>';
  const ok = await SheetsAPI.ping();
  if (el) el.innerHTML = ok
    ? '<span style="color:var(--success);font-weight:700">✅ Koneksi berhasil! Spreadsheet siap digunakan.</span>'
    : '<span style="color:var(--danger);font-weight:700">❌ Gagal terhubung. Pastikan Apps Script sudah di-deploy.</span>';
}

async function saveSheetUrl() { /* no-op, hardcoded */ }

// ===== EXPORT / IMPORT DATA (sync antar device) =====
function exportData() {
  const data = {
    v: 1,
    tasks: JSON.parse(localStorage.getItem('tasks') || '[]'),
    submissions: JSON.parse(localStorage.getItem('submissions') || '[]'),
    feedbacks: JSON.parse(localStorage.getItem('feedbacks') || '[]'),
    sheetsWebAppUrl: localStorage.getItem('sheetsWebAppUrl') || '',
    sheetsSpreadsheetUrl: localStorage.getItem('sheetsSpreadsheetUrl') || '',
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tugasku-data-${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.json`;
  a.click();
  showToast('📦 Data berhasil diexport!', 'success');
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.v || !data.tasks) { showToast('❌ File tidak valid', 'error'); return; }
      if (!confirm(`Import data dari ${new Date(data.exportedAt).toLocaleString('id-ID')}?\n${data.tasks.length} tugas, ${data.submissions.length} pengumpulan.\n\nData yang ada akan digabung.`)) return;
      // Merge — tidak overwrite, gabungkan
      const existingTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
      const existingIds = new Set(existingTasks.map(t => t.id));
      const newTasks = [...existingTasks, ...data.tasks.filter(t => !existingIds.has(t.id))];
      localStorage.setItem('tasks', JSON.stringify(newTasks));

      const existingSubs = JSON.parse(localStorage.getItem('submissions') || '[]');
      const existingSubIds = new Set(existingSubs.map(s => s.id));
      const newSubs = [...existingSubs, ...data.submissions.filter(s => !existingSubIds.has(s.id))];
      localStorage.setItem('submissions', JSON.stringify(newSubs));

      const existingFbs = JSON.parse(localStorage.getItem('feedbacks') || '[]');
      const existingFbIds = new Set(existingFbs.map(f => f.subId));
      const newFbs = [...existingFbs, ...data.feedbacks.filter(f => !existingFbIds.has(f.subId))];
      localStorage.setItem('feedbacks', JSON.stringify(newFbs));

      if (data.sheetsWebAppUrl) localStorage.setItem('sheetsWebAppUrl', data.sheetsWebAppUrl);
      if (data.sheetsSpreadsheetUrl) localStorage.setItem('sheetsSpreadsheetUrl', data.sheetsSpreadsheetUrl);

      tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
      submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
      feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
      updateStats(); renderRecentTasks(); populateFilters(); checkSheetsStatus();
      showToast('✅ Data berhasil diimport!', 'success');
    } catch(err) {
      showToast('❌ Gagal membaca file', 'error');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ===== CLOCK =====
function startClock() {
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    const el = document.getElementById('clockTime');
    if (el) el.textContent = `${h}:${m}:${s}`;
    const dateEl = document.getElementById('clockDate');
    if (dateEl) dateEl.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
  tick();
  setInterval(tick, 1000);
}

// ===== PRESENCE (online users) =====
function initPresence() {
  if (!window._fbDB) return;
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  const presenceRef = window._fbRef(window._fbDB, `presence/${sessionId}`);
  const userData = {
    name: currentUser.name,
    role: currentUser.role,
    username: currentUser.username,
    joinedAt: new Date().toISOString()
  };
  window._fbSet(presenceRef, userData);
  // Auto-remove on disconnect
  window._fbOnDisconnect(presenceRef).remove();
  // Also remove on page unload
  window.addEventListener('beforeunload', () => window._fbSet(presenceRef, null));

  // Listen to all online users
  window._fbOnValue(window._fbRef(window._fbDB, 'presence'), snap => {
    const data = snap.val() || {};
    const users = Object.values(data);
    const countEl = document.getElementById('onlineCount');
    const avatarsEl = document.getElementById('onlineAvatars');
    if (countEl) countEl.textContent = users.length;
    if (avatarsEl) {
      avatarsEl.innerHTML = users.slice(0, 5).map(u => {
        const emoji = u.role === 'guru' ? '👨‍🏫' : '🎒';
        const isMe = u.username === currentUser.username;
        return `<div class="online-avatar ${isMe ? 'me' : ''}" title="${u.name} (${u.role})">${emoji}</div>`;
      }).join('') + (users.length > 5 ? `<div class="online-avatar-more">+${users.length - 5}</div>` : '');
    }
  });
}

// ===== HELPERS =====
function saveTasks() { localStorage.setItem('tasks', JSON.stringify(tasks)); }
function saveSubmissions() { localStorage.setItem('submissions', JSON.stringify(submissions)); }
function formatDate(d) {
  return new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3500);
}
function logout() { sessionStorage.removeItem('user'); window.location.href = 'index.html'; }

['addTaskModal','taskDetailModal','feedbackModal','submissionDetailModal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function(e) {
    if (e.target === this) closeModalAnimated(id);
  });
});
