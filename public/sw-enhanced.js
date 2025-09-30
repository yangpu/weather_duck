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
  '/weather_duck.jpg'
] : [
  // 生产环境缓存完整资源
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/apple-touch-icon.svg',
  '/weather_duck.jpg',
  '/src/main.ts'
];

// 需要缓存的API端点模式
const API_CACHE_PATTERNS = [
  /\/api\/weather/,
  /\/api\/diary/,
  /supabase\.co/
];

// Service Worker 安装
self.addEventListener('install', (event) => {
  // console.log('Service Worker 安装中...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // console.log('缓存静态资源');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        // 强制激活新的Service Worker
        return self.skipWaiting();
      })
  );
});

// Service Worker 激活
self.addEventListener('activate', (event) => {
  // console.log('Service Worker 激活中...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本的缓存
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            //console.log('删除旧缓存:', cacheName);
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

  // 开发环境下跳过 Vite 相关请求
  if (isDevelopment) {
    if (url.pathname.includes('/@vite/') ||
      url.pathname.includes('/src/') ||
      url.pathname.includes('?t=') ||
      url.pathname.includes('/node_modules/') ||
      url.pathname.includes('/__vite_ping') ||
      url.searchParams.has('t')) {
      return; // 不拦截，让浏览器直接处理
    }
  }

  // 跳过 Supabase 存储的图片请求，让它们直接通过网络获取
  if (url.pathname.includes('/storage/v1/object/public/')) {
    return; // 不拦截，让浏览器直接处理
  }

  // 处理API请求（数据缓存）
  if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // 处理静态资源请求
  if (request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
  }
});

// 判断是否为API请求
function isApiRequest(url) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url.href));
}

// 处理API请求 - 缓存优先策略（离线优先）
async function handleApiRequest(request) {
  const cache = await caches.open(DATA_CACHE_NAME);
  const url = new URL(request.url);

  // console.log('🔍 处理API请求:', url.pathname);

  // 首先检查缓存（缓存优先策略）
  const cachedResponse = await cache.match(request);

  // 检查网络状态
  const isOnline = navigator.onLine !== false;

  if (cachedResponse && !isOnline) {
    // 离线状态且有缓存，直接返回缓存
    //console.log('📱 离线模式，返回缓存数据:', request.url);
    return cachedResponse;
  }

  if (cachedResponse) {
    // 有缓存的情况下，先返回缓存，然后在后台更新
    //console.log('📦 返回缓存数据（后台更新）:', request.url);

    // 后台更新缓存
    fetch(request).then(networkResponse => {
      if (networkResponse && networkResponse.ok) {
        //console.log('🔄 后台更新缓存:', request.url);
        cache.put(request, networkResponse.clone());
      }
    }).catch(error => {
      console.error('🔄 后台更新失败:', error.message);
    });

    return cachedResponse;
  }

  // 没有缓存，尝试网络请求
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // 成功时更新缓存
      //console.log('✅ 网络请求成功，更新缓存:', request.url);

      // 确保响应可以被缓存
      try {
        await cache.put(request, networkResponse.clone());
        //console.log('✅ 缓存更新成功:', request.url);
      } catch (cacheError) {
        console.warn('⚠️ 缓存更新失败:', request.url, cacheError);
      }

      return networkResponse;
    } else {
      // 只对非图片资源记录错误日志
      if (!request.url.includes('/storage/v1/object/public/')) {
        console.warn('❌ 网络请求失败，状态码:', networkResponse.status);
      }
    }
  } catch (error) {
    // 只对非图片资源记录异常日志
    if (!request.url.includes('/storage/v1/object/public/')) {
      console.warn('❌ 网络请求异常:', request.url, error.message);
    }
  }

  // 只对非图片资源记录缓存查找日志
  if (!request.url.includes('/storage/v1/object/public/')) {
    //console.log('没有Service Worker缓存，尝试从其他缓存源获取:', request.url);
  }

  // 尝试从localStorage获取缓存数据
  try {
    if (url.pathname.includes('weather_diaries') || url.pathname.includes('diaries')) {
      // 尝试从localStorage获取日记数据
      const diaryData = [];
      const urlParams = new URLSearchParams(url.search);
      const startDate = urlParams.get('date.gte') || urlParams.get('date') || '2025-09-01';
      const endDate = urlParams.get('date.lte') || startDate;

      // 生成日期范围
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        const localKey = `diary_${dateStr}`;
        const localData = localStorage.getItem(localKey);
        if (localData) {
          try {
            const diary = JSON.parse(localData);
            diaryData.push(diary);
            //console.log('从localStorage恢复日记数据:', dateStr);
          } catch (e) {
            console.warn('解析localStorage日记数据失败:', dateStr, e);
          }
        }
      }

      if (diaryData.length > 0) {
        //console.log('返回localStorage中的日记数据:', diaryData.length, '条');
        return new Response(JSON.stringify(diaryData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else if (url.pathname.includes('weather') || url.hostname.includes('open-meteo')) {
      // 尝试从localStorage获取天气数据
      const urlParams = new URLSearchParams(url.search);
      const startDate = urlParams.get('start_date') || '2025-09-01';
      const endDate = urlParams.get('end_date') || startDate;

      const weatherData = {
        daily: {
          time: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          precipitation_sum: [],
          windspeed_10m_max: [],
          winddirection_10m_dominant: [],
          cloudcover_mean: [],
          weathercode: []
        }
      };

      // 生成日期范围
      const start = new Date(startDate);
      const end = new Date(endDate);
      let hasData = false;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        const localKey = `weather_${dateStr}`;
        const localData = localStorage.getItem(localKey);
        if (localData) {
          try {
            const weather = JSON.parse(localData);
            if (weather && !weather.isPlaceholder) {
              weatherData.daily.time.push(dateStr);
              weatherData.daily.temperature_2m_max.push(weather.temperature?.max || 0);
              weatherData.daily.temperature_2m_min.push(weather.temperature?.min || 0);
              weatherData.daily.precipitation_sum.push(weather.precipitation || 0);
              weatherData.daily.windspeed_10m_max.push(weather.windSpeed || 0);
              weatherData.daily.winddirection_10m_dominant.push(weather.windDirection || 0);
              weatherData.daily.cloudcover_mean.push(weather.cloudCover || 0);
              weatherData.daily.weathercode.push(weather.weathercode || 0);
              hasData = true;
              //console.log('从localStorage恢复天气数据:', dateStr);
            }
          } catch (e) {
            console.warn('解析localStorage天气数据失败:', dateStr, e);
          }
        }
      }

      if (hasData) {
        //console.log('返回localStorage中的天气数据:', weatherData.daily.time.length, '条');
        return new Response(JSON.stringify(weatherData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  } catch (error) {
    console.warn('从localStorage获取缓存数据失败:', error);
  }

  // 最后的兜底响应 - 只对非图片资源记录日志
  if (!request.url.includes('/storage/v1/object/public/')) {
    //console.log('没有任何缓存数据，返回离线响应:', request.url);
  }

  let offlineResponse;
  let responseHeaders = { 'Content-Type': 'application/json' };

  if (url.pathname.includes('/storage/v1/object/public/')) {
    // 对于图片资源，返回404状态，不记录日志
    return new Response(null, { status: 404 });
  } else if (url.pathname.includes('weather_diaries') || url.pathname.includes('diaries')) {
    // 日记API返回空数组格式，符合Supabase响应格式
    offlineResponse = [];
  } else if (url.pathname.includes('weather') || url.hostname.includes('open-meteo')) {
    // 天气API返回null或空对象
    offlineResponse = {
      daily: {
        time: [],
        temperature_2m_max: [],
        temperature_2m_min: [],
        precipitation_sum: [],
        windspeed_10m_max: [],
        winddirection_10m_dominant: [],
        cloudcover_mean: [],
        weathercode: []
      },
      offline: true,
      message: '离线模式：暂无缓存数据'
    };
  } else {
    // 其他API返回通用格式
    offlineResponse = {
      error: '当前离线，请检查网络连接',
      offline: true,
      timestamp: new Date().toISOString()
    };
  }

  return new Response(
    JSON.stringify(offlineResponse),
    {
      status: 200,
      headers: responseHeaders
    }
  );
}

// 处理静态资源请求 - 缓存优先策略
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const url = new URL(request.url);

  if (cachedResponse) {
    // 有缓存，直接返回
    return cachedResponse;
  }

  try {
    // 没有缓存，尝试网络请求
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // 只缓存支持的URL scheme，且不是开发环境的动态资源
      if ((url.protocol === 'http:' || url.protocol === 'https:') &&
        (!isDevelopment || !url.searchParams.has('t'))) {
        cache.put(request, networkResponse.clone());
      }
    }

    return networkResponse;
  } catch (error) {
    // 开发环境下，对于 Vite 相关资源的失败不记录警告
    if (!isDevelopment ||
      (!url.pathname.includes('/@vite/') &&
        !url.pathname.includes('/src/') &&
        !url.searchParams.has('t'))) {
      console.warn('静态资源请求失败:', request.url);
    }

    // 对于HTML请求，返回离线页面
    if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>天气小鸭 - 离线模式</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              text-align: center; 
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              margin: 0;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .offline-icon { font-size: 64px; margin-bottom: 20px; }
            h1 { margin-bottom: 10px; }
            p { opacity: 0.8; }
            .retry-btn {
              background: rgba(255,255,255,0.2);
              border: 1px solid rgba(255,255,255,0.3);
              color: white;
              padding: 12px 24px;
              border-radius: 6px;
              margin-top: 20px;
              cursor: pointer;
            }
            .dev-notice {
              background: rgba(255,255,255,0.1);
              padding: 15px;
              border-radius: 8px;
              margin-top: 20px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="offline-icon">🦆</div>
          <h1>天气小鸭</h1>
          <p>当前处于离线模式</p>
          ${isDevelopment ? '<div class="dev-notice">开发环境：请确保开发服务器正在运行</div>' : '<p>请检查网络连接后重试</p>'}
          <button class="retry-btn" onclick="window.location.reload()">重新加载</button>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    return new Response('资源不可用', { status: 404 });
  }
}

// 后台同步（如果支持）
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
      //console.log('执行后台同步');
      event.waitUntil(syncData());
    }
  });
}

// 同步数据函数
async function syncData() {
  try {
    // 这里可以实现数据同步逻辑
    //console.log('后台数据同步完成');
  } catch (error) {
    console.error('后台同步失败:', error);
  }
}

// 消息处理
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_DATA') {
    // 缓存特定数据
    const { key, data } = event.data;
    caches.open(DATA_CACHE_NAME).then(cache => {
      cache.put(key, new Response(JSON.stringify(data)));
    });
  }
});