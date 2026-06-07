# LMS Unmuh Babel

Sistem Manajemen Pembelajaran (LMS) untuk Universitas Muhammadiyah Bangka Belitung.

## Stack

- **Frontend**: HTML, CSS, Bootstrap 5, Bootstrap Icons
- **Backend**: Supabase (Auth + Database)
- **Hosting**: Vercel (static)

## Struktur File

| File | Keterangan |
|------|-----------|
| `index.html` | Entry point → redirect ke login |
| `login.html` | Halaman login (email NIM@kampus.ac.id) |
| `dashboard.html` | Dashboard setelah login (semua role) |
| `mhs-*.html` | Halaman khusus Mahasiswa |
| `dsn-*.html` | Halaman khusus Dosen |
| `adm-*.html` | Halaman khusus Admin |
| `shared.js` | Helper bersama: Supabase client, sidebar, auth |

## Setup Supabase

Buat tabel berikut di Supabase:

### `profiles`
```sql
create table profiles (
  id uuid references auth.users primary key,
  nama text,
  nim text unique,
  role text check (role in ('mahasiswa','dosen','admin')),
  created_at timestamptz default now()
);

-- Trigger otomatis buat profile saat user baru register
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, nim, role)
  values (new.id, split_part(new.email, '@', 1), 'mahasiswa');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

### RLS (Row Level Security)
```sql
alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
```

## Deploy ke Vercel

1. Push ke GitHub
2. Import repo di [vercel.com](https://vercel.com)
3. Deploy — tidak ada build step, static files langsung serve

## Login

Format email: `NIM@kampus.ac.id`

Contoh:
- Mahasiswa NIM `250241114` → email `250241114@kampus.ac.id`
- Dosen NIDN `198901` → email `198901@kampus.ac.id`

## Konfigurasi

Edit konstanta di `shared.js`:
```js
const SUPABASE_URL  = 'https://xxxx.supabase.co'
const SUPABASE_ANON = 'sb_publishable_...'
```
