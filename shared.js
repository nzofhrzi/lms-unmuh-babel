// ============================================================
// LMS Unmuh Babel — Shared Helpers
// ============================================================

const SUPABASE_URL       = 'https://tykhjixclpjmsgwrlfxm.supabase.co'
const SUPABASE_ANON      = 'sb_publishable_JlBcaYcORxPvRZgEmbFzLA_zTZqGHpB'
const EDGE_TAMBAH_USER   = `${SUPABASE_URL}/functions/v1/tambah-user`
const EDGE_HAPUS_USER    = `${SUPABASE_URL}/functions/v1/hapus-user`

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

// ---- Ambil profil — SELALU dari Supabase ----
async function getProfile(sb, userId) {
  const { data: profile, error } = await sb
    .from('profiles')
    .select('role, nama, nim, prodi_id')
    .eq('id', userId)
    .single()

  if (profile && !error && profile.role) {
    return {
      role:     profile.role,
      nama:     profile.nama     || 'Pengguna',
      nim:      profile.nim      || '',
      prodi_id: profile.prodi_id || null,
    }
  }
  return { role: 'mahasiswa', nama: 'Pengguna', nim: '', prodi_id: null }
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

// ---- Cek sesi ----
async function requireAuth(sb) {
  const { data: { session }, error } = await sb.auth.getSession()
  if (error || !session) { window.location.replace('login.html'); return null }
  return session
}

// ---- Cek role ----
async function requireRole(sb, allowedRoles) {
  const session = await requireAuth(sb)
  if (!session) return null
  const profile = await getProfile(sb, session.user.id)
  if (!allowedRoles.includes(profile.role)) {
    window.location.replace('dashboard.html')
    return null
  }
  return { session, ...profile }
}

// ---- Logout ----
async function handleLogout(sb) {
  await sb.auth.signOut()
  window.location.replace('login.html')
}

// ---- Panggil Edge Function ----
async function callEdge(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON,
    },
    body: JSON.stringify(body)
  })
  return res.json()
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
