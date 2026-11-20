# TEN A '26 Discord Bot 🤖

Bot Discord multi-server berbasis **Node.js** dan **Discord.js v14** yang awalnya dikembangkan untuk server **TEN A '26** (Teknik Konversi Energi) dan siap di-*self-host* maupun ditambahkan ke berbagai server Discord lain. Dilengkapi asisten tanya jawab berbasis **Google Gemini API** (membaca file lampiran, tautan Google Maps, YouTube, dan Google Drive), pengingat otomatis via DM zona waktu Jakarta (UTC+7), **WhatsApp Community Announcements Bridge per-server**, **Auto-Role**, **Kotak Saran Privat**, **Hybrid Meme Fetcher (Reddit & X / Twitter)**, Auto-Respond Embed, Welcome Message, dan Private Room System.

---

## 📋 Daftar Lengkap Fitur & Command

### 1. 💬 Tanya Jawab, Analisis File & Link Google (Google Gemini API)
Asisten diskusi akademik dan pertanyaan umum dengan proteksi identitas permanen, pemecahan pesan otomatis (> 2000 karakter), konversi simbol matematika/LaTeX ke karakter Unicode rapi, mention user otomatis (`<@userId>`), pencarian web (Google Search grounding), serta pembacaan file dan tautan.
- **Slash Command:**
  - `/ask [question] [file]` — Bertanya ke bot dan/atau melampirkan file untuk dibaca, dirangkum, atau dianalisis
- **Prefix Command:**
  - `[prefix]ask <pertanyaan>` — Contoh: `!ask Jelaskan hukum pertama termodinamika`
  - `[prefix] <pertanyaan>` — Contoh: `! Jelaskan siklus Rankine secara singkat`
  - **Membaca File via Prefix:** Lampirkan file langsung bersama `[prefix]ask` (atau kirim file dengan caption `!`), maupun **reply pesan yang berisi file** lalu ketik `!ask jelaskan isi file ini`
  - **Membaca Link Google Maps, YouTube & Google Drive:** Tempelkan URL lokasi **Google Maps** (`maps.app.goo.gl` / `google.com/maps`), video **YouTube**, atau file **Google Drive/Docs/Sheets/Slides** langsung di dalam pertanyaan

> **Format File & Link yang Didukung (Maks. 15 MB):**
> - **Dokumen & Teks:** `PDF`, `TXT`, `MD`, `CSV`, `JSON`, `XML`, `HTML`, `TEX`, `LOG`
> - **Gambar:** `PNG`, `JPG`, `JPEG`, `WEBP`, `HEIC`
> - **Audio & Video:** `MP3`, `WAV`, `OGG`, `FLAC`, `AAC`, `MP4`, `MOV`, `WEBM`
> - **Tautan:** Lokasi **Google Maps**, video **YouTube** (Publik/Unlisted), serta file **Google Drive, Docs, Sheets, dan Slides** dengan izin akses *"Anyone with the link"*
> *(Catatan: Untuk file Microsoft Word/Excel/PowerPoint lokal, export ke **PDF** terlebih dahulu agar dapat dibaca).*

---

### 2. ⏰ Reminder Otomatis via DM (WIB / UTC+7)
Sistem pengingat berbasis zona waktu **Jakarta (UTC+7)** yang tersimpan secara persisten (`data/reminders.json`). Daftar reminder bersifat pribadi per user, dan saat waktunya tiba bot mengirim notifikasi langsung melalui **Direct Message (DM)** *(dengan fallback otomatis ke channel asal jika pengaturan DM user tertutup)*.
- **Slash Commands:**
  - `/remind set waktu:<waktu> pesan:<pesan>` — Membuat pengingat baru
  - `/remind list` — Melihat daftar pengingat aktif milikmu
  - `/remind hapus id:<id>` — Membatalkan pengingat berdasarkan ID
- **Prefix Commands:**
  - `[prefix]remind <waktu> | <pesan>` — Contoh: `!remind 30m | Kumpul tugas` atau `!remind 19:30 | Rapat kelompok`
  - `[prefix]remind list` — Melihat daftar pengingat aktif milikmu
  - `[prefix]remind hapus <id>` — Membatalkan pengingat berdasarkan ID
  - `[prefix]remind` — Menampilkan panduan format waktu reminder

> **Format Waktu yang Didukung (UTC+7 / WIB):**
> - **Durasi relatif:** `30s` / `30detik`, `15m` / `15menit`, `2j` / `2jam` / `2h`, `1j 30m`, `1d` / `1hari`
> - **Jam spesifik:** `19:30` atau `19.30` *(otomatis dijadwalkan untuk besok jika sudah terlewat hari ini)*
> - **Tanggal & jam:** `DD/MM/YYYY HH:MM` (contoh: `20/11/2026 08:00`) atau `YYYY-MM-DD HH:MM` (contoh: `2026-11-20 08:00`)

---

### 3. 📢 WhatsApp Community Announcements Bridge (Multi-Server)
Meneruskan pesan dan lampiran file (dokumen, gambar, audio, video hingga 10 MB) secara *real-time* dari channel **Announcements** di Komunitas WhatsApp ke channel Discord tujuan. Setiap server memiliki sesi login (`wa_auth/<guildId>/`) dan pengaturan (`data/waConfig.json`) yang terisolasi secara independen.
- Menggunakan filter ketat (`isCommunityAnnounce === true` dan JID grup terpilih) sehingga hanya membaca pengumuman resmi komunitas dan mengabaikan grup obrolan biasa maupun chat pribadi.
- **Command Pengaturan (Khusus Moderator / Administrator):**
  - `/wa-update login [nomor_wa]` — Menautkan akun WhatsApp khusus server ini lewat gambar **QR Code** privat atau **Kode Pairing 8 digit** langsung di Discord
  - `/wa-update set channel:<#channel> jid:<grup_wa>` — Menentukan channel Discord tujuan dan memilih grup Announcements WA *(dilengkapi dropdown autocomplete)*
  - `/wa-update status` — Mengecek status koneksi WhatsApp, channel tujuan, dan grup Announcements yang terdeteksi
  - `/wa-update test` — Mengirim pesan uji coba ke channel pengumuman yang telah disetel
  - `/wa-update enable` / `/wa-update disable` — Mengaktifkan atau menjeda penerusan pesan sementara
  - `/wa-update logout` — Memutuskan tautan akun WhatsApp dan menghapus kredensial sesi server ini

---

### 4. 🎭 Auto-Role System (Multi-Server) — *Khusus Moderator & Administrator*
Memberikan satu atau beberapa role secara otomatis kepada setiap anggota baru yang bergabung ke server (`data/autoroles.json`), dilengkapi validasi hierarki posisi role.
- **Slash Commands:**
  - `/autorole set role:<@role>` — Menetapkan 1 role utama untuk member baru
  - `/autorole add role:<@role>` — Menambahkan role ekstra ke daftar Auto-Role
  - `/autorole remove role:<@role>` — Menghapus salah satu role dari daftar
  - `/autorole status` — Melihat status aktif dan daftar role yang terpasang
  - `/autorole enable` / `/autorole disable` — Mengaktifkan atau menonaktifkan sementara fitur Auto-Role
  - `/autorole clear` — Mengosongkan seluruh daftar Auto-Role
- **Prefix Commands:**
  - `[prefix]autorole set @Role` / `add @Role` / `remove @Role` — Mengatur role via prefix
  - `[prefix]autorole status` / `enable` / `disable` / `clear` — Mengelola status dan daftar Auto-Role via prefix

> **Catatan:** Pastikan posisi role bot di **Server Settings → Roles** berada **di atas** role yang akan dibagikan, serta izin **Manage Roles** dan **Server Members Intent** dalam keadaan aktif.

---

### 5. 💡 Kotak Saran Privat (Suggestion Box)
Sistem pengiriman kritik, saran, dan masukan secara tersembunyi (*ephemeral* — hanya tersedia melalui Slash Command agar input tidak muncul di chat publik) dan diteruskan ke channel pilihan Moderator/Admin (`data/saranConfig.json`), lengkap dengan nomor urut, opsi anonim, lampiran file/gambar, serta reaksi voting otomatis (`👍` / `👎`).
- **Command Member:**
  - `/saran isi:<pesan> [anonim] [lampiran]` — Mengirim saran secara privat ke kotak saran server
- **Command Pengaturan (Khusus Moderator / Administrator):**
  - `/kotak-saran set channel:<#channel> [izinkan_anonim]` — Menentukan channel tujuan kotak saran dan mengatur izin pengiriman anonim
  - `/kotak-saran status` — Mengecek status aktif, mode anonim, total saran masuk, dan channel tujuan
  - `/kotak-saran test` — Mengirim pesan uji coba ke channel kotak saran
  - `/kotak-saran enable` / `/kotak-saran disable` — Mengaktifkan atau menonaktifkan sementara fitur kotak saran

---

### 6. ⚙️ Auto-Respond (Embed) — *Khusus Administrator*
Bot secara otomatis membalas dengan pesan **Embed** ketika kata atau kalimat pemicu diketik di chat (misalnya kata kunci cepat `jadwal` dan `pj`).
- `/autorespond add` — Tambah auto-response embed baru (`trigger`, `description`, `title`, `image`, `color`, `match_type`)
- `/autorespond edit` — Mengubah embed auto-response yang sudah ada (ketik `hapus` pada opsi opsional yang ingin dikosongkan)
- `/autorespond list` — Menampilkan daftar semua auto-response aktif di server
- `/autorespond remove` — Menghapus auto-response berdasarkan kata pemicu
- `/autorespond clear` — Menghapus seluruh auto-response di server

---

### 7. 🎉 Welcome Message — *Khusus Administrator*
Menyapa anggota baru secara otomatis dengan format dinamis dan mention interaktif saat bergabung ke server.
- `/welcome set` — Menentukan channel pengiriman sambutan, channel obrolan rujukan, serta template pesan
- `/welcome test` — Menguji kirim pesan sambutan secara langsung ke channel yang disetel
- `/welcome status` — Meninjau channel aktif dan template pesan sambutan saat ini
- `/welcome disable` — Menonaktifkan pengiriman pesan sambutan

> **Placeholder yang didukung pada Welcome Message:**
> - `{user}` — Mention member baru (`@NamaMember`)
> - `{username}` — Nama user member baru
> - `{server}` — Nama server Discord
> - `{channel}` — Mention channel rujukan obrolan (`#general-chat`)
> - `{memberCount}` — Jumlah total member di server

---

### 8. 🔒 Private Room / Channel System
Sistem pembuatan channel teks privat sementara menggunakan role terisolasi (`private-room-[number]`).
- `/create-private-channel [name] [user1] [user2] [user3]` — Membuat channel privat baru dengan nomor role terkecil yang tersedia dan mengundang user yang dipilih
- `/delete-private-channel` — Menghapus room privat beserta role-nya dengan **jeda konfirmasi 10 detik** dan tombol **Batalkan Penghapusan** *(dijalankan di dalam channel oleh anggota room/admin)*
- `/set-private-category` — *(Khusus Moderator/Admin)* Menentukan kategori Discord tempat private room dibuat

---

### 9. 🔀 Pengaturan Prefix — *Khusus Administrator*
Mengubah prefix perintah teks secara dinamis per server (default: `!`).
- `/setprefix prefix:<prefix_baru>`
- `[prefix]setprefix <prefix_baru>` — Contoh: `!setprefix ?` atau `!setprefix .`

---

### 10. 😂 Hybrid Meme Fetcher (Reddit & X / Twitter)
Mengambil gambar maupun video meme secara acak dari **Reddit** dan daftar **akun X pilihan**, dilengkapi tombol interaktif **Meme Berikutnya**.
- **Anti-Duplikat & Selalu Segar (Reddit):** Mengacak mode `new`, `rising`, `top`, dan `hot` dari 12 subreddit SFW serta menyimpan riwayat 250 postingan terakhir agar meme tidak berulang.
- **Integrasi Akun X (`config/xMemeAccounts.json`):** Daftar akun X disimpan dalam file konfigurasi terpisah yang dapat ditambah atau diubah kapan saja tanpa perlu me-restart bot. Postingan X berbentuk video/GIF akan diputar **autoplay** di dalam embed disertai catatan **`*video`** (sebagai penanda bagi pengguna dengan koneksi lambat agar bisa langsung mengganti meme) serta tautan sumber asli `x.com`.
- **Slash Command:**
  - `/meme [sumber] [subreddit] [akun_x]` — Pilih sumber **Acak (Reddit & X)**, **Akun X Pilihan**, atau **Reddit** beserta autocomplete subreddit dan akun X
- **Prefix Command:**
  - `[prefix]meme` — Acak antara Reddit dan daftar akun X
  - `[prefix]meme x` — Ambil meme acak khusus dari daftar akun X
  - `[prefix]meme @<username_x>` — Ambil meme dari akun X tertentu *(contoh: `!meme @HumansNoContext` atau `!meme @FAFO_TV`)*
  - `[prefix]meme reddit` atau `[prefix]meme <subreddit>` — Ambil meme dari Reddit *(contoh: `!meme ProgrammerHumor`)*

---

### 11. 📖 Menu Bantuan Interaktif & Utilitas
- `/help` atau `[prefix]help` — Menampilkan menu bantuan multi-halaman per kategori dengan ringkasan kategori di setiap halaman, dropdown menu, dan tombol navigasi
- `/ping` atau `[prefix]ping` — Mengecek latensi koneksi bot ke Discord Gateway
- `[prefix]halo` — Menyapa bot *(juga merespons sapaan teks `"halo"` atau `"halo bot"`)*

---

## 🛠️ Langkah Pengaturan & Instalasi (Self-Hosting)

### 1. Konfigurasi di Discord Developer Portal
1. Buka [Discord Developer Portal](https://discord.com/developers/applications) dan buat/pilih aplikasi bot kamu.
2. Masuk ke menu **Bot**:
   - Klik **Reset Token** dan salin token bot.
   - Aktifkan **Public Bot** *(jika ingin bot dapat diundang ke berbagai server lain)*.
   - Aktifkan **Privileged Gateway Intents**:
     - ✅ **Message Content Intent** (Wajib untuk auto-respond & prefix command)
     - ✅ **Server Members Intent** (Wajib untuk fitur Auto-Role & Welcome Message)
   - Klik **Save Changes**.
3. Masuk ke menu **General Information** dan salin **Application ID** (`CLIENT_ID`).
4. Masuk ke menu **OAuth2 → URL Generator** untuk membuat link undangan bot:
   - Centang **Scopes**: `bot` dan `applications.commands`.
   - Centang **Bot Permissions**: `View Channels`, `Send Messages`, `Send Messages in Threads`, `Embed Links`, `Attach Files`, `Read Message History`, `Add Reactions`, `Manage Roles`, dan `Manage Channels`.

### 2. Clone Repository & Install Dependencies
```bash
git clone <url-repository-kamu>
cd ten-a-bot-discord
npm install