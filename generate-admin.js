/**
 * Script: generate-admin.js
 * Jalankan: node generate-admin.js
 *
 * Ganti nilai JWT_SECRET di bawah sesuai yang kamu set di Vercel ENV.
 * Output: isi untuk data/users.json — copy ke repo GitHub kamu.
 */

const crypto = require('crypto')

// ============================================================
// ⚠️  GANTI INI sesuai ENV kamu di Vercel
// ============================================================
const JWT_SECRET    = 'lms-unmuh-supersecret-2024!'  // nilai SETUP_KEY di Vercel
const ADMIN_NIM     = 'admin001'
const ADMIN_PASSWORD = 'Admin123!'
// ============================================================

function hashPass(pass) {
  return crypto.createHash('sha256').update(pass + JWT_SECRET).digest('hex')
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

const adminUser = {
  id: uuidv4(),
  nim: ADMIN_NIM,
  nama: 'Administrator',
  role: 'admin',
  prodi_id: null,
  password_hash: hashPass(ADMIN_PASSWORD),
  created_at: new Date().toISOString(),
}

const output = JSON.stringify([adminUser], null, 2)

console.log('\n✅ Isi untuk data/users.json:\n')
console.log(output)
console.log('\n📋 Copy teks di atas ke file data/users.json di repo GitHub kamu.')
console.log(`\n🔑 Login dengan NIM: ${ADMIN_NIM} | Password: ${ADMIN_PASSWORD}`)
