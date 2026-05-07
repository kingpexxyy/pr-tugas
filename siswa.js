// ===== AUTH =====
const currentUser = JSON.parse(sessionStorage.getItem('user') || 'null');
if (!currentUser || currentUser.role !== 'siswa') window.location.href = 'index.html';

// ===== FIREBASE HELPERS =====
function fbSaveSubmission(sub) {
  return window._fbSet(window._fbRef(window._fbDB, `submissions/${sub.id}`), sub);
}

// ===== STATE =====
// PENTING: Jangan baca dari localStorage untuk tasks/submissions
// Firebase adalah sumber kebenaran. localStorage hanya cache offline.
let tasks = [];
let submissions = [];
let personalTasks = JSON.parse(localStorage.getItem('personalTasks_' + currentUser.username) || '[]');
let mySubmissions = [];
let pinnedTasks = JSON.parse(localStorage.getItem('pinnedTasks_' + currentUser.username) || '[]');

const SUBJ_COLORS = {
  'Matematika':'#6366f1','Bahasa Indonesia':'#10b981','Bahasa Inggris':'#3b82f6',
  'IPA':'#8b5cf6','IPS':'#f59e0b','PKN':'#ef4444',
  'Seni Budaya':'#ec4899','Penjaskes':'#14b8a6','Informatika':'#6366f1'
};

// ===== INIT =====
document.getElementById('siswaName').textContent = currentUser.name;
document.getElementById('sidebarName').textContent = currentUser.name;
document.getElementById('sidebarClass').textContent = currentUser.class || 'Siswa';
document.getElementById('profileName').value = currentUser.name;
document.getElementById('profileClass').value = currentUser.class || '';
applyDark();

// Load nama terbaru dari Firebase (sync antar device)
function loadUserProfile() {
  if (!window._fbDB) return;
  window._fbOnValue(window._fbRef(window._fbDB, `users/siswa_${currentUser.username}`), snap => {
    const data = snap.val();
    if (!data) return;
    if (data.name && data.name !== currentUser.name) {
      currentUser.name = data.name;
      if (data.class) currentUser.class = data.class;
      sessionStorage.setItem('user', JSON.stringify(currentUser));
      document.getElementById('siswaName').textContent = data.name;
      document.getElementById('sidebarName').textContent = data.name;
      document.getElementById('profileName').value = data.name;
      if (data.class) {
        document.getElementById('sidebarClass').textContent = data.class;
        document.getElementById('profileClass').value = data.class;
      }
    }
  }, { onlyOnce: false });
}
if (window._fbReady) loadUserProfile();
else document.addEventListener('firebase-ready', loadUserProfile);

function initFirebaseListeners() {
  // Show loading indicator
  const grid = document.getElementById('urgentTasksGrid');
  if (grid && !tasks.length) grid.innerHTML = '<div class="empty-state"><div class="icon" style="font-size:2rem">⏳</div><p>Memuat tugas...</p></div>';

  window._fbOnValue(window._fbRef(window._fbDB, 'tasks'), snap => {
    const data = snap.val() || {};
    tasks = Object.values(data).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    localStorage.setItem('tasks', JSON.stringify(tasks));
    updateStats(); renderUrgentTasks(); renderStreak(); populateFilters();
    if (document.getElementById('page-tugas').style.display !== 'none') renderTasks();
    if (document.getElementById('page-kalender').style.display !== 'none') renderCalendar();
    if (document.getElementById('page-jadwalku').style.display !== 'none') renderPersonalTasks();
  });
  window._fbOnValue(window._fbRef(window._fbDB, 'submissions'), snap => {
    const data = snap.val() || {};
    submissions = Object.values(data);
    mySubmissions = submissions.filter(s => s.studentUsername === currentUser.username);
    localStorage.setItem('submissions', JSON.stringify(submissions));
    updateStats(); renderUrgentTasks(); renderStreak();
    if (document.getElementById('page-tugas').style.display !== 'none') renderTasks();
    if (document.getElementById('page-riwayat').style.display !== 'none') renderRiwayat();
  });
  window._fbOnValue(window._fbRef(window._fbDB, 'feedbacks'), snap => {
    const data = snap.val() || {};
    localStorage.setItem('feedbacks', JSON.stringify(Object.values(data)));
    // Re-render task detail if open to show latest feedback
    if (document.getElementById('taskDetailModal').classList.contains('open')) {
      const feedbacks = Object.values(data);
      localStorage.setItem('feedbacks', JSON.stringify(feedbacks));
    }
  });
}

if (window._fbReady) {
  initFirebaseListeners();
  initPresence();
} else {
  document.addEventListener('firebase-ready', () => { initFirebaseListeners(); initPresence(); });
}

startClock();
requestNotifPermission();
startCountdownTimers();

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

// ===== AUTO REFRESH =====
function autoRefresh() {
  tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
  submissions = JSON.parse(localStorage.getItem('submissions') || '[]');
  mySubmissions = submissions.filter(s => s.studentUsername === currentUser.username);
  updateStats(); renderUrgentTasks(); renderStreak();
  if (document.getElementById('page-riwayat').style.display !== 'none') { renderRiwayat(); updateRefreshTime(); }
  if (document.getElementById('page-tugas').style.display !== 'none') renderTasks();
  checkDeadlineNotifs();
}
function updateRefreshTime() {
  const el = document.getElementById('lastRefreshText');
  if (el) el.textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

// ===== NAVIGATION =====
function showPage(page, el) {
  document.querySelectorAll('[id^="page-"]').forEach(p => p.style.display = 'none');
  const target = document.getElementById('page-' + page);
  target.style.display = 'block';
  target.classList.remove('page'); void target.offsetWidth; target.classList.add('page');
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');
  if (page === 'tugas') { populateFilters(); renderTasks(); }
  if (page === 'jadwalku') renderPersonalTasks();
  if (page === 'kalender') renderCalendar();
  if (page === 'riwayat') { renderRiwayat(); updateRefreshTime(); }
  return false;
}

// ===== STATS =====
function updateStats() {
  const now = new Date();
  const submittedIds = mySubmissions.map(s => s.taskId);
  animateCount('statTotal', tasks.length);
  animateCount('statSudah', submittedIds.length);
  animateCount('statJadwal', personalTasks.filter(t => !t.done).length);
  animateCount('statTerlambat', tasks.filter(t => !submittedIds.includes(t.id) && new Date(t.deadline) < now).length);
}
function animateCount(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const prev = parseInt(el.textContent) || 0;
  if (prev === val) return;
  let start = prev, step = val > prev ? 1 : -1;
  const iv = setInterval(() => { start += step; el.textContent = start; if (start === val) clearInterval(iv); }, 30);
}

// ===== STREAK =====
function renderStreak() {
  const sorted = [...mySubmissions].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  let streak = 0, lastDate = null;
  for (const s of sorted) {
    const task = tasks.find(t => t.id === s.taskId);
    if (!task) continue;
    const onTime = new Date(s.submittedAt) <= new Date(task.deadline);
    if (!onTime) break;
    const d = new Date(s.submittedAt).toDateString();
    if (!lastDate || lastDate === d) { if (!lastDate) streak++; lastDate = d; }
    else { const diff = (new Date(lastDate) - new Date(d)) / 86400000; if (diff <= 1) { streak++; lastDate = d; } else break; }
  }
  const el = document.getElementById('streakNum');
  const sub = document.getElementById('streakSub');
  if (el) el.textContent = streak;
  if (sub) sub.textContent = streak > 0 ? 'Pertahankan terus!' : 'Kumpulkan tepat waktu untuk mulai streak';
}

// ===== NOTIFIKASI BROWSER =====
function requestNotifPermission() {
  if (!('Notification' in window)) return;
  const banner = document.getElementById('notifBanner');

  if (Notification.permission === 'granted') {
    if (banner) banner.innerHTML = '';
    checkDeadlineNotifs();
    return;
  }

  if (Notification.permission === 'denied') {
    if (banner) banner.innerHTML = '';
    return;
  }

  // Auto-request langsung tanpa perlu klik banner
  Notification.requestPermission().then(p => {
    if (banner) banner.innerHTML = '';
    if (p === 'granted') {
      showToast('🔔 Notifikasi aktif!', 'success');
      checkDeadlineNotifs();
      scheduleNotifications();
    }
  });
}

function enableNotif() {
  Notification.requestPermission().then(p => {
    const banner = document.getElementById('notifBanner');
    if (banner) banner.innerHTML = '';
    if (p === 'granted') {
      showToast('🔔 Notifikasi aktif!', 'success');
      checkDeadlineNotifs();
      scheduleNotifications();
    }
  });
}

function sendNotif(title, body, tag) {
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: 'https://pr-tugas-l98j.vercel.app/favicon.ico',
      badge: 'https://pr-tugas-l98j.vercel.app/favicon.ico',
      tag: tag || 'tugasku',
      renotify: true,
      vibrate: [200, 100, 200]
    });
  } catch(e) {
    // Fallback tanpa options yang tidak didukung
    new Notification(title, { body });
  }
}

function checkDeadlineNotifs() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const submittedIds = mySubmissions.map(s => s.taskId);
  const notified = JSON.parse(localStorage.getItem('notified_' + currentUser.username) || '{}');

  tasks.forEach(t => {
    if (submittedIds.includes(t.id)) return;
    const d = new Date(t.deadline);
    if (d < now) return; // sudah lewat

    const diffMs = d - now;
    const diffH = diffMs / 3600000;

    // Notif 24 jam sebelum
    if (diffH <= 24 && diffH > 23 && !notified[t.id + '_24h']) {
      sendNotif('📅 Tenggat Besok!', `${t.title} · ${t.subject} — tenggat besok!`, t.id + '_24h');
      notified[t.id + '_24h'] = true;
    }
    // Notif 3 jam sebelum
    if (diffH <= 3 && diffH > 2.5 && !notified[t.id + '_3h']) {
      sendNotif('⚠️ Tenggat 3 Jam Lagi!', `${t.title} · ${t.subject} — segera kumpulkan!`, t.id + '_3h');
      notified[t.id + '_3h'] = true;
    }
    // Notif 1 jam sebelum
    if (diffH <= 1 && diffH > 0.8 && !notified[t.id + '_1h']) {
      sendNotif('🚨 Tenggat 1 Jam Lagi!', `${t.title} · ${t.subject} — jangan sampai terlambat!`, t.id + '_1h');
      notified[t.id + '_1h'] = true;
    }
  });

  localStorage.setItem('notified_' + currentUser.username, JSON.stringify(notified));
}

// Jadwalkan pengecekan notif setiap 5 menit
function scheduleNotifications() {
  checkDeadlineNotifs();
  setInterval(checkDeadlineNotifs, 5 * 60 * 1000);
}

// ===== COUNTDOWN TIMERS =====
function startCountdownTimers() {
  setInterval(() => {
    document.querySelectorAll('[data-countdown]').forEach(el => {
      const deadline = new Date(el.dataset.countdown);
      const diff = deadline - new Date();
      if (diff <= 0) { el.textContent = 'Lewat tenggat!'; return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = h > 0 ? `${h}j ${m}m lagi` : `${m}m ${s}d lagi`;
    });
  }, 1000);
}

// ===== URGENT TASKS =====
function renderUrgentTasks() {
  const grid = document.getElementById('urgentTasksGrid');
  const now = new Date(), in48h = new Date(now.getTime() + 172800000);
  const submittedIds = mySubmissions.map(s => s.taskId);
  const urgentGuru = tasks.filter(t => !submittedIds.includes(t.id) && new Date(t.deadline) <= in48h && new Date(t.deadline) >= now).map(t => ({ ...t, _type: 'guru' }));
  const urgentPersonal = personalTasks.filter(t => !t.done && new Date(t.deadline) <= in48h && new Date(t.deadline) >= now).map(t => ({ ...t, _type: 'personal' }));
  const all = [...urgentGuru, ...urgentPersonal].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  if (!all.length) { grid.innerHTML = '<div class="empty-state"><div class="icon">🎉</div><p>Tidak ada tugas mendesak dalam 48 jam!</p></div>'; return; }
  grid.innerHTML = all.map(t => t._type === 'guru' ? taskCardHTML(t, false) : personalCardHTML(t)).join('');
}

// ===== TUGAS GURU =====
function renderTasks() {
  const search = document.getElementById('searchTugas').value.toLowerCase();
  const mapel = document.getElementById('filterMapel').value;
  const status = document.getElementById('filterStatus').value;
  const grid = document.getElementById('allTasksGrid');
  const now = new Date();
  const submittedIds = mySubmissions.map(s => s.taskId);

  let filtered = tasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(search) || t.subject.toLowerCase().includes(search);
    const matchMapel = !mapel || t.subject === mapel;
    const isSubmitted = submittedIds.includes(t.id);
    const isOverdue = !isSubmitted && new Date(t.deadline) < now;
    const matchStatus = !status || (status === 'submitted' && isSubmitted) || (status === 'pending' && !isSubmitted && !isOverdue) || (status === 'overdue' && isOverdue);
    return matchSearch && matchMapel && matchStatus;
  }).sort((a, b) => {
    const aPinned = pinnedTasks.includes(a.id), bPinned = pinnedTasks.includes(b.id);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  if (!filtered.length) { grid.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>Tidak ada tugas ditemukan</p></div>'; return; }
  grid.innerHTML = filtered.map(t => taskCardHTML(t, submittedIds.includes(t.id))).join('');
}

function taskCardHTML(task, isSubmitted) {
  const now = new Date(), deadline = new Date(task.deadline);
  const isOverdue = !isSubmitted && deadline < now;
  const daysLeft = Math.ceil((deadline - now) / 86400000);
  const isPinned = pinnedTasks.includes(task.id);
  const color = SUBJ_COLORS[task.subject] || '#6366f1';
  const diff = deadline - now;
  const showCountdown = !isSubmitted && !isOverdue && diff < 86400000;

  let chipClass = 'ok', chipText = `📅 ${daysLeft} hari lagi`, cardClass = '';
  if (isSubmitted) { chipClass = 'ok'; chipText = '✅ Terkumpul'; cardClass = 'submitted'; }
  else if (isOverdue) { chipClass = 'urgent'; chipText = '⚠️ Lewat tenggat!'; cardClass = 'overdue'; }
  else if (daysLeft === 0) { chipClass = 'warning'; chipText = '🔴 Hari ini!'; }
  else if (daysLeft <= 3) { chipClass = 'warning'; chipText = `⏰ ${daysLeft} hari lagi`; }

  const est = task.estimate ? `<span class="est-chip">⏱ ${task.estimate}</span>` : '';
  const countdown = showCountdown ? `<span class="live-countdown" data-countdown="${task.deadline}">…</span>` : '';

  return `
    <div class="task-card ${cardClass} ${isPinned ? 'pinned' : ''}" onclick="openTaskDetail('${task.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <span class="task-subject" style="color:${color};background:${color}18">${task.subject}</span>
        <button class="pin-btn" onclick="event.stopPropagation();togglePin('${task.id}')" title="${isPinned ? 'Unpin' : 'Pin tugas ini'}">
          ${isPinned ? '📌' : '📍'}
        </button>
      </div>
      <h3>${task.title}</h3>
      <p class="task-desc">${task.description.substring(0, 90)}${task.description.length > 90 ? '…' : ''}</p>
      <div class="task-footer">
        <span class="deadline-chip ${chipClass}">${chipText}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${countdown}
          ${est}
          ${!isSubmitted ? `<button class="btn ${isOverdue ? 'btn-danger' : 'btn-primary'} btn-sm" onclick="event.stopPropagation();openSubmitModal('${task.id}')">📤 Kumpulkan</button>` : ''}
        </div>
      </div>
    </div>`;
}

function togglePin(id) {
  const idx = pinnedTasks.indexOf(id);
  if (idx >= 0) pinnedTasks.splice(idx, 1); else pinnedTasks.push(id);
  localStorage.setItem('pinnedTasks_' + currentUser.username, JSON.stringify(pinnedTasks));
  renderTasks();
  showToast(pinnedTasks.includes(id) ? '📌 Tugas dipinned!' : '📍 Pin dilepas', '');
}

function populateFilters() {
  const subjects = [...new Set(tasks.map(t => t.subject))];
  const sel = document.getElementById('filterMapel');
  if (sel) sel.innerHTML = '<option value="">Semua Mapel</option>' + subjects.map(s => `<option>${s}</option>`).join('');
}

// ===== GLOBAL SEARCH =====
function globalSearchHandler() {
  const q = document.getElementById('globalSearch').value.toLowerCase().trim();
  const res = document.getElementById('searchResults');
  if (!q) { res.classList.remove('open'); return; }
  const submittedIds = mySubmissions.map(s => s.taskId);
  const matches = [
    ...tasks.filter(t => t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)).map(t => ({ ...t, _src: 'guru' })),
    ...personalTasks.filter(t => t.title.toLowerCase().includes(q)).map(t => ({ ...t, _src: 'personal' }))
  ].slice(0, 6);
  if (!matches.length) { res.innerHTML = '<div class="search-result-item"><span class="result-sub">Tidak ada hasil</span></div>'; res.classList.add('open'); return; }
  res.innerHTML = matches.map(t => `
    <div class="search-result-item" onclick="${t._src === 'guru' ? `openTaskDetail('${t.id}')` : `openPersonalDetail('${t.id}')`};closeSearch()">
      <span class="result-icon">${t._src === 'guru' ? '📋' : '📝'}</span>
      <div>
        <div class="result-title">${t.title}</div>
        <div class="result-sub">${t.subject} · ${t._src === 'guru' ? (submittedIds.includes(t.id) ? '✅ Terkumpul' : '⏳ Belum') : (t.done ? '✅ Selesai' : '⏳ Belum')}</div>
      </div>
    </div>`).join('');
  res.classList.add('open');
}
function closeSearch() { const r = document.getElementById('searchResults'); if (r) r.classList.remove('open'); }

// ===== TASK DETAIL =====
function openTaskDetail(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  const now = new Date(), deadline = new Date(t.deadline);
  const isOverdue = deadline < now;
  const daysLeft = Math.ceil((deadline - now) / 86400000);
  const isSubmitted = mySubmissions.some(s => s.taskId === id);
  const mySub = mySubmissions.find(s => s.taskId === id);
  const color = SUBJ_COLORS[t.subject] || '#6366f1';
  const feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
  const fb = mySub ? feedbacks.find(f => f.subId === mySub.id) : null;

  document.getElementById('taskDetailContent').innerHTML = `
    <div class="task-detail-header">
      <div class="task-detail-icon" style="background:${color}20"><span style="font-size:1.6rem">📋</span></div>
      <div style="flex:1">
        <span class="task-subject" style="color:${color};background:${color}18">${t.subject}</span>
        <h2 style="margin-top:8px;font-size:1.2rem;font-weight:800">${t.title}</h2>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:4px">Dari ${t.createdBy}</p>
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
        <span class="label">📊 Status</span>
        ${isSubmitted ? `<span class="badge badge-submitted">✅ Sudah Dikumpulkan${mySub && mySub.isLate ? ' (Terlambat)' : ''}</span>` : isOverdue ? '<span class="badge badge-overdue">⚠️ Belum (Lewat Tenggat)</span>' : '<span class="badge badge-pending">⏳ Belum Dikumpulkan</span>'}
      </div>
      ${isSubmitted && mySub ? `
        <div class="task-detail-row"><span class="label">🕐 Dikumpulkan</span><span>${formatDate(mySub.submittedAt)}</span></div>
        ${mySub.note ? `<div class="task-detail-row"><span class="label">📝 Catatanmu</span><span>${mySub.note}</span></div>` : ''}
        ${fb ? `<div class="task-detail-row"><span class="label">💬 Feedback Guru</span><span style="color:var(--primary);font-weight:600">${fb.text}</span></div>` : ''}
      ` : ''}
    </div>
    <p style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Deskripsi Tugas</p>
    <div class="task-detail-desc">${t.description}</div>
  `;

  const actions = document.getElementById('taskDetailActions');
  actions.innerHTML = `<button class="btn btn-secondary" onclick="closeTaskDetail()">Tutup</button>`;
  if (!isSubmitted) {
    actions.innerHTML += `<button class="btn ${isOverdue ? 'btn-danger' : 'btn-primary'}" onclick="closeTaskDetail();openSubmitModal('${id}')">
      ${isOverdue ? '⚠️ Kumpulkan (Terlambat)' : '📤 Kumpulkan Tugas'}
    </button>`;
  }
  document.getElementById('taskDetailModal').classList.add('open');
}
function closeTaskDetail() { closeModalAnimated('taskDetailModal'); }

// ===== SUBMIT =====
let selectedFile = null;
function openSubmitModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  document.getElementById('submitTaskId').value = taskId;
  document.getElementById('submitNote').value = '';
  document.getElementById('fileLabel').textContent = 'Klik untuk pilih file';
  selectedFile = null;
  const isOverdue = new Date(task.deadline) < new Date();
  const daysLeft = Math.ceil((new Date(task.deadline) - new Date()) / 86400000);
  document.getElementById('modalTaskInfo').innerHTML = `
    <div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:16px;border-left:3px solid var(--primary)">
      <div style="font-weight:700;font-size:0.95rem">${task.title}</div>
      <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px">
        📚 ${task.subject} &nbsp;·&nbsp; 📅 ${formatDate(task.deadline)}
        ${isOverdue ? '<br><span style="color:var(--danger);font-weight:600">⚠️ Kamu mengumpulkan setelah tenggat!</span>' : daysLeft === 0 ? '<br><span style="color:var(--warning);font-weight:600">🔴 Tenggat hari ini!</span>' : ''}
      </div>
    </div>`;
  document.getElementById('submitModal').classList.add('open');
}
function closeSubmitModal() { closeModalAnimated('submitModal'); }
function handleFileSelect(input) {
  if (input.files[0]) { selectedFile = input.files[0]; document.getElementById('fileLabel').textContent = `📄 ${selectedFile.name}`; }
}
async function submitHomework(e) {
  e.preventDefault();
  const taskId = document.getElementById('submitTaskId').value;
  const note = document.getElementById('submitNote').value.trim();
  const task = tasks.find(t => t.id === taskId);
  if (mySubmissions.find(s => s.taskId === taskId)) { showToast('Kamu sudah mengumpulkan tugas ini!', 'error'); return; }

  const submitBtn = document.querySelector('#submitModal .btn-primary');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Mengupload...'; }

  let fileURL = null;
  let fileName = null;

  // Upload file ke Firebase Storage jika ada
  if (selectedFile && window._fbStorage) {
    try {
      showToast('📤 Mengupload file...', 'warning');
      const filePath = `submissions/${currentUser.username}/${taskId}_${Date.now()}_${selectedFile.name}`;
      const storageRef = window._fbStorageRef(window._fbStorage, filePath);
      const uploadTask = window._fbUpload(storageRef, selectedFile);

      fileURL = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Upload timeout')), 30000);
        uploadTask.on('state_changed',
          snapshot => {
            const pct = Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100);
            if (submitBtn) submitBtn.textContent = `⏳ Upload ${pct}%...`;
          },
          err => { clearTimeout(timeout); reject(err); },
          async () => {
            clearTimeout(timeout);
            try {
              const url = await window._fbGetDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch(e) { reject(e); }
          }
        );
      });
      fileName = selectedFile.name;
      showToast('✅ File terupload!', 'success');
    } catch(err) {
      console.error('Upload error:', err);
      // Tetap kumpulkan tanpa file
      fileName = selectedFile ? selectedFile.name : null;
      fileURL = null;
      showToast('⚠️ File gagal diupload, tugas tetap dikumpulkan', 'warning');
    }
  } else if (selectedFile) {
    // Storage tidak tersedia, simpan nama file saja
    fileName = selectedFile.name;
  }

  const isLate = task && new Date() > new Date(task.deadline);
  const submission = {
    id: Date.now().toString(), taskId,
    studentUsername: currentUser.username, studentName: currentUser.name,
    studentClass: currentUser.class || '-', taskTitle: task ? task.title : taskId,
    subject: task ? task.subject : '-', deadline: task ? task.deadline : '',
    note,
    fileName: fileName,
    fileURL: fileURL,
    isLate, source: 'web', submittedAt: new Date().toISOString()
  };

  await fbSaveSubmission(submission);
  closeSubmitModal();
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Kumpulkan Sekarang'; }
  showToast('✅ Tugas berhasil dikumpulkan!', 'success');
  if (SheetsAPI.isConnected()) await SheetsAPI.updateStatus(submission);
}

// ===== TUGAS PRIBADI =====
function renderPersonalTasks() {
  const grid = document.getElementById('personalTasksGrid');
  const sorted = [...personalTasks].sort((a, b) => { if (a.done !== b.done) return a.done ? 1 : -1; return new Date(a.deadline) - new Date(b.deadline); });
  if (!sorted.length) { grid.innerHTML = '<div class="empty-state"><div class="icon">📓</div><p>Belum ada tugas pribadi.</p></div>'; return; }
  grid.innerHTML = sorted.map(t => personalCardHTML(t)).join('');
}

function personalCardHTML(t) {
  const now = new Date(), deadline = new Date(t.deadline);
  const isOverdue = !t.done && deadline < now;
  const daysLeft = Math.ceil((deadline - now) / 86400000);
  let chipClass = '', chipText = `📅 ${daysLeft} hari lagi`, cardClass = '';
  if (t.done) { chipClass = 'ok'; chipText = '✅ Selesai'; cardClass = 'submitted'; }
  else if (isOverdue) { chipClass = 'urgent'; chipText = '⚠️ Lewat!'; cardClass = 'overdue'; }
  else if (daysLeft === 0) { chipClass = 'warning'; chipText = '🔴 Hari ini!'; }
  return `
    <div class="task-card ${cardClass}" style="border-top-color:#8b5cf6" onclick="openPersonalDetail('${t.id}')">
      <span class="task-subject" style="color:#7c3aed;background:#ede9fe">${t.subject} · Pribadi</span>
      <h3>${t.title}</h3>
      <p class="task-desc">${(t.description || 'Tidak ada catatan').substring(0, 90)}</p>
      <div class="task-footer">
        <span class="deadline-chip ${chipClass}">${chipText}</span>
        ${!t.done ? `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();markDone('${t.id}')">✅ Tandai Selesai</button>` : ''}
      </div>
    </div>`;
}

function openPersonalDetail(id) {
  const t = personalTasks.find(t => t.id === id);
  if (!t) return;
  const now = new Date(), deadline = new Date(t.deadline);
  const isOverdue = !t.done && deadline < now;
  const daysLeft = Math.ceil((deadline - now) / 86400000);
  document.getElementById('personalDetailContent').innerHTML = `
    <div class="task-detail-header">
      <div class="task-detail-icon" style="background:#ede9fe"><span style="font-size:1.6rem">📝</span></div>
      <div style="flex:1">
        <span class="task-subject" style="color:#7c3aed;background:#ede9fe">${t.subject} · Pribadi</span>
        <h2 style="margin-top:8px;font-size:1.2rem;font-weight:800">${t.title}</h2>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:4px">Ditambahkan ${formatDate(t.createdAt)}</p>
      </div>
    </div>
    <div class="task-detail-meta">
      <div class="task-detail-row">
        <span class="label">📅 Tenggat</span>
        <span style="font-weight:600;color:${isOverdue ? 'var(--danger)' : 'var(--text)'}">
          ${formatDate(t.deadline)}
          ${t.done ? '<span style="color:var(--success)"> (Selesai)</span>' : isOverdue ? '<span style="color:var(--danger)"> (Lewat)</span>' : daysLeft === 0 ? '<span style="color:var(--warning)"> (Hari ini!)</span>' : `<span style="color:var(--text-muted)"> (${daysLeft} hari lagi)</span>`}
        </span>
      </div>
      <div class="task-detail-row">
        <span class="label">📊 Status</span>
        ${t.done ? `<span class="badge badge-submitted">✅ Selesai · ${formatDate(t.doneAt)}</span>` : isOverdue ? '<span class="badge badge-overdue">⚠️ Belum Selesai (Lewat)</span>' : '<span class="badge badge-pending">⏳ Belum Selesai</span>'}
      </div>
    </div>
    ${t.description ? `<p style="font-size:0.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Catatan</p><div class="task-detail-desc" style="border-left-color:#8b5cf6">${t.description}</div>` : ''}
  `;
  document.getElementById('personalDetailActions').innerHTML = `
    <button class="btn btn-secondary" onclick="closePersonalDetail()">Tutup</button>
    <button class="btn btn-danger btn-sm" onclick="deletePersonalTask('${id}');closePersonalDetail()">🗑️ Hapus</button>
    ${!t.done ? `<button class="btn btn-success" onclick="markDone('${id}');closePersonalDetail()">✅ Tandai Selesai</button>` : ''}
  `;
  document.getElementById('personalDetailModal').classList.add('open');
}
function closePersonalDetail() { closeModalAnimated('personalDetailModal'); }

function openAddPersonalModal() {
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('personalDeadline').min = now.toISOString().slice(0, 16);
  document.getElementById('addPersonalModal').classList.add('open');
}
function closePersonalModal() {
  closeModalAnimated('addPersonalModal', () => {
    document.getElementById('addPersonalModal').querySelector('form').reset();
  });
}

function submitPersonalTask(e) {
  e.preventDefault();
  const task = { id: Date.now().toString(), title: document.getElementById('personalTitle').value.trim(), subject: document.getElementById('personalSubject').value, description: document.getElementById('personalDesc').value.trim(), deadline: document.getElementById('personalDeadline').value, done: false, createdAt: new Date().toISOString() };
  personalTasks.unshift(task); savePersonalTasks(); closePersonalModal(); renderPersonalTasks(); updateStats();
  showToast('📝 Tugas pribadi ditambahkan!', 'success');
}

async function markDone(id) {
  const task = personalTasks.find(t => t.id === id);
  if (!task || task.done) return;
  task.done = true; task.doneAt = new Date().toISOString();
  savePersonalTasks(); renderPersonalTasks(); updateStats(); renderStreak();
  showToast('✅ Tugas ditandai selesai!', 'success');
  if (SheetsAPI.isConnected()) {
    await SheetsAPI.updateStatus({ taskId: 'personal_' + task.id, taskTitle: task.title, subject: task.subject, deadline: task.deadline, studentName: currentUser.name, studentClass: currentUser.class || '-', status: new Date(task.doneAt) > new Date(task.deadline) ? 'Terlambat' : 'Selesai', submittedAt: task.doneAt, note: task.description || '', isLate: new Date(task.doneAt) > new Date(task.deadline) });
  }
}
function deletePersonalTask(id) {
  personalTasks = personalTasks.filter(t => t.id !== id); savePersonalTasks(); renderPersonalTasks(); updateStats();
  showToast('🗑️ Tugas dihapus', '');
}

// ===== KALENDER =====
function renderCalendar() {
  const stored = localStorage.getItem('calMonth');
  const calRef = stored ? new Date(stored) : new Date();
  renderCalendarMonth(calRef);
}

function renderCalendarMonth(calRef) {
  localStorage.setItem('calMonth', calRef.toISOString());
  const year = calRef.getFullYear(), month = calRef.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const submittedIds = mySubmissions.map(s => s.taskId);

  const taskDays = {};
  [...tasks, ...personalTasks].forEach(t => {
    const d = new Date(t.deadline);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      const isOverdue = !submittedIds.includes(t.id) && !t.done && d < today;
      taskDays[day] = taskDays[day] || { has: true, overdue: false };
      if (isOverdue) taskDays[day].overdue = true;
    }
  });

  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

  let html = `
    <div class="cal-header">
      <button class="cal-nav" onclick="changeMonth(-1)">‹</button>
      <h3>${monthNames[month]} ${year}</h3>
      <button class="cal-nav" onclick="changeMonth(1)">›</button>
    </div>
    <div class="cal-grid">
      ${dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
      ${Array(firstDay).fill('<div class="cal-day other-month"></div>').join('')}
      ${Array.from({length: daysInMonth}, (_, i) => {
        const day = i + 1;
        const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
        const info = taskDays[day];
        return `<div class="cal-day ${isToday ? 'today' : ''} ${info ? (info.overdue ? 'overdue-day' : 'has-task') : ''}">${day}</div>`;
      }).join('')}
    </div>`;

  document.getElementById('calendarWidget').innerHTML = html;

  // Task list for this month
  const monthTasks = [...tasks, ...personalTasks].filter(t => {
    const d = new Date(t.deadline);
    return d.getFullYear() === year && d.getMonth() === month;
  }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const listEl = document.getElementById('calendarTaskList');
  if (!monthTasks.length) { listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Tidak ada tugas bulan ini</p>'; return; }
  listEl.innerHTML = monthTasks.map(t => {
    const isPersonal = !t.createdBy;
    const color = isPersonal ? '#8b5cf6' : (SUBJ_COLORS[t.subject] || '#6366f1');
    const d = new Date(t.deadline);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="width:4px;height:36px;background:${color};border-radius:4px;flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.85rem">${t.title}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${t.subject} · ${d.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][d.getMonth()]}</div>
      </div>
      ${isPersonal ? '<span class="badge badge-personal">Pribadi</span>' : ''}
    </div>`;
  }).join('');
}

function changeMonth(dir) {
  const stored = localStorage.getItem('calMonth');
  const calRef = stored ? new Date(stored) : new Date();
  calRef.setMonth(calRef.getMonth() + dir);
  renderCalendarMonth(calRef);
}

// ===== RIWAYAT =====
function renderRiwayat() {
  const tbody = document.getElementById('riwayatTableBody');
  const feedbacks = JSON.parse(localStorage.getItem('feedbacks') || '[]');
  if (!mySubmissions.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">Belum ada pengumpulan</td></tr>'; return; }
  tbody.innerHTML = [...mySubmissions].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).map(s => {
    const task = tasks.find(t => t.id === s.taskId);
    const isLate = s.isLate || (task && new Date(s.submittedAt) > new Date(task.deadline));
    const fb = feedbacks.find(f => f.subId === s.id);
    return `<tr>
      <td><strong>${task ? task.title : s.taskTitle || 'Tugas dihapus'}</strong></td>
      <td>${task ? task.subject : s.subject || '-'}</td>
      <td style="font-size:0.85rem">${task ? formatDate(task.deadline) : '-'}</td>
      <td style="font-size:0.85rem">${formatDate(s.submittedAt)}</td>
      <td>${isLate ? '<span class="badge badge-overdue">Terlambat</span>' : '<span class="badge badge-submitted">Tepat Waktu</span>'}</td>
      <td style="font-size:0.85rem;color:var(--text-muted)">${s.note || '—'}</td>
      <td>${fb ? `<span class="feedback-chip" style="cursor:default">💬 ${fb.text}</span>` : '<span style="color:var(--text-muted);font-size:0.8rem">—</span>'}</td>
    </tr>`;
  }).join('');
}

// ===== PROFIL =====
async function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  const kelas = document.getElementById('profileClass').value.trim();
  const pass = document.getElementById('profilePass').value;
  const confirm = document.getElementById('profilePassConfirm').value;
  if (!name) { showToast('Nama tidak boleh kosong', 'error'); return; }
  if (pass && pass !== confirm) { showToast('Password tidak cocok', 'error'); return; }

  currentUser.name = name;
  currentUser.class = kelas;
  if (pass) currentUser.password = pass;
  sessionStorage.setItem('user', JSON.stringify(currentUser));

  // Simpan ke localStorage (fallback)
  const overrides = JSON.parse(localStorage.getItem('userOverrides') || '{}');
  const key = 'siswa_' + currentUser.username;
  overrides[key] = { name, class: kelas, ...(pass ? { password: pass } : {}) };
  localStorage.setItem('userOverrides', JSON.stringify(overrides));

  // Simpan ke Firebase supaya sync ke semua device
  if (window._fbDB) {
    await window._fbSet(window._fbRef(window._fbDB, `users/siswa_${currentUser.username}`), {
      name,
      class: kelas,
      username: currentUser.username,
      role: 'siswa',
      updatedAt: new Date().toISOString()
    });
  }

  // Update UI
  document.getElementById('siswaName').textContent = name;
  document.getElementById('sidebarName').textContent = name;
  document.getElementById('sidebarClass').textContent = kelas || 'Siswa';
  document.getElementById('profilePass').value = '';
  document.getElementById('profilePassConfirm').value = '';
  showToast('✅ Profil berhasil disimpan!', 'success');
}

// ===== IMPORT DATA (siswa bisa import data tugas dari guru) =====
function importDataSiswa(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.v || !data.tasks) { showToast('❌ File tidak valid', 'error'); return; }
      if (!confirm(`Import ${data.tasks.length} tugas dari guru?\nData tugasmu yang ada akan digabung.`)) return;
      const existingTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
      const existingIds = new Set(existingTasks.map(t => t.id));
      const newTasks = [...existingTasks, ...data.tasks.filter(t => !existingIds.has(t.id))];
      localStorage.setItem('tasks', JSON.stringify(newTasks));
      if (data.sheetsWebAppUrl) localStorage.setItem('sheetsWebAppUrl', data.sheetsWebAppUrl);
      if (data.sheetsSpreadsheetUrl) localStorage.setItem('sheetsSpreadsheetUrl', data.sheetsSpreadsheetUrl);
      tasks = newTasks;
      updateStats(); renderUrgentTasks(); populateFilters();
      showToast('✅ Data tugas berhasil diimport!', 'success');
    } catch(err) { showToast('❌ Gagal membaca file', 'error'); }
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
  window._fbOnDisconnect(presenceRef).remove();
  window.addEventListener('beforeunload', () => window._fbSet(presenceRef, null));

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

// ===== MODAL CLOSE HELPER =====
function closeModalAnimated(id, callback) {
  const el = document.getElementById(id);
  if (!el || !el.classList.contains('open')) return;
  el.classList.add('closing');
  setTimeout(() => {
    el.classList.remove('open', 'closing');
    if (callback) callback();
  }, 280);
}

// ===== HELPERS =====
function savePersonalTasks() { localStorage.setItem('personalTasks_' + currentUser.username, JSON.stringify(personalTasks)); }
function formatDate(d) { return new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
function showToast(msg, type = '') {
  const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3500);
}
function logout() { sessionStorage.removeItem('user'); window.location.href = 'index.html'; }

['taskDetailModal','submitModal','addPersonalModal','personalDetailModal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function(e) {
    if (e.target === this) closeModalAnimated(id);
  });
});
