# Sentinel AI - CCTV Dashboard 🛡️

Dashboard Monitoring CCTV (berbasis Nginx, Node.js/Next.js, WebRTC, dan Python/Flask AI) yang dirancang secara khusus untuk integrasi dengan DVR Analog (Dahua) melalui RTSP stream. Aplikasi ini difokuskan pada pengawasan low-latency, deteksi objek cerdas, dan efisiensi memori.

## Fitur Utama ✨
1. **Low Latency Streaming:** Mengubah stream RTSP lawas (DVR Analog Dahua) menjadi WebRTC (sub 0.5s latency) dan fallback MJPEG melalui `go2rtc`.
2. **Multi-Channel & Multi-Resolution:** Mendukung navigasi instan antar kamera (CAM 1–4) dan switch profil (Sub-stream untuk speed, Main-stream untuk HD).
3. **AI Motion/Person Detection:** Menggunakan HOG (Histogram of Oriented Gradients) via Python OpenCV/Flask API untuk mendeteksi pergerakan atau manusia, dengan _resource_ CPU dan RAM sangat minim.
4. **Auto-Recording 15s:** Otomatis memicu FFmpeg stream copy (`-c copy`) yang tidak butuh encoding berat, setiap ada event pergerakan yang tertangkap.
5. **Retensi 3 Hari:** Cron/background worker otomatis di Python akan menghapus video berumur lebih dari 3 hari.
6. **Built-in DAV Converter:** Modul konverter dari DAV (format default Dahua backup) ke MP4 yang bisa diputar langsung di browser manapun.
7. **Mobile Responsive Grid:** UI Dashboard industrial ala terminal menggunakan CSS Grid 2 Kolom untuk desktop, dan stacking elegan untuk perangkat mobile.

## Arsitektur & Tech Stack 🏗️
- **Frontend / Web Proxy:** Next.js (React), berjalan di port `3000` (diekspos ke host via `5009`).
- **Stream Server:** `alexxit/go2rtc` (WebRTC, RTSP proxy) berjalan di port `1984` & `8555`.
- **AI Backend:** Python 3 (Flask, OpenCV) berjalan di port `5050`.
- **Reverse Proxy:** Web container Next.js yang menangani proxy pass `/stream/` (ke go2rtc) dan `/ai-api/` (ke Flask AI) untuk mengeliminasi CORS dan mengekspos app dalam satu port (5009).

## Struktur Direktori 📂
```
/cctv-app
│
├── docker-compose.yml     # Konfigurasi container utama (Web, AI, Go2rtc)
├── go2rtc.yaml            # Konfigurasi input stream RTSP channel 1-4
│
├── web/                   # Next.js Frontend Dashboard (UI & API Proxy)
│   ├── pages/             # Berisi index.js (Monitor) & converter.js
│   ├── styles/            # CSS globals, custom variable warna industrial
│   └── public/            # Static assets
│
└── ai/                    # Python Backend
    ├── server.py          # API Flask (Log event, list rekaman)
    ├── detector.py        # Logic HOG Detektor & auto FFmpeg trigger
    ├── snapshots/         # Hasil screenshot foto saat event
    ├── recordings/        # Klip video 15s MP4
    └── data/              # SQLite / log JSON
```

## Cara Deployment (Proxmox/Ubuntu) 🚀

1. **Clone repository ini**
   ```bash
   git clone git@github.com:rijalunns/cctv-app.git
   cd cctv-app
   ```

2. **Sesuaikan URL RTSP DVR Dahua di konfigurasi**
   Buka file `go2rtc.yaml` dan `/ai/docker-compose.yml`, pastikan password admin Dahua benar:
   ```yaml
   rtsp://admin:[PASSWORD]@192.168.1.2:554/cam/realmonitor?channel=1&subtype=1
   ```

3. **Build & Start Containers**
   Aplikasi ini fully-dockerized. Cukup jalankan:
   ```bash
   docker compose up -d --build
   ```

4. **Akses Dashboard**
   Akses `http://<IP-SERVER>:5009` (Misal: `http://localhost:5009` atau setup via Nginx Reserve Proxy untuk custom domain).

## FAQ & Troubleshooting 🔧
**Q: Stream kadang patah-patah?**
> Coba ganti mode dari *WebRTC* ke *MJPEG* di toolbar bawah video. WebRTC butuh UDP port (8555) terbuka di firewall.

**Q: AI tidak mendeteksi objek?**
> Pastikan container `cctv-app-ai` berjalan dan CPU memadai (minimal alokasi 1 Core 2.0 GHz untuk HOG detection).

**Q: Kenapa Nginx Reverse proxy? Kenapa gak langsung akses IP?**
> Di setup server `100% Nginx`, proxy memungkinkan integrasi WebRTC WebSocket yang lancar, SSL termination (HTTPS), dan menyembunyikan port aslinya ke dalam sub-domain (misal `cctv.adibrijal.my.id`).

---
_Dibuat dengan bantuan Hermes Agent 🚀._