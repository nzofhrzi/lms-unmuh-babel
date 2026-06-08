// /api/absensi
// GET  — list absensi
// POST — catat absensi (dosen/admin)
// PUT  — update status (dosen/admin)

const { v4: uuidv4 } = require('uuid')
const { readCollection, writeCollection } = require('../_github')
const { requireAuth, requireRole } = require('../_jwt')

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const user = requireAuth(req, res)
    if (!user) return
    const { items } = await readCollection('absensi')
    let result = items
    if (user.role === 'mahasiswa') result = items.filter(a => a.mahasiswa_id === user.id)
    const { matkul_id, mahasiswa_id, tanggal } = req.query || {}
    if (matkul_id)   result = result.filter(a => a.matkul_id === matkul_id)
    if (mahasiswa_id) result = result.filter(a => a.mahasiswa_id === mahasiswa_id)
    if (tanggal)     result = result.filter(a => a.tanggal === tanggal)
    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    const caller = requireRole(req, res, ['dosen', 'admin'])
    if (!caller) return
    // Bisa satu atau batch
    const body = req.body || {}
    const records = Array.isArray(body) ? body : [body]
    const { items, sha } = await readCollection('absensi')
    const newRecords = []
    for (const r of records) {
      const { mahasiswa_id, matkul_id, tanggal, status, pertemuan } = r
      if (!mahasiswa_id || !matkul_id || !tanggal) continue
      const existing = items.findIndex(a => a.mahasiswa_id === mahasiswa_id && a.matkul_id === matkul_id && a.tanggal === tanggal)
      if (existing !== -1) {
        items[existing].status = status || items[existing].status
        items[existing].pertemuan = pertemuan || items[existing].pertemuan
      } else {
        newRecords.push({
          id: uuidv4(), mahasiswa_id, matkul_id, tanggal,
          status: status || 'hadir', pertemuan: pertemuan || 1,
          created_at: new Date().toISOString(),
        })
      }
    }
    await writeCollection('absensi', [...items, ...newRecords], sha)
    return res.status(201).json({ success: true, count: newRecords.length })
  }

  if (req.method === 'PUT') {
    const caller = requireRole(req, res, ['dosen', 'admin'])
    if (!caller) return
    const { id, status } = req.body || {}
    if (!id || !status) return res.status(400).json({ error: 'id dan status wajib' })
    const { items, sha } = await readCollection('absensi')
    const idx = items.findIndex(a => a.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Absensi tidak ditemukan' })
    items[idx].status = status
    await writeCollection('absensi', items, sha)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
