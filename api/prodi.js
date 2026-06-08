// /api/prodi
// GET — list semua prodi (semua role)
// POST/PUT/DELETE — admin only

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
    requireAuth(req, res)
    // tidak return kalau gagal karena kita cek sendiri
    const { items } = await readCollection('prodi')
    return res.status(200).json(items)
  }

  if (req.method === 'POST') {
    const caller = requireRole(req, res, ['admin'])
    if (!caller) return
    const { kode, nama } = req.body || {}
    if (!kode || !nama) return res.status(400).json({ error: 'kode dan nama wajib' })
    const { items, sha } = await readCollection('prodi')
    if (items.find(p => p.kode === kode)) return res.status(409).json({ error: `Kode ${kode} sudah ada` })
    const newProdi = { id: uuidv4(), kode, nama, created_at: new Date().toISOString() }
    await writeCollection('prodi', [...items, newProdi], sha)
    return res.status(201).json({ success: true, data: newProdi })
  }

  if (req.method === 'PUT') {
    const caller = requireRole(req, res, ['admin'])
    if (!caller) return
    const { id, kode, nama } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { items, sha } = await readCollection('prodi')
    const idx = items.findIndex(p => p.id === id)
    if (idx === -1) return res.status(404).json({ error: 'Prodi tidak ditemukan' })
    if (kode) items[idx].kode = kode
    if (nama) items[idx].nama = nama
    await writeCollection('prodi', items, sha)
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const caller = requireRole(req, res, ['admin'])
    if (!caller) return
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { items, sha } = await readCollection('prodi')
    await writeCollection('prodi', items.filter(p => p.id !== id), sha)
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
