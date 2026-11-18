# Ten-A Discord Bot 🤖

Proyek bot Discord serbaguna berbasis **Node.js** dan **Discord.js v14**.

---

## 🚀 Fitur Utama

### 1. ⚙️ Auto-Respond (Embed) - *Khusus Administrator*
Bot secara otomatis menjawab dengan pesan **Embed** ketika kata atau kalimat pemicu disebutkan di chat. Mendukung pengaturan **Judul**, **Deskripsi**, **Link Gambar**, **Warna HEX**, dan **Tipe Pencocokan**.
- `/autorespond add` - Tambah auto-response embed baru:
  - `trigger`: Kata atau kalimat pemicu (contoh: `rules`, `jadwal`, `sosmed`).
  - `description`: Isi teks deskripsi utama di embed.
  - `title`: *(Opsional)* Judul embed.
  - `image`: *(Opsional)* Link URL gambar (contoh: `https://.../gambar.png`).
  - `color`: *(Opsional)* Kode warna HEX (contoh: `#5865F2`).
  - `match_type`: *(Opsional)* `contains` (mengandung kata) atau `exact` (sama persis).
- `/autorespond edit` - Mengubah embed auto-response yang sudah ada:
  - `trigger`: Kata pemicu yang ingin diedit.
  - Ubah `description`, `title`, `image`, `color`, atau `match_type` (ketik `hapus` pada opsi yang ingin dikosongkan).
- `/autorespond list` - Menampilkan daftar semua auto-response yang aktif di server.
- `/autorespond remove` - Menghapus auto-response berdasarkan kata pemicu.
- `/autorespond clear` - Menghapus seluruh auto-response di server.

### 2. 🎉 Welcome Message - *Khusus Administrator*
Menyapa anggota baru secara otomatis dengan format dinamis dan mention interaktif (seperti format: `Selamat datang @User di Server. Silahkan lihat-lihat dulu ada apa aja dan lanjut berunding di #general-chat`).
- `/welcome set` - Menentukan channel pengiriman sambutan, channel obrolan rujukan, serta format teks template.
- `/welcome test` - Menguji kirim pesan sambutan secara langsung ke channel yang disetel.
- `/welcome status` - Meninjau channel aktif dan template pesan sambutan saat ini.
- `/welcome disable` - Menonaktifkan pengiriman pesan sambutan.

> **Placeholder yang didukung pada Welcome Message:**
> - `{user}`: Mention member baru (`@NamaMember`)
> - `{username}`: Nama user member baru
> - `{server}`: Nama server Discord
> - `{channel}`: Mention channel rujukan obrolan (`#general-chat`)
> - `{memberCount}`: Jumlah total member di server

### 3. 🔒 Private Room / Channel System
Sistem pembuatan channel teks privat otomatis menggunakan role terisolasi.
- `/create-private-channel [name] [user1] [user2] [user3]` - Membuat channel private baru dan mengundang user yang dipilih.
  - Menggunakan sistem role dinamis: `private-room-[number]`.
  - Otomatis menggunakan angka role terkecil yang belum terpakai (daur ulang nomor).
  - Bot secara otomatis me-mention role private baru tersebut di dalam channel dan memberikan peringatan untuk menghapus room setelah selesai.
- `/delete-private-channel` - Menghapus room private beserta role privatnya (dijalankan di dalam channel oleh anggota room/admin).
- `/set-private-category` - *(Khusus Moderator/Admin)* Menentukan kategori Discord tempat private room akan dibuat.

### 4. ✨ Tanya Jawab AI (Google Gemini API)
Bertanya apa saja langsung dijawab oleh AI Gemini cerdas dari Google.
- **Prefix Command:**
  - `[prefix]ask <pertanyaan>` (contoh: `!ask Siapakah penemu internet?`)
  - `[prefix] <pertanyaan>` (contoh: `! Siapakah penemu internet?`)
- **Slash Command:**
  - `/ask question:<pertanyaan>`
- Dilengkapi otomatisasi pemecahan pesan panjang (> 2000 karakter) dan indikator status mengetik.

### 5. 🔀 Ganti Prefix Perintah - *Khusus Administrator*
Prefix bot dapat diubah sewaktu-waktu secara dinamis per server.
- **Prefix Command:** `[prefix]setprefix <prefix_baru>` (contoh: `!setprefix ?` atau `!setprefix .`)
- **Slash Command:** `/setprefix prefix:<prefix_baru>`

### 6. 🤖 Perintah Bawaan Lainnya
- **Prefix Commands:** `[prefix]ping`, `[prefix]halo`, `[prefix]help`
- **Slash Commands:** `/ping`, `/help`
- Respon percakapan santai bawaan: `"halo bot"` atau `"halo"`

---

## 🛠️ Langkah Pengaturan

### 1. Konfigurasi Token di Discord Developer Portal
1. Buka [Discord Developer Portal](https://discord.com/developers/applications).
2. Pilih aplikasi bot kamu.
3. Masuk ke menu **Bot** di bilah kiri:
   - Klik **Reset Token** dan copy token yang diberikan.
   - Gulir ke bawah ke bagian **Privileged Gateway Intents** dan aktifkan:
     - ✅ **Message Content Intent** (Wajib agar bot bisa membaca pesan teks untuk trigger auto-respond & prefix).
     - ✅ **Server Members Intent** (Wajib agar bot bisa mendeteksi member baru bergabung untuk fitur Welcome Message).
   - Klik **Save Changes**.
4. Masuk ke menu **General Information**:
   - Salin **Application ID** (ini adalah `CLIENT_ID`).

### 2. Isi File `.env`
Buka file `.env` di folder ini dan masukkan data yang sudah kamu salin:
```env
DISCORD_TOKEN=masukkan_token_bot_kamu_di_sini
CLIENT_ID=masukkan_application_id_di_sini
GUILD_ID=opsional_masukkan_id_server_discord_kamu

# Dapatkan gratis di https://aistudio.google.com/app/apikey
GEMINI_API_KEY=masukkan_api_key_gemini_di_sini
```

> **Catatan GUILD_ID**: Jika kamu mengisi `GUILD_ID`, pendaftaran Slash Command (`/autorespond`, `/welcome`, `/ping`, `/help`) akan langsung muncul seketika di server tersebut tanpa menunggu sinkronisasi global Discord.

### 3. Daftarkan Slash Commands
Jalankan perintah berikut di terminal:
```bash
npm run deploy
```

### 4. Jalankan Bot
Untuk menyalakan bot:
```bash
npm start
```
Atau:
```bash
node index.js
```

Jika sukses, bot akan berstatus **Online** dan siap digunakan di server Discord kamu!
