// ============================================================
// JWT Helper — sign & verify token sederhana (HMAC-SHA256)
// ============================================================
// ENV: JWT_SECRET

const crypto = require('crypto')

const SECRET = process.env.JWT_SECRET || 'lms-unmuh-secret-change-this'

function base64url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function sign(payload, expiresInHours = 24) {
  const header  = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const exp     = Math.floor(Date.now() / 1000) + expiresInHours * 3600
  const body    = base64url(Buffer.from(JSON.stringify({ ...payload, exp, iat: Math.floor(Date.now() / 1000) })))
  const sig     = base64url(crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

function verify(token) {
  try {
    const [header, body, sig] = token.split('.')
    const expected = base64url(crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest())
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(body, 'base64').toString())
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// Middleware: ambil payload dari Authorization header
function getUser(req) {
  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  return verify(token)
}

// Middleware: require auth, return null kalau tidak valid
function requireAuth(req, res) {
  const user = getUser(req)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  return user
}

// Middleware: require role tertentu
function requireRole(req, res, roles) {
  const user = requireAuth(req, res)
  if (!user) return null
  if (!roles.includes(user.role)) {
    res.status(403).json({ error: 'Akses ditolak' })
    return null
  }
  return user
}

module.exports = { sign, verify, getUser, requireAuth, requireRole }
