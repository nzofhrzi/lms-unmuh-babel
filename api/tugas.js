// /api/tugas
// GET    — list tugas (authenticated)
// POST   — buat tugas (dosen/admin)
// PUT    — update (dosen pemilik / admin)
// DELETE — hapus (dosen pemilik / admin)

const { v4: uuidv4 } = require('uuid')
const { readCollection, writeCollection } = require('../_github')
const { requireAuth, requireRole } = require('../_jwt')

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const user = requireAuth(req, res)
    if (!user) return
    const { items: tugas }  = await readCollection('tugas')
    const { items: matkul } = await readCollection('matkul')

    const enriched = tugas.map(t => ({
      ...t,
      matkul: matkul.find(m => m.id === t.matkul_id) || null,
    }))

    let result = enriched
    if (user.role === 'dosen') result = enriched.filter(t => t.dosen_id === user.id)
    
    const { matkul_id } = req.query || {}
    if (matkul_id) result = result.filter(t => t.matkul_id === matkul_id)

    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    const caller = requireRole(req, res, ['dosen', 'admin'])
    if (!caller) return
    const { judul, deskripsi, matkul_id, tanggal_buka, deadline } = req.body || {}
    if (!judul || !matkul_id || !deadline) {
      return res.status(400).json({ error: 'judul, matkul_id, deadline wajib' })
    }
    const { items, sha } = await readCollection('tugas')
    const newTugas = {
      id: uuidv4(), judul, deskripsi: deskripsi || '',
      matkul_id, dosen_id: caller.id,
      tanggal_buka: tanggal_buka || new Date().toISOString().split('T')[0],
      deadline, created_at: new Date().toISOString(),
    }
    await writeCollection('tugas', [...items, newTugas], sha)
    return res.status(201).json({ success: true, data: newTugas })
  }

  if (req.method === 'PUT') {
    const caller = requireRole(req, res, ['dosen', 'admin'])
    if (!caller) return
    const { id, judul, deskripsi, deadline, tanggal_buka } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { items, sha } = await readCollection('tugas')
    const idx = items.findIndex(t => t.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Tugas tidak ditemukan' })
    if (caller.role === 'dosen' && items[idx].dosen_id !== caller.id) {
      return res.status(403).json({ error: 'Hanya dosen pembuat yang bisa edit' })
    }
    if (judul)        items[idx].judul = judul
    if (deskripsi !== undefined) items[idx].deskripsi = deskripsi
    if (deadline)     items[idx].deadline = deadline
    if (tanggal_buka) items[idx].tanggal_buka = tanggal_buka
    await writeCollection('tugas', items, sha)
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const caller = requireRole(req, res, ['dosen', 'admin'])
    if (!caller) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { items, sha } = await readCollection('tugas')
    const tgs = items.find(t => t.id === id)
    if (!tgs) return res.status(404).json({ error: 'Tugas tidak ditemukan' })
    if (caller.role === 'dosen' && tgs.dosen_id !== caller.id) {
      return res.status(403).json({ error: 'Akses ditolak' })
    }
    await writeCollection('tugas', items.filter(t => t.id !== id), sha)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
