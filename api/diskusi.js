// /api/diskusi
// GET  — list pesan diskusi per matkul
// POST — kirim pesan

const { v4: uuidv4 } = require('uuid')
const { readCollection, writeCollection } = require('../_github')
const { requireAuth } = require('../_jwt')

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
    const { items } = await readCollection('diskusi')
    const { matkul_id } = req.query || {}
    const result = matkul_id ? items.filter(d => d.matkul_id === matkul_id) : items
    return res.status(200).json(result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
  }

  if (req.method === 'POST') {
    const user = requireAuth(req, res)
    if (!user) return
    const { matkul_id, pesan } = req.body || {}
    if (!matkul_id || !pesan) return res.status(400).json({ error: 'matkul_id dan pesan wajib' })
    const { items, sha } = await readCollection('diskusi')
    const newMsg = {
      id: uuidv4(), matkul_id, pesan,
      pengirim_id: user.id, pengirim_nama: user.nama, pengirim_role: user.role,
      created_at: new Date().toISOString(),
    }
    await writeCollection('diskusi', [...items, newMsg], sha)
    return res.status(201).json({ success: true, data: newMsg })
  }

  if (req.method === 'DELETE') {
    const user = requireAuth(req, res)
    if (!user) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { items, sha } = await readCollection('diskusi')
    const msg = items.find(d => d.id === id)
    if (!msg) return res.status(404).json({ error: 'Pesan tidak ditemukan' })
    if (msg.pengirim_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya pengirim atau admin yang bisa hapus' })
    }
    await writeCollection('diskusi', items.filter(d => d.id !== id), sha)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
