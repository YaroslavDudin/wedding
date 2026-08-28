import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Download, Heart, Image as ImageIcon, Loader2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// --- Инициализация Firebase ---
// Используем переменные окружения Canvas, если они доступны
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wedding-app-id';
const COLLECTION_NAME = 'wedding_photos';

// --- Цветовая палитра из мудборда ---
const colors = {
  white: '#FFFFFF', // Цвет невесты
  sageGreen: '#8FA08B',
  ivory: '#F4F0EB',
  dustyRose: '#C58F93',
  champagne: '#E5D3B3',
  antiqueGold: '#C6A26B',
  softTaupe: '#C3B8B2'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // 1. Авторизация (незаметная для гостей)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Ошибка авторизации:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Получение фотографий из базы данных
  useEffect(() => {
    if (!user) return;

    // Strict Path Rule: collection(db, 'artifacts', appId, 'public', 'data', collectionName)
    const photosRef = collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME);
    
    const unsubscribe = onSnapshot(
      photosRef,
      (snapshot) => {
        const fetchedPhotos = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Сортируем локально: новые сверху (Rule 2: No Complex Queries)
        fetchedPhotos.sort((a, b) => {
          const timeA = a.timestamp?.toMillis() || 0;
          const timeB = b.timestamp?.toMillis() || 0;
          return timeB - timeA;
        });
        
        setPhotos(fetchedPhotos);
      },
      (error) => {
        console.error("Ошибка загрузки фото:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Функция для сжатия изображения перед отправкой (чтобы не превышать лимиты БД)
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Ограничиваем размер для экономии места, но сохраняем качество для печати 10х15
          const MAX_WIDTH = 1200; 
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Конвертируем в JPEG с качеством 80%
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
    });
  };

  // 3. Загрузка новой фотографии
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const base64Image = await compressImage(file);
      
      const photosRef = collection(db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME);
      await addDoc(photosRef, {
        url: base64Image,
        timestamp: serverTimestamp(),
        userId: user.uid,
      });
      
    } catch (error) {
      console.error("Ошибка при загрузке:", error);
    } finally {
      setIsUploading(false);
      // Сбрасываем input, чтобы можно было загрузить то же фото еще раз если нужно
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Функция скачивания фото
  const handleDownload = (photoUrl, photoId) => {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = `wedding_photo_${photoId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: colors.white, color: '#333' }}>
      
      {/* Шапка */}
      <header className="relative px-6 pt-12 pb-8 text-center" style={{ backgroundColor: colors.ivory }}>
        <div className="max-w-2xl mx-auto">
          <Heart className="w-8 h-8 mx-auto mb-4" style={{ color: colors.dustyRose }} fill={colors.dustyRose} />
          <h1 className="text-4xl md:text-5xl mb-2" style={{ fontFamily: 'Georgia, serif', color: colors.antiqueGold }}>
            Наша Свадьба
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-6 italic">
            Поделитесь лучшими моментами этого дня с нами
          </p>
        </div>
        
        {/* Декоративная линия */}
        <div className="absolute bottom-0 left-0 w-full h-1" style={{ background: `linear-gradient(to right, ${colors.sageGreen}, ${colors.dustyRose}, ${colors.champagne})` }}></div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        
        {/* Кнопка загрузки */}
        <div className="flex flex-col items-center justify-center mb-16">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" // Предлагает открыть камеру на мобильных устройствах
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full text-white text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            style={{ backgroundColor: colors.sageGreen }}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Загружаем магию...</span>
              </>
            ) : (
              <>
                <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span>Сделать или выбрать фото</span>
              </>
            )}
          </button>
          <p className="mt-4 text-sm text-gray-500" style={{ color: colors.softTaupe }}>
            Фотографии сразу появятся в нашей общей галерее
          </p>
        </div>

        {/* Галерея фотографий */}
        <div className="mb-8">
          <h2 className="text-3xl text-center mb-10" style={{ fontFamily: 'Georgia, serif', color: colors.sageGreen }}>
            Галерея Моментов
          </h2>
          
          {photos.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-2xl" style={{ borderColor: colors.champagne }}>
              <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: colors.dustyRose }} />
              <p className="text-xl text-gray-500">Здесь пока нет фотографий.</p>
              <p className="text-gray-400 mt-2">Будьте первыми, кто поделится радостью!</p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
              {photos.map((photo) => (
                <div 
                  key={photo.id} 
                  className="break-inside-avoid bg-white p-3 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 relative group border"
                  style={{ borderColor: colors.ivory }}
                >
                  <img 
                    src={photo.url} 
                    alt="Свадебное фото" 
                    className="w-full h-auto rounded-lg"
                    loading="lazy"
                  />
                  
                  {/* Кнопка скачивания, появляется при наведении на десктопе, всегда доступна на мобильном через полупрозрачную панель */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 sm:opacity-0">
                    <button
                      onClick={() => handleDownload(photo.url, photo.id)}
                      className="bg-white text-gray-800 p-3 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center gap-2"
                      title="Скачать фото"
                    >
                      <Download className="w-5 h-5" style={{ color: colors.antiqueGold }} />
                      <span className="text-sm font-medium pr-1 sm:hidden">Скачать</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Подвал */}
      <footer className="text-center py-10 mt-12 border-t" style={{ backgroundColor: colors.white, borderColor: colors.ivory }}>
        <p style={{ color: colors.softTaupe, fontFamily: 'Georgia, serif' }}>
          С любовью в каждой детали
        </p>
        <p className="text-xs mt-2" style={{ color: colors.softTaupe }}>
          Фотографии сохраняются в оригинальном качестве, пригодном для печати.
        </p>
      </footer>
    </div>
  );
}