# Office Letter Management System (Sistem Penomoran & Manajemen Surat Kantor)

Sistem manajemen administrasi, registrasi, penomoran otomatis, dan pengarsipan surat perusahaan yang dirancang khusus untuk kebutuhan lintas departemen (HRD, General Affairs, Sekretariat, Finance, Legal, IT, dan Operations) dengan jaminan keunikan nomor surat, jejak audit menyeluruh, dan **tanpa alur persetujuan (Zero-Approval Workflow)**.

### User Review & Critical Decisions

> [!IMPORTANT]
> Berikut adalah keputusan utama yang telah dikonfirmasi dari jawaban Anda serta ketetapan arsitektur yang akan diterapkan:

- **Keputusan Terkonfirmasi 1 — Sumber Tanggal Penomoran Otomatis**: Komponen bulan (Angka/Romawi) dan tahun (4 digit) pada nomor surat otomatis **selalu menggunakan Tanggal Surat (`letter_date`)** sebagai acuan dasar perhitungan periode dan urutan.
- **Keputusan Terkonfirmasi 2 — Penomoran Ganda Surat Masuk**: Setiap **Surat Masuk** dari pihak eksternal secara otomatis memperoleh **Nomor Registrasi Internal** sesuai aturan penomoran yang berlaku sekaligus menyimpan **Nomor Surat Asli Pengirim** secara terpisah.
- **Keputusan Terkonfirmasi 3 — Autentikasi & Pengujian Multi-Role**: Aplikasi menyediakan halaman login kredensial (Email & Password dengan validasi keamanan penuh) serta dilengkapi **Instant Demo Role Switcher** agar Anda dapat langsung menguji hak akses **Super Admin**, **Admin HRD/GA**, **Staff**, dan **Viewer/Auditor** secara instan.
- **Kepatuhan Mutlak Tanpa Approval (Zero-Approval Policy)**: Sesuai instruksi wajib, seluruh antarmuka dan skema data hanya menggunakan 3 status administratif murni (**Draft**, **Terdaftar**, **Dibatalkan**). Tidak ada tombol setuju/tolak, antrean persetujuan, maupun status menunggu persetujuan.

---

### 1. Overview & Core Concept

- **What It Does**: Platform terpadu untuk mencatat surat keluar, surat masuk, dan memorandum internal; mengalokasikan nomor surat resmi secara otomatis berdasarkan rumus format perusahaan yang fleksibel; menyimpan berkas lampiran fisik/digital; menyajikan analitik serta laporan rekapitulasi yang siap diekspor (CSV, XLSX, PDF/Print); serta merekam setiap perubahan data ke dalam log audit yang tidak dapat dimanipulasi.
- **Target Audience / Persona**:
  - **Super Admin**: Mengelola konfigurasi aturan penomoran, identitas perusahaan, seluruh master data, manajemen pengguna/role, dan audit trail penuh.
  - **Admin HRD / GA / Sekretariat**: Mengelola registrasi surat lintas/sesuai departemen, membatalkan surat dengan alasan resmi, mengelola master data operasional, dan mencetak laporan.
  - **Staff Departemen**: Membuat draft surat, menerbitkan registrasi surat untuk mendapatkan nomor resmi, dan mengunggah dokumen lampiran pada departemennya.
  - **Viewer / Auditor**: Memantau daftar surat, memeriksa keabsahan nomor, mengekspor laporan, dan menelusuri riwayat audit tanpa akses modifikasi.
- **Key Value**: Menghilangkan risiko nomor surat ganda atau terlewat pada pencatatan manual spreadsheet, menstandarkan format kode surat perusahaan secara otomatis, serta menjamin akuntabilitas historis (nomor dari surat yang dibatalkan tetap dikunci dan tidak pernah dipakai ulang).

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Autentikasi & Pemilihan Peran**: Pengguna masuk melalui layar autentikasi atau beralih antar akun demo role di bilah profil untuk menguji batasan akses nyata di sisi klien dan server.
  2. **Dashboard Eksekutif**: Menampilkan ringkasan KPI real-time dari basis data (Total Surat Terdaftar, Surat Keluar Bulan Ini, Surat Masuk Bulan Ini, Surat Internal Bulan Ini, Surat Dibatalkan, dan Rekap per Departemen) beserta filter periode/departemen, grafik tren bulanan, distribusi jenis surat, tabel surat terbaru, dan log aktivitas terkini.
  3. **Registrasi & Penomoran Surat Otomatis**:
     - Petugas memilih kategori (**Surat Keluar**, **Surat Masuk**, atau **Surat Internal**), departemen, jenis surat, klasifikasi kerahasiaan, dan mengisi tanggal surat serta perihal.
     - Sistem menampilkan **Pratinjau Nomor (Preview)** secara real-time dengan penanda jelas bahwa nomor tersebut adalah estimasi sebelum alokasi resmi.
     - Pengguna dapat menyimpan sebagai **Draft** (belum mengalokasikan nomor urut) atau langsung menekan **Daftarkan & Terbitkan Nomor** untuk mengunci nomor urut secara transaksional dan mengunggah lampiran (PDF, DOCX, JPG, PNG).
  4. **Arsip, Detail, & Pembatalan Surat**: Menampilkan rincian lengkap surat, rincian komponen pembentuk nomor historis, pratinjau dokumen lampiran, cetak Bukti Registrasi Surat (Print/PDF), serta aksi **Batalkan Surat** (wajib menyertakan alasan pembatalan; nomor tetap tersimpan permanen dan tidak dapat dihapus).
  5. **Konfigurasi Mesin Penomoran (Numbering Rule Builder)**: Administrator menyusun template format dinamis (mis. `{SEQ}/{COMP}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}`), mengatur jumlah digit urutan (`3` digit -> `001`), memilih separator (`/`, `-`, `.`), menentukan ruang lingkup urutan (*Global*, *Per Departemen*, *Per Jenis*, atau *Per Departemen & Jenis*), serta periode reset (*Tahunan*, *Bulanan*, atau *Tidak Pernah Reset*) lengkap dengan simulasi hasil langsung.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: **Enterprise Utilitarian & Editorial Precision** — tata letak bersih, berfokus pada keterbacaan tabel berdensitas tinggi, hierarki jelas, tanpa dekorasi berlebihan.
  - *Color Palette & Mood (60-30-10 Distribution)*:
    - **60% Dominant Neutral Canvas**: Putih bersih (`#FFFFFF`) dan latar kanvas abu-abu dingin lembut (`#F8FAFC` / `slate-50`).
    - **30% Structural Surfaces**: Permukaan panel dengan garis batas tipis 1px (`#E2E8F0` / `slate-200`), teks utama navy gelap (`#0F172A` / `slate-900`), dan teks sekunder (`#475569` / `slate-600`).
    - **10% Accent Budget**: Biru korporat profesional (`#1D4ED8` / `blue-700` dan `#1E3A8A` / `blue-900`) khusus pada aksi utama, navigasi aktif, dan fokus input.
    - **Semantic Status Signaling**: Selalu memadukan warna dengan ikon dan label teks eksplisit — Hijau (`#16A34A`) untuk *Terdaftar*, Abu-abu netral (`#475569`) untuk *Draft*, dan Merah Crimson (`#DC2626`) untuk *Dibatalkan*.
  - *Typography & Hierarchy*:
    - **Display & Navigation**: `Plus Jakarta Sans` (SemiBold/Bold) untuk judul halaman, metrik utama, dan struktur navigasi.
    - **Body & Form Controls**: `Plus Jakarta Sans` (Regular/Medium, 14px–15px) untuk kenyamanan baca formulir dan tabel.
    - **Monospace & Tabular Data**: `JetBrains Mono` dengan `font-variant-numeric: tabular-nums` wajib diterapkan pada seluruh **Nomor Surat**, **Kode Master Data**, **Nomor Urut Counter**, **Tanggal/Waktu**, dan **Angka Statistik** agar sejajar sempurna secara vertikal.
  - *Component Styling & Layout*:
    - **Workspace Canvas**: Sidebar navigasi kiri tetap (`260px` pada desktop, drawer responsif pada mobile/tablet) + Top Header kontekstual (judul halaman, pencarian cepat global, pengalih role demo, dan profil pengguna) + Area konten utama dengan *single-elevation depth* (tanpa kartu bersarang di dalam kartu).
    - **High-Density Data Grids**: Tinggi baris tabel kompak (`40px–44px`), dukungan pengurutan kolom (sorting), filter multi-kriteria, dan paginasi dengan pilihan jumlah baris per halaman.
- **Interactive Feedback & Motion**:
  - Transisi mikro responsif ($\le 150\text{ms}$), indikator skeleton saat memuat data, *empty state* informatif dengan tombol aksi cepat, modal konfirmasi wajib untuk pembatalan surat dan perubahan aturan penomoran, serta *toast notification* untuk setiap operasi CRUD.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Transactional Atomic Numbering Engine dengan Snapshot Historis**
  - *Chosen Approach*: Menyimpan posisi urutan terakhir pada tabel khusus `numbering_counters` berdasarkan kunci komposit (`rule_id`, `scope_key`, `period_year`, `period_month`). Saat surat didaftarkan menjadi status **Terdaftar**, sistem melakukan operasi atomik di dalam transaksi basis data untuk menaikkan counter (`last_number + 1`), memformat nomor surat menggunakan **Tanggal Surat**, lalu menyimpan baik string nomor final maupun JSON komponen pembentuknya (`numbering_snapshot`) pada rekaman surat.
  - *Why*: Menjamin tidak ada nomor ganda meskipun beberapa staf mendaftarkan surat secara bersamaan (concurrent requests), serta memastikan surat lama tetap mempertahankan format nomor aslinya walaupun administrator mengubah aturan penomoran di masa depan.
  - *Alternatives Considered*: Menghitung `COUNT(*)` atau `MAX(number) + 1` langsung dari tabel `letters` — ditolak karena rawan *race condition* dan rusak apabila aturan format diubah.

- **Decision 2: Pemisahan Mode Pratinjau (Preview) vs Alokasi Resmi**
  - *Chosen Approach*: Endpoint pratinjau membaca nilai counter saat ini tanpa menaikkan urutan dan memberi label eksplisit `[PRATINJAU - BELUM DIALOKASIKAN]`. Alokasi nomor hanya terjadi satu kali ketika status surat berubah menjadi **Terdaftar**.
  - *Why*: Mencegah lompatan nomor urut akibat pengguna yang sekadar membuka form atau menyimpan surat sebagai **Draft**.

- **Decision 3: Penyimpanan Berkas Lampiran di File System / Object Storage Lokal Terproteksi**
  - *Chosen Approach*: Berkas lampiran (PDF, DOCX, JPG, PNG) disimpan sebagai file biner pada direktori penyimpanan server terproteksi dengan metadata tercatat di tabel `letter_attachments`, dan diakses melalui endpoint terautentikasi yang memeriksa hak akses role pengguna.
  - *Why*: Menghindari pembengkakan ukuran basis data akibat penyimpanan Base64 di kolom tabel serta memungkinkan pratinjau dokumen dan pengunduhan cepat.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND WORKSPACE (React + TypeScript)                      │
│                                                                                     │
│  ┌──────────────────────┐   ┌────────────────────────────────────────────────────┐  │
│  │  Sidebar Navigation  │   │  Top Header Bar                                    │  │
│  │  (Role-Filtered)     │   │  Breadcrumb · Global Search · Role Switcher · User │  │
│  └──────────┬───────────┘   └─────────────────────────┬──────────────────────────┘  │
│             │                                         │                             │
│             ▼                                         ▼                             │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                           MAIN APPLICATION VIEWS                              │  │
│  │                                                                               │  │
│  │  ┌────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐  │  │
│  │  │ 1. Dashboard View  │  │ 2. Manajemen Surat     │  │ 3. Form Registrasi  │  │  │
│  │  │ - KPI Metric Grid  │  │ - Surat Keluar         │  │ - Dynamic Fields    │  │  │
│  │  │ - Monthly Charts   │  │ - Surat Masuk (Dual #) │  │ - Live # Preview    │  │  │
│  │  │ - Dept & Type Dist │  │ - Surat Internal       │  │ - Draft / Register  │  │  │
│  │  │ - Recent Letters   │  │ - Detail, Print & Void │  │ - File Upload       │  │  │
│  │  └────────────────────┘  └────────────────────────┘  └─────────────────────┘  │  │
│  │                                                                               │  │
│  │  ┌────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐  │  │
│  │  │ 4. Master Data     │  │ 5. Laporan & Ekspor    │  │ 6. Audit & Sistem   │  │  │
│  │  │ - Departemen       │  │ - Filter Multi-Dimensi │  │ - Audit Trail Viewer│  │  │
│  │  │ - Jenis & Klasif.  │  │ - Ekspor CSV & XLSX    │  │ - Manajemen User    │  │  │
│  │  │ - Rule Builder     │  │ - Cetak Rekap PDF      │  │ - OpenAPI & Settings│  │  │
│  │  └────────────────────┘  └────────────────────────┘  └─────────────────────┘  │  │
│  └────────────────────────────────────────┬──────────────────────────────────────┘  │
└───────────────────────────────────────────┼─────────────────────────────────────────┘
                                            │ REST API (JSON / Multipart + Auth Token)
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER (Node.js + Express + Zod)                       │
│                                                                                     │
│  ┌──────────────────────┐   ┌────────────────────────┐   ┌───────────────────────┐  │
│  │ Security & Auth      │   │ Atomic Numbering       │   │ Audit & Reporting     │  │
│  │ Middleware           │   │ Engine                 │   │ Services              │  │
│  │ - Session / Token    │   │ - Scope & Reset Logic  │   │ - Before/After Diff   │  │
│  │ - Role & Permission  │   │ - Roman Month Parser   │   │ - CSV/XLSX Generator  │  │
│  │ - Rate Limiter & Zod │   │ - Atomic Counter Lock  │   │ - Attachment Streamer │  │
│  └──────────┬───────────┘   └───────────┬────────────┘   └───────────┬───────────┘  │
└─────────────┼───────────────────────────┼────────────────────────────┼──────────────┘
              │                           │                            │
              ▼                           ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│               RELATIONAL DATABASE LAYER & PERSISTENT FILE STORAGE                   │
│                                                                                     │
│  [users] ──< [user_roles] >── [roles] ──< [permissions]                             │
│  [departments] · [letter_types] · [letter_classifications] · [company_settings]     │
│  [numbering_rules] ──< [numbering_counters] (Unique Composite Lock)                 │
│  [letters] ──< [letter_attachments] (Binary Files on Disk Storage)                  │
│  [audit_logs] (Immutable Append-Only Activity Ledger)                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State (13 Tabel Relasional Utama)**:
  1. `users`: Menyimpan kredensial pengguna (`id`, `name`, `email`, `password_hash`, `department_id`, `is_active`, `last_login_at`, `created_at`, `updated_at`).
  2. `roles` & `permissions` & `user_roles`: Mengelola peran (`SUPER_ADMIN`, `ADMIN_GA_HRD`, `STAFF`, `AUDITOR`) beserta matriks izin granular (`letter:create`, `letter:register`, `letter:cancel`, `master:manage`, `report:export`, `audit:view`, `user:manage`).
  3. `departments`: Master departemen (`id`, `code` unik mis. `HRD`, `GA`, `FIN`, `IT`, `LEGAL`, `OPS`, `name`, `description`, `is_active`).
  4. `letter_types`: Master jenis surat (`id`, `code` unik mis. `SK`, `ST`, `UND`, `SP`, `SKET`, `SPH`, `SE`, `MEMO`, `BA`, `name`, `allowed_categories`, `description`, `is_active`).
  5. `letter_classifications`: Master klasifikasi kerahasiaan (`id`, `code` mis. `BIASA`, `RAHASIA`, `SANGAT_RAHASIA`, `INTERNAL`, `name`, `confidentiality_level`, `description`, `is_active`).
  6. `numbering_rules`: Konfigurasi rumus nomor (`id`, `name`, `category`, `format_template`, `scope_type`, `reset_period`, `digit_padding`, `separator`, `date_source` = `'LETTER_DATE'`, `is_active`, `effective_date`).
  7. `numbering_counters`: Tabel pengunci urutan (`id`, `rule_id`, `scope_key`, `period_year`, `period_month`, `last_sequence`, `updated_at`) dengan *Unique Constraint* pada `(rule_id, scope_key, period_year, period_month)`.
  8. `letters`: Tabel inti surat (`id`, `category`, `status` [`DRAFT` | `REGISTERED` | `CANCELLED`], `official_number` unik, `external_original_number`, `letter_type_id`, `department_id`, `classification_id`, `letter_date`, `registration_date`, `subject`, `sender`, `recipient`, `destination`, `summary`, `admin_notes`, `numbering_rule_id`, `sequence_number`, `numbering_components_json`, `cancelled_at`, `cancelled_by`, `cancellation_reason`, `created_by`, `created_at`, `updated_at`).
  9. `letter_attachments`: Metadata berkas (`id`, `letter_id`, `file_name`, `stored_name`, `mime_type`, `file_size`, `uploaded_by`, `created_at`).
  10. `audit_logs`: Jejak audit komprehensif (`id`, `user_id`, `user_name`, `user_role`, `action`, `entity_type`, `entity_id`, `before_value_json`, `after_value_json`, `reason`, `ip_address`, `created_at`).
  11. `company_settings`: Identitas perusahaan (`id`, `company_name`, `company_code`, `logo_url`, `address`, `phone`, `email`, `website`, `updated_at`).

- **Interactive Component & State Mapping**:
  - **Form Registrasi & Live Numbering Preview**: Setiap perubahan pada pilihan Kategori, Departemen, Jenis Surat, Klasifikasi, atau Tanggal Surat memicu pemanggilan ke `/api/numbering/preview` yang menghitung rumus aktif pada tanggal surat tersebut tanpa mengubah database. Saat tombol **Terbitkan & Daftarkan Surat** ditekan, sistem menjalankan transaksi penuh di `/api/letters` atau `/api/letters/:id/register`, mengunci baris counter terkait, menghasilkan `official_number` unik, menyimpan berkas lampiran, mencatat `audit_logs`, dan mengarahkan pengguna ke halaman Detail Surat resmi.
  - **Pembatalan Surat (Voiding)**: Mengklik **Batalkan Surat** pada surat berstatus `Terdaftar` membuka modal konfirmasi yang mewajibkan pengisian alasan pembatalan minimal 10 karakter. Setelah dikonfirmasi, status surat berubah menjadi `Dibatalkan`, informasi pembatalan (`cancelled_by`, `cancelled_at`, `cancellation_reason`) disimpan, nomor surat tetap terkunci pada surat tersebut, dan perubahan tercatat di Audit Trail.
  - **Filter Gabungan & Laporan Ekspor**: Halaman Manajemen Surat dan Laporan mendukung filter simultan (kata kunci nomor/perihal/pengirim/penerima, kategori, departemen, jenis surat, klasifikasi, status, tahun, dan rentang tanggal). Tombol **Export CSV**, **Export XLSX**, dan **Cetak Laporan / PDF** menghasilkan dokumen nyata berdasarkan data terfilter dari database.
