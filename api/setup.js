// POST /api/setup
// Inisialisasi data awal: prodi, matkul, dan akun admin pertama
// Hanya bisa dijalankan sekali (kalau data sudah ada, tolak)
// Header: x-setup-key = nilai dari ENV SETUP_KEY

const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { readCollection, writeCollection, writeFile, readFile } = require('../_github')

function hashPass(pass) {
  return crypto.createHash('sha256').update(pass + process.env.JWT_SECRET).digest('hex')
}

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-setup-key')
}

const PRODI_DATA = [
  { kode: 'PJKR', nama: 'Pendidikan Jasmani Kesehatan dan Rekreasi' },
  { kode: 'PGSD', nama: 'Pendidikan Guru Sekolah Dasar' },
  { kode: 'PBI',  nama: 'Pendidikan Bahasa Inggris' },
  { kode: 'PMTK', nama: 'Pendidikan Matematika' },
]

module.exports = async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Cek setup key
  const key = req.headers['x-setup-key']
  if (!key || key !== process.env.SETUP_KEY) {
    return res.status(401).json({ error: 'Setup key salah atau tidak ada' })
  }

  // Cek apakah sudah pernah disetup
  const { data: existing } = await readFile('data/_setup_done.json')
  if (existing) return res.status(409).json({ error: 'Setup sudah pernah dijalankan' })

  try {
    // 1. Prodi
    const prodi = PRODI_DATA.map(p => ({ id: uuidv4(), ...p, created_at: new Date().toISOString() }))
    const { sha: prodiSha } = await readFile('data/prodi.json')
    await writeFile('data/prodi.json', prodi, prodiSha)

    // 2. Admin pertama
    const adminPass = req.body?.admin_password || 'Admin123!'
    const adminNim  = req.body?.admin_nim       || 'admin001'
    const adminUser = {
      id: uuidv4(), nim: adminNim, nama: 'Administrator',
      role: 'admin', prodi_id: null,
      password_hash: hashPass(adminPass),
      created_at: new Date().toISOString(),
    }
    const { sha: usersSha } = await readFile('data/users.json')
    await writeFile('data/users.json', [adminUser], usersSha)

    // 3. Inisialisasi koleksi kosong
    const empty = []
    const emptyCollections = ['matkul', 'enrollment', 'tugas', 'pengumpulan', 'absensi', 'diskusi', 'nilai']
    for (const col of emptyCollections) {
      const { sha } = await readFile(`data/${col}.json`)
      if (!sha) await writeFile(`data/${col}.json`, empty, null)
    }

    // 4. Tandai setup selesai
    await writeFile('data/_setup_done.json', { done: true, at: new Date().toISOString() }, null)

    return res.status(200).json({
      success: true,
      message: 'Setup selesai!',
      admin: { nim: adminNim, password: adminPass },
      prodi: prodi.map(p => ({ kode: p.kode, nama: p.nama })),
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
