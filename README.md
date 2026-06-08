# LMS Unmuh Babel — GitHub + Vercel

Arsitektur penuh tanpa Supabase. Semua data disimpan sebagai JSON di repository GitHub, API berjalan sebagai Vercel Serverless Functions.

---

## Struktur Repository

```
/
├── api/                    ← Vercel Serverless Functions
│   ├── _github.js          ← GitHub storage helper
│   ├── _jwt.js             ← JWT auth helper
│   ├── auth/
│   │   ├── login.js        ← POST /api/auth/login
│   │   └── verify.js       ← GET /api/auth/verify
│   ├── users.js            ← CRUD user
│   ├── prodi.js            ← CRUD prodi
│   ├── matkul.js           ← CRUD mata kuliah
│   ├── tugas.js            ← CRUD tugas
│   ├── pengumpulan.js      ← Pengumpulan tugas mahasiswa
│   ├── absensi.js          ← Absensi
│   ├── diskusi.js          ← Forum diskusi
│   ├── enrollment.js       ← Enrollment mahasiswa-matkul
│   ├── nilai.js            ← Nilai akhir
│   └── setup.js            ← Inisialisasi data awal (sekali pakai)
├── data/                   ← Data JSON (diisi otomatis via /api/setup)
│   ├── users.json
│   ├── prodi.json
│   ├── matkul.json
│   ├── tugas.json
│   ├── pengumpulan.json
│   ├── absensi.json
│   ├── diskusi.json
│   ├── enrollment.json
│   ├── nilai.json
│   └── _setup_done.json
├── *.html                  ← Halaman frontend
├── shared.js               ← Shared helper (auth, fetch, sidebar)
├── package.json
└── vercel.json
```

---

## Langkah Deploy

### 1. Siapkan Repository GitHub

1. Buat repo baru di GitHub, misal: `username/lms-unmuh-data`
2. Upload semua file ini ke repo tersebut
3. Buat folder `data/` di repo dan tambahkan file kosong `data/.gitkeep`

### 2. Buat GitHub Personal Access Token (PAT)

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Klik **Generate new token (classic)**
3. Centang scope: **`repo`** (full control)
4. Salin tokennya — hanya tampil sekali!

### 3. Deploy ke Vercel

1. Import repo GitHub kamu ke [vercel.com](https://vercel.com)
2. Di Vercel project → **Settings → Environment Variables**, tambahkan:

| Key | Value | Contoh |
|-----|-------|--------|
| `GITHUB_TOKEN` | PAT yang dibuat di langkah 2 | `ghp_xxxxxxxxxxxx` |
| `GITHUB_REPO` | `username/nama-repo` | `ahmaduser/lms-unmuh-data` |
| `GITHUB_BRANCH` | Branch utama | `main` |
| `JWT_SECRET` | String acak panjang | `lms-unmuh-supersecret-2024!` |
| `SETUP_KEY` | Kunci setup sekali pakai | `setup-lms-2024` |

3. Klik **Deploy**

### 4. Inisialisasi Data (Sekali Pakai)

Setelah deploy berhasil, jalankan setup awal via curl atau Postman:

```bash
curl -X POST https://your-app.vercel.app/api/setup \
  -H "Content-Type: application/json" \
  -H "x-setup-key: setup-lms-2024" \
  -d '{
    "admin_nim": "admin001",
    "admin_password": "Admin123!"
  }'
```

Response sukses:
```json
{
  "success": true,
  "message": "Setup selesai!",
  "admin": { "nim": "admin001", "password": "Admin123!" },
  "prodi": [...]
}
```

### 5. Login Pertama

Buka `https://your-app.vercel.app/login.html`

- NIM: `admin001`
- Password: `Admin123!`

---

## Role & Akses

| Role | Akses |
|------|-------|
| `admin` | Kelola semua user, matkul, lihat semua data |
| `dosen` | Kelola matkul yg diampu, upload tugas, absensi, nilai |
| `mahasiswa` | Lihat matkul, kumpul tugas, lihat absensi & nilai sendiri |

---

## Catatan Penting

- Data disimpan di **branch `main`** repo GitHub sebagai file JSON
- Setiap write (POST/PUT/DELETE) = 1 commit ke repo → histori data terjaga
- Token JWT valid **24 jam**, disimpan di `sessionStorage`
- File `/api/setup.js` hanya bisa dijalankan **sekali** (dicek via `data/_setup_done.json`)
- Untuk reset data: hapus file `data/_setup_done.json` dari repo, lalu jalankan setup ulang
