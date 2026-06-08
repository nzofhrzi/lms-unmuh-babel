// ============================================================
// GitHub Storage Helper — semua data disimpan di repo GitHub
// ============================================================
// ENV yang dibutuhkan:
//   GITHUB_TOKEN  = PAT dengan scope "repo"
//   GITHUB_REPO   = "username/repo-name"
//   GITHUB_BRANCH = "main" (default)

const TOKEN  = process.env.GITHUB_TOKEN
const REPO   = process.env.GITHUB_REPO
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const BASE   = `https://api.github.com/repos/${REPO}/contents`

const headers = {
  Authorization: `token ${TOKEN}`,
  Accept: 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
  'User-Agent': 'LMS-Unmuh',
}

// Baca file JSON dari repo
async function readFile(path) {
  const res = await fetch(`${BASE}/${path}?ref=${BRANCH}`, { headers })
  if (res.status === 404) return { data: null, sha: null }
  if (!res.ok) throw new Error(`GitHub read error ${res.status}: ${path}`)
  const json = await res.json()
  const content = Buffer.from(json.content, 'base64').toString('utf8')
  return { data: JSON.parse(content), sha: json.sha }
}

// Tulis file JSON ke repo (create atau update)
async function writeFile(path, data, sha = null) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
  const body = {
    message: `data: update ${path}`,
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub write error ${res.status}: ${err.message || path}`)
  }
  return res.json()
}

// Hapus file dari repo
async function deleteFile(path, sha, message = null) {
  const body = {
    message: message || `data: delete ${path}`,
    sha,
    branch: BRANCH,
  }
  const res = await fetch(`${BASE}/${path}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GitHub delete error ${res.status}: ${path}`)
  return res.json()
}

// Helper: baca koleksi JSON (array), return [] kalau belum ada
async function readCollection(name) {
  const { data, sha } = await readFile(`data/${name}.json`)
  return { items: data || [], sha }
}

// Helper: simpan koleksi JSON
async function writeCollection(name, items, sha) {
  return writeFile(`data/${name}.json`, items, sha)
}

module.exports = { readFile, writeFile, deleteFile, readCollection, writeCollection }
