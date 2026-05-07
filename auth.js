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
  ['guru', 'siswa'].forEach(role => {
    result[role] = DEFAULT_USERS[role].map(u => {
      const key = role + '_' + u.username;
      return overrides[key] ? { ...u, ...overrides[key] } : { ...u };
    });
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
  setTimeout(() => {
    const USERS = getUsers();
    const users = USERS[selectedRole] || [];
    const user  = users.find(u => u.username === username && u.password === password);

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
