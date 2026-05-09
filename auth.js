// Default users — password changes disimpan di localStorage
const DEFAULT_USERS = {
  guru: [
    { username: 'guru1', password: 'guru123', name: 'Pak Budi', subject: 'Matematika' },
    { username: 'guru2', password: 'guru123', name: 'Bu Sari', subject: 'Bahasa Indonesia' },
  ],
  siswa: [
    { username: 'siswa1', password: 'siswa123', name: 'Andi Pratama', class: 'X-A' },
    { username: 'siswa2', password: 'siswa123', name: 'Budi Santoso', class: 'X-A' },
    { username: 'siswa3', password: 'siswa123', name: 'Citra Dewi', class: 'X-B' },
  ]
};

function getUsers() {
  const overrides = JSON.parse(localStorage.getItem('userOverrides') || '{}');
  const result = { guru: [], siswa: [] };

  // Default users
  ['guru', 'siswa'].forEach(role => {
    result[role] = DEFAULT_USERS[role].map(u => {
      const key = role + '_' + u.username;
      return overrides[key] ? { ...u, ...overrides[key] } : { ...u };
    });
  });

  // Tambahkan akun yang dibuat via registrasi (dari overrides yang tidak ada di DEFAULT_USERS)
  Object.entries(overrides).forEach(([key, data]) => {
    const [role, ...usernameParts] = key.split('_');
    const username = usernameParts.join('_');
    if ((role === 'guru' || role === 'siswa') && data.password) {
      const existsInDefault = DEFAULT_USERS[role]?.find(u => u.username === username);
      if (!existsInDefault) {
        result[role].push({ username, ...data, role });
      }
    }
  });

  return result;
}

let selectedRole = 'siswa';

function setRole(role) {
  selectedRole = role;
  const tabSiswa = document.getElementById('tabSiswa');
  const tabGuru  = document.getElementById('tabGuru');
  if (!tabSiswa) return;
  tabSiswa.classList.toggle('active', role === 'siswa');
  tabGuru.classList.toggle('active',  role === 'guru');
  // Update class field visibility in register form
  if (typeof updateClassField === 'function') updateClassField();
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl  = document.getElementById('errorMsg');
  const btn      = document.getElementById('submitBtn');

  // Loading state
  btn.classList.add('loading');
  btn.textContent = 'Masuk';

  // Simulate slight delay for UX feel
  setTimeout(async () => {
    const USERS = getUsers();
    const users = USERS[selectedRole] || [];
    let user = users.find(u => u.username === username && u.password === password);

    // Kalau tidak ketemu di local, cek Firebase (akun dari device lain)
    if (!user && window._fbDB) {
      try {
        const snap = await window._fbGet(window._fbRef(window._fbDB, `accounts/${selectedRole}_${username}`));
        const fbUser = snap.val();
        if (fbUser && fbUser.password === password) {
          // Simpan ke localStorage supaya bisa login offline berikutnya
          const overrides = JSON.parse(localStorage.getItem('userOverrides') || '{}');
          overrides[selectedRole + '_' + username] = { name: fbUser.name, password: fbUser.password, ...(fbUser.class ? { class: fbUser.class } : {}) };
          localStorage.setItem('userOverrides', JSON.stringify(overrides));
          user = fbUser;
        }
      } catch(e) { /* Firebase tidak tersedia, lanjut */ }
    }

    btn.classList.remove('loading');

    if (!user) {
      errorEl.textContent = 'Username atau password salah.';
      errorEl.style.display = 'block';
      // Re-trigger shake animation
      errorEl.style.animation = 'none';
      void errorEl.offsetWidth;
      errorEl.style.animation = '';
      // Shake inputs
      const inputs = document.querySelectorAll('.field input');
      inputs.forEach(inp => {
        inp.style.borderColor = 'rgba(252,165,165,.8)';
        inp.style.animation = 'none';
        void inp.offsetWidth;
        inp.style.animation = 'shake .4s cubic-bezier(.36,.07,.19,.97)';
        setTimeout(() => { inp.style.borderColor = ''; inp.style.animation = ''; }, 500);
      });
      return;
    }

    errorEl.style.display = 'none';

    // Success animation — card scale out
    const card = document.querySelector('.card');
    card.style.transition = 'transform .3s cubic-bezier(.4,0,1,1), opacity .3s ease';
    card.style.transform = 'scale(.95) translateY(-10px)';
    card.style.opacity = '0';

    setTimeout(() => {
      sessionStorage.setItem('user', JSON.stringify({ ...user, role: selectedRole }));
      window.location.href = selectedRole === 'guru' ? 'guru.html' : 'siswa.html';
    }, 300);
  }, 400);
}

// Guard: redirect if already logged in
const existingUser = sessionStorage.getItem('user');
if (existingUser) {
  const u = JSON.parse(existingUser);
  window.location.href = u.role === 'guru' ? 'guru.html' : 'siswa.html';
}

// ===== REGISTER =====
async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById('regName').value.trim();
  const username = document.getElementById('regUsername').value.trim().toLowerCase().replace(/\s+/g,'');
  const kelas    = document.getElementById('regClass') ? document.getElementById('regClass').value.trim() : '';
  const pass     = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regPasswordConfirm').value;
  const errEl    = document.getElementById('regErrorMsg');
  const okEl     = document.getElementById('regSuccessMsg');
  const btn      = document.getElementById('regBtn');

  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  // Validasi
  if (!name || !username || !pass) { showRegError('Semua field wajib diisi'); return; }
  if (username.length < 3) { showRegError('Username minimal 3 karakter'); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { showRegError('Username hanya boleh huruf kecil, angka, dan _'); return; }
  if (pass.length < 6) { showRegError('Password minimal 6 karakter'); return; }
  if (pass !== confirm) { showRegError('Password tidak cocok'); return; }

  btn.classList.add('loading');
  btn.textContent = 'Membuat akun...';

  try {
    // Cek apakah username sudah ada di Firebase
    if (window._fbDB) {
      const snap = await window._fbGet(window._fbRef(window._fbDB, `accounts/${selectedRole}_${username}`));
      if (snap.val()) {
        showRegError('Username sudah dipakai, coba yang lain');
        btn.classList.remove('loading'); btn.textContent = 'Buat Akun';
        return;
      }
    }

    // Cek juga di DEFAULT_USERS
    const USERS = getUsers();
    if (USERS[selectedRole].find(u => u.username === username)) {
      showRegError('Username sudah dipakai, coba yang lain');
      btn.classList.remove('loading'); btn.textContent = 'Buat Akun';
      return;
    }

    // Simpan akun baru
    const newUser = {
      username, name, password: pass, role: selectedRole,
      ...(selectedRole === 'siswa' ? { class: kelas } : {}),
      createdAt: new Date().toISOString()
    };

    // Simpan ke localStorage overrides
    const overrides = JSON.parse(localStorage.getItem('userOverrides') || '{}');
    const key = selectedRole + '_' + username;
    overrides[key] = { name, password: pass, ...(selectedRole === 'siswa' ? { class: kelas } : {}) };
    localStorage.setItem('userOverrides', JSON.stringify(overrides));

    // Simpan ke Firebase supaya bisa login dari device lain
    if (window._fbDB) {
      await window._fbSet(window._fbRef(window._fbDB, `accounts/${selectedRole}_${username}`), newUser);
      await window._fbSet(window._fbRef(window._fbDB, `users/${selectedRole}_${username}`), {
        name, username, role: selectedRole,
        ...(selectedRole === 'siswa' ? { class: kelas } : {}),
        updatedAt: new Date().toISOString()
      });
    }

    // Langsung login
    okEl.textContent = '✅ Akun berhasil dibuat! Masuk...';
    okEl.style.display = 'block';

    setTimeout(() => {
      sessionStorage.setItem('user', JSON.stringify({ ...newUser }));
      const card = document.getElementById('mainCard');
      if (card) { card.style.transition = 'transform .3s ease, opacity .3s ease'; card.style.transform = 'scale(.95)'; card.style.opacity = '0'; }
      setTimeout(() => { window.location.href = selectedRole === 'guru' ? 'guru.html' : 'siswa.html'; }, 300);
    }, 800);

  } catch(err) {
    console.error(err);
    showRegError('Gagal membuat akun, coba lagi');
    btn.classList.remove('loading'); btn.textContent = 'Buat Akun';
  }
}

function showRegError(msg) {
  const el = document.getElementById('regErrorMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}
