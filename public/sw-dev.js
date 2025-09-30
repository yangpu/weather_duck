// 开发环境专用的 Service Worker
const CACHE_NAME = 'weather-duck-dev-v1.0';
const DATA_CACHE_NAME = 'weather-duck-data-dev-v1.0';

// 开发环境只缓存最基本的资源
const STATIC_CACHE_URLS = [
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/icons/icon.svg',
  '/weather_duck.jpg'
];

// API缓存模式
const API_CACHE_PATTERNS = [
  /\/api\/weather/,
  /\/api\/diary/,
  /supabase\.co/
];

// Service Worker 安装
self.addEventListener('install', (event) => {
  console.log('开发环境 Service Worker 安装中...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('缓存基本静态资源');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(error => {
        console.warn('缓存资源时出错:', error);
        // 即使缓存失败也继续安装
        return self.skipWaiting();
      })
  );
});

// Service Worker 激活
self.addEventListener('activate', (event) => {
  console.log('开发环境 Service Worker 激活中...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 网络请求拦截 - 开发环境更保守的策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 开发环境下，只处理非常有限的请求
  // 跳过所有 Vite 相关的请求
  if (
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/src/') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('/__vite') ||
    url.pathname.includes('?t=') ||
    url.pathname.includes('?import') ||
    url.pathname.includes('?direct') ||
    url.pathname.includes('?worker') ||
    url.pathname.includes('?raw') ||
    url.pathname.includes('?url') ||
    url.pathname.includes('?v=') ||
    url.searchParams.has('t') ||
    url.searchParams.has('import') ||
    url.searchParams.has('v') ||
    url.port === '3000' || // 跳过错误端口的请求
    url.hostname !== location.hostname || // 跳过不同域名的请求
    url.port !== location.port // 跳过不同端口的请求
  ) {
    console.log('跳过 Vite/开发相关请求:', url.pathname);
    return; // 不拦截，让浏览器直接处理
  }

  // 跳过 Supabase 存储请求
  if (url.pathname.includes('/storage/v1/object/public/')) {
    return;
  }

  // 只处理 API 请求和基本静态资源
  if (isApiRequest(url)) {
    console.log('处理 API 请求:', url.pathname);
    event.respondWith(handleApiRequest(request));
  } else if (isBasicStaticResource(url)) {
    console.log('处理静态资源:', url.pathname);
    event.respondWith(handleStaticRequest(request));
  }
  // 其他所有请求都不拦截
});

// 判断是否为API请求
function isApiRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url.href));
}

// 判断是否为基本静态资源
function isBasicStaticResource(url) {
  const basicResources = [
    '/manifest.json',
    '/favicon.svg',
    '/apple-touch-icon.svg',
    '/icons/icon.svg',
    '/weather_duck.jpg'
  ];
  return basicResources.includes(url.pathname);
}

// 处理API请求
async function handleApiRequest(request) {
  const cache = await caches.open(DATA_CACHE_NAME);

  try {
    // 先尝试网络请求
    const networkResponse = await fetch(request);
    if (networkResponse.ok && request.method === 'GET') {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // 网络失败时尝试缓存
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('返回缓存的 API 数据:', request.url);
      return cachedResponse;
    }

    // 返回离线响应
    return new Response(JSON.stringify({
      error: '离线模式，暂无缓存数据',
      offline: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 处理静态资源请求
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  // 先检查缓存
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('返回缓存的静态资源:', request.url);
    return cachedResponse;
  }

  try {
    // 尝试网络请求
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('静态资源网络请求失败:', request.url);

    // 为 icon.svg 提供后备
    if (request.url.includes('/icons/icon.svg')) {
      return new Response(`
        <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="256" cy="256" r="256" fill="#4A90E2"/>
          <ellipse cx="256" cy="300" rx="80" ry="60" fill="#FFD700"/>
          <circle cx="256" cy="200" r="50" fill="#FFD700"/>
          <ellipse cx="280" cy="210" rx="20" ry="8" fill="#FF8C00"/>
          <circle cx="245" cy="190" r="6" fill="#000"/>
          <circle cx="247" cy="188" r="2" fill="#FFF"/>
        </svg>
      `, {
        headers: { 'Content-Type': 'image/svg+xml' }
      });
    }

    return new Response('资源不可用', { status: 404 });
  }
}

// 消息处理
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('开发环境 Service Worker 已加载');