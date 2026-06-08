// /api/users
// GET    — list semua user (admin)
// POST   — tambah user baru (admin)
// PUT    — update user (admin)
// DELETE — hapus user (admin)

const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { readCollection, writeCollection } = require('../_github')
const { requireRole, requireAuth } = require('../_jwt')

function hashPass(pass) {
  return crypto.createHash('sha256').update(pass + process.env.JWT_SECRET).digest('hex')
}

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET: admin bisa lihat semua, user lain hanya data sendiri
  if (req.method === 'GET') {
    const user = requireAuth(req, res)
    if (!user) return
    const { items: users } = await readCollection('users')
    if (user.role === 'admin') {
      // Hapus password_hash sebelum kirim
      return res.status(200).json(users.map(u => ({ ...u, password_hash: undefined })))
    }
    // User biasa: hanya data sendiri
    const me = users.find(u => u.id === user.id)
    if (!me) return res.status(404).json({ error: 'User tidak ditemukan' })
    return res.status(200).json({ ...me, password_hash: undefined })
  }

  // POST: tambah user baru (admin only)
  if (req.method === 'POST') {
    const caller = requireRole(req, res, ['admin'])
    if (!caller) return

    const { nim, nama, password, role, prodi_id } = req.body || {}
    if (!nim || !nama || !password || !role) {
      return res.status(400).json({ error: 'nim, nama, password, role wajib diisi' })
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' })
    if (!['mahasiswa', 'dosen', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid' })
    }

    const { items, sha } = await readCollection('users')
    if (items.find(u => u.nim === nim)) {
      return res.status(409).json({ error: `NIM ${nim} sudah terdaftar` })
    }

    const newUser = {
      id: uuidv4(),
      nim,
      nama,
      role,
      prodi_id: prodi_id || null,
      password_hash: hashPass(password),
      created_at: new Date().toISOString(),
    }

    await writeCollection('users', [...items, newUser], sha)
    return res.status(201).json({ success: true, message: `User ${nama} berhasil dibuat`, user_id: newUser.id })
  }

  // PUT: update user (admin only)
  if (req.method === 'PUT') {
    const caller = requireRole(req, res, ['admin'])
    if (!caller) return

    const { id, nama, role, prodi_id, password } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib diisi' })

    const { items, sha } = await readCollection('users')
    const idx = items.findIndex(u => u.id === id)
    if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan' })

    const updated = { ...items[idx] }
    if (nama)     updated.nama = nama
    if (role)     updated.role = role
    if (prodi_id !== undefined) updated.prodi_id = prodi_id
    if (password) updated.password_hash = hashPass(password)

    items[idx] = updated
    await writeCollection('users', items, sha)
    return res.status(200).json({ success: true, message: 'User berhasil diperbarui' })
  }

  // DELETE: hapus user (admin only)
  if (req.method === 'DELETE') {
    const caller = requireRole(req, res, ['admin'])
    if (!caller) return

    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id wajib diisi' })

    const { items, sha } = await readCollection('users')
    const filtered = items.filter(u => u.id !== id)
    if (filtered.length === items.length) return res.status(404).json({ error: 'User tidak ditemukan' })

    await writeCollection('users', filtered, sha)
    return res.status(200).json({ success: true, message: 'User berhasil dihapus' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
