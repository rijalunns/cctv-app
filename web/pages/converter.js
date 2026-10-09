import { useState, useRef } from 'react';
import Head from 'next/head';

export default function Converter() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | converting | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.name.toLowerCase().endsWith('.dav')) {
        setFile(f);
        setStatus('idle');
        setResult(null);
        setErrorMsg('');
      } else {
        setErrorMsg('File harus berekstensi .dav!');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setResult(null);
      setErrorMsg('');
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    setStatus('uploading');
    setProgress(10);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      setProgress(30);
      setStatus('converting');

      const res = await fetch('/ai-api/api/convert', {
        method: 'POST',
        body: formData,
      });

      setProgress(80);
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setProgress(100);
        setStatus('done');
        setResult(data);
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Konversi gagal.');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('Network error — server tidak dapat dihubungi.');
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const resetAll = () => {
    setFile(null);
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
    setProgress(0);
  };

  return (
    <>
      <Head>
        <title>DAV → MP4 CONVERTER // SENTINEL AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app-container">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="brand-section">
            <span className="logo-badge">DAHUA</span>
            <span className="logo-text">SENTINEL AI</span>
          </div>
          <div className="status-group">
            <a href="/" className="badge" style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← LIVE MONITOR
            </a>
            <div className="badge" style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}>
              <span className="dot" style={{ backgroundColor: 'var(--accent-cyan)' }} />
              DAV CONVERTER
            </div>
          </div>
        </header>

        {/* Main */}
        <div style={{ maxWidth: '680px', margin: '40px auto', padding: '0 16px' }}>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', color: '#fff', marginBottom: '6px' }}>
            DAV → MP4 CONVERTER
          </h1>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginBottom: '30px' }}>
            Convert file rekaman CCTV Dahua (.dav) menjadi .mp4 yang bisa diputar di semua perangkat.
            Kualitas 100% asli, proses cepat (stream copy).
          </p>

          {/* Drop Zone */}
          <div
            className={`dropzone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".dav,.DAV"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {file ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎬</div>
                <div style={{ color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                  {file.name}
                </div>
                <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginTop: '4px' }}>
                  {formatSize(file.size)}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '10px', opacity: 0.6 }}>📂</div>
                <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                  Drag & Drop file .dav ke sini
                </div>
                <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginTop: '6px' }}>
                  atau klik untuk browse file
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div style={{
              marginTop: '14px', padding: '10px 14px', background: 'rgba(255,51,102,0.1)',
              border: '1px solid var(--accent-warn)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
              color: 'var(--accent-warn)'
            }}>
              ⚠ {errorMsg}
            </div>
          )}

          {/* Progress Bar */}
          {(status === 'uploading' || status === 'converting') && (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem', color: 'var(--accent)', marginBottom: '6px'
              }}>
                <span>{status === 'uploading' ? '⬆ UPLOADING...' : '⚙ CONVERTING...'}</span>
                <span>{progress}%</span>
              </div>
              <div style={{
                width: '100%', height: '4px', background: 'var(--surface)', borderRadius: '2px', overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progress}%`, height: '100%', background: 'var(--accent)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            {status !== 'done' && (
              <button
                onClick={handleConvert}
                disabled={!file || status === 'uploading' || status === 'converting'}
                style={{
                  flex: 1, padding: '12px', background: file && status === 'idle' ? 'var(--accent)' : 'var(--border)',
                  color: file && status === 'idle' ? '#000' : 'var(--text-muted)',
                  border: 'none', fontFamily: 'var(--font-mono)', fontWeight: 'bold',
                  fontSize: '0.85rem', cursor: file && status === 'idle' ? 'pointer' : 'not-allowed',
                  textTransform: 'uppercase', letterSpacing: '2px'
                }}
              >
                {status === 'converting' ? '⚙ Converting...' : status === 'uploading' ? '⬆ Uploading...' : '🔄 CONVERT KE MP4'}
              </button>
            )}
            {(file || status === 'done') && (
              <button
                onClick={resetAll}
                style={{
                  padding: '12px 20px', background: 'transparent', color: 'var(--text-muted)',
                  border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                RESET
              </button>
            )}
          </div>

          {/* Result / Download */}
          {status === 'done' && result && (
            <div style={{
              marginTop: '24px', padding: '20px', background: 'var(--surface)',
              border: '1px solid var(--accent)'
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent)',
                marginBottom: '12px', fontWeight: 'bold'
              }}>
                ✅ KONVERSI BERHASIL!
              </div>

              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)',
                marginBottom: '16px', wordBreak: 'break-all'
              }}>
                File: {result.filename}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={`/ai-api${result.download_url}`}
                  download
                  style={{
                    flex: 1, padding: '12px', background: 'var(--accent)', color: '#000',
                    textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 'bold',
                    fontSize: '0.85rem', textDecoration: 'none', textTransform: 'uppercase',
                    letterSpacing: '2px', display: 'block', minWidth: '200px'
                  }}
                >
                  ⬇ DOWNLOAD MP4
                </a>

                <button
                  onClick={() => {
                    const video = document.createElement('video');
                    video.src = `/ai-api${result.download_url}`;
                    video.controls = true;
                    video.autoplay = true;
                    video.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:90vw;max-height:80vh;z-index:9999;background:#000';
                    const bg = document.createElement('div');
                    bg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9998';
                    bg.onclick = () => { document.body.removeChild(bg); document.body.removeChild(video); };
                    document.body.appendChild(bg);
                    document.body.appendChild(video);
                  }}
                  style={{
                    flex: 1, padding: '12px', background: 'transparent', color: 'var(--accent-cyan)',
                    border: '1px solid var(--accent-cyan)', fontFamily: 'var(--font-mono)',
                    fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', textTransform: 'uppercase',
                    letterSpacing: '2px', minWidth: '200px'
                  }}
                >
                  ▶ PUTAR VIDEO
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div style={{
            marginTop: '40px', padding: '16px', background: 'var(--surface)',
            border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
            color: 'var(--text-muted)', lineHeight: '1.6'
          }}>
            <div style={{ color: '#fff', marginBottom: '8px', fontWeight: 'bold' }}>ℹ INFO</div>
            • File .dav adalah format rekaman bawaan DVR Dahua<br />
            • Konversi menggunakan metode Stream Copy (tanpa re-encoding)<br />
            • Kualitas video 100% identik dengan file asli<br />
            • Proses sangat cepat (1-3 detik untuk file 100MB)<br />
            • Hasil .mp4 bisa diputar di semua device (HP, Laptop, Smart TV)
          </div>
        </div>
      </div>
    </>
  );
}
