// /api/nilai
// GET  — list nilai
// POST/PUT — upsert nilai (dosen/admin)

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
    const { items } = await readCollection('nilai')
    let result = items
    if (user.role === 'mahasiswa') result = items.filter(n => n.mahasiswa_id === user.id)
    const { matkul_id, mahasiswa_id } = req.query || {}
    if (matkul_id)   result = result.filter(n => n.matkul_id === matkul_id)
    if (mahasiswa_id) result = result.filter(n => n.mahasiswa_id === mahasiswa_id)
    return res.status(200).json(result)
  }

  // POST = upsert nilai
  if (req.method === 'POST') {
    const caller = requireRole(req, res, ['dosen', 'admin'])
    if (!caller) return
    const { mahasiswa_id, matkul_id, nilai_tugas, nilai_uts, nilai_uas } = req.body || {}
    if (!mahasiswa_id || !matkul_id) return res.status(400).json({ error: 'mahasiswa_id dan matkul_id wajib' })
    const { items, sha } = await readCollection('nilai')
    const idx = items.findIndex(n => n.mahasiswa_id === mahasiswa_id && n.matkul_id === matkul_id)

    const nilaiAkhir = () => {
      const nt = nilai_tugas || 0, nuts = nilai_uts || 0, nuas = nilai_uas || 0
      return Math.round(nt * 0.3 + nuts * 0.3 + nuas * 0.4)
    }

    if (idx !== -1) {
      if (nilai_tugas !== undefined) items[idx].nilai_tugas = nilai_tugas
      if (nilai_uts   !== undefined) items[idx].nilai_uts   = nilai_uts
      if (nilai_uas   !== undefined) items[idx].nilai_uas   = nilai_uas
      items[idx].nilai_akhir = nilaiAkhir()
      items[idx].updated_at  = new Date().toISOString()
      await writeCollection('nilai', items, sha)
    } else {
      const newNilai = {
        id: uuidv4(), mahasiswa_id, matkul_id,
        nilai_tugas: nilai_tugas || null, nilai_uts: nilai_uts || null, nilai_uas: nilai_uas || null,
        nilai_akhir: nilaiAkhir(),
        created_at: new Date().toISOString(),
      }
      await writeCollection('nilai', [...items, newNilai], sha)
    }
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
