// /api/pengumpulan
// GET    — list pengumpulan
// POST   — kumpul tugas (mahasiswa)
// PUT    — beri nilai (dosen/admin)

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
    const { items } = await readCollection('pengumpulan')
    let result = items
    if (user.role === 'mahasiswa') result = items.filter(p => p.mahasiswa_id === user.id)
    const { tugas_id, mahasiswa_id } = req.query || {}
    if (tugas_id)     result = result.filter(p => p.tugas_id === tugas_id)
    if (mahasiswa_id) result = result.filter(p => p.mahasiswa_id === mahasiswa_id)
    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    const caller = requireRole(req, res, ['mahasiswa'])
    if (!caller) return
    const { tugas_id, isi_jawaban, file_url } = req.body || {}
    if (!tugas_id) return res.status(400).json({ error: 'tugas_id wajib' })
    const { items, sha } = await readCollection('pengumpulan')
    const existing = items.find(p => p.tugas_id === tugas_id && p.mahasiswa_id === caller.id)
    if (existing) {
      // Update existing submission
      const idx = items.indexOf(existing)
      items[idx] = { ...existing, isi_jawaban, file_url, updated_at: new Date().toISOString() }
      await writeCollection('pengumpulan', items, sha)
      return res.status(200).json({ success: true, message: 'Tugas diperbarui' })
    }
    const newKumpul = {
      id: uuidv4(), tugas_id, mahasiswa_id: caller.id,
      isi_jawaban: isi_jawaban || '', file_url: file_url || null,
      nilai: null, feedback: null,
      submitted_at: new Date().toISOString(),
    }
    await writeCollection('pengumpulan', [...items, newKumpul], sha)
    return res.status(201).json({ success: true, message: 'Tugas berhasil dikumpulkan', data: newKumpul })
  }

  if (req.method === 'PUT') {
    const caller = requireRole(req, res, ['dosen', 'admin'])
    if (!caller) return
    const { id, nilai, feedback } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { items, sha } = await readCollection('pengumpulan')
    const idx = items.findIndex(p => p.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Pengumpulan tidak ditemukan' })
    if (nilai !== undefined) items[idx].nilai = nilai
    if (feedback !== undefined) items[idx].feedback = feedback
    items[idx].graded_at = new Date().toISOString()
    await writeCollection('pengumpulan', items, sha)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
