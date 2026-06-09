// api/tugas/[action].js
// CRUD Tugas — disimpan di tugas.json via GitHub API
// Actions: list, add, update, delete
// list  → dosen (filter by dosen_id) atau mahasiswa (filter by matkul)
// add   → dosen only (token)
// update→ dosen only (token)
// delete→ dosen only (token)

import { webcrypto } from 'crypto';
import { Buffer } from 'buffer';

const crypto = webcrypto;
const FILE = 'tugas.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  try {
    switch (action) {
      case 'list':   return await handleList(req, res);
      case 'add':    return await handleAdd(req, res);
      case 'update': return await handleUpdate(req, res);
      case 'delete': return await handleDelete(req, res);
      default:
        return res.status(404).json({ error: `Action tidak dikenal: ${action}` });
    }
  } catch (err) {
    console.error(`[tugas/${action}] Error:`, err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}

// ─── GITHUB HELPERS ──────────────────────────────────────────────────────────

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
  if (!r.ok) throw new Error(`GitHub GET error: ${r.status}`);
  const j = await r.json();
  const decoded = Buffer.from(j.content, 'base64').toString('utf-8');
  return { data: JSON.parse(decoded), sha: j.sha };
}

async function saveData(data, sha) {
  const gh = getGHConfig();
  if (!gh) throw new Error('ENV_MISSING');
  const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64');
  const r = await fetch(gh.url, {
    method: 'PUT',
    headers: gh.headers,
    body: JSON.stringify({ message: 'Update tugas.json via LMS API', content, sha })
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
    const expected = Array.from(new Uint8Array(sigBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    if (sigHex !== expected) return null;
    return { nim_nip, role, id };
  } catch { return null; }
}

async function requireDosen(req, res) {
  const token = req.headers['x-session-token'];
  if (!token) { res.status(401).json({ error: 'Token diperlukan.' }); return null; }
  const session = await verifyToken(token);
  if (!session || session.role !== 'dosen') {
    res.status(403).json({ error: 'Hanya dosen yang dapat melakukan aksi ini.' });
    return null;
  }
  return session;
}

// ─── LIST ─────────────────────────────────────────────────────────────────────
// Query params: dosen_id, matkul (untuk filter)

async function handleList(req, res) {
  let result;
  try { result = await getData(); }
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

async function handleAdd(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireDosen(req, res);
  if (!session) return;

  const { judul, deskripsi, matkul, deadline } = req.body || {};
  if (!judul || !matkul || !deadline) {
    return res.status(400).json({ error: 'judul, matkul, dan deadline diperlukan.' });
  }

  let result;
  try { result = await getData(); } catch (e) { return res.status(500).json({ error: 'Gagal membaca data.' }); }

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

  try { await saveData(data, sha); }
  catch (e) { return res.status(500).json({ error: 'Gagal menyimpan.' }); }

  return res.status(200).json({ message: `Tugas "${judul}" berhasil ditambahkan.`, tugas: newTugas });
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

async function handleUpdate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireDosen(req, res);
  if (!session) return;

  const { id, judul, deskripsi, matkul, deadline, status } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id tugas diperlukan.' });

  let result;
  try { result = await getData(); } catch (e) { return res.status(500).json({ error: 'Gagal membaca data.' }); }

  const { data, sha } = result;
  const idx = (data.tugas || []).findIndex(t => t.id === id && t.dosen_id === session.id);
  if (idx === -1) return res.status(404).json({ error: 'Tugas tidak ditemukan atau bukan milik Anda.' });

  if (judul)    data.tugas[idx].judul    = judul.trim();
  if (deskripsi !== undefined) data.tugas[idx].deskripsi = deskripsi.trim();
  if (matkul)   data.tugas[idx].matkul   = matkul.trim();
  if (deadline) data.tugas[idx].deadline = deadline;
  if (status && ['aktif','ditutup','selesai'].includes(status)) data.tugas[idx].status = status;
  data.tugas[idx].updated_at = new Date().toISOString();

  try { await saveData(data, sha); }
  catch (e) { return res.status(500).json({ error: 'Gagal menyimpan.' }); }

  return res.status(200).json({ message: 'Tugas berhasil diperbarui.' });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

async function handleDelete(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const session = await requireDosen(req, res);
  if (!session) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id tugas diperlukan.' });

  let result;
  try { result = await getData(); } catch (e) { return res.status(500).json({ error: 'Gagal membaca data.' }); }

  const { data, sha } = result;
  const before = (data.tugas || []).length;
  // Hanya dosen pemilik atau admin yang bisa hapus
  data.tugas = (data.tugas || []).filter(t => !(t.id === id && t.dosen_id === session.id));
  if (data.tugas.length === before) return res.status(404).json({ error: 'Tugas tidak ditemukan atau bukan milik Anda.' });

  try { await saveData(data, sha); }
  catch (e) { return res.status(500).json({ error: 'Gagal menyimpan.' }); }

  return res.status(200).json({ message: 'Tugas berhasil dihapus.' });
}
