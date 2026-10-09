import { useState, useEffect } from 'react';
import Head from 'next/head';

const CHANNELS = [
  { id: 'ch1', label: 'CAM 01', name: 'Depan / Garasi' },
  { id: 'ch2', label: 'CAM 02', name: 'Teras / Pintu' },
  { id: 'ch3', label: 'CAM 03', name: 'Samping' },
  { id: 'ch4', label: 'CAM 04', name: 'Halaman Belakang' },
];

export default function Home() {
  const [selectedCam, setSelectedCam] = useState('ch1');
  const [isHd, setIsHd] = useState(false);
  const [streamMode, setStreamMode] = useState('webrtc'); // 'webrtc' | 'mjpeg'
  const [events, setEvents] = useState([]);
  const [aiStatus, setAiStatus] = useState('CONNECTING');
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [activeVideoModal, setActiveVideoModal] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const currentStreamId = isHd ? `${selectedCam}_hd` : selectedCam;

  useEffect(() => {
    const fetchData = () => {
      fetch('/ai-api/api/events')
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            setEvents(d);
            setAiStatus('ACTIVE');
          }
        })
        .catch(() => setAiStatus('STANDBY'));

      fetch('/ai-api/api/live')
        .then(r => r.json())
        .then(d => {
          if (d?.snapshot_b64) {
            setLatestSnapshot(`data:image/jpeg;base64,${d.snapshot_b64}`);
          }
        })
        .catch(() => {});
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const activeChannelObj = CHANNELS.find(c => c.id === selectedCam) || CHANNELS[0];

  return (
    <>
      <Head>
        <title>DAHUA CCTV Monitor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#090a0f" />
      </Head>

      <div className="cctv-app">
        {/* Header Bar */}
        <header className="cctv-header">
          <div className="brand-group">
            <div className="logo-icon">📡</div>
            <div>
              <h1 className="brand-title">DAHUA MONITOR</h1>
              <div className="ai-badge">
                <span className={`status-dot ${aiStatus === 'ACTIVE' ? 'active' : 'warn'}`} />
                AI {aiStatus}
              </div>
            </div>
          </div>

          <div className="header-actions">
            <a href="/converter" className="header-btn">
              <span>📄 DAV Converter</span>
            </a>
          </div>
        </header>

        {/* Desktop Layout Grid Wrapper */}
        <div className="desktop-grid">
          <div className="desktop-main">
            {/* Channel Selector */}
            <div className="channel-nav">
              {CHANNELS.map(cam => (
                <button
                  key={cam.id}
                  className={`channel-card ${selectedCam === cam.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCam(cam.id);
                    setReloadKey(prev => prev + 1);
                  }}
                >
                  <span className="cam-num">{cam.label}</span>
                  <span className="cam-desc">{cam.name}</span>
                </button>
              ))}
            </div>

            {/* Main Video Viewport */}
            <div className="viewport-container">
              <div className="video-wrapper">
                {streamMode === 'mjpeg' ? (
                  <img
                    key={`${currentStreamId}-mjpeg-${reloadKey}`}
                    src={`/stream/api/stream.mjpeg?src=${currentStreamId}`}
                    className="video-frame mjpeg"
                    alt="Live Stream"
                  />
                ) : (
                  <iframe
                    key={`${currentStreamId}-webrtc-${reloadKey}`}
                    src={`/stream/stream.html?src=${currentStreamId}`}
                    className="video-frame"
                    allow="autoplay; fullscreen"
                  />
                )}

                {/* Video HUD Overlay */}
                <div className="hud-overlay top-left">
                  <span className="hud-tag live-tag">● LIVE</span>
                  <span className="hud-tag">{activeChannelObj.label}</span>
                  <span className="hud-tag">{isHd ? 'MAIN 1080P' : 'SUB 360P'}</span>
                </div>

                <div className="hud-overlay top-right">
                  <span className="hud-tag mode-tag">{streamMode.toUpperCase()}</span>
                </div>
              </div>

              {/* Quick Toolbar under Video */}
              <div className="toolbar">
                <div className="segmented-group">
                  <button
                    className={`segmented-btn ${!isHd ? 'active' : ''}`}
                    onClick={() => setIsHd(false)}
                  >
                    ⚡ Sub (Fast)
                  </button>
                  <button
                    className={`segmented-btn ${isHd ? 'active' : ''}`}
                    onClick={() => setIsHd(true)}
                  >
                    💎 Main (HD)
                  </button>
                </div>

                <div className="segmented-group">
                  <button
                    className={`segmented-btn ${streamMode === 'webrtc' ? 'active' : ''}`}
                    onClick={() => setStreamMode('webrtc')}
                  >
                    WebRTC
                  </button>
                  <button
                    className={`segmented-btn ${streamMode === 'mjpeg' ? 'active' : ''}`}
                    onClick={() => setStreamMode('mjpeg')}
                  >
                    MJPEG
                  </button>
                </div>

                <button
                  className="refresh-btn"
                  title="Refresh Stream"
                  onClick={() => setReloadKey(prev => prev + 1)}
                >
                  🔄
                </button>
              </div>
            </div>
          </div>

          <aside className="desktop-side">
            {/* Dashboard Content Grid */}
            <div className="dashboard-content">
              {/* AI Snapshot Card */}
              {latestSnapshot && (
                <section className="card snapshot-section">
                  <div className="card-header">
                    <h3>⚡ LIVE AI DETECTOR</h3>
                    <span className="badge-sub">Realtime Motion Frame</span>
                  </div>
                  <div className="snapshot-box">
                    <img src={latestSnapshot} alt="AI Detection Preview" className="snapshot-img" />
                  </div>
                </section>
              )}

              {/* Event Logs & Recordings */}
              <section className="card events-section">
                <div className="card-header">
                  <h3>🚨 EVENT & REKAMAN ({events.length})</h3>
                  <span className="badge-sub">Retensi 3 Hari</span>
                </div>

                <div className="events-grid">
                  {events.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-icon">🛡️</span>
                      <p>Belum ada gerakan/orang terdeteksi.</p>
                      <small>Auto-record 15 detik saat motion terdeteksi.</small>
                    </div>
                  ) : (
                    events.map(evt => (
                      <div key={evt.id} className="event-item">
                        <div className="event-info">
                          <div className="event-meta">
                            <span className="event-time">⏱ {evt.time}</span>
                            <span className="event-badge">{evt.type}</span>
                          </div>
                          <div className="event-title">{evt.desc}</div>
                        </div>

                        <div className="event-actions">
                          {evt.snapshot && (
                            <a
                              href={`/ai-api${evt.snapshot}`}
                              target="_blank"
                              rel="noreferrer"
                              className="action-btn photo"
                            >
                              📷 Foto
                            </a>
                          )}
                          {evt.video && (
                            <>
                              <button
                                onClick={() => setActiveVideoModal(`/ai-api${evt.video}`)}
                                className="action-btn play"
                              >
                                ▶ Putar Video
                              </button>
                              <a
                                href={`/ai-api${evt.video}`}
                                download
                                className="action-btn download"
                              >
                                ⬇ MP4
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>

        {/* Modal Video Player */}
        {activeVideoModal && (
          <div className="modal-backdrop" onClick={() => setActiveVideoModal(null)}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
              <div className="modal-top">
                <span className="modal-title">🎬 KLIP REKAMAN DETEKSI</span>
                <button className="modal-close" onClick={() => setActiveVideoModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <video src={activeVideoModal} controls autoPlay className="modal-video" />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
