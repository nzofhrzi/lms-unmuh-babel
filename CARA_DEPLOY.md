# Cara Deploy — LMS Unmuh Babel

## LANGKAH 1: Jalankan SQL di Supabase

Buka **SQL Editor** di Supabase, jalankan file `database.sql` **per blok** (copy dari BLOK 1, run, lanjut BLOK 2, dst).

---

## LANGKAH 2: Deploy Edge Functions

Edge Function dibutuhkan agar admin bisa tambah user dari web.

### Install Supabase CLI (di laptop/PC kamu)

```bash
# Windows (pakai PowerShell)
winget install Supabase.CLI

# Mac
brew install supabase/tap/supabase

# Linux
curl -fsSL https://raw.githubusercontent.com/supabase/supabase/master/web/spec/cli/install.sh | sh
```

### Login & Deploy

```bash
# Login ke Supabase
supabase login

# Masuk ke folder project
cd lms-final

# Link ke project kamu (project ID ada di Settings > General)
supabase link --project-ref tykhjixclpjmsgwrlfxm

# Deploy kedua edge function
supabase functions deploy tambah-user
supabase functions deploy hapus-user
```

---

## LANGKAH 3: Set Secret di Supabase

Edge function butuh SERVICE_ROLE_KEY. Buka:
**Supabase → Settings → API → service_role key** (copy)

Lalu jalankan:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...key_kamu...
```

---

## LANGKAH 4: Deploy ke Vercel

Push semua file ke GitHub, lalu import di Vercel seperti biasa.

---

## Login

Format email: `NIM@kampus.ac.id`

- Admin   : `adm001@kampus.ac.id`
- Dosen   : `dosen001@kampus.ac.id`
- Mahasiswa: `250241001@kampus.ac.id`

