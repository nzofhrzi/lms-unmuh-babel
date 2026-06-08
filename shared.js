// ============================================================
// LMS Unmuh Babel — Shared Helpers (GitHub + Vercel API)
// ============================================================

const API = ''  // kosong = same origin (Vercel), atau ganti dengan URL deploy

// ---- Ambil token dari sessionStorage ----
function getToken() { return sessionStorage.getItem('lms_token') }
function getUser()  {
  const raw = sessionStorage.getItem('lms_user')
  try { return raw ? JSON.parse(raw) : null } catch { return null }
}

// ---- Simpan sesi setelah login ----
function saveSession(token, user) {
  sessionStorage.setItem('lms_token', token)
  sessionStorage.setItem('lms_user', JSON.stringify(user))
}

// ---- Hapus sesi (logout) ----
function clearSession() {
  sessionStorage.removeItem('lms_token')
  sessionStorage.removeItem('lms_user')
}

// ---- Fetch helper dengan auth header ----
async function apiFetch(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ---- Menu per role ----
const MENUS = {
  mahasiswa: [
    { label: 'Dashboard',   icon: 'bi-house',           href: 'dashboard.html' },
    { label: 'Mata Kuliah', icon: 'bi-book',            href: 'mhs-mata-kuliah.html' },
    { label: 'Tugas',       icon: 'bi-clipboard-check', href: 'mhs-tugas.html' },
    { label: 'Absensi',     icon: 'bi-calendar-check',  href: 'mhs-absensi.html' },
    { label: 'Diskusi',     icon: 'bi-chat-dots',       href: 'mhs-diskusi.html' },
  ],
  dosen: [
    { label: 'Dashboard',      icon: 'bi-house',           href: 'dashboard.html' },
    { label: 'Mata Kuliah',    icon: 'bi-book',            href: 'dsn-mata-kuliah.html' },
    { label: 'Upload Tugas',   icon: 'bi-cloud-upload',    href: 'dsn-upload-tugas.html' },
    { label: 'Kelola Absensi', icon: 'bi-person-check',    href: 'dsn-absensi.html' },
    { label: 'Hasil & Data',   icon: 'bi-bar-chart-line',  href: 'dsn-hasil.html' },
    { label: 'Diskusi',        icon: 'bi-chat-dots',       href: 'dsn-diskusi.html' },
  ],
  admin: [
    { label: 'Dashboard',      icon: 'bi-house',            href: 'dashboard.html' },
    { label: 'Kelola User',    icon: 'bi-people',           href: 'adm-user.html' },
    { label: 'Kelola Matkul',  icon: 'bi-journal-bookmark', href: 'adm-matkul.html' },
    { label: 'Hasil & Data',   icon: 'bi-bar-chart-line',   href: 'adm-hasil.html' },
  ],
}

const ROLE_INFO = {
  mahasiswa: { label: 'Mahasiswa',     color: '#2563eb', icon: 'bi-person-badge' },
  dosen:     { label: 'Dosen',         color: '#059669', icon: 'bi-person-workspace' },
  admin:     { label: 'Administrator', color: '#7c3aed', icon: 'bi-shield-lock' },
}

// ---- Bangun sidebar ----
function buildSidebar(role, nama, nim, activeHref) {
  const ri    = ROLE_INFO[role] || ROLE_INFO.mahasiswa
  const menus = MENUS[role]    || MENUS.mahasiswa

  const el = document.getElementById('sidebarRole')
  if (el) el.innerHTML = `<i class="bi ${ri.icon}" style="color:${ri.color};"></i><span>${ri.label}</span>`

  const av = document.getElementById('userAvatar')
  if (av) av.textContent = nama ? nama[0].toUpperCase() : 'U'
  const un = document.getElementById('userName')
  if (un) un.textContent = nama || '—'
  const un2 = document.getElementById('userNim')
  if (un2) un2.textContent = nim || '—'

  const nav = document.getElementById('sidebarNav')
  if (!nav) return
  nav.innerHTML = '<div class="nav-section">Menu Utama</div>'
  menus.forEach(m => {
    const curFile = window.location.pathname.split('/').pop() || 'dashboard.html'
    const isActive = m.href === activeHref || m.href === curFile
    nav.innerHTML += `
      <a class="nav-item ${isActive ? 'active' : ''}" href="${m.href}">
        <i class="bi ${m.icon}"></i>${m.label}
      </a>`
  })
}

// ---- Cek sesi (verifikasi token ke API) ----
async function requireAuth() {
  const token = getToken()
  if (!token) { window.location.replace('login.html'); return null }
  try {
    const { user } = await apiFetch('/api/auth/verify')
    return user
  } catch {
    clearSession()
    window.location.replace('login.html')
    return null
  }
}

// ---- Cek role ----
async function requireRole(allowedRoles) {
  const user = await requireAuth()
  if (!user) return null
  if (!allowedRoles.includes(user.role)) {
    window.location.replace('dashboard.html')
    return null
  }
  return user
}

// ---- Logout ----
async function handleLogout() {
  clearSession()
  window.location.replace('login.html')
}

function openSidebar()  {
  document.getElementById('sidebar').classList.add('open')
  document.getElementById('overlay').classList.add('show')
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('overlay').classList.remove('show')
}

function setTopbarDate() {
  const el = document.getElementById('topbarDate')
  if (el) el.textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

function hideLoading() {
  const el = document.getElementById('loadingScreen')
  if (el) el.style.display = 'none'
}

function showToast(msg, type = 'success') {
  const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' }
  const icons  = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill', warning: 'bi-exclamation-triangle-fill' }
  const toast  = document.createElement('div')
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:white;border-left:4px solid ${colors[type]};border-radius:10px;padding:12px 18px;box-shadow:0 8px 24px rgba(0,0,0,0.12);display:flex;align-items:center;gap:10px;font-family:'Plus Jakarta Sans',sans-serif;font-size:0.86rem;font-weight:500;color:#0f172a;animation:slideIn 0.3s ease;max-width:320px;`
  toast.innerHTML = `<i class="bi ${icons[type]}" style="color:${colors[type]};font-size:1.1rem;flex-shrink:0;"></i>${msg}`
  document.body.appendChild(toast)
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(()=>toast.remove(),300) }, 3500)
}

const _s = document.createElement('style')
_s.textContent = `@keyframes slideIn{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}`
document.head.appendChild(_s)
