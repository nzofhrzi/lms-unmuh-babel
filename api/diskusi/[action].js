// api/diskusi/[action].js
// Sistem Diskusi LMS — Chat per Mata Kuliah
// Actions:
//   kirim    → dosen/mahasiswa: kirim pesan ke ruang diskusi matkul
//   pesan    → dosen/mahasiswa: ambil pesan terbaru suatu matkul
//   hapus    → dosen/pengirim: hapus pesan
// Storage: diskusi.json via GitHub API

import { webcrypto } from 'crypto';
import { Buffer } from 'buffer';

const crypto = webcrypto;
const FILE = 'diskusi.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  try {
    switch (action) {
      case 'kirim':  return await handleKirim(req, res);
      case 'pesan':  return await handlePesan(req, res);
      case 'hapus':  return await handleHapus(req, res);
      default:
        return res.status(404).json({ error: `Action tidak dikenal: ${action}` });
    }
  } catch (err) {
    console.error(`[diskusi/${action}] Error:`, err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}

// ─── GITHUB HELPERS ───────────────────────────────────────────────────────────

function getGHConfig() {
  const { GITHUB_OWNER, GITHUB_REPO, GITHUB_PAT } = process.env;
  if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_PAT) return null;
  return {
    url: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE}`,
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
  };
}

async function getData() {
  const gh = getGHConfig();
  if (!gh) throw new Error('ENV_MISSING');
  const r = await fetch(gh.url, { headers: gh.headers });
  if (r.status === 404) {
    return { data: { rooms: {} }, sha: null };
  }
  if (!r.ok) throw new Error(`GitHub GET error: ${r.status}`);
  const j = await r.json();
  const decoded = Buffer.from(j.content, 'base64').toString('utf-8');
  return { data: JSON.parse(decoded), sha: j.sha };
}

async function saveData(data, sha) {
  const gh = getGHConfig();
  if (!gh) throw new Error('ENV_MISSING');

  // Batasi tiap room maksimal 200 pesan terbaru (FIFO)
  const MAX_PER_ROOM = 200;
  if (data.rooms) {
    for (const key of Object.keys(data.rooms)) {
      const msgs = data.rooms[key];
      if (Array.isArray(msgs) && msgs.length > MAX_PER_ROOM) {
        data.rooms[key] = msgs.slice(msgs.length - MAX_PER_ROOM);
      }
    }
  }

  const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64');
  const body = { message: 'Update diskusi.json via LMS API', content };
  if (sha) body.sha = sha;
  const r = await fetch(gh.url, {
    method: 'PUT',
    headers: gh.headers,
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`GitHub PUT error ${r.status}: ${await r.text()}`);
  return true;
}

// ─── TOKEN VERIFY ─────────────────────────────────────────────────────────────

async function verifyToken(token) {
  try {
    const secret  = process.env.SESSION_SECRET || 'lms-secret-key';
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts   = decoded.split('|');
    if (parts.length < 5) return null;
    const sigHex  = parts[parts.length - 1];
    const payload = parts.slice(0, parts.length - 1).join('|');
    const [nim_nip, role, id, tsStr] = parts;
    const ts = parseInt(tsStr);
    if (isNaN(ts) || Date.now() - ts > 24 * 60 * 60 * 1000) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const expected = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (sigHex !== expected) return null;
    return { nim_nip, role, id };
  } catch { return null; }
}

async function requireAuth(req, res) {
  const token = req.headers['x-session-token'];
  if (!token) { res.status(401).json({ error: 'Token diperlukan.' }); return null; }
  const session = await verifyToken(token);
  if (!session) { res.status(401).json({ error: 'Sesi tidak valid.' }); return null; }
  return session;
}

// ─── ROOM KEY ─────────────────────────────────────────────────────────────────
// Normalisasi nama matkul → key yang aman untuk JSON key
function roomKey(matkul) {
  return matkul.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

// ─── KIRIM PESAN ──────────────────────────────────────────────────────────────
// Body: { matkul, isi, nama }

async function handleKirim(req, res) {
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
  try { result = await getData(); } catch (e) {
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

  try { await saveData(data, sha); } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan pesan.' });
  }

  return res.status(200).json({ message: 'Pesan terkirim.', pesan });
}

// ─── AMBIL PESAN ──────────────────────────────────────────────────────────────
// Query: matkul, limit (default 50), before_id (pagination optional)

async function handlePesan(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { matkul, limit, before_id } = req.query;
  if (!matkul) return res.status(400).json({ error: 'Parameter matkul diperlukan.' });

  let result;
  try { result = await getData(); } catch (e) {
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

async function handleHapus(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireAuth(req, res);
  if (!session) return;

  const { matkul, pesan_id } = req.body || {};
  if (!matkul || !pesan_id) {
    return res.status(400).json({ error: 'matkul dan pesan_id diperlukan.' });
  }

  let result;
  try { result = await getData(); } catch (e) {
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

  try { await saveData(data, sha); } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan.' });
  }

  return res.status(200).json({ message: 'Pesan berhasil dihapus.' });
}
