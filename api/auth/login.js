// POST /api/auth/login
// Body: { nim, password }
// Return: { token, user: { id, nim, nama, role, prodi_id } }

const crypto = require('crypto')
const { readCollection } = require('../_github')
const { sign } = require('../_jwt')

function hashPass(pass) {
  return crypto.createHash('sha256').update(pass + process.env.JWT_SECRET).digest('hex')
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nim, password } = req.body || {}
  if (!nim || !password) return res.status(400).json({ error: 'NIM dan password wajib diisi' })

  const { items: users } = await readCollection('users')
  const user = users.find(u => u.nim === nim)

  if (!user) return res.status(401).json({ error: 'NIM atau password salah' })

  const hashed = hashPass(password)
  if (user.password_hash !== hashed) return res.status(401).json({ error: 'NIM atau password salah' })

  const token = sign({ id: user.id, nim: user.nim, nama: user.nama, role: user.role, prodi_id: user.prodi_id || null })

  res.status(200).json({
    token,
    user: { id: user.id, nim: user.nim, nama: user.nama, role: user.role, prodi_id: user.prodi_id || null }
  })
}
