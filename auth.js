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

// Merge default dengan perubahan yang disimpan di localStorage
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
  const tabGuru = document.getElementById('tabGuru');
  if (!tabSiswa) return;
  if (role === 'siswa') {
    tabSiswa.className = 'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all bg-white text-indigo-600 shadow-sm';
    tabGuru.className = 'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all text-gray-500';
  } else {
    tabGuru.className = 'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all bg-white text-indigo-600 shadow-sm';
    tabSiswa.className = 'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all text-gray-500';
  }
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('errorMsg');

  const USERS = getUsers();
  const users = USERS[selectedRole] || [];
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    errorEl.textContent = 'Username atau password salah.';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  sessionStorage.setItem('user', JSON.stringify({ ...user, role: selectedRole }));
  window.location.href = selectedRole === 'guru' ? 'guru.html' : 'siswa.html';
}

// Guard: redirect if already logged in
const existingUser = sessionStorage.getItem('user');
if (existingUser) {
  const u = JSON.parse(existingUser);
  window.location.href = u.role === 'guru' ? 'guru.html' : 'siswa.html';
}
