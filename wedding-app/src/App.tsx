import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, Download, Heart, Image as ImageIcon,
  Loader2, LogIn, LogOut, Archive, X, CheckCircle, ZoomIn, Trash2, ShieldOff
} from 'lucide-react';
import JSZip from 'jszip';

const API_URL = ''; // относительный путь — работает на любом хосте
const WS_URL  = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
const ADMIN_TOKEN_KEY = 'wedding_admin_token';

const c = {
  white:       '#FFFFFF',
  sageGreen:   '#8FA08B',
  ivory:       '#F4F0EB',
  dustyRose:   '#C58F93',
  champagne:   '#E5D3B3',
  antiqueGold: '#C6A26B',
  softTaupe:   '#C3B8B2',
  dark:        '#3a3430',
};

interface Photo { id: number; image_data: string; uploaded_at: string; }
interface Toast  { id: number; message: string; type: 'success' | 'error'; }

// ─── helpers ─────────────────────────────────────────────────────────────────
function base64ToBlob(dataUrl: string) {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}
function downloadSingle(photo: Photo) {
  const a = document.createElement('a');
  a.href = photo.image_data;
  a.download = `wedding_photo_${photo.id}.jpg`;
  a.click();
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} className="toast-in" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: t.type === 'success' ? 'rgba(255,255,255,0.95)' : 'rgba(220,80,80,0.92)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${t.type === 'success' ? c.champagne : '#f8a0a0'}`,
          borderRadius: 14, padding: '12px 18px', pointerEvents: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          cursor: 'pointer',
        }} onClick={() => remove(t.id)}>
          {t.type === 'success'
            ? <Heart size={16} fill={c.dustyRose} color={c.dustyRose} />
            : <X size={16} color="#fff" />}
          <span style={{ fontSize: 14, color: t.type === 'success' ? c.dark : '#fff', fontFamily: 'Inter, sans-serif' }}>
            {t.message}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── FloatingHearts ──────────────────────────────────────────────────────────
function FloatingHearts() {
  const hearts = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    left: `${10 + i * 11}%`,
    delay: `${i * 1.4}s`,
    duration: `${7 + i * 1.2}s`,
    size: 10 + (i % 3) * 6,
    opacity: 0.12 + (i % 4) * 0.04,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {hearts.map(h => (
        <div key={h.id} className="float-heart" style={{
          position: 'absolute', bottom: -20, left: h.left,
          animationDuration: h.duration, animationDelay: h.delay,
          color: c.dustyRose, opacity: h.opacity,
        }}>
          <Heart size={h.size} fill={c.dustyRose} />
        </div>
      ))}
    </div>
  );
}

// ─── OrnamentDivider ─────────────────────────────────────────────────────────
function OrnamentDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${c.champagne})` }} />
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        <path d="M14 2 C14 2, 6 8, 6 14 C6 17 9 19 12 17 L14 15 L16 17 C19 19 22 17 22 14 C22 8 14 2 14 2Z" fill={c.dustyRose} opacity="0.5" />
        <circle cx="4" cy="10" r="1.5" fill={c.champagne} />
        <circle cx="24" cy="10" r="1.5" fill={c.champagne} />
        <path d="M7 10 Q4 7 2 10 Q4 13 7 10Z" fill={c.softTaupe} opacity="0.4" />
        <path d="M21 10 Q24 7 26 10 Q24 13 21 10Z" fill={c.softTaupe} opacity="0.4" />
      </svg>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${c.champagne})` }} />
    </div>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ photo, isAdmin, onClose }: { photo: Photo; isAdmin: boolean; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="lightbox-in" style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(20,15,12,0.92)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>
        <img src={photo.image_data} alt="" style={{
          maxWidth: '90vw', maxHeight: '85vh',
          borderRadius: 16, objectFit: 'contain',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          display: 'block',
        }} />

        <button onClick={onClose} style={{
          position: 'absolute', top: -14, right: -14,
          width: 36, height: 36, borderRadius: '50%', border: 'none',
          background: c.dustyRose, color: c.white, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
        }}>
          <X size={16} />
        </button>

        {isAdmin && (
          <button onClick={() => downloadSingle(photo)} style={{
            position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: `linear-gradient(135deg, ${c.antiqueGold}, ${c.champagne})`,
            color: c.dark, border: 'none', borderRadius: 50,
            padding: '10px 24px', cursor: 'pointer', fontSize: 14,
            fontFamily: 'Inter, sans-serif', fontWeight: 600,
            boxShadow: '0 6px 20px rgba(198,162,107,0.4)',
          }}>
            <Download size={16} /> Скачать это фото
          </button>
        )}
      </div>
    </div>
  );
}

// ─── LoginModal ───────────────────────────────────────────────────────────────
function LoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: (t: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        onLogin(data.token); onClose();
      } else {
        setError('Неверный логин или пароль');
      }
    } catch { setError('Ошибка подключения к серверу'); }
    finally { setLoading(false); }
  };

  return (
    <div className="lightbox-in" style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      background: 'rgba(58,52,48,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="modal-in" style={{
        background: 'rgba(255,255,255,0.97)', borderRadius: 24,
        padding: '44px 40px', width: '100%', maxWidth: 380,
        boxShadow: '0 32px 80px rgba(58,52,48,0.22)',
        border: `1px solid ${c.champagne}`, position: 'relative',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'none',
          border: 'none', cursor: 'pointer', color: c.softTaupe,
        }}><X size={20} /></button>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', gap: 4 }}>
            {[14, 20, 14].map((s, i) => (
              <Heart key={i} size={s} fill={c.dustyRose} color={c.dustyRose} style={{ opacity: 0.7 + i * 0.15 }} />
            ))}
          </div>
          <h2 style={{ fontSize: '1.5rem', color: c.antiqueGold, fontFamily: '"Playfair Display", serif', fontWeight: 500, marginBottom: 6 }}>
            Вход для организатора
          </h2>
          <p style={{ fontSize: 13, color: c.softTaupe, fontFamily: 'Inter, sans-serif' }}>Доступ к управлению галереей</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <input value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Логин" required className="form-input" />
          </div>
          <div style={{ position: 'relative' }}>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Пароль" required className="form-input" />
          </div>

          {error && (
            <div style={{
              background: 'rgba(220,80,80,0.08)', border: '1px solid #f8c0c0',
              borderRadius: 10, padding: '10px 14px', fontSize: 13,
              color: '#c05050', textAlign: 'center', fontFamily: 'Inter, sans-serif',
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 8 }}>
            {loading
              ? <><Loader2 size={18} className="spin" /> Вход...</>
              : <><LogIn size={18} /> Войти</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── PhotoCard ────────────────────────────────────────────────────────────────
function PhotoCard({
  photo, isAdmin, deleteMode, onOpen, onDelete,
}: {
  photo: Photo; isAdmin: boolean; deleteMode: boolean;
  onOpen: (p: Photo) => void; onDelete: (id: number) => void;
}) {
  const [loaded, setLoaded]         = useState(false);
  const [hovered, setHovered]       = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleClick = () => {
    if (deleteMode) {
      if (!confirming) { setConfirming(true); return; }
      onDelete(photo.id);
    } else if (isAdmin) {
      downloadSingle(photo);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } else {
      onOpen(photo);
    }
  };

  // Сбрасываем подтверждение если уходим мышкой
  const handleLeave = () => { setHovered(false); setConfirming(false); };

  const overlayBg = deleteMode
    ? confirming
      ? 'rgba(180,40,40,0.82)'
      : 'rgba(197,80,80,0.65)'
    : isAdmin
      ? `linear-gradient(135deg, rgba(198,162,107,0.75), rgba(197,143,147,0.65))`
      : 'rgba(0,0,0,0.32)';

  return (
    <div
      className="photo-card"
      style={{ breakInside: 'avoid', marginBottom: 16, cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      onClick={handleClick}
    >
      <div style={{
        borderRadius: 14, overflow: 'hidden', position: 'relative',
        boxShadow: hovered
          ? deleteMode
            ? `0 20px 50px rgba(180,40,40,0.25), 0 0 0 2px #e05050`
            : `0 20px 50px rgba(0,0,0,0.2), 0 0 0 2px ${c.champagne}`
          : '0 4px 16px rgba(0,0,0,0.1)',
        transform: hovered ? 'translateY(-4px) scale(1.01)' : 'none',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        background: c.champagne + '50',
      }}>
        {!loaded && (
          <div className="shimmer" style={{ position: 'absolute', inset: 0, zIndex: 1, minHeight: 160 }} />
        )}

        <img
          src={photo.image_data}
          alt="Свадебное фото"
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: 'auto', display: 'block', opacity: loaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
        />

        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: overlayBg,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.3s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8,
        }}>
          {deleteMode ? (
            confirming
              ? <><Trash2 size={36} color="#fff" /><span style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>Нажмите ещё раз<br/>для удаления</span></>
              : <><Trash2 size={36} color="#fff" /><span style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Удалить</span></>
          ) : isAdmin ? (
            downloaded
              ? <><CheckCircle size={36} color="#a8f0a0" /><span style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Сохранено!</span></>
              : <><Download size={36} color="#fff" /><span style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Скачать</span></>
          ) : (
            <><ZoomIn size={32} color="#fff" /><span style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>Открыть</span></>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [photos, setPhotos]         = useState<Photo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrent, setUploadCurrent]   = useState(0);
  const [uploadTotal, setUploadTotal]       = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [showLogin, setShowLogin]   = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [isZipping, setIsZipping]   = useState(false);
  const [toasts, setToasts]         = useState<Toast[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);
  const isAdmin = !!adminToken;

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastId.current;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = (id: number) => setToasts(p => p.filter(t => t.id !== id));

  // Scroll to top button
  useEffect(() => {
    const handler = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Load photos
  useEffect(() => {
    fetch(`${API_URL}/photos`).then(r => r.json()).then(setPhotos).catch(console.error);
  }, []);

  // WebSocket
  useEffect(() => {
    let ws: WebSocket;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen  = () => setIsConnected(true);
      ws.onclose = () => { setIsConnected(false); setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'new_photo')
          setPhotos(prev => prev.some(p => p.id === data.photo.id) ? prev : [data.photo, ...prev]);
        else if (data.type === 'delete_photo')
          setPhotos(prev => prev.filter(p => p.id !== data.photo_id));
      };
    };
    connect();
    return () => ws?.close();
  }, []);

  // Compress image
  const compressImage = (file: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = e => {
        const img = new Image();
        img.src = e.target!.result as string;
        img.onload = () => {
          const MAX = 1200;
          let { width: w, height: h } = img;
          if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
          else        { if (h > MAX) { w *= MAX / h; h = MAX; } }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
      };
    });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setIsUploading(true);
    setUploadCurrent(0);
    setUploadTotal(files.length);
    setUploadProgress(0);

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadCurrent(i + 1);
      setUploadProgress(0);
      const prog = setInterval(() => setUploadProgress(p => Math.min(p + 14, 85)), 120);
      try {
        const image_data = await compressImage(files[i]);
        await fetch(`${API_URL}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_data }),
        });
        setUploadProgress(100);
        successCount++;
      } catch {
        addToast(`Не удалось загрузить фото ${i + 1}`, 'error');
      } finally {
        clearInterval(prog);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (successCount > 0)
      addToast(successCount === 1 ? 'Фото добавлено в галерею!' : `${successCount} фото добавлено в галерею!`);

    setIsUploading(false);
    setUploadProgress(0);
    setUploadCurrent(0);
    setUploadTotal(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (photoId: number) => {
    try {
      const res = await fetch(`${API_URL}/photos/${photoId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      addToast('Фото удалено');
    } catch {
      addToast('Не удалось удалить фото', 'error');
    }
  };



  const handleDownloadAll = async () => {
    if (!isAdmin || photos.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      photos.forEach((photo, i) => {
        zip.file(`wedding_photo_${String(i + 1).padStart(3, '0')}.jpg`, base64ToBlob(photo.image_data), { base64: true });
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'wedding_photos.zip'; a.click();
      URL.revokeObjectURL(url);
      addToast(`Архив из ${photos.length} фото скачан!`);
    } finally { setIsZipping(false); }
  };

  const handleLogout = () => { localStorage.removeItem(ADMIN_TOKEN_KEY); setAdminToken(null); };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: c.ivory }}>

      {/* ── Header ── */}
      <header style={{ position: 'relative', overflow: 'hidden', backgroundColor: c.white }}>
        <FloatingHearts />

        {/* Gradient top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${c.sageGreen}, ${c.dustyRose}, ${c.champagne}, ${c.antiqueGold}, ${c.dustyRose}, ${c.sageGreen})`, backgroundSize: '200% 100%', animation: 'shimmer-bar 4s linear infinite' }} />

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '36px 24px 28px', maxWidth: 700, margin: '0 auto' }}>
          {/* Ornamental hearts */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 40, height: 1, background: `linear-gradient(to right, transparent, ${c.champagne})` }} />
            <Heart size={12} fill={c.dustyRose} color={c.dustyRose} style={{ opacity: 0.5 }} />
            <Heart size={20} fill={c.dustyRose} color={c.dustyRose} />
            <Heart size={12} fill={c.dustyRose} color={c.dustyRose} style={{ opacity: 0.5 }} />
            <div style={{ width: 40, height: 1, background: `linear-gradient(to left, transparent, ${c.champagne})` }} />
          </div>

          <h1 className="hero-title">Наша Свадьба</h1>

          <p style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: '1.1rem', color: c.softTaupe, marginBottom: 8, letterSpacing: '0.02em' }}>
            Поделитесь самыми светлыми моментами этого дня
          </p>

          <OrnamentDivider />

          {/* Sync indicator */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, padding: '6px 16px', borderRadius: 50, background: isConnected ? 'rgba(143,160,139,0.12)' : 'rgba(195,184,178,0.15)', border: `1px solid ${isConnected ? c.sageGreen + '40' : c.softTaupe + '40'}` }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isConnected ? c.sageGreen : c.softTaupe, display: 'inline-block', animation: isConnected ? 'pulse-dot 2s infinite' : 'none' }} />
            <span style={{ fontSize: 12, color: isConnected ? c.sageGreen : c.softTaupe, fontFamily: 'Inter, sans-serif', letterSpacing: '0.03em' }}>
              {isConnected ? 'Галерея синхронизирована' : 'Подключение...'}
            </span>
          </div>
        </div>

        {/* Bottom gradient border */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${c.sageGreen}, ${c.dustyRose}, ${c.champagne})` }} />
      </header>

      {/* ── Admin bar ── */}
      {isAdmin && (
        <div className="admin-bar-in" style={{
          background: deleteMode
            ? `linear-gradient(135deg, rgba(210,80,80,0.92), rgba(180,50,50,0.88))`
            : `linear-gradient(135deg, rgba(229,211,179,0.95), rgba(198,162,107,0.9))`,
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${deleteMode ? '#e05050' : c.champagne}`,
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
          transition: 'background 0.3s ease',
        }}>
          <span style={{ fontSize: 13, color: deleteMode ? '#fff' : c.dark, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
            {deleteMode ? '🗑 Режим удаления — нажмите на фото дважды для удаления' : '✦ Режим организатора — нажимайте на фото для скачивания'}
          </span>

          <button
            onClick={() => setDeleteMode(d => !d)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: deleteMode ? 'rgba(255,255,255,0.25)' : 'rgba(220,80,80,0.15)',
              border: `1px solid ${deleteMode ? 'rgba(255,255,255,0.5)' : '#e05050'}`,
              borderRadius: 50, padding: '8px 16px', cursor: 'pointer',
              fontSize: 13, color: deleteMode ? '#fff' : '#c03030',
              fontFamily: 'Inter, sans-serif', fontWeight: 600,
              transition: 'all 0.2s',
            }}>
            {deleteMode ? <><ShieldOff size={14} /> Выйти из удаления</> : <><Trash2 size={14} /> Удалять фото</>}
          </button>

          {!deleteMode && (
            <button onClick={handleDownloadAll} disabled={isZipping || photos.length === 0}
              className="btn-gold" style={{ padding: '8px 20px', fontSize: 13 }}>
              {isZipping ? <><Loader2 size={14} className="spin" /> Архивируем...</> : <><Archive size={14} /> Скачать все ({photos.length})</>}
            </button>
          )}

          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: deleteMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.4)',
            border: `1px solid ${deleteMode ? 'rgba(255,255,255,0.3)' : 'rgba(195,184,178,0.6)'}`,
            borderRadius: 50, padding: '8px 16px', cursor: 'pointer',
            fontSize: 13, color: deleteMode ? '#fff' : c.dark, fontFamily: 'Inter, sans-serif',
          }}>
            <LogOut size={14} /> Выйти
          </button>
        </div>
      )}

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 20px 24px' }}>

        {/* ── Upload section ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <input type="file" accept="image/*" multiple
            style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />

          <div style={{ position: 'relative' }}>
            {/* Pulsing ring */}
            {!isUploading && (
              <div style={{
                position: 'absolute', inset: -8, borderRadius: 50,
                border: `2px solid ${c.sageGreen}30`,
                animation: 'ring-pulse 2.5s ease-out infinite',
                pointerEvents: 'none',
              }} />
            )}

            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
              className="btn-upload">
              {isUploading
                ? <><Loader2 size={22} className="spin" /><span>
                    {uploadTotal > 1 ? `Загружаем ${uploadCurrent} из ${uploadTotal}...` : 'Загружаем...'}
                  </span></>
                : <><Camera size={22} /><span>Добавить фото</span></>}
            </button>
          </div>

          {/* Progress bar */}
          {isUploading && (
            <div style={{ width: 220, marginTop: 16 }}>
              {uploadTotal > 1 && (
                <div style={{ textAlign: 'center', fontSize: 12, color: c.softTaupe, fontFamily: 'Inter, sans-serif', marginBottom: 6 }}>
                  {uploadCurrent} / {uploadTotal}
                </div>
              )}
              <div style={{ height: 3, background: c.champagne, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: `linear-gradient(90deg, ${c.sageGreen}, ${c.dustyRose})`,
                  width: `${uploadProgress}%`,
                  transition: 'width 0.2s ease',
                }} />
              </div>
            </div>
          )}

          <p style={{ marginTop: 14, fontSize: 13, color: c.softTaupe, fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em' }}>
            Можно выбрать несколько фото сразу
          </p>
        </div>

        {/* ── Gallery ── */}
        <section>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: c.sageGreen, fontWeight: 400, marginBottom: 6 }}>
              Галерея Моментов
            </h2>
            {photos.length > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <div style={{ width: 32, height: 1, background: c.champagne }} />
                <span style={{ fontSize: 13, color: c.softTaupe, fontFamily: 'Inter, sans-serif' }}>{photos.length} {photos.length === 1 ? 'фотография' : 'фотографий'}</span>
                <div style={{ width: 32, height: 1, background: c.champagne }} />
              </div>
            )}
          </div>

          {photos.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '90px 20px',
              border: `2px dashed ${c.champagne}`, borderRadius: 24,
              background: 'rgba(255,255,255,0.5)',
            }}>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
                <ImageIcon size={64} style={{ color: c.champagne, display: 'block' }} />
                <Heart size={22} fill={c.dustyRose} color={c.dustyRose} style={{ position: 'absolute', bottom: -4, right: -8, opacity: 0.7 }} />
              </div>
              <p style={{ fontSize: '1.1rem', color: c.softTaupe, fontFamily: '"Playfair Display", serif', marginBottom: 8 }}>Здесь пока нет фотографий</p>
              <p style={{ color: c.champagne, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>Будьте первыми, кто поделится радостью!</p>
            </div>
          ) : (
            <div className="masonry-grid">
              {photos.map(photo => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  isAdmin={isAdmin}
                  deleteMode={deleteMode}
                  onOpen={setLightboxPhoto}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: c.white, borderTop: `1px solid ${c.champagne}30`, padding: '24px 24px 20px', textAlign: 'center', position: 'relative', marginTop: 20 }}>
        <OrnamentDivider />
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 10 }}>
            {[10, 14, 10].map((s, i) => <Heart key={i} size={s} fill={c.dustyRose} color={c.dustyRose} style={{ opacity: 0.4 + i * 0.2 }} />)}
          </div>
          <p style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', color: c.softTaupe, fontSize: '1rem' }}>
            С любовью в каждой детали
          </p>
          <p style={{ fontSize: 12, color: c.champagne, marginTop: 6, fontFamily: 'Inter, sans-serif' }}>
            Фотографии сохраняются в качестве, пригодном для печати
          </p>
        </div>

        {!isAdmin && (
          <button onClick={() => setShowLogin(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: `1px solid ${c.champagne}`,
            borderRadius: 50, padding: '7px 18px', cursor: 'pointer',
            fontSize: 12, color: c.softTaupe, fontFamily: 'Inter, sans-serif',
            marginTop: 16, transition: 'all 0.2s',
          }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = c.antiqueGold; (e.currentTarget as HTMLButtonElement).style.color = c.antiqueGold; }}
             onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = c.champagne; (e.currentTarget as HTMLButtonElement).style.color = c.softTaupe; }}>
            <LogIn size={13} /> Вход
          </button>
        )}
      </footer>

      {/* ── Scroll to top ── */}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="scroll-top-btn">
          ↑
        </button>
      )}

      {/* ── Modals & overlays ── */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={t => setAdminToken(t)} />}
      {lightboxPhoto && <Lightbox photo={lightboxPhoto} isAdmin={isAdmin} onClose={() => setLightboxPhoto(null)} />}
      <ToastContainer toasts={toasts} remove={removeToast} />

      {/* ── Global styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${c.ivory}; -webkit-font-smoothing: antialiased; }

        @keyframes spin         { to { transform: rotate(360deg); } }
        @keyframes float-heart  { 0%{transform:translateY(0) rotate(-10deg);opacity:0} 10%{opacity:1} 90%{opacity:0.6} 100%{transform:translateY(-110vh) rotate(20deg);opacity:0} }
        @keyframes ring-pulse   { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(1.5);opacity:0} }
        @keyframes pulse-dot    { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer-bar  { 0%{background-position:0 0} 100%{background-position:200% 0} }
        @keyframes photo-enter  { from{opacity:0;transform:translateY(18px) scale(0.97)} to{opacity:1;transform:none} }
        @keyframes slide-up     { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }
        @keyframes slide-right  { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:none} }
        @keyframes shimmer-bg   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        .float-heart { animation: float-heart linear infinite; }
        .spin        { animation: spin 1s linear infinite; }

        .hero-title {
          font-family: "Playfair Display", serif;
          font-size: clamp(2.4rem, 6vw, 4rem);
          font-weight: 500;
          letter-spacing: 0.02em;
          background: linear-gradient(135deg, ${c.antiqueGold} 0%, #d4a96a 40%, ${c.dustyRose} 70%, ${c.antiqueGold} 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 14px;
          line-height: 1.2;
        }

        .admin-bar-in { animation: slide-up 0.4s ease; }
        .lightbox-in  { animation: slide-up 0.25s ease; }
        .modal-in     { animation: slide-up 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        .toast-in     { animation: slide-right 0.3s ease; }

        .photo-card { animation: photo-enter 0.5s ease both; }

        .shimmer {
          background: linear-gradient(90deg, ${c.ivory} 25%, ${c.champagne}50 50%, ${c.ivory} 75%);
          background-size: 200% 100%;
          animation: shimmer-bg 1.4s ease infinite;
        }

        .masonry-grid { columns: 2; column-gap: 14px; }
        @media (min-width: 640px)  { .masonry-grid { columns: 2; column-gap: 18px; } }
        @media (min-width: 900px)  { .masonry-grid { columns: 3; column-gap: 20px; } }
        @media (min-width: 1200px) { .masonry-grid { columns: 4; column-gap: 22px; } }

        .btn-upload {
          display: flex; align-items: center; gap: 12;
          padding: 18px 44px; border-radius: 50px; border: none;
          background: linear-gradient(135deg, ${c.sageGreen}, #7a9075);
          color: #fff; font-size: 1.05rem; font-family: Inter, sans-serif;
          font-weight: 500; cursor: pointer; letter-spacing: 0.02em;
          box-shadow: 0 8px 28px rgba(143,160,139,0.45), 0 2px 8px rgba(143,160,139,0.3);
          transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .btn-upload:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 14px 40px rgba(143,160,139,0.5);
        }
        .btn-upload:disabled { opacity: 0.7; cursor: not-allowed; }

        .btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 8;
          padding: 13px 24px; border-radius: 50px; border: none;
          background: linear-gradient(135deg, ${c.sageGreen}, #7a9075);
          color: #fff; font-size: 15px; font-family: Inter, sans-serif;
          font-weight: 500; cursor: pointer;
          box-shadow: 0 6px 20px rgba(143,160,139,0.35);
          transition: all 0.25s;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(143,160,139,0.45); }

        .btn-gold {
          display: flex; align-items: center; gap: 7;
          border: none; border-radius: 50px;
          background: rgba(255,255,255,0.55); color: ${c.dark};
          font-family: Inter, sans-serif; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          transition: all 0.2s;
        }
        .btn-gold:hover:not(:disabled) { background: rgba(255,255,255,0.8); transform: translateY(-1px); }
        .btn-gold:disabled { opacity: 0.55; cursor: not-allowed; }

        .form-input {
          width: 100%; padding: 13px 16px; border-radius: 12px;
          border: 1.5px solid ${c.champagne};
          font-size: 15px; font-family: Inter, sans-serif;
          background: ${c.ivory}; color: ${c.dark}; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .form-input:focus {
          border-color: ${c.sageGreen};
          box-shadow: 0 0 0 3px ${c.sageGreen}22;
        }

        .scroll-top-btn {
          position: fixed; bottom: 28px; left: 24px; z-index: 999;
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: ${c.dustyRose}; color: #fff; font-size: 18px;
          cursor: pointer; box-shadow: 0 4px 16px rgba(197,143,147,0.4);
          transition: all 0.2s;
          animation: slide-up 0.3s ease;
        }
        .scroll-top-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(197,143,147,0.5); }
        @media (max-width: 640px) { .scroll-top-btn { display: none; } }
      `}</style>
    </div>
  );
}
