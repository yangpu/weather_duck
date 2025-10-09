// Enhanced Service Worker for Weather Duck PWA
const CACHE_NAME = 'weather-duck-v1.2';
const DATA_CACHE_NAME = 'weather-duck-data-v1.2';

// 检测是否为开发环境
const isDevelopment = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// 需要缓存的静态资源
const STATIC_CACHE_URLS = isDevelopment ? [
  // 开发环境只缓存基本资源
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/icons/icon.svg',
  '/weather_duck.jpg',
  '/ios-location-debug.html'
] : [
  // 生产环境缓存完整资源
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/icons/icon.svg',
  '/weather_duck.jpg',
  '/src/main.ts',
  '/ios-location-debug.html'
];

// 需要缓存的API端点模式
const API_CACHE_PATTERNS = [
  /\/api\/weather/,
  /\/api\/diary/,
  /supabase\.co/
];

// Service Worker 安装
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        // 逐个添加资源，避免某个资源失败导致整体失败
        const cachePromises = STATIC_CACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (error) {
            // 静默处理错误，不阻止安装过程
          }
        });

        await Promise.allSettled(cachePromises);
      })
      .then(() => {
        // 强制激活新的Service Worker
        return self.skipWaiting();
      })
      .catch(() => {
        // 即使缓存失败也要跳过等待，确保SW能正常工作
        return self.skipWaiting();
      })
  );
});

// Service Worker 激活
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本的缓存
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 立即控制所有客户端
      return self.clients.claim();
    })
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

  // 跳过开发环境的热更新请求
  if (isDevelopment && (
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@fs/') ||
    url.pathname.includes('/node_modules/') ||
    url.searchParams.has('t') ||
    request.url.includes('hot-update')
  )) {
    return;
  }

  // API请求缓存策略
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then(cache => {
        return fetch(request)
          .then(response => {
            // 只缓存成功的GET请求
            if (request.method === 'GET' && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // 网络失败时返回缓存
            return cache.match(request);
          });
      })
    );
    return;
  }

  // 静态资源缓存策略
  event.respondWith(
    caches.match(request)
      .then(response => {
        // 缓存命中，返回缓存
        if (response) {
          return response;
        }

        // 缓存未命中，发起网络请求
        return fetch(request)
          .then(response => {
            // 检查响应是否有效
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 克隆响应用于缓存
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // 网络失败时的降级处理
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
            return new Response('', { status: 404 });
          });
      })
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