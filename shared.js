// ============================================================
// LMS Unmuh Babel — Shared Helpers
// ============================================================

const SUPABASE_URL  = 'https://tykhjixclpjmsgwrlfxm.supabase.co'
const SUPABASE_ANON = 'sb_publishable_JlBcaYcORxPvRZgEmbFzLA_zTZqGHpB'

function getSB() {
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON)
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

  const sidebarRole = document.getElementById('sidebarRole')
  if (sidebarRole) {
    sidebarRole.innerHTML = `<i class="bi ${ri.icon}" style="color:${ri.color};"></i><span>${ri.label}</span>`
  }

  const userAvatar = document.getElementById('userAvatar')
  if (userAvatar) userAvatar.textContent = nama ? nama[0].toUpperCase() : 'U'
  const userNameEl = document.getElementById('userName')
  if (userNameEl) userNameEl.textContent = nama || '—'
  const userNimEl = document.getElementById('userNim')
  if (userNimEl) userNimEl.textContent = nim || '—'

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

// ---- Cek sesi ----
async function requireAuth(sb) {
  const { data: { session }, error } = await sb.auth.getSession()
  if (error || !session) {
    window.location.replace('login.html')
    return null
  }
  return session
}

// ---- Ambil profil — SELALU dari Supabase, bukan hanya sessionStorage ----
async function getProfile(sb, userId) {
  // Coba ambil dari Supabase dulu (sumber kebenaran)
  const { data: profile, error } = await sb
    .from('profiles')
    .select('role, nama, nim')
    .eq('id', userId)
    .single()

  if (profile && !error && profile.role) {
    // Simpan ke sessionStorage sebagai cache
    sessionStorage.setItem('userRole', profile.role)
    sessionStorage.setItem('userName', profile.nama || '')
    sessionStorage.setItem('userNim',  profile.nim  || '')
    return {
      role: profile.role,
      nama: profile.nama || 'Pengguna',
      nim:  profile.nim  || ''
    }
  }

  // Fallback ke sessionStorage kalau query gagal (offline / RLS)
  const cachedRole = sessionStorage.getItem('userRole')
  const cachedNama = sessionStorage.getItem('userName')
  const cachedNim  = sessionStorage.getItem('userNim')

  if (cachedRole) {
    return {
      role: cachedRole,
      nama: cachedNama || 'Pengguna',
      nim:  cachedNim  || ''
    }
  }

  // Terakhir: fallback default
  return { role: 'mahasiswa', nama: 'Pengguna', nim: '' }
}

// ---- Logout ----
async function handleLogout(sb) {
  await sb.auth.signOut()
  sessionStorage.clear()
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
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:white;border-left:4px solid ${colors[type]};
    border-radius:10px;padding:12px 18px;
    box-shadow:0 8px 24px rgba(0,0,0,0.12);
    display:flex;align-items:center;gap:10px;
    font-family:'Plus Jakarta Sans',sans-serif;
    font-size:0.86rem;font-weight:500;color:#0f172a;
    animation:slideIn 0.3s ease;max-width:320px;
  `
  toast.innerHTML = `<i class="bi ${icons[type]}" style="color:${colors[type]};font-size:1.1rem;flex-shrink:0;"></i>${msg}`
  document.body.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 0.3s'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

const _toastStyle = document.createElement('style')
_toastStyle.textContent = `@keyframes slideIn{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}`
document.head.appendChild(_toastStyle)

// ---- Proteksi halaman berdasarkan role ----
// roleAllowed: array role yang boleh akses, misal ['admin'] atau ['dosen','admin']
async function requireRole(sb, roleAllowed) {
  const session = await requireAuth(sb)
  if (!session) return null

  const { role, nama, nim } = await getProfile(sb, session.user.id)

  if (!roleAllowed.includes(role)) {
    // Role tidak sesuai — redirect ke dashboard
    window.location.replace('dashboard.html')
    return null
  }

  return { session, role, nama, nim }
}
