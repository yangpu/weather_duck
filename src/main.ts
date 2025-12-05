import { createApp } from 'vue'
import TDesign from 'tdesign-vue-next'
import 'tdesign-vue-next/es/style/index.css'
import App from './App.vue'
import { enhancedOfflineCacheService } from './services/enhancedOfflineCacheService'
import { optimizedUnifiedCacheService } from './services/optimizedUnifiedCacheService'
import { offlineDataService } from './services/offlineDataService'
import { initPWAInstall } from './utils/pwa'

// 初始化 PWA 安装监听
initPWAInstall()

const app = createApp(App)
app.use(TDesign)

// 全局错误处理
app.config.errorHandler = (err, _instance, info) => {
  console.error('Vue应用错误:', err, info)
}

// 全局警告处理
app.config.warnHandler = (msg, _instance, trace) => {
  console.warn('Vue应用警告:', msg, trace)
}

// 暴露服务到全局，便于调试和组件访问
declare global {
  interface Window {
    __enhancedOfflineCacheService: typeof enhancedOfflineCacheService
    __optimizedUnifiedCacheService: typeof optimizedUnifiedCacheService
    __offlineDataService: typeof offlineDataService
    __unifiedCacheService?: any
    __diaryCache?: any
    __weatherCache?: any
    __weatherList?: any
  }
}

// 在应用启动时初始化服务
async function initializeServices() {
  try {
    // 暴露服务到全局
    window.__enhancedOfflineCacheService = enhancedOfflineCacheService
    window.__optimizedUnifiedCacheService = optimizedUnifiedCacheService
    window.__offlineDataService = offlineDataService
    window.__unifiedCacheService = optimizedUnifiedCacheService


  } catch (error) {
    console.error('❌ 服务初始化失败:', error)
  }
}

// 初始化服务
initializeServices()

app.mount('#app')