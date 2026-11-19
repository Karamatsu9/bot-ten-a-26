# TEN A '26 Discord Bot 🤖

Bot Discord khusus untuk server **TEN A '26** (Teknik Konversi Energi) berbasis **Node.js** dan **Discord.js v14**, dilengkapi integrasi Google Gemini API dengan pembacaan file/gambar, sistem pengingat otomatis via DM zona waktu Jakarta (UTC+7), Auto-Respond Embed, Welcome Message, dan Private Channel.

---

## 📋 Daftar Lengkap Command

### 1. 💬 Tanya Jawab & Analisis File (Google Gemini API)
Asisten khusus server **TEN A '26** untuk diskusi akademik dan pertanyaan umum. Dilengkapi proteksi identitas permanen, pemecahan pesan otomatis (> 2000 karakter), konversi simbol matematika/LaTeX ke karakter Unicode rapi, serta kemampuan membaca file lampiran.
- **Slash Command:**
  - `/ask [question] [file]` — Bertanya ke bot dan/atau melampirkan file untuk dibaca dan dirangkum
- **Prefix Command:**
  - `[prefix]ask <pertanyaan>` — Contoh: `!ask Jelaskan hukum pertama termodinamika`
  - `[prefix] <pertanyaan>` — Contoh: `! Jelaskan siklus Rankine secara singkat`
  - **Membaca File via Prefix:** Lampirkan file langsung bersama `[prefix]ask` (atau cukup kirim file dengan caption `!`), maupun **reply pesan yang berisi file** lalu ketik `!ask jelaskan isi file ini`

> **Format File yang Didukung (Maks. 15 MB):**
> - **Dokumen & Teks:** `PDF`, `TXT`, `MD`, `CSV`, `JSON`, `XML`, `HTML`, `TEX`, `LOG`
> - **Gambar:** `PNG`, `JPG`, `JPEG`, `WEBP`, `HEIC`
> - **Audio & Video:** `MP3`, `WAV`, `OGG`, `FLAC`, `AAC`, `MP4`, `MOV`, `WEBM`
> *(Catatan: Untuk file Microsoft Word/Excel/PowerPoint, silakan export ke **PDF** terlebih dahulu agar dapat dibaca).*

---

### 2. ⏰ Reminder Otomatis via DM (WIB / UTC+7)
Sistem pengingat berbasis zona waktu **Jakarta (UTC+7)** yang tersimpan secara persisten (`data/reminders.json`). Daftar reminder bersifat pribadi per user, dan saat waktunya tiba bot akan mengirim notifikasi langsung melalui **Direct Message (DM)** *(dengan fallback otomatis ke channel asal jika pengaturan DM user tertutup)*.
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

### 3. ⚙️ Auto-Respond (Embed) — *Khusus Administrator*
Bot secara otomatis membalas dengan pesan **Embed** ketika kata atau kalimat pemicu diketik di chat (misalnya kata kunci cepat `jadwal` dan `pj`).
- `/autorespond add` — Tambah auto-response embed baru (`trigger`, `description`, `title`, `image`, `color`, `match_type`)
- `/autorespond edit` — Mengubah embed auto-response yang sudah ada (ketik `hapus` pada opsi opsional yang ingin dikosongkan)
- `/autorespond list` — Menampilkan daftar semua auto-response aktif di server
- `/autorespond remove` — Menghapus auto-response berdasarkan kata pemicu
- `/autorespond clear` — Menghapus seluruh auto-response di server

---

### 4. 🎉 Welcome Message — *Khusus Administrator*
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

### 5. 🔒 Private Room / Channel System
Sistem pembuatan channel teks privat sementara menggunakan role terisolasi (`private-room-[number]`).
- `/create-private-channel [name] [user1] [user2] [user3]` — Membuat channel privat baru dengan nomor role terkecil yang tersedia dan mengundang user yang dipilih
- `/delete-private-channel` — Menghapus room privat beserta role-nya (dijalankan di dalam channel oleh anggota room/admin)
- `/set-private-category` — *(Khusus Moderator/Admin)* Menentukan kategori Discord tempat private room dibuat

---

### 6. 🔀 Pengaturan Prefix — *Khusus Administrator*
Mengubah prefix perintah teks secara dinamis per server (default: `!`).
- `/setprefix prefix:<prefix_baru>`
- `[prefix]setprefix <prefix_baru>` — Contoh: `!setprefix ?` atau `!setprefix .`

---

### 7. 🤖 Perintah Bawaan & Utilitas
- `/help` atau `[prefix]help` — Menampilkan menu bantuan perintah
- `/ping` atau `[prefix]ping` — Mengecek latensi koneksi bot ke Discord Gateway
- `[prefix]halo` — Menyapa bot *(juga merespons sapaan teks `"halo"` atau `"halo bot"`)*

---

## 🛠️ Langkah Pengaturan & Instalasi

### 1. Konfigurasi di Discord Developer Portal
1. Buka [Discord Developer Portal](https://discord.com/developers/applications) dan pilih aplikasi bot kamu.
2. Masuk ke menu **Bot**:
   - Klik **Reset Token** dan salin token bot.
   - Aktifkan **Privileged Gateway Intents**:
     - ✅ **Message Content Intent** (Wajib untuk auto-respond & prefix command)
     - ✅ **Server Members Intent** (Wajib untuk fitur Welcome Message)
   - Klik **Save Changes**.
3. Masuk ke menu **General Information** dan salin **Application ID** (`CLIENT_ID`).

### 2. Isi File `.env`
Buat atau buka file `.env` di folder utama proyek dan isi konfigurasi berikut:
```env
DISCORD_TOKEN=masukkan_token_bot_kamu_di_sini
CLIENT_ID=masukkan_application_id_di_sini
GUILD_ID=opsional_masukkan_id_server_discord_kamu

# Dapatkan gratis di [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=masukkan_api_key_gemini_di_sini
# Opsional: tentukan model utama Gemini
GEMINI_MODEL=gemini-2.5-flash