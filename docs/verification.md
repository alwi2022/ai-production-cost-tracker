# Verifikasi requirement

Tanggal: 21 Oktober 2026. Acuan: `AI_Production_Cost_Tracker_Take_Home.pdf`.

| Requirement | Hasil dan bukti |
|---|---|
| Import empat sumber ke satu database | Lulus: integrasi dengan mock Vendor C berjalan, CSV A/B dan workbook asli menghasilkan 387 input, 383 record unik. Database uji di memori. |
| Konversi IDR dan waktu WIB | Lulus tes otomatis: parsing nominal, refund, tanggal sumber, batas hari/minggu WIB. Total rekonsiliasi Rp165.830.720. |
| Setiap record terhubung ke proyek | Baseline asli memiliki 13 unresolved senilai Rp5.836.232,50. Jumlah sebelumnya menjadi 7 karena penautan manual oleh pengguna. Setelah reset 21 Oktober 2026, database aktif kembali memiliki 13 unresolved tanpa penautan manual. Label kosong/ambigu memerlukan konfirmasi pemilik; buka detail transaksi, pilih proyek yang benar, lalu Simpan proyek. |
| Import ulang tidak menggandakan total | Lulus integrasi API nyata: import kedua 0 baru, 0 diperbarui, 383 tidak berubah. |
| Dashboard budget, persentase, vendor, mingguan | Perhitungan backend diuji dan endpoint/aset HTTP 200. Tampilan dan interaksi browser belum diverifikasi. |
| Alert di atas 80% beserta rincian proyek | Lulus: 3 payload ditangkap oleh penerima uji, tidak dikirim ulang setelah reimport. Tes mencakup isi pesan, retry, pembatalan dan konfirmasi Discord. |
| Keputusan, setup, arsitektur dan keterbatasan terdokumentasi | Ada di README dan docs pendukung. README menafsirkan threshold sebagai lebih besar dari 80%. |
| Kredensial tidak disimpan di repository | `.env` tidak tercatat dalam Git. Key mock bawaan assignment tetap berada di mock yang disediakan. Pemeriksaan ini bukan audit riwayat secret menyeluruh. |
| Tes logika kritis | `npm.cmd test`: 15 lulus, 0 gagal. |
| Dependency | `npm.cmd audit --json`: 0 kerentanan dilaporkan. |
| Repository dan commit history | Riwayat Git lokal tersedia. Publikasi/link repository belum diverifikasi. |

Pemeriksaan tambahan: syntax `public/app.js` dan `src/server.js` valid; health aplikasi port 3000 dan Vendor C port 4010 HTTP 200; fetch terautentikasi Vendor C menghasilkan 103 record. Setelah reset baseline, database aktif memiliki 383 record, 351 terhitung, 13 unresolved, dan 19 duplikat. Total rekonsiliasi Rp165.830.720. Riwayat import sebelumnya, penautan manual, alert, pengiriman, dan inbox lokal dikosongkan; satu import baseline baru tercatat. Backup sebelum reset tersedia di `storage/backups/`. Import berikutnya mengevaluasi dan mengirim alert sesuai konfigurasi webhook.

Verifikasi awal tidak mengubah database aktif. Reset baseline selanjutnya dilakukan atas permintaan pengguna, dengan backup terlebih dahulu. Tidak ada pesan eksternal dikirim selama verifikasi maupun reset. Uji browser sebelumnya ditolak oleh kebijakan akses; desktop/mobile, keyboard, tema, dan download CSV belum dinyatakan lulus. Screenshot Discord yang tersedia adalah bukti visual sebelumnya.
