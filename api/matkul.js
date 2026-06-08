// /api/matkul
// GET    — list (semua authenticated), filter by prodi_id, dosen_id, semester
// POST   — tambah (admin/dosen)
// PUT    — update (admin/dosen pemilik)
// DELETE — hapus (admin)

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
    const { items: matkul } = await readCollection('matkul')
    const { items: prodi }  = await readCollection('prodi')
    const { items: users }  = await readCollection('users')

    // Join prodi dan dosen
    const enriched = matkul.map(m => ({
      ...m,
      prodi: prodi.find(p => p.id === m.prodi_id) || null,
      dosen: users.find(u => u.id === m.dosen_id) ? { id: m.dosen_id, nama: users.find(u => u.id === m.dosen_id).nama } : null,
    }))

    // Filter untuk dosen: hanya matkul yang dia ampu
    let result = enriched
    if (user.role === 'dosen') {
      result = enriched.filter(m => m.dosen_id === user.id)
    }

    // Filter by query
    const { prodi_id, semester, dosen_id } = req.query || {}
    if (prodi_id)  result = result.filter(m => m.prodi_id === prodi_id)
    if (semester)  result = result.filter(m => String(m.semester) === String(semester))
    if (dosen_id)  result = result.filter(m => m.dosen_id === dosen_id)

    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    const caller = requireRole(req, res, ['admin', 'dosen'])
    if (!caller) return
    const { kode, nama, sks, semester, prodi_id, dosen_id } = req.body || {}
    if (!kode || !nama) return res.status(400).json({ error: 'kode dan nama wajib' })
    const { items, sha } = await readCollection('matkul')
    if (items.find(m => m.kode === kode)) return res.status(409).json({ error: `Kode ${kode} sudah ada` })
    const newMatkul = {
      id: uuidv4(), kode, nama,
      sks: sks || 3, semester: semester || 1,
      prodi_id: prodi_id || null,
      dosen_id: dosen_id || (caller.role === 'dosen' ? caller.id : null),
      created_at: new Date().toISOString(),
    }
    await writeCollection('matkul', [...items, newMatkul], sha)
    return res.status(201).json({ success: true, data: newMatkul })
  }

  if (req.method === 'PUT') {
    const caller = requireRole(req, res, ['admin', 'dosen'])
    if (!caller) return
    const { id, kode, nama, sks, semester, prodi_id, dosen_id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { items, sha } = await readCollection('matkul')
    const idx = items.findIndex(m => m.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Matkul tidak ditemukan' })
    if (caller.role === 'dosen' && items[idx].dosen_id !== caller.id) {
      return res.status(403).json({ error: 'Hanya dosen pengampu yang bisa edit' })
    }
    if (kode)     items[idx].kode = kode
    if (nama)     items[idx].nama = nama
    if (sks)      items[idx].sks = sks
    if (semester) items[idx].semester = semester
    if (prodi_id !== undefined) items[idx].prodi_id = prodi_id
    if (dosen_id !== undefined) items[idx].dosen_id = dosen_id
    await writeCollection('matkul', items, sha)
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const caller = requireRole(req, res, ['admin'])
    if (!caller) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { items, sha } = await readCollection('matkul')
    await writeCollection('matkul', items.filter(m => m.id !== id), sha)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
