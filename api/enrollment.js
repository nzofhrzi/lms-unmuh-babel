// /api/enrollment
// GET  — list enrollment
// POST — daftar matkul (admin/dosen)
// DELETE — hapus enrollment (admin)

const { v4: uuidv4 } = require('uuid')
const { readCollection, writeCollection } = require('../_github')
const { requireAuth, requireRole } = require('../_jwt')

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const user = requireAuth(req, res)
    if (!user) return
    const { items } = await readCollection('enrollment')
    let result = items
    if (user.role === 'mahasiswa') result = items.filter(e => e.mahasiswa_id === user.id)
    const { matkul_id, mahasiswa_id } = req.query || {}
    if (matkul_id)   result = result.filter(e => e.matkul_id === matkul_id)
    if (mahasiswa_id) result = result.filter(e => e.mahasiswa_id === mahasiswa_id)
    return res.status(200).json(result)
  }

  if (req.method === 'POST') {
    const caller = requireRole(req, res, ['admin', 'dosen'])
    if (!caller) return
    const { mahasiswa_id, matkul_id } = req.body || {}
    if (!mahasiswa_id || !matkul_id) return res.status(400).json({ error: 'mahasiswa_id dan matkul_id wajib' })
    const { items, sha } = await readCollection('enrollment')
    if (items.find(e => e.mahasiswa_id === mahasiswa_id && e.matkul_id === matkul_id)) {
      return res.status(409).json({ error: 'Mahasiswa sudah terdaftar di matkul ini' })
    }
    const newEnroll = { id: uuidv4(), mahasiswa_id, matkul_id, created_at: new Date().toISOString() }
    await writeCollection('enrollment', [...items, newEnroll], sha)
    return res.status(201).json({ success: true, data: newEnroll })
  }

  if (req.method === 'DELETE') {
    const caller = requireRole(req, res, ['admin'])
    if (!caller) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { items, sha } = await readCollection('enrollment')
    await writeCollection('enrollment', items.filter(e => e.id !== id), sha)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
