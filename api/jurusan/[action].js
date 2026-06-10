// api/jurusan/[action].js
// CRUD Jurusan — disimpan di jurusan.json via GitHub API
// Actions: list (public), list-admin, add, update, delete
// list → publik (dapat diakses tanpa auth)
// add/update/delete/list-admin → butuh x-admin-key

import { Buffer } from 'buffer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-session-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  // Endpoint publik
  if (action === 'list') {
    return await handleList(req, res);
  }

  // Semua endpoint lain butuh admin key
  if (!checkAdmin(req, res)) return;

  try {
    switch (action) {
      case 'list-admin': return await handleList(req, res);
      case 'add':        return await handleAdd(req, res);
      case 'update':     return await handleUpdate(req, res);
      case 'delete':     return await handleDelete(req, res);
      default:
        return res.status(404).json({ error: `Action tidak dikenal: ${action}` });
    }
  } catch (err) {
    console.error(`[jurusan/${action}] Error:`, err);
    return res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}

// ─── GITHUB HELPERS ──────────────────────────────────────────────────────────

const FILE = 'jurusan.json';

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
    body: JSON.stringify({
      message: 'Update jurusan.json via LMS API',
      content,
      sha,
    })
  });
  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(`GitHub PUT error ${r.status}: ${errBody}`);
  }
  return true;
}

// ─── ADMIN CHECK ──────────────────────────────────────────────────────────────

function checkAdmin(req, res) {
  const { ADMIN_KEY } = process.env;
  const key = req.headers['x-admin-key']
    || (req.body && (req.body.adminKey || req.body.key))
    || '';
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    res.status(403).json({ error: 'Akses ditolak.' });
    return false;
  }
  return true;
}

// ─── LIST (PUBLIK) ────────────────────────────────────────────────────────────

async function handleList(req, res) {
  let result;
  try {
    result = await getData();
  } catch (e) {
    const msg = e.message === 'ENV_MISSING'
      ? 'Konfigurasi server belum diatur.'
      : 'Gagal membaca data jurusan.';
    return res.status(500).json({ error: msg });
  }
  return res.status(200).json({ jurusan: result.data.jurusan || [] });
}

// ─── ADD ──────────────────────────────────────────────────────────────────────

async function handleAdd(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });

  const { nama, kode, fakultas, jenjang } = req.body || {};
  if (!nama || !kode) {
    return res.status(400).json({ error: 'nama dan kode jurusan diperlukan.' });
  }

  let result;
  try {
    result = await getData();
  } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data jurusan.' });
  }

  const { data, sha } = result;
  const list = data.jurusan || [];

  if (list.find(j => j.kode.toLowerCase() === kode.toLowerCase())) {
    return res.status(409).json({ error: 'Kode jurusan sudah digunakan.' });
  }

  const newJurusan = {
    id: `jur_${Date.now()}`,
    nama: nama.trim(),
    kode: kode.trim().toUpperCase(),
    fakultas: (fakultas || '').trim(),
    jenjang: (jenjang || 'S1').trim(),
    created_at: new Date().toISOString(),
  };

  list.push(newJurusan);
  data.jurusan = list;

  try {
    await saveData(data, sha);
  } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan data jurusan.' });
  }

  return res.status(200).json({ message: `Jurusan "${nama}" berhasil ditambahkan.`, jurusan: newJurusan });
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

async function handleUpdate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });

  const { id, nama, kode, fakultas, jenjang } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id jurusan diperlukan.' });

  let result;
  try {
    result = await getData();
  } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data jurusan.' });
  }

  const { data, sha } = result;
  const idx = (data.jurusan || []).findIndex(j => j.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Jurusan tidak ditemukan.' });

  if (nama)     data.jurusan[idx].nama     = nama.trim();
  if (kode)     data.jurusan[idx].kode     = kode.trim().toUpperCase();
  if (fakultas) data.jurusan[idx].fakultas = fakultas.trim();
  if (jenjang)  data.jurusan[idx].jenjang  = jenjang.trim();
  data.jurusan[idx].updated_at = new Date().toISOString();

  try {
    await saveData(data, sha);
  } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan.' });
  }

  return res.status(200).json({ message: 'Jurusan berhasil diperbarui.' });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

async function handleDelete(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id jurusan diperlukan.' });

  let result;
  try {
    result = await getData();
  } catch (e) {
    return res.status(500).json({ error: 'Gagal membaca data jurusan.' });
  }

  const { data, sha } = result;
  const before = (data.jurusan || []).length;
  data.jurusan = (data.jurusan || []).filter(j => j.id !== id);

  if (data.jurusan.length === before) {
    return res.status(404).json({ error: 'Jurusan tidak ditemukan.' });
  }

  try {
    await saveData(data, sha);
  } catch (e) {
    return res.status(500).json({ error: 'Gagal menyimpan.' });
  }

  return res.status(200).json({ message: 'Jurusan berhasil dihapus.' });
}
