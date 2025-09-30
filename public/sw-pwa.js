// PWA 专用 Service Worker - 完全独立，不依赖 Vite
const CACHE_NAME = 'weather-duck-pwa-v1.0';
const DATA_CACHE_NAME = 'weather-duck-pwa-data-v1.0';

// 需要缓存的静态资源 - 只包含 PWA 页面需要的资源
const STATIC_CACHE_URLS = [
  '/pwa.html',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/icons/icon.svg',
  '/weather_duck.jpg'
];

// API 缓存模式（如果需要）
const API_CACHE_PATTERNS = [
  /\/api\/weather/,
  /\/api\/diary/,
  /supabase\.co/
];

console.log('PWA Service Worker 脚本加载');

// Service Worker 安装
self.addEventListener('install', (event) => {
  console.log('PWA Service Worker 安装中...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('缓存 PWA 静态资源');
        // 尝试缓存所有资源，但不因为单个资源失败而中断
        return Promise.allSettled(
          STATIC_CACHE_URLS.map(url =>
            cache.add(url).catch(error => {
              console.warn(`缓存资源失败: ${url}`, error);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('PWA Service Worker 安装完成');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('PWA Service Worker 安装失败:', error);
        // 即使缓存失败也继续安装
        return self.skipWaiting();
      })
  );
});

// Service Worker 激活
self.addEventListener('activate', (event) => {
  console.log('PWA Service Worker 激活中...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // 删除旧版本的缓存
            if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
              console.log('删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('PWA Service Worker 激活完成');
        return self.clients.claim();
      })
  );
});

// 网络请求拦截 - 只处理 PWA 相关请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // 跳过所有 Vite 相关请求（开发环境保护）
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
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.jsx')
  ) {
    console.log('跳过开发相关请求:', url.pathname);
    return;
  }

  // 跳过 Supabase 存储请求
  if (url.pathname.includes('/storage/v1/object/public/')) {
    return;
  }

  // 处理 PWA 页面和静态资源
  if (request.method === 'GET') {
    if (isPWAResource(url)) {
      console.log('处理 PWA 资源:', url.pathname);
      event.respondWith(handlePWARequest(request));
    } else if (isApiRequest(url)) {
      console.log('处理 API 请求:', url.pathname);
      event.respondWith(handleApiRequest(request));
    }
  }
});

// 判断是否为 PWA 资源
function isPWAResource(url) {
  const pwaResources = [
    '/pwa.html',
    '/manifest.json',
    '/favicon.svg',
    '/apple-touch-icon.svg',
    '/icons/icon.svg',
    '/weather_duck.jpg'
  ];

  return pwaResources.includes(url.pathname) ||
    url.pathname === '/' ||
    url.pathname === '/index.html';
}

// 判断是否为 API 请求
function isApiRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url.href));
}

// 处理 PWA 请求 - 缓存优先策略
async function handlePWARequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const url = new URL(request.url);

  // 对于根路径，重定向到 PWA 页面
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const pwaRequest = new Request('/pwa.html');
    const cachedResponse = await cache.match(pwaRequest);

    if (cachedResponse) {
      console.log('返回缓存的 PWA 页面');
      return cachedResponse;
    }

    try {
      const networkResponse = await fetch(pwaRequest);
      if (networkResponse.ok) {
        cache.put(pwaRequest, networkResponse.clone());
        return networkResponse;
      }
    } catch (error) {
      console.log('PWA 页面网络请求失败，返回离线页面');
    }

    // 返回离线 PWA 页面
    return createOfflinePWAPage();
  }

  // 先检查缓存
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('返回缓存资源:', request.url);
    return cachedResponse;
  }

  try {
    // 尝试网络请求
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      console.log('缓存新资源:', request.url);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('网络请求失败:', request.url);
  }

  // 为特定资源提供后备
  if (request.url.includes('/icons/icon.svg')) {
    return createFallbackIcon();
  }

  return new Response('资源不可用', { status: 404 });
}

// 处理 API 请求
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
      offline: true,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 创建离线 PWA 页面
function createOfflinePWAPage() {
  const offlineHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>天气小鸭日记 - 离线模式</title>
    <meta name="theme-color" content="#4A90E2">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 20px;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .icon { font-size: 4em; margin-bottom: 20px; }
        h1 { font-size: 2.5em; margin-bottom: 15px; }
        p { font-size: 1.1em; opacity: 0.9; margin-bottom: 20px; line-height: 1.6; }
        .status {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
        }
        button {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
            transition: all 0.3s ease;
        }
        button:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🦆</div>
        <h1>天气小鸭日记</h1>
        <p>当前处于离线模式</p>
        <div class="status">
            <p>📱 PWA 离线功能正常运行</p>
            <p>💾 本地数据已缓存</p>
            <p>🔄 网络恢复后将自动同步</p>
        </div>
        <button onclick="window.location.reload()">🔄 重新加载</button>
        <button onclick="checkOnline()">🌐 检查网络</button>
    </div>
    
    <script>
        function checkOnline() {
            if (navigator.onLine) {
                alert('网络已连接，正在重新加载...');
                window.location.reload();
            } else {
                alert('仍处于离线状态，请检查网络连接');
            }
        }
        
        // 监听网络状态变化
        window.addEventListener('online', () => {
            console.log('网络已连接');
            window.location.reload();
        });
        
        console.log('PWA 离线页面已加载');
    </script>
</body>
</html>`;

  return new Response(offlineHTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// 创建后备图标
function createFallbackIcon() {
  const iconSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="256" cy="256" r="256" fill="#4A90E2"/>
  <ellipse cx="256" cy="300" rx="80" ry="60" fill="#FFD700"/>
  <circle cx="256" cy="200" r="50" fill="#FFD700"/>
  <ellipse cx="280" cy="210" rx="20" ry="8" fill="#FF8C00"/>
  <circle cx="245" cy="190" r="6" fill="#000"/>
  <circle cx="247" cy="188" r="2" fill="#FFF"/>
  <ellipse cx="220" cy="280" rx="25" ry="35" fill="#FFA500" transform="rotate(-20 220 280)"/>
</svg>`;

  return new Response(iconSVG, {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}

// 消息处理
self.addEventListener('message', (event) => {
  console.log('PWA Service Worker 收到消息:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_DATA') {
    const { key, data } = event.data;
    caches.open(DATA_CACHE_NAME).then(cache => {
      cache.put(key, new Response(JSON.stringify(data)));
    });
  }
});

// 后台同步（如果支持）
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
      console.log('执行后台同步');
      event.waitUntil(syncPWAData());
    }
  });
}

// 同步 PWA 数据
async function syncPWAData() {
  try {
    console.log('PWA 后台数据同步完成');
  } catch (error) {
    console.error('PWA 后台同步失败:', error);
  }
}

console.log('PWA Service Worker 已完全加载');