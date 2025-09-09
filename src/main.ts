import { createApp } from 'vue'
import TDesign from 'tdesign-vue-next'
import 'tdesign-vue-next/es/style/index.css'
import App from './App.vue'
// import { checkNetworkStatus, requestNotificationPermission } from './utils/pwa.js'

const app = createApp(App)

// 忽略已知的 TDesign 内部 size 额外属性告警（TSelectPanel/TSelectInput）
app.config.warnHandler = (msg, _instance, trace) => {
  const text = typeof msg === 'string' ? msg : String(msg)
  const stack = typeof trace === 'string' ? trace : ''
  const isExtraneousSize =
    text.includes('Extraneous non-props attributes') &&
    text.includes('(size)') &&
    (stack.includes('TSelectPanel') || stack.includes('TSelectInput') || stack.includes('TSelect'))

  if (isExtraneousSize) {
    return
  }
  console.warn(text + (stack ? `\n${stack}` : ''))
}

app.use(TDesign)

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // 清理旧版本
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
      }
      
      const cacheNames = await caches.keys();
      for (let cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 注册新Service Worker
      const registration = await navigator.serviceWorker.register('/sw-clean.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              window.location.reload();
            }
          });
        }
      });
      
    } catch (error) {
      // 静默处理错误
    }
  });
}

// 初始化PWA功能
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

app.mount('#app')

// 标记应用已挂载完成
if ((window as any).markLoaded) {
  (window as any).markLoaded('app');
}
