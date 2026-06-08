// GET /api/auth/verify
// Header: Authorization: Bearer <token>
// Return: { user }

const { getUser } = require('../_jwt')

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const user = getUser(req)
  if (!user) return res.status(401).json({ error: 'Token tidak valid atau kadaluarsa' })
  res.status(200).json({ user })
}
