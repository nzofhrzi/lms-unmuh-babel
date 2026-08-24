# LMS Universitas Anak Indonesia

Sistem Learning Management System (LMS) berbasis **Vercel Serverless + GitHub as Database**.

## Arsitektur Dual-Branch

| Branch | Isi | Deploy Vercel |
|--------|-----|---------------|
| **main** | Kode aplikasi (HTML, JS, API, vercel.json) | ✅ Ya |
| **data** | File JSON data (`users.json`, `jurusan.json`, …) | ❌ Tidak |

Setiap perubahan data (login, CRUD, absensi, dll.) hanya commit ke branch `data` → **tidak memicu deploy**, sehingga aman dari **Vercel push/deploy limit**.

```
vercel.json → git.deploymentEnabled
  main: true
  data: false
```

API membaca & menulis file JSON lewat GitHub Contents API dengan `?ref=data` dan `branch: "data"`.

---

## Environment Variables (Vercel)

Set di **Project Settings → Environment Variables**:

| Nama | Wajib | Keterangan |
|------|-------|------------|
| `GITHUB_OWNER` | ✅ | Username / org GitHub (contoh: `yourusername`) |
| `GITHUB_REPO` | ✅ | Nama repo (contoh: `lms-universitas-anak-indonesia`) |
| `GITHUB_PAT` | ✅ | Personal Access Token (scope: `repo`) |
| `JWT_SECRET` | ✅ | Secret kuat untuk tanda tangan token (ganti dari default!) |
| `PASS_SALT` | opsional | Salt hash password (default: `lms-salt`) |

> **Hapus** `ADMIN_KEY` / `SESSION_SECRET` lama jika masih ada.  
> Admin sekarang login seperti user biasa (role `admin`) menggunakan JWT.

---

## Setup Dual-Branch (langkah demi langkah)

### 1. Buat repo GitHub baru

```bash
# Di folder project ini
git init
git add .
git commit -m "Initial: LMS Universitas Anak Indonesia (main branch — code only)"
git branch -M main
git remote add origin https://github.com/YOUR_USER/lms-universitas-anak-indonesia.git
git push -u origin main
```

### 2. Buat branch `data` berisi file JSON

```bash
# Buat orphan branch data (hanya JSON, tanpa history kode)
git checkout --orphan data
git rm -rf .          # hapus semua file dari index
cp data/*.json .      # salin JSON ke root branch data
git add *.json
git commit -m "Initial data branch: users, jurusan, matkul, tugas, absensi, diskusi"
git push -u origin data
git checkout main     # kembali ke main
```

Struktur akhir di GitHub:

```
main  → api/, admin/, dosen/, mahasiswa/, *.html, auth.js, package.json, vercel.json
data  → users.json, jurusan.json, matkul.json, tugas.json, absensi.json, diskusi.json
```

### 3. Hubungkan ke Vercel

1. Import repo di [vercel.com](https://vercel.com)
2. Framework Preset: **Other**
3. Root Directory: `.`
4. Pastikan Production Branch = `main`
5. Isi Environment Variables (lihat tabel di atas)
6. Deploy

Vercel hanya akan deploy saat ada push ke `main`. Push ke `data` diabaikan.

### 4. Generate JWT_SECRET yang aman

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste hasilnya ke `JWT_SECRET` di Vercel.

### 5. GitHub PAT

Buat token di GitHub → Settings → Developer settings → Personal access tokens:

- Classic: centang **repo**
- Atau Fine-grained: permission **Contents: Read and write** pada repo ini saja

---

## Login Admin

Akun seed (dari `users.json`):

| Field | Nilai |
|-------|-------|
| ID Admin | `ADMIN001` |
| Password | `admin123` |

Pilih tab **Admin** di halaman login → masukkan kredensial di atas.  
Setelah login berhasil, token JWT (role=`admin`) dipakai untuk semua endpoint admin.

> **Segera ganti password** setelah deploy pertama!

---

## Alur Kerja Sehari-hari

| Aksi | Branch yang di-push | Deploy? |
|------|---------------------|---------|
| Ubah kode / UI / API | `main` | Ya |
| Data berubah via LMS (user, tugas, absensi…) | `data` (otomatis via API) | Tidak |
| Seed / restore data manual | `data` | Tidak |

Jangan commit file `*.json` data ke branch `main`. Folder `data/` di repo hanya sebagai **seed/backup** lokal.

---

## Struktur File (main)

```
├── api/                    ← Serverless functions (tetap di root)
│   ├── auth/[action].js
│   ├── jurusan/[action].js
│   ├── matkul/[action].js
│   ├── tugas/[action].js
│   ├── absensi/[action].js
│   └── diskusi/[action].js
├── public/                 ← Static files (Output Directory Vercel)
│   ├── index.html
│   ├── login.html
│   ├── auth.js
│   ├── admin/dashboard.html
│   ├── dosen/dashboard.html
│   └── mahasiswa/dashboard.html
├── package.json
├── vercel.json             ← outputDirectory: "public"
├── data/                   ← seed JSON (hanya referensi; runtime pakai branch data)
└── README.md
```

---

## Optimasi yang Sudah Diterapkan

1. **ADMIN_KEY dihapus** → diganti JWT (`JWT_SECRET`) + role check
2. **Dual-branch** → data update tidak memicu deploy
3. **Rename** seluruh branding ke **Universitas Anak Indonesia**
4. **vercel.json** dengan `deploymentEnabled` + memory/maxDuration terbatas
5. **CORS** hanya header yang dibutuhkan (`x-session-token`)
6. Token expire 24 jam, password di-hash SHA-256 + salt

---

## Troubleshooting

| Gejala | Solusi |
|--------|--------|
| `ENV_MISSING` | Cek 4 env wajib di Vercel + Redeploy |
| 403 pada admin | Pastikan login sebagai role `admin`, token masih valid |
| GitHub 404 / 409 | Pastikan branch `data` ada & file JSON ada di root branch tersebut |
| Deploy limit tetap kena | Pastikan push data hanya ke branch `data`, bukan `main` |

---

© 2026 Universitas Anak Indonesia — Sistem Informasi Akademik
