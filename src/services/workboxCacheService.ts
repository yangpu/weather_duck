/**
 * Workbox 缓存管理服务
 * 提供应用层面的缓存控制和离线数据管理
 */

// 缓存名称常量
export const CACHE_NAMES = {
  SUPABASE_REST: 'supabase-rest-cache',
  SUPABASE_STORAGE: 'supabase-storage-cache',
  WEATHER_API: 'weather-api-cache',
  WEATHER_EXTERNAL: 'weather-external-cache',
  GEOCODING: 'geocoding-cache',
  IMAGES: 'images-cache',
  VIDEOS: 'videos-cache',
  FONTS: 'fonts-cache',
  CDN: 'cdn-cache'
} as const

// 缓存统计信息
interface CacheStats {
  name: string
  count: number
  size: number
}

// 离线数据状态
interface OfflineStatus {
  isOnline: boolean
  lastOnlineTime: number
  cachedWeatherDates: string[]
  cachedDiaryDates: string[]
  cachedImagesCount: number
  cachedVideosCount: number
}

class WorkboxCacheService {
  private offlineStatus: OfflineStatus = {
    isOnline: navigator.onLine,
    lastOnlineTime: Date.now(),
    cachedWeatherDates: [],
    cachedDiaryDates: [],
    cachedImagesCount: 0,
    cachedVideosCount: 0
  }

  constructor() {
    this.init()
  }

  private async init(): Promise<void> {
    // 监听网络状态
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())

    // 等待 Service Worker 就绪
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.ready
        // 初始化缓存统计
        await this.updateCacheStats()
      } catch {
        // Service Worker 未就绪
      }
    }
  }

  private handleOnline(): void {
    this.offlineStatus.isOnline = true
    this.offlineStatus.lastOnlineTime = Date.now()
    // 触发后台同步
    this.triggerBackgroundSync()
  }

  private handleOffline(): void {
    this.offlineStatus.isOnline = false
  }

  /**
   * 触发后台同步
   */
  private async triggerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready
        await (registration as any).sync.register('supabase-sync-queue')
      } catch {
        // 后台同步触发失败
      }
    }
  }

  /**
   * 预缓存指定 URL 列表
   */
  async precacheUrls(urls: string[]): Promise<void> {
    if (!('caches' in window)) return

    const cache = await caches.open('precache-v1')
    const uniqueUrls = [...new Set(urls)]
    
    const results = await Promise.allSettled(
      uniqueUrls.map(async (url) => {
        try {
          const response = await fetch(url, { mode: 'cors' })
          if (response.ok) {
            await cache.put(url, response)
            return { url, success: true }
          }
          return { url, success: false, error: 'Response not ok' }
        } catch (error) {
          return { url, success: false, error }
        }
      })
    )

    // 统计成功数量（用于内部监控）
    results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
  }

  /**
   * 预缓存日记图片 - 仅用于批量缓存（如打开日记详情时）
   */
  async precacheDiaryImages(imageUrls: string[]): Promise<void> {
    if (!imageUrls.length) return

    const cache = await caches.open(CACHE_NAMES.SUPABASE_STORAGE)
    
    const results = await Promise.allSettled(
      imageUrls.map(async (url) => {
        // 检查是否已缓存
        const cached = await cache.match(url)
        if (cached) return { url, cached: true }

        try {
          const response = await fetch(url, { mode: 'cors' })
          if (response.ok) {
            await cache.put(url, response.clone())
            return { url, success: true }
          }
          return { url, success: false }
        } catch (error) {
          return { url, success: false, error }
        }
      })
    )

    const cached = results.filter(r => r.status === 'fulfilled' && (r.value as any).cached).length
    const newlyCached = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length
    
    this.offlineStatus.cachedImagesCount += newlyCached
    
    // 仅在有新缓存时记录（用于调试，生产环境可移除）
    if (newlyCached > 0) {
      // console.log(`[WorkboxCache] 图片缓存: ${cached} 已存在, ${newlyCached} 新缓存`)
    }
    void cached // 避免 unused variable 警告
  }

  /**
   * 缓存单张图片 - 用于懒加载时缓存
   */
  async cacheSingleImage(imageUrl: string): Promise<boolean> {
    if (!imageUrl || !('caches' in window)) return false

    try {
      const cache = await caches.open(CACHE_NAMES.SUPABASE_STORAGE)
      
      // 检查是否已缓存
      const cached = await cache.match(imageUrl)
      if (cached) return true

      // 下载并缓存
      const response = await fetch(imageUrl, { mode: 'cors' })
      if (response.ok) {
        await cache.put(imageUrl, response.clone())
        this.offlineStatus.cachedImagesCount++
        return true
      }
      return false
    } catch {
      // 缓存图片失败，静默处理
      return false
    }
  }

  /**
   * 从缓存获取图片，如果没有则下载并缓存
   */
  async getImageWithCache(imageUrl: string): Promise<string | null> {
    if (!imageUrl) return null

    try {
      const cache = await caches.open(CACHE_NAMES.SUPABASE_STORAGE)
      
      // 先检查缓存
      const cached = await cache.match(imageUrl)
      if (cached) {
        // 返回缓存的 blob URL
        const blob = await cached.blob()
        return URL.createObjectURL(blob)
      }

      // 没有缓存，下载并缓存
      const response = await fetch(imageUrl, { mode: 'cors' })
      if (response.ok) {
        // 克隆响应用于缓存
        await cache.put(imageUrl, response.clone())
        this.offlineStatus.cachedImagesCount++
        
        // 返回原始 URL（浏览器会自动使用缓存）
        return imageUrl
      }
      return null
    } catch {
      // 获取图片失败，静默处理
      return null
    }
  }

  /**
   * 预缓存日记视频 - 已禁用，视频不缓存
   */
  async precacheDiaryVideos(_videoUrls: string[]): Promise<void> {
    // 视频不再缓存，每次在线加载
    // 这样可以节省存储空间
  }

  /**
   * 从缓存获取响应
   */
  async getCachedResponse(url: string, cacheName?: string): Promise<Response | null> {
    if (!('caches' in window)) return null

    try {
      if (cacheName) {
        const cache = await caches.open(cacheName)
        return await cache.match(url) || null
      }

      // 搜索所有缓存
      return await caches.match(url) || null
    } catch {
      // 获取缓存失败，静默处理
      return null
    }
  }

  /**
   * 手动添加到缓存
   */
  async addToCache(url: string, response: Response, cacheName: string): Promise<void> {
    if (!('caches' in window)) return

    try {
      const cache = await caches.open(cacheName)
      await cache.put(url, response.clone())
    } catch {
      // 添加缓存失败，静默处理
    }
  }

  /**
   * 从缓存删除
   */
  async removeFromCache(url: string, cacheName?: string): Promise<boolean> {
    if (!('caches' in window)) return false

    try {
      if (cacheName) {
        const cache = await caches.open(cacheName)
        return await cache.delete(url)
      }

      // 从所有缓存中删除
      const cacheNames = await caches.keys()
      const results = await Promise.all(
        cacheNames.map(async (name) => {
          const cache = await caches.open(name)
          return await cache.delete(url)
        })
      )
      return results.some(r => r)
    } catch {
      // 删除缓存失败，静默处理
      return false
    }
  }

  /**
   * 清理指定缓存
   */
  async clearCache(cacheName: string): Promise<void> {
    if (!('caches' in window)) return

    try {
      await caches.delete(cacheName)
    } catch {
      // 清理缓存失败，静默处理
    }
  }

  /**
   * 清理所有运行时缓存
   */
  async clearAllRuntimeCaches(): Promise<void> {
    if (!('caches' in window)) return

    const cacheNames = Object.values(CACHE_NAMES)
    await Promise.all(cacheNames.map(name => this.clearCache(name)))
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<CacheStats[]> {
    if (!('caches' in window)) return []

    const stats: CacheStats[] = []
    const cacheNames = await caches.keys()

    for (const name of cacheNames) {
      try {
        const cache = await caches.open(name)
        const keys = await cache.keys()
        
        let totalSize = 0
        for (const request of keys.slice(0, 50)) { // 限制检查数量
          try {
            const response = await cache.match(request)
            if (response) {
              const blob = await response.clone().blob()
              totalSize += blob.size
            }
          } catch {
            // 忽略单个文件的错误
          }
        }

        stats.push({
          name,
          count: keys.length,
          size: totalSize
        })
      } catch {
        // 获取缓存统计失败，静默处理
      }
    }

    return stats
  }

  /**
   * 更新缓存统计
   */
  private async updateCacheStats(): Promise<void> {
    const stats = await this.getCacheStats()
    
    // 更新图片和视频计数
    const imagesCache = stats.find(s => s.name === CACHE_NAMES.IMAGES || s.name === CACHE_NAMES.SUPABASE_STORAGE)
    const videosCache = stats.find(s => s.name === CACHE_NAMES.VIDEOS)
    
    this.offlineStatus.cachedImagesCount = imagesCache?.count || 0
    this.offlineStatus.cachedVideosCount = videosCache?.count || 0
  }

  /**
   * 获取离线状态
   */
  getOfflineStatus(): OfflineStatus {
    return { ...this.offlineStatus }
  }

  /**
   * 检查 URL 是否已缓存
   */
  async isCached(url: string): Promise<boolean> {
    if (!('caches' in window)) return false
    const response = await caches.match(url)
    return !!response
  }

  /**
   * 批量检查 URL 是否已缓存
   */
  async checkCachedUrls(urls: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>()
    
    await Promise.all(
      urls.map(async (url) => {
        const isCached = await this.isCached(url)
        result.set(url, isCached)
      })
    )
    
    return result
  }

  /**
   * 获取缓存大小（估算）
   */
  async getEstimatedCacheSize(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate()
        return {
          usage: estimate.usage || 0,
          quota: estimate.quota || 0
        }
      } catch {
        // 获取存储估算失败，静默处理
      }
    }
    return { usage: 0, quota: 0 }
  }

  /**
   * 请求持久化存储
   */
  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const isPersisted = await navigator.storage.persist()
        return isPersisted
      } catch {
        // 请求持久化存储失败，静默处理
      }
    }
    return false
  }

  /**
   * 检查是否已启用持久化存储
   */
  async isPersisted(): Promise<boolean> {
    if ('storage' in navigator && 'persisted' in navigator.storage) {
      return await navigator.storage.persisted()
    }
    return false
  }

  /**
   * 强制更新 Service Worker
   */
  async forceUpdateServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.update()
      }
    }
  }

  /**
   * 跳过等待并激活新 Service Worker
   */
  async skipWaitingAndReload(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        
        // 监听控制器变化并刷新
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload()
        })
      }
    }
  }
}

// 导出单例
export const workboxCacheService = new WorkboxCacheService()
export default workboxCacheService
