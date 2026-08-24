// api/index.js
// Single entry-point for all LMS APIs
// Routes: /api/{module}/{action}  →  rewritten to this file
// Modules: auth | jurusan | matkul | tugas | absensi | diskusi
// Storage: GitHub branch "data"
// Auth: JWT (JWT_SECRET)

import { webcrypto } from 'crypto';
import { Buffer } from 'buffer';

const crypto = webcrypto;
const atob = (str) => Buffer.from(str, 'base64').toString('utf-8');
const btoa = (str) => Buffer.from(str, 'utf-8').toString('base64');

const DATA_BRANCH = 'data';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // path from rewrite: ?path=auth/login  or query module/action
  let module = req.query.module || '';
  let action = req.query.action || '';
  if (req.query.path) {
    const parts = String(req.query.path).split('/').filter(Boolean);
    module = parts[0] || module;
    action = parts[1] || action;
  }
  // also support /api/index?module=... from some rewrites
  if (!module && req.url) {
    try {
      const u = new URL(req.url, 'http://x');
      const segs = u.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
      // when rewritten to /api/index, pathname may be /api/index — prefer query
      if (segs[0] && segs[0] !== 'index') {
        module = segs[0];
        action = segs[1] || action;
      }
    } catch {}
  }

  module = String(module || '').toLowerCase();
  action = String(action || '').toLowerCase();

  try {
    switch (module) {
      case 'auth':     return await routeAuth(action, req, res);
      case 'jurusan':  return await routeJurusan(action, req, res);
      case 'matkul':   return await routeMatkul(action, req, res);
      case 'tugas':    return await routeTugas(action, req, res);
      case 'absensi':  return await routeAbsensi(action, req, res);
      case 'diskusi':  return await routeDiskusi(action, req, res);
      default:
        return res.status(404).json({ error: `Module tidak dikenal: ${module || '(kosong)'}` });
    }
  } catch (err) {
    console.error(`[api/${module}/${action}]`, err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED: JWT + GitHub helpers
// ═══════════════════════════════════════════════════════════════════════════

function getSecret() {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET || 'lms-jwt-secret-change-me';
}

async function makeToken(user) {
  const secret = getSecret();
  const payload = `${user.nim_nip}|${user.role}|${user.id}|${Date.now()}`;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return btoa(`${payload}|${sigHex}`);
}

async function verifyToken(token) {
  try {
    const secret = getSecret();
    const decoded = atob(token);
    const parts = decoded.split('|');
    if (parts.length < 5) return null;
    const sigHex = parts[parts.length - 1];
    const payload = parts.slice(0, parts.length - 1).join('|');
    const [nim_nip, role, id, tsStr] = parts;
    const ts = parseInt(tsStr, 10);
    if (isNaN(ts) || Date.now() - ts > 24 * 60 * 60 * 1000) return null;
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
    const expectedHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (sigHex !== expectedHex) return null;
    return { nim_nip, role, id };
  } catch {
    return null;
  }
}

async function requireAuth(req, res, allowedRoles = null) {
  const token = req.headers['x-session-token'] || (req.body && req.body.token);
  if (!token) {
    res.status(401).json({ error: 'Token diperlukan.' });
    return null;
  }
  const session = await verifyToken(token);
  if (!session) {
    res.status(401).json({ error: 'Sesi tidak valid.' });
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    res.status(403).json({ error: 'Akses ditolak.' });
    return null;
  }
  return session;
}

async function requireAdmin(req, res) {
  return requireAuth(req, res, ['admin']);
}

async function requireDosen(req, res) {
  return requireAuth(req, res, ['dosen']);
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + (process.env.PASS_SALT || 'lms-salt'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeUser(user) {
  return {
    id: user.id,
    nim_nip: user.nim_nip,
    nama: user.nama,
    role: user.role,
    jurusan: user.jurusan || null,
    semester: user.semester || null,
    mata_kuliah: user.mata_kuliah || null,
  };
}

function getGHConfig(file) {
  const { GITHUB_OWNER, GITHUB_REPO, GITHUB_PAT } = process.env;
  if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_PAT) return null;
  return {
    url: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${file}?ref=${DATA_BRANCH}`,
    putUrl: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${file}`,
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
}

async function ghGet(file) {
  const gh = getGHConfig(file);
  if (!gh) throw new Error('ENV_MISSING');
  const r = await fetch(gh.url, { headers: gh.headers });
  if (r.status === 404) return { data: {}, sha: null };
  if (!r.ok) throw new Error(`GitHub GET error: ${r.status}`);
  const j = await r.json();
  const decoded = Buffer.from(j.content, 'base64').toString('utf-8');
  return { data: JSON.parse(decoded), sha: j.sha };
}

async function ghSave(file, data, sha, message) {
  const gh = getGHConfig(file);
  if (!gh) throw new Error('ENV_MISSING');
  const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64');
  const body = {
    message: message || `Update ${file} [LMS] ${new Date().toISOString()}`,
    content,
    branch: DATA_BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(gh.putUrl, {
    method: 'PUT',
    headers: gh.headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub PUT error ${r.status}: ${await r.text()}`);
  return true;
}


// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════

async function routeAuth(action, req, res) {
  switch (action) {
    case 'login': return authLogin(req, res);
    case 'verify': return authVerify(req, res);
    case 'register': return authRegister(req, res);
    case 'list-users': return authListUsers(req, res);
    case 'delete-user': return authDeleteUser(req, res);
    case 'update-user': return authUpdateUser(req, res);
    case 'change-password': return authChangePassword(req, res);
    case 'list-mahasiswa': return authListMahasiswa(req, res);
    default: return res.status(404).json({ error: `Action auth tidak dikenal: ${action}` });
  }
}

async function authLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const { nim_nip, password } = req.body || {};
  if (!nim_nip || !password) return res.status(400).json({ error: 'NIM/NIP dan password diperlukan.' });
  let result;
  try { result = await ghGet('users.json'); }
  catch (e) {
    return res.status(500).json({ error: e.message === 'ENV_MISSING' ? 'Konfigurasi server belum diatur.' : 'Gagal membaca data pengguna.' });
  }
  const users = result.data.users || [];
  const user = users.find(u => u.nim_nip === String(nim_nip).trim());
  if (!user) return res.status(401).json({ error: 'NIM/NIP tidak ditemukan.' });
  let ok = user.password === password;
  if (!ok) ok = user.password === await hashPassword(password);
  if (!ok) return res.status(401).json({ error: 'Password salah.' });
  const token = await makeToken(user);
  return res.status(200).json({ message: 'Login berhasil.', token, user: safeUser(user) });
}

async function authVerify(req, res) {
  const token = req.headers['x-session-token'] || (req.body && req.body.token);
  if (!token) return res.status(401).json({ valid: false, error: 'Token tidak ada.' });
  const session = await verifyToken(token);
  if (!session) return res.status(401).json({ valid: false, error: 'Sesi tidak valid atau sudah berakhir.' });
  try {
    const result = await ghGet('users.json');
    const user = (result.data.users || []).find(u => u.id === session.id);
    if (!user) return res.status(401).json({ valid: false, error: 'Akun tidak ditemukan.' });
    return res.status(200).json({ valid: true, user: safeUser(user) });
  } catch {
    return res.status(200).json({ valid: true, user: session });
  }
}

async function authRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  if (!(await requireAdmin(req, res))) return;
  const { nim_nip, nama, password, role, jurusan, semester, mata_kuliah } = req.body || {};
  if (!nim_nip || !nama || !password || !role) return res.status(400).json({ error: 'nim_nip, nama, password, dan role wajib.' });
  if (!['mahasiswa', 'dosen', 'admin'].includes(role)) return res.status(400).json({ error: 'Role tidak valid.' });
  let result;
  try { result = await ghGet('users.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data pengguna.' }); }
  const { data, sha } = result;
  if ((data.users || []).some(u => u.nim_nip === String(nim_nip).trim()))
    return res.status(409).json({ error: 'NIM/NIP sudah terdaftar.' });
  const newUser = {
    id: `usr_${Date.now()}`,
    nim_nip: String(nim_nip).trim(),
    nama: String(nama).trim(),
    password: await hashPassword(password),
    role,
    jurusan: jurusan || null,
    semester: semester || null,
    mata_kuliah: Array.isArray(mata_kuliah) ? mata_kuliah : null,
    created_at: new Date().toISOString(),
  };
  data.users = data.users || [];
  data.users.push(newUser);
  try { await ghSave('users.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal menyimpan pengguna.' }); }
  return res.status(201).json({ message: 'Pengguna berhasil ditambahkan.', user: safeUser(newUser) });
}

async function authListUsers(req, res) {
  if (!(await requireAdmin(req, res))) return;
  try {
    const result = await ghGet('users.json');
    return res.status(200).json({ users: (result.data.users || []).map(safeUser) });
  } catch {
    return res.status(500).json({ error: 'Gagal membaca data pengguna.' });
  }
}

async function authDeleteUser(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  if (!(await requireAdmin(req, res))) return;
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id pengguna diperlukan.' });
  let result;
  try { result = await ghGet('users.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data pengguna.' }); }
  const { data, sha } = result;
  const before = (data.users || []).length;
  data.users = (data.users || []).filter(u => u.id !== id);
  if (data.users.length === before) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  try { await ghSave('users.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal menghapus pengguna.' }); }
  return res.status(200).json({ message: 'Pengguna berhasil dihapus.' });
}

async function authUpdateUser(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  if (!(await requireAdmin(req, res))) return;
  const { id, nama, role, jurusan, semester, mata_kuliah, password } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id pengguna diperlukan.' });
  let result;
  try { result = await ghGet('users.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data pengguna.' }); }
  const { data, sha } = result;
  const idx = (data.users || []).findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
  if (nama !== undefined) data.users[idx].nama = String(nama).trim();
  if (role !== undefined) {
    if (!['mahasiswa', 'dosen', 'admin'].includes(role)) return res.status(400).json({ error: 'Role tidak valid.' });
    data.users[idx].role = role;
  }
  if (jurusan !== undefined) data.users[idx].jurusan = jurusan;
  if (semester !== undefined) data.users[idx].semester = semester;
  if (mata_kuliah !== undefined) data.users[idx].mata_kuliah = mata_kuliah;
  if (password) data.users[idx].password = await hashPassword(password);
  data.users[idx].updated_at = new Date().toISOString();
  try { await ghSave('users.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal memperbarui pengguna.' }); }
  return res.status(200).json({ message: 'Pengguna berhasil diperbarui.', user: safeUser(data.users[idx]) });
}

async function authChangePassword(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireAuth(req, res);
  if (!session) return;
  const { old_password, new_password } = req.body || {};
  if (!old_password || !new_password) return res.status(400).json({ error: 'Password lama dan baru diperlukan.' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
  let result;
  try { result = await ghGet('users.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data pengguna.' }); }
  const { data, sha } = result;
  const idx = (data.users || []).findIndex(u => u.id === session.id);
  if (idx === -1) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
  const user = data.users[idx];
  const oldHashed = await hashPassword(old_password);
  if (user.password !== old_password && user.password !== oldHashed)
    return res.status(401).json({ error: 'Password lama tidak sesuai.' });
  data.users[idx].password = await hashPassword(new_password);
  data.users[idx].updated_at = new Date().toISOString();
  try { await ghSave('users.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal menyimpan.' }); }
  return res.status(200).json({ message: 'Password berhasil diubah.' });
}

async function authListMahasiswa(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;
  try {
    const result = await ghGet('users.json');
    const mahasiswa = (result.data.users || [])
      .filter(u => u.role === 'mahasiswa')
      .map(u => ({ id: u.id, nim_nip: u.nim_nip, nama: u.nama, jurusan: u.jurusan || null, semester: u.semester || null }));
    return res.status(200).json({ mahasiswa });
  } catch {
    return res.status(500).json({ error: 'Gagal membaca data pengguna.' });
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// JURUSAN
// ═══════════════════════════════════════════════════════════════════════════

async function routeJurusan(action, req, res) {
  if (action === 'list') return jurusanList(req, res);
  if (!(await requireAdmin(req, res))) return;
  switch (action) {
    case 'list-admin': return jurusanList(req, res);
    case 'add': return jurusanAdd(req, res);
    case 'update': return jurusanUpdate(req, res);
    case 'delete': return jurusanDelete(req, res);
    default: return res.status(404).json({ error: `Action jurusan tidak dikenal: ${action}` });
  }
}

async function jurusanList(req, res) {
  try {
    const result = await ghGet('jurusan.json');
    return res.status(200).json({ jurusan: result.data.jurusan || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message === 'ENV_MISSING' ? 'Konfigurasi server belum diatur.' : 'Gagal membaca data jurusan.' });
  }
}

async function jurusanAdd(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const { nama, kode, fakultas, jenjang } = req.body || {};
  if (!nama || !kode) return res.status(400).json({ error: 'nama dan kode wajib diisi.' });
  let result;
  try { result = await ghGet('jurusan.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data jurusan.' }); }
  const { data, sha } = result;
  const list = data.jurusan || [];
  if (list.some(j => j.kode.toUpperCase() === String(kode).trim().toUpperCase()))
    return res.status(409).json({ error: 'Kode jurusan sudah ada.' });
  const item = {
    id: `jur_${Date.now()}`,
    nama: String(nama).trim(),
    kode: String(kode).trim().toUpperCase(),
    fakultas: (fakultas || '').trim(),
    jenjang: (jenjang || 'S1').trim(),
    created_at: new Date().toISOString(),
  };
  list.push(item);
  data.jurusan = list;
  try { await ghSave('jurusan.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal menyimpan data jurusan.' }); }
  return res.status(200).json({ message: `Jurusan "${nama}" berhasil ditambahkan.`, jurusan: item });
}

async function jurusanUpdate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const { id, nama, kode, fakultas, jenjang } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id jurusan diperlukan.' });
  let result;
  try { result = await ghGet('jurusan.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data jurusan.' }); }
  const { data, sha } = result;
  const idx = (data.jurusan || []).findIndex(j => j.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Jurusan tidak ditemukan.' });
  if (nama) data.jurusan[idx].nama = String(nama).trim();
  if (kode) data.jurusan[idx].kode = String(kode).trim().toUpperCase();
  if (fakultas) data.jurusan[idx].fakultas = String(fakultas).trim();
  if (jenjang) data.jurusan[idx].jenjang = String(jenjang).trim();
  data.jurusan[idx].updated_at = new Date().toISOString();
  try { await ghSave('jurusan.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal menyimpan.' }); }
  return res.status(200).json({ message: 'Jurusan berhasil diperbarui.' });
}

async function jurusanDelete(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id jurusan diperlukan.' });
  let result;
  try { result = await ghGet('jurusan.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data jurusan.' }); }
  const { data, sha } = result;
  const before = (data.jurusan || []).length;
  data.jurusan = (data.jurusan || []).filter(j => j.id !== id);
  if (data.jurusan.length === before) return res.status(404).json({ error: 'Jurusan tidak ditemukan.' });
  try { await ghSave('jurusan.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal menyimpan.' }); }
  return res.status(200).json({ message: 'Jurusan berhasil dihapus.' });
}


// ═══════════════════════════════════════════════════════════════════════════
// MATKUL
// ═══════════════════════════════════════════════════════════════════════════

async function routeMatkul(action, req, res) {
  if (action === 'list') return matkulList(req, res);
  if (!(await requireAdmin(req, res))) return;
  switch (action) {
    case 'list-admin': return matkulList(req, res);
    case 'add': return matkulAdd(req, res);
    case 'update': return matkulUpdate(req, res);
    case 'delete': return matkulDelete(req, res);
    default: return res.status(404).json({ error: `Action matkul tidak dikenal: ${action}` });
  }
}

async function matkulList(req, res) {
  try {
    const result = await ghGet('matkul.json');
    return res.status(200).json({ matkul: result.data.matkul || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message === 'ENV_MISSING' ? 'Konfigurasi server belum diatur.' : 'Gagal membaca data mata kuliah.' });
  }
}

async function matkulAdd(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const { nama, kode, jurusan, sks, dosen_id, dosen_nama } = req.body || {};
  if (!nama || !kode) return res.status(400).json({ error: 'nama dan kode wajib diisi.' });
  let result;
  try { result = await ghGet('matkul.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data mata kuliah.' }); }
  const { data, sha } = result;
  const list = data.matkul || [];
  if (list.some(m => m.kode.toUpperCase() === String(kode).trim().toUpperCase()))
    return res.status(409).json({ error: 'Kode mata kuliah sudah ada.' });
  const item = {
    id: `mk_${Date.now()}`,
    nama: String(nama).trim(),
    kode: String(kode).trim().toUpperCase(),
    jurusan: (jurusan || '').trim(),
    sks: parseInt(sks, 10) || 2,
    dosen_id: dosen_id || null,
    dosen_nama: (dosen_nama || '').trim(),
    created_at: new Date().toISOString(),
  };
  list.push(item);
  data.matkul = list;
  try { await ghSave('matkul.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal menyimpan data mata kuliah.' }); }
  return res.status(200).json({ message: `Mata kuliah "${nama}" berhasil ditambahkan.`, matkul: item });
}

async function matkulUpdate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const { id, nama, kode, jurusan, sks, dosen_id, dosen_nama } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id mata kuliah diperlukan.' });
  let result;
  try { result = await ghGet('matkul.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data mata kuliah.' }); }
  const { data, sha } = result;
  const idx = (data.matkul || []).findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Mata kuliah tidak ditemukan.' });
  if (nama) data.matkul[idx].nama = String(nama).trim();
  if (kode) data.matkul[idx].kode = String(kode).trim().toUpperCase();
  if (jurusan) data.matkul[idx].jurusan = String(jurusan).trim();
  if (sks) data.matkul[idx].sks = parseInt(sks, 10);
  if (dosen_id !== undefined) data.matkul[idx].dosen_id = dosen_id;
  if (dosen_nama) data.matkul[idx].dosen_nama = String(dosen_nama).trim();
  data.matkul[idx].updated_at = new Date().toISOString();
  try { await ghSave('matkul.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal menyimpan.' }); }
  return res.status(200).json({ message: 'Mata kuliah berhasil diperbarui.' });
}

async function matkulDelete(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id mata kuliah diperlukan.' });
  let result;
  try { result = await ghGet('matkul.json'); } catch { return res.status(500).json({ error: 'Gagal membaca data mata kuliah.' }); }
  const { data, sha } = result;
  const before = (data.matkul || []).length;
  data.matkul = (data.matkul || []).filter(m => m.id !== id);
  if (data.matkul.length === before) return res.status(404).json({ error: 'Mata kuliah tidak ditemukan.' });
  try { await ghSave('matkul.json', data, sha); } catch { return res.status(500).json({ error: 'Gagal menyimpan.' }); }
  return res.status(200).json({ message: 'Mata kuliah berhasil dihapus.' });
}


// ═══════════════════════════════════════════════════════════════════════════
// TUGAS
// ═══════════════════════════════════════════════════════════════════════════

async function routeTugas(action, req, res) {
  switch (action) {
    case 'list': return tugasList(req, res);
    case 'add': return tugasAdd(req, res);
    case 'update': return tugasUpdate(req, res);
    case 'delete': return tugasDelete(req, res);
    default: return res.status(404).json({ error: `Action tugas tidak dikenal: ${action}` });
  }
}

async function tugasList(req, res) {
  let result;
  try { result = await ghGet('tugas.json'); }
  catch (e) {
    return res.status(500).json({ error: e.message === 'ENV_MISSING' ? 'Konfigurasi server belum diatur.' : 'Gagal membaca data tugas.' });
  }
  let list = result.data.tugas || [];
  const { dosen_id, matkul } = req.query;
  if (dosen_id) list = list.filter(t => t.dosen_id === dosen_id);
  if (matkul)   list = list.filter(t => t.matkul === matkul);
  return res.status(200).json({ tugas: list });
}

// ─── ADD ──────────────────────────────────────────────────────────────────────

async function tugasAdd(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireDosen(req, res);
  if (!session) return;

  const { judul, deskripsi, matkul, deadline } = req.body || {};
  if (!judul || !matkul || !deadline) {
    return res.status(400).json({ error: 'judul, matkul, dan deadline diperlukan.' });
  }

  let result;
  try { result = await ghGet('tugas.json'); } catch (e) { return res.status(500).json({ error: 'Gagal membaca data.' }); }

  const { data, sha } = result;
  const newTugas = {
    id: `tgs_${Date.now()}`,
    judul: judul.trim(),
    deskripsi: (deskripsi || '').trim(),
    matkul: matkul.trim(),
    deadline,
    dosen_id: session.id,
    status: 'aktif',
    created_at: new Date().toISOString(),
  };
  (data.tugas = data.tugas || []).push(newTugas);

  try { await ghSave('tugas.json', data, sha); }
  catch (e) { return res.status(500).json({ error: 'Gagal menyimpan.' }); }

  return res.status(200).json({ message: `Tugas "${judul}" berhasil ditambahkan.`, tugas: newTugas });
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

async function tugasUpdate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireDosen(req, res);
  if (!session) return;

  const { id, judul, deskripsi, matkul, deadline, status } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id tugas diperlukan.' });

  let result;
  try { result = await ghGet('tugas.json'); } catch (e) { return res.status(500).json({ error: 'Gagal membaca data.' }); }

  const { data, sha } = result;
  const idx = (data.tugas || []).findIndex(t => t.id === id && t.dosen_id === session.id);
  if (idx === -1) return res.status(404).json({ error: 'Tugas tidak ditemukan atau bukan milik Anda.' });

  if (judul)    data.tugas[idx].judul    = judul.trim();
  if (deskripsi !== undefined) data.tugas[idx].deskripsi = deskripsi.trim();
  if (matkul)   data.tugas[idx].matkul   = matkul.trim();
  if (deadline) data.tugas[idx].deadline = deadline;
  if (status && ['aktif','ditutup','selesai'].includes(status)) data.tugas[idx].status = status;
  data.tugas[idx].updated_at = new Date().toISOString();

  try { await ghSave('tugas.json', data, sha); }
  catch (e) { return res.status(500).json({ error: 'Gagal menyimpan.' }); }

  return res.status(200).json({ message: 'Tugas berhasil diperbarui.' });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

async function tugasDelete(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireDosen(req, res);
  if (!session) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id tugas diperlukan.' });

  let result;
  try { result = await ghGet('tugas.json'); } catch (e) { return res.status(500).json({ error: 'Gagal membaca data.' }); }

  const { data, sha } = result;
  const before = (data.tugas || []).length;
  // Hanya dosen pemilik atau admin yang bisa hapus
  data.tugas = (data.tugas || []).filter(t => !(t.id === id && t.dosen_id === session.id));
  if (data.tugas.length === before) return res.status(404).json({ error: 'Tugas tidak ditemukan atau bukan milik Anda.' });

  try { await ghSave('tugas.json', data, sha); }
  catch (e) { return res.status(500).json({ error: 'Gagal menyimpan.' }); }

  return res.status(200).json({ message: 'Tugas berhasil dihapus.' });
}

// ═══════════════════════════════════════════════════════════════════════════
// ABSENSI
// ═══════════════════════════════════════════════════════════════════════════

async function routeAbsensi(action, req, res) {
  switch (action) {
    case 'buat-pertemuan': return absBuatPertemuan(req, res);
    case 'list-pertemuan': return absListPertemuan(req, res);
    case 'hapus-pertemuan': return absHapusPertemuan(req, res);
    case 'submit-hadir': return absSubmitHadir(req, res);
    case 'verifikasi': return absVerifikasi(req, res);
    case 'rekap': return absRekap(req, res);
    default: return res.status(404).json({ error: `Action absensi tidak dikenal: ${action}` });
  }
}

async function absBuatPertemuan(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireAuth(req, res, ['dosen']);
  if (!session) return;

  const { matkul, judul, tanggal, keterangan } = req.body || {};
  if (!matkul || !judul || !tanggal) {
    return res.status(400).json({ error: 'matkul, judul, dan tanggal diperlukan.' });
  }

  let result;
  try { result = await ghGet('absensi.json'); } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data absensi.' });
  }

  const { data, sha } = result;
  const pertemuanList = data.pertemuan || [];

  const newPertemuan = {
    id: `abs_${Date.now()}`,
    matkul: matkul.trim(),
    judul: judul.trim(),
    tanggal,
    keterangan: (keterangan || '').trim(),
    dosen_id: session.id,
    status: 'aktif',    // aktif | ditutup
    created_at: new Date().toISOString(),
    kehadiran: [],      // array: { mhs_id, nim, nama, status, keterangan, submitted_at, verified_at }
  };

  pertemuanList.push(newPertemuan);
  data.pertemuan = pertemuanList;

  try { await ghSave('absensi.json', data, sha); } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan data.' });
  }

  return res.status(200).json({ message: `Pertemuan "${judul}" berhasil dibuat.`, pertemuan: newPertemuan });
}

// ─── LIST PERTEMUAN ───────────────────────────────────────────────────────────
// Query: matkul (required), dosen_id (optional filter)

async function absListPertemuan(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { matkul } = req.query;
  if (!matkul) return res.status(400).json({ error: 'Parameter matkul diperlukan.' });

  let result;
  try { result = await ghGet('absensi.json'); } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data absensi.' });
  }

  let list = (result.data.pertemuan || []).filter(p => p.matkul === matkul);

  // Dosen hanya lihat pertemuan miliknya
  if (session.role === 'dosen') {
    list = list.filter(p => p.dosen_id === session.id);
  }

  // Untuk mahasiswa: sembunyikan detail kehadiran orang lain, hanya tampilkan status diri sendiri
  if (session.role === 'mahasiswa') {
    list = list.map(p => ({
      ...p,
      kehadiran: p.kehadiran.filter(k => k.mhs_id === session.id),
    }));
  }

  return res.status(200).json({ pertemuan: list });
}

// ─── HAPUS PERTEMUAN (Dosen only) ─────────────────────────────────────────────

async function absHapusPertemuan(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireAuth(req, res, ['dosen']);
  if (!session) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id pertemuan diperlukan.' });

  let result;
  try { result = await ghGet('absensi.json'); } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data.' });
  }

  const { data, sha } = result;
  const before = (data.pertemuan || []).length;
  data.pertemuan = (data.pertemuan || []).filter(
    p => !(p.id === id && p.dosen_id === session.id)
  );

  if (data.pertemuan.length === before) {
    return res.status(404).json({ error: 'Pertemuan tidak ditemukan atau bukan milik Anda.' });
  }

  try { await ghSave('absensi.json', data, sha); } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan.' });
  }

  return res.status(200).json({ message: 'Pertemuan berhasil dihapus.' });
}

// ─── SUBMIT HADIR (Mahasiswa only) ────────────────────────────────────────────
// Body: { pertemuan_id, keterangan? }
// Mahasiswa mengklik pertemuan lalu submit → status: "menunggu"

async function absSubmitHadir(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireAuth(req, res, ['mahasiswa']);
  if (!session) return;

  const { pertemuan_id, alasan_tipe, keterangan, nama } = req.body || {};
  if (!pertemuan_id) {
    return res.status(400).json({ error: 'pertemuan_id diperlukan.' });
  }

  // Validasi alasan_tipe
  const validAlasan = ['hadir', 'izin', 'sakit'];
  if (!alasan_tipe || !validAlasan.includes(alasan_tipe)) {
    return res.status(400).json({ error: 'alasan_tipe diperlukan: hadir, izin, atau sakit.' });
  }

  let result;
  try { result = await ghGet('absensi.json'); } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data absensi.' });
  }

  const { data, sha } = result;
  const idx = (data.pertemuan || []).findIndex(p => p.id === pertemuan_id);
  if (idx === -1) return res.status(404).json({ error: 'Pertemuan tidak ditemukan.' });

  const pertemuan = data.pertemuan[idx];
  if (pertemuan.status === 'ditutup') {
    return res.status(400).json({ error: 'Pertemuan sudah ditutup, tidak bisa absen.' });
  }

  // Validasi: hanya bisa absen pada hari yang sama dengan tanggal pertemuan
  const ptmDate = new Date(pertemuan.tanggal);
  const now     = new Date();
  const sameDay = ptmDate.getFullYear() === now.getFullYear() &&
                  ptmDate.getMonth()    === now.getMonth()    &&
                  ptmDate.getDate()     === now.getDate();
  if (!sameDay) {
    const tgl = ptmDate.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    return res.status(400).json({ error: `Absensi hanya bisa dilakukan pada hari pertemuan berlangsung (${tgl}).` });
  }

  // Cek apakah sudah pernah submit
  const existing = pertemuan.kehadiran.find(k => k.mhs_id === session.id);
  if (existing) {
    return res.status(409).json({ error: 'Anda sudah mengajukan absensi untuk pertemuan ini.', status: existing.status });
  }

  // Tentukan status berdasarkan alasan:
  // - hadir  → menunggu (perlu verifikasi dosen)
  // - izin   → menunggu (perlu verifikasi dosen)
  // - sakit  → menunggu (perlu verifikasi dosen)
  const entry = {
    mhs_id:       session.id,
    nim:          session.nim_nip,
    nama:         (nama || session.nim_nip).trim(),
    status:       'menunggu',
    alasan_tipe,          // hadir | izin | sakit
    keterangan:   (keterangan || '').trim(),
    submitted_at: new Date().toISOString(),
    verified_at:  null,
  };

  data.pertemuan[idx].kehadiran.push(entry);

  try { await ghSave('absensi.json', data, sha); } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan absensi.' });
  }

  return res.status(200).json({ message: 'Absensi berhasil diajukan, menunggu verifikasi dosen.', entry });
}

// ─── VERIFIKASI KEHADIRAN (Dosen only) ────────────────────────────────────────
// Body: { pertemuan_id, mhs_id, status } → status: hadir | izin | tidak_hadir
// Dosen juga bisa tutup pertemuan: { pertemuan_id, tutup: true }

async function absVerifikasi(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireAuth(req, res, ['dosen']);
  if (!session) return;

  const { pertemuan_id, mhs_id, status, tutup, keterangan_dosen } = req.body || {};
  if (!pertemuan_id) return res.status(400).json({ error: 'pertemuan_id diperlukan.' });

  let result;
  try { result = await ghGet('absensi.json'); } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data.' });
  }

  const { data, sha } = result;
  const idx = (data.pertemuan || []).findIndex(
    p => p.id === pertemuan_id && p.dosen_id === session.id
  );
  if (idx === -1) return res.status(404).json({ error: 'Pertemuan tidak ditemukan atau bukan milik Anda.' });

  // Tutup pertemuan
  if (tutup) {
    data.pertemuan[idx].status = 'ditutup';
    data.pertemuan[idx].ditutup_at = new Date().toISOString();
    try { await ghSave('absensi.json', data, sha); } catch (e) {
      return res.status(500).json({ error: 'Gagal menyimpan.' });
    }
    return res.status(200).json({ message: 'Pertemuan berhasil ditutup.' });
  }

  // Verifikasi satu mahasiswa
  if (!mhs_id || !status) {
    return res.status(400).json({ error: 'mhs_id dan status diperlukan untuk verifikasi.' });
  }
  if (!['hadir', 'izin', 'sakit', 'tidak_hadir'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid. Gunakan: hadir, izin, sakit, tidak_hadir.' });
  }

  const kidx = data.pertemuan[idx].kehadiran.findIndex(k => k.mhs_id === mhs_id);
  if (kidx === -1) {
    // Dosen bisa langsung set status walau mahasiswa belum submit (mis. mahasiswa hadir tapi lupa submit)
    data.pertemuan[idx].kehadiran.push({
      mhs_id,
      nim:          mhs_id,
      nama:         req.body.nama || mhs_id,
      status,
      keterangan:   '',
      keterangan_dosen: (keterangan_dosen || '').trim(),
      submitted_at: null,
      verified_at:  new Date().toISOString(),
    });
  } else {
    data.pertemuan[idx].kehadiran[kidx].status        = status;
    data.pertemuan[idx].kehadiran[kidx].verified_at   = new Date().toISOString();
    if (keterangan_dosen !== undefined) {
      data.pertemuan[idx].kehadiran[kidx].keterangan_dosen = keterangan_dosen.trim();
    }
  }

  try { await ghSave('absensi.json', data, sha); } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan.' });
  }

  return res.status(200).json({ message: `Kehadiran berhasil diverifikasi sebagai "${status}".` });
}

// ─── REKAP ABSENSI (Dosen only) ───────────────────────────────────────────────
// Query: matkul
// Mengembalikan: semua pertemuan + ringkasan kehadiran per mahasiswa

async function absRekap(req, res) {
  const session = await requireAuth(req, res, ['dosen']);
  if (!session) return;

  const { matkul } = req.query;
  if (!matkul) return res.status(400).json({ error: 'Parameter matkul diperlukan.' });

  let result;
  try { result = await ghGet('absensi.json'); } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data absensi.' });
  }

  const list = (result.data.pertemuan || []).filter(
    p => p.matkul === matkul && p.dosen_id === session.id
  );

  // Hitung statistik per mahasiswa
  const mhsMap = {};
  list.forEach(p => {
    p.kehadiran.forEach(k => {
      if (!mhsMap[k.mhs_id]) {
        mhsMap[k.mhs_id] = { mhs_id: k.mhs_id, nim: k.nim, nama: k.nama, hadir: 0, izin: 0, tidak_hadir: 0, menunggu: 0 };
      }
      const s = k.status;
      if (s === 'hadir') mhsMap[k.mhs_id].hadir++;
      else if (s === 'izin') mhsMap[k.mhs_id].izin++;
      else if (s === 'tidak_hadir') mhsMap[k.mhs_id].tidak_hadir++;
      else mhsMap[k.mhs_id].menunggu++;
    });
  });

  return res.status(200).json({
    pertemuan: list,
    total_pertemuan: list.length,
    rekap_mahasiswa: Object.values(mhsMap),
  });
}


function roomKey(matkul) {
  return String(matkul).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

// ═══════════════════════════════════════════════════════════════════════════
// DISKUSI
// ═══════════════════════════════════════════════════════════════════════════

async function routeDiskusi(action, req, res) {
  switch (action) {
    case 'kirim': return disKirim(req, res);
    case 'pesan': return disPesan(req, res);
    case 'hapus': return disHapus(req, res);
    default: return res.status(404).json({ error: `Action diskusi tidak dikenal: ${action}` });
  }
}

async function disKirim(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireAuth(req, res);
  if (!session) return;

  const { matkul, isi, nama } = req.body || {};
  if (!matkul || !isi || !isi.trim()) {
    return res.status(400).json({ error: 'matkul dan isi pesan diperlukan.' });
  }
  if (isi.trim().length > 2000) {
    return res.status(400).json({ error: 'Pesan terlalu panjang (maks 2000 karakter).' });
  }

  let result;
  try { result = await ghGet('diskusi.json'); } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data diskusi.' });
  }

  const { data, sha } = result;
  const key = roomKey(matkul);
  if (!data.rooms) data.rooms = {};
  if (!data.rooms[key]) data.rooms[key] = [];

  const pesan = {
    id:         `msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    sender_id:  session.id,
    sender_nim: session.nim_nip,
    sender_nama:(nama || session.nim_nip).trim(),
    role:       session.role,
    matkul:     matkul.trim(),
    isi:        isi.trim(),
    created_at: new Date().toISOString(),
    dihapus:    false,
  };

  data.rooms[key].push(pesan);

  try { await ghSave('diskusi.json', data, sha); } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan pesan.' });
  }

  return res.status(200).json({ message: 'Pesan terkirim.', pesan });
}

// ─── AMBIL PESAN ──────────────────────────────────────────────────────────────
// Query: matkul, limit (default 50), before_id (pagination optional)

async function disPesan(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { matkul, limit, before_id } = req.query;
  if (!matkul) return res.status(400).json({ error: 'Parameter matkul diperlukan.' });

  let result;
  try { result = await ghGet('diskusi.json'); } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data diskusi.' });
  }

  const key = roomKey(matkul);
  let list = (result.data.rooms?.[key] || []).filter(p => !p.dihapus);

  // Pagination: ambil pesan sebelum before_id
  if (before_id) {
    const idx = list.findIndex(p => p.id === before_id);
    if (idx > 0) list = list.slice(0, idx);
  }

  const n = Math.min(parseInt(limit) || 50, 100);
  list = list.slice(-n); // ambil n pesan terbaru

  return res.status(200).json({ pesan: list, total: list.length });
}

// ─── HAPUS PESAN ──────────────────────────────────────────────────────────────
// Body: { matkul, pesan_id }
// Dosen bisa hapus semua pesan di room mereka, mahasiswa hanya pesannya sendiri

async function disHapus(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireAuth(req, res);
  if (!session) return;

  const { matkul, pesan_id } = req.body || {};
  if (!matkul || !pesan_id) {
    return res.status(400).json({ error: 'matkul dan pesan_id diperlukan.' });
  }

  let result;
  try { result = await ghGet('diskusi.json'); } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data.' });
  }

  const { data, sha } = result;
  const key = roomKey(matkul);
  const list = data.rooms?.[key];
  if (!list) return res.status(404).json({ error: 'Ruang diskusi tidak ditemukan.' });

  const idx = list.findIndex(p => p.id === pesan_id);
  if (idx === -1) return res.status(404).json({ error: 'Pesan tidak ditemukan.' });

  const pesan = list[idx];
  // Mahasiswa hanya bisa hapus pesannya sendiri
  if (session.role === 'mahasiswa' && pesan.sender_id !== session.id) {
    return res.status(403).json({ error: 'Anda hanya bisa menghapus pesan Anda sendiri.' });
  }

  // Soft delete
  data.rooms[key][idx].dihapus = true;
  data.rooms[key][idx].dihapus_at = new Date().toISOString();

  try { await ghSave('diskusi.json', data, sha); } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan.' });
  }

  return res.status(200).json({ message: 'Pesan berhasil dihapus.' });
}
