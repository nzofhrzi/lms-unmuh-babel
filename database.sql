-- ============================================================
-- LMS Unmuh Babel — Database Setup Lengkap
-- Jalankan di Supabase SQL Editor SATU PER SATU per blok
-- ============================================================

-- ============================================================
-- BLOK 1: TABEL PROFILES (sudah ada, skip kalau error)
-- ============================================================
alter table profiles add column if not exists nama text;
alter table profiles add column if not exists nim text;
alter table profiles add column if not exists role text default 'mahasiswa';
alter table profiles add column if not exists prodi_id uuid;
alter table profiles add column if not exists created_at timestamptz default now();

-- ============================================================
-- BLOK 2: TABEL PRODI
-- ============================================================
create table if not exists prodi (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- BLOK 3: TABEL MATA KULIAH
-- ============================================================
create table if not exists mata_kuliah (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  sks integer default 3,
  semester integer default 1,
  prodi_id uuid references prodi(id) on delete cascade,
  dosen_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- BLOK 4: TABEL ENROLLMENT (mahasiswa ikut matkul)
-- ============================================================
create table if not exists enrollment (
  id uuid primary key default gen_random_uuid(),
  mahasiswa_id uuid references auth.users(id) on delete cascade,
  matkul_id uuid references mata_kuliah(id) on delete cascade,
  created_at timestamptz default now(),
  unique(mahasiswa_id, matkul_id)
);

-- ============================================================
-- BLOK 5: TABEL TUGAS
-- ============================================================
create table if not exists tugas (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  deskripsi text,
  matkul_id uuid references mata_kuliah(id) on delete cascade,
  dosen_id uuid references auth.users(id) on delete set null,
  tanggal_buka date default current_date,
  deadline date not null,
  created_at timestamptz default now()
);

-- ============================================================
-- BLOK 6: TABEL PENGUMPULAN TUGAS
-- ============================================================
create table if not exists pengumpulan_tugas (
  id uuid primary key default gen_random_uuid(),
  tugas_id uuid references tugas(id) on delete cascade,
  mahasiswa_id uuid references auth.users(id) on delete cascade,
  nama_file text,
  status text default 'dikumpulkan',
  nilai integer,
  catatan text,
  created_at timestamptz default now(),
  unique(tugas_id, mahasiswa_id)
);

-- ============================================================
-- BLOK 7: TABEL ABSENSI
-- ============================================================
create table if not exists absensi (
  id uuid primary key default gen_random_uuid(),
  matkul_id uuid references mata_kuliah(id) on delete cascade,
  mahasiswa_id uuid references auth.users(id) on delete cascade,
  tanggal date not null,
  pertemuan integer not null,
  status text check (status in ('hadir','izin','sakit','alpha')) default 'alpha',
  keterangan text,
  created_at timestamptz default now(),
  unique(matkul_id, mahasiswa_id, tanggal, pertemuan)
);

-- ============================================================
-- BLOK 8: TABEL DISKUSI
-- ============================================================
create table if not exists diskusi (
  id uuid primary key default gen_random_uuid(),
  matkul_id uuid references mata_kuliah(id) on delete cascade,
  pengirim_id uuid references auth.users(id) on delete cascade,
  pesan text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- BLOK 9: TABEL NILAI
-- ============================================================
create table if not exists nilai (
  id uuid primary key default gen_random_uuid(),
  mahasiswa_id uuid references auth.users(id) on delete cascade,
  matkul_id uuid references mata_kuliah(id) on delete cascade,
  nilai_tugas numeric(5,2) default 0,
  nilai_uts numeric(5,2) default 0,
  nilai_uas numeric(5,2) default 0,
  updated_at timestamptz default now(),
  unique(mahasiswa_id, matkul_id)
);

-- ============================================================
-- BLOK 10: RLS POLICIES
-- ============================================================
alter table profiles enable row level security;
alter table prodi enable row level security;
alter table mata_kuliah enable row level security;
alter table enrollment enable row level security;
alter table tugas enable row level security;
alter table pengumpulan_tugas enable row level security;
alter table absensi enable row level security;
alter table diskusi enable row level security;
alter table nilai enable row level security;

-- Profiles: user bisa baca semua (untuk nama dosen dll), edit milik sendiri
create policy "profiles_select" on profiles for select to authenticated using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Prodi & Matkul: semua bisa baca
create policy "prodi_select" on prodi for select to authenticated using (true);
create policy "matkul_select" on mata_kuliah for select to authenticated using (true);

-- Enrollment
create policy "enrollment_select" on enrollment for select to authenticated using (true);
create policy "enrollment_insert" on enrollment for insert with check (auth.uid() = mahasiswa_id);

-- Tugas: semua bisa baca, dosen bisa insert
create policy "tugas_select" on tugas for select to authenticated using (true);
create policy "tugas_insert" on tugas for insert with check (auth.uid() = dosen_id);
create policy "tugas_update" on tugas for update using (auth.uid() = dosen_id);
create policy "tugas_delete" on tugas for delete using (auth.uid() = dosen_id);

-- Pengumpulan tugas
create policy "kumpul_select" on pengumpulan_tugas for select to authenticated using (true);
create policy "kumpul_insert" on pengumpulan_tugas for insert with check (auth.uid() = mahasiswa_id);
create policy "kumpul_update_dosen" on pengumpulan_tugas for update using (true);

-- Absensi
create policy "absensi_select" on absensi for select to authenticated using (true);
create policy "absensi_insert" on absensi for insert with check (true);
create policy "absensi_update" on absensi for update using (true);

-- Diskusi
create policy "diskusi_select" on diskusi for select to authenticated using (true);
create policy "diskusi_insert" on diskusi for insert with check (auth.uid() = pengirim_id);

-- Nilai
create policy "nilai_select" on nilai for select to authenticated using (true);
create policy "nilai_upsert" on nilai for insert with check (true);
create policy "nilai_update" on nilai for update using (true);

-- ============================================================
-- BLOK 11: DATA PRODI
-- ============================================================
insert into prodi (kode, nama) values
  ('PJKR', 'Pendidikan Jasmani Kesehatan dan Rekreasi'),
  ('PGSD', 'Pendidikan Guru Sekolah Dasar'),
  ('PBI',  'Pendidikan Bahasa Inggris'),
  ('PMTK', 'Pendidikan Matematika')
on conflict (kode) do nothing;

-- ============================================================
-- BLOK 12: DATA MATA KULIAH
-- ============================================================
-- PJKR
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR101','Anatomi & Fisiologi Olahraga',3,1,id from prodi where kode='PJKR' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR102','Dasar-dasar Pendidikan Jasmani',3,1,id from prodi where kode='PJKR' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR103','Permainan Bola Besar',2,1,id from prodi where kode='PJKR' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR104','Permainan Bola Kecil',2,2,id from prodi where kode='PJKR' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR105','Atletik',3,2,id from prodi where kode='PJKR' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR106','Renang',2,2,id from prodi where kode='PJKR' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR107','Kesehatan Olahraga',3,3,id from prodi where kode='PJKR' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR108','Biomekanika',3,3,id from prodi where kode='PJKR' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR109','Psikologi Olahraga',3,3,id from prodi where kode='PJKR' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PJKR110','Metodologi Penelitian',3,4,id from prodi where kode='PJKR' on conflict (kode) do nothing;

-- PGSD
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD101','Konsep Dasar IPA SD',3,1,id from prodi where kode='PGSD' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD102','Konsep Dasar IPS SD',3,1,id from prodi where kode='PGSD' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD103','Pembelajaran Bahasa Indonesia SD',3,1,id from prodi where kode='PGSD' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD104','Matematika SD',3,2,id from prodi where kode='PGSD' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD105','Pembelajaran PKn SD',2,2,id from prodi where kode='PGSD' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD106','Pendidikan Seni & Budaya',2,2,id from prodi where kode='PGSD' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD107','Manajemen Kelas',3,3,id from prodi where kode='PGSD' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD108','Evaluasi Pembelajaran',3,3,id from prodi where kode='PGSD' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD109','Media Pembelajaran',3,3,id from prodi where kode='PGSD' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PGSD110','Penelitian Tindakan Kelas',3,4,id from prodi where kode='PGSD' on conflict (kode) do nothing;

-- PBI
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI101','Structure I',3,1,id from prodi where kode='PBI' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI102','Listening Comprehension I',3,1,id from prodi where kode='PBI' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI103','Reading Comprehension I',3,1,id from prodi where kode='PBI' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI104','Speaking I',2,2,id from prodi where kode='PBI' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI105','Writing I',3,2,id from prodi where kode='PBI' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI106','Pronunciation',2,2,id from prodi where kode='PBI' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI107','Introduction to Linguistics',3,3,id from prodi where kode='PBI' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI108','English Literature',3,3,id from prodi where kode='PBI' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI109','Language Teaching Methodology',3,3,id from prodi where kode='PBI' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PBI110','Research in ELT',3,4,id from prodi where kode='PBI' on conflict (kode) do nothing;

-- PMTK
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK101','Kalkulus I',3,1,id from prodi where kode='PMTK' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK102','Aljabar Linear',3,1,id from prodi where kode='PMTK' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK103','Logika Matematika',3,1,id from prodi where kode='PMTK' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK104','Kalkulus II',3,2,id from prodi where kode='PMTK' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK105','Geometri',3,2,id from prodi where kode='PMTK' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK106','Statistika Dasar',3,2,id from prodi where kode='PMTK' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK107','Teori Bilangan',3,3,id from prodi where kode='PMTK' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK108','Analisis Real',3,3,id from prodi where kode='PMTK' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK109','Pemrograman Komputer',3,3,id from prodi where kode='PMTK' on conflict (kode) do nothing;
insert into mata_kuliah (kode, nama, sks, semester, prodi_id) select 'PMTK110','Metodologi Penelitian',3,4,id from prodi where kode='PMTK' on conflict (kode) do nothing;

