// Enhanced Service Worker for Weather Duck PWA
const CACHE_VERSION = '1.2.4';
const CACHE_NAME = `weather-duck-v${CACHE_VERSION}`;
const DATA_CACHE_NAME = `weather-duck-data-v${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `weather-duck-runtime-v${CACHE_VERSION}`;

// 检测是否为开发环境
const isDevelopment = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// 需要预缓存的核心资源（shell）
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/icons/icon.svg',
  '/weather_duck.jpg'
];

// 生产环境额外缓存的资源会在运行时动态添加

// 需要缓存的API端点模式
const API_CACHE_PATTERNS = [
  /\/api\/weather/,
  /\/api\/diary/,
  /supabase\.co/
];

// Service Worker 安装
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker version:', CACHE_VERSION);
  console.log('[SW] Environment:', isDevelopment ? 'Development' : 'Production');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        
        // 逐个添加资源，避免某个资源失败导致整体失败
        const cachePromises = STATIC_CACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(url, response);
              console.log('[SW] Cached:', url);
            } else {
              console.warn('[SW] Failed to cache (not ok):', url, response.status);
            }
          } catch (error) {
            console.warn('[SW] Failed to cache:', url, error.message);
          }
        });

        await Promise.allSettled(cachePromises);
        console.log('[SW] Installation complete, cached', STATIC_CACHE_URLS.length, 'resources');
        
        // 强制激活新的Service Worker
        return self.skipWaiting();
      } catch (error) {
        console.error('[SW] Installation failed:', error);
        // 即使缓存失败也要跳过等待，确保SW能正常工作
        return self.skipWaiting();
      }
    })()
  );
});

// Service Worker 激活
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker version:', CACHE_VERSION);
  
  event.waitUntil(
    (async () => {
      // 删除旧版本的缓存
      const cacheNames = await caches.keys();
      const deletePromises = cacheNames.map((cacheName) => {
        if (cacheName !== CACHE_NAME && 
            cacheName !== DATA_CACHE_NAME && 
            cacheName !== RUNTIME_CACHE_NAME) {
          console.log('[SW] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        }
      });
      
      await Promise.all(deletePromises);
      console.log('[SW] Activation complete');
      
      // 立即控制所有客户端
      return self.clients.claim();
    })()
  );
});

// 网络请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非HTTP请求
  if (!request.url.startsWith('http')) {
    return;
  }

  // 跳过开发环境的热更新请求（但不跳过普通的开发请求）
  if (isDevelopment && (
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@fs/') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('/__vite') ||
    url.searchParams.has('t') ||
    url.searchParams.has('import') ||
    request.url.includes('hot-update')
  )) {
    return;
  }

  // 跳过chrome-extension和其他非同源请求
  if (!url.origin.includes(self.location.origin) && !API_CACHE_PATTERNS.some(p => p.test(request.url))) {
    return;
  }

  // API请求：网络优先，失败时使用缓存
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE_NAME);
        try {
          const response = await fetch(request);
          // 只缓存成功的GET请求
          if (request.method === 'GET' && response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          console.log('[SW] Network failed, trying cache:', url.pathname);
          // 网络失败时返回缓存
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          throw error;
        }
      })()
    );
    return;
  }

  // 导航请求（HTML页面）：网络优先，失败时返回index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          console.log('[SW] Navigation request:', url.pathname);
          const response = await fetch(request, { cache: 'no-cache' });
          // 缓存成功的导航响应
          if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            // 同时缓存到多个路径
            await cache.put('/index.html', response.clone());
            await cache.put('/', response.clone());
            console.log('[SW] Navigation successful, cached to /index.html and /');
          }
          return response;
        } catch (error) {
          console.log('[SW] 🔌 Navigation failed (offline), returning cached app:', error.message);
          
          // 尝试多个缓存源
          const cacheKeys = ['/index.html', '/', '/index.html?', request.url];
          
          // 先在主缓存中查找
          const mainCache = await caches.open(CACHE_NAME);
          for (const key of cacheKeys) {
            const cached = await mainCache.match(key, { ignoreSearch: true });
            if (cached) {
              console.log('[SW] ✅ Found in CACHE_NAME:', key);
              return cached;
            }
          }
          
          // 在运行时缓存中查找
          const runtimeCache = await caches.open(RUNTIME_CACHE_NAME);
          for (const key of cacheKeys) {
            const cached = await runtimeCache.match(key, { ignoreSearch: true });
            if (cached) {
              console.log('[SW] ✅ Found in RUNTIME_CACHE_NAME:', key);
              return cached;
            }
          }
          
          // 检查所有缓存
          const allCaches = await caches.keys();
          console.log('[SW] 🔍 Searching in all caches:', allCaches);
          for (const cacheName of allCaches) {
            const cache = await caches.open(cacheName);
            for (const key of cacheKeys) {
              const cached = await cache.match(key, { ignoreSearch: true });
              if (cached) {
                console.log('[SW] ✅ Found in cache:', cacheName, 'key:', key);
                return cached;
              }
            }
          }
          
          // 如果没有任何缓存，返回基础错误响应
          console.error('[SW] ❌ No cached content available in any cache');
          console.error('[SW] ❌ Available caches:', allCaches);
          throw error;
        }
      })()
    );
    return;
  }

  // 静态资源：缓存优先，失败时使用网络
  event.respondWith(
    (async () => {
      // 先检查缓存
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // 后台更新缓存（stale-while-revalidate策略）
        if (!isDevelopment) {
          fetch(request).then(response => {
            if (response && response.ok) {
              caches.open(RUNTIME_CACHE_NAME).then(cache => {
                cache.put(request, response);
              });
            }
          }).catch(() => {});
        }
        return cachedResponse;
      }

      // 缓存未命中，发起网络请求
      try {
        const response = await fetch(request);
        
        // 检查响应是否有效
        if (response && response.ok) {
          // 克隆响应用于缓存
          const responseToCache = response.clone();
          
          // 缓存JS、CSS等静态资源
          if (request.destination === 'script' || 
              request.destination === 'style' ||
              request.destination === 'image' ||
              url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
            const cache = await caches.open(RUNTIME_CACHE_NAME);
            cache.put(request, responseToCache);
          }
          
          return response;
        }
        
        return response;
      } catch (error) {
        console.warn('[SW] Fetch failed:', url.pathname, error);
        // 返回404响应
        return new Response('', { status: 404 });
      }
    })()
  );
});



// 后台同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // 执行后台同步任务
      Promise.resolve()
    );
  }
});

// 推送通知
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();

    event.waitUntil(
      self.registration.showNotification(data.title || '天气鸭', {
        body: data.body || '您有新的天气提醒',
        icon: '/icons/icon.svg',
        badge: '/icons/icon.svg',
        tag: 'weather-notification',
        requireInteraction: false,
        actions: [
          {
            action: 'view',
            title: '查看详情'
          },
          {
            action: 'close',
            title: '关闭'
          }
        ]
      })
    );
  }
});

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});