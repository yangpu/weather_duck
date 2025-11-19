// 缓存验证和预加载工具
import { offlineDataService } from '../services/offlineDataService'
import { cacheService } from '../services/cacheService'

export class CacheValidator {
  // 验证缓存数据完整性
  static async validateCache(startDate: string, endDate: string): Promise<{
    weatherCacheValid: boolean
    diaryCacheValid: boolean
    details: string[]
  }> {
    const details: string[] = []
    
    // 检查离线数据服务缓存
    const cacheStatus = offlineDataService.hasCachedData(startDate, endDate)
    details.push(`离线服务缓存状态: 天气=${cacheStatus.hasWeather}, 日记=${cacheStatus.hasDiary}`)
    
    // 检查具体的缓存数据
    const weatherData = offlineDataService.getOfflineWeatherData(startDate, endDate)
    const validWeatherCount = weatherData.filter(w => !w.isPlaceholder).length
    details.push(`天气数据: 总计${weatherData.length}条, 有效${validWeatherCount}条`)
    
    const diaryData = offlineDataService.getOfflineDiaryData(startDate, endDate)
    details.push(`日记数据: 总计${diaryData.length}条`)
    
    // 检查持久化缓存
    const dates = this.generateDateRange(startDate, endDate)
    let persistentWeatherCount = 0
    let persistentDiaryCount = 0
    
    dates.forEach(date => {
      const weatherKey = cacheService.generateKey('weather_by_date', { date })
      const diaryKey = cacheService.generateKey('diary_by_date', { date })
      
      if (cacheService.get(weatherKey)) persistentWeatherCount++
      if (cacheService.get(diaryKey)) persistentDiaryCount++
    })
    
    details.push(`持久化缓存: 天气${persistentWeatherCount}条, 日记${persistentDiaryCount}条`)
    
    // 检查Service Worker缓存
    if ('caches' in window) {
      try {
        const cache = await caches.open('weather-duck-data-v1')
        const keys = await cache.keys()
        const apiRequests = keys.filter(req => 
          req.url.includes('api.open-meteo.com') || 
          req.url.includes('supabase.co')
        )
        details.push(`Service Worker缓存: ${apiRequests.length}个API请求`)
      } catch (error) {
        details.push(`Service Worker缓存检查失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    return {
      weatherCacheValid: validWeatherCount > 0,
      diaryCacheValid: diaryData.length > 0,
      details
    }
  }
  
  // 强制预加载和缓存数据
  static async preloadAndCache(
    startDate: string, 
    endDate: string, 
    latitude: number, 
    longitude: number
  ): Promise<boolean> {
    try {

      
      // 这里需要调用实际的数据加载服务
      // 由于我们在工具类中，需要通过全局服务来加载
      if (window.__unifiedCacheService) {
        await window.__unifiedCacheService.initializeData(
          startDate, endDate, latitude, longitude, true
        )
        

        return true
      } else {
        console.warn('⚠️ 统一缓存服务不可用')
        return false
      }
    } catch (error) {
      console.error('❌ 预加载失败:', error)
      return false
    }
  }
  
  // 清理过期缓存
  static clearExpiredCache(): void {

    
    // 清理离线数据服务缓存
    offlineDataService.clearExpiredCache()
    
    // 清理持久化缓存中的过期数据
    // 这里可以添加更详细的清理逻辑
    

  }
  
  // 生成日期范围
  private static generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10))
    }
    
    return dates
  }
  
  // 获取缓存统计信息
  static getCacheStats(): {
    offlineService: { weatherCount: number; diaryCount: number }
    persistent: { totalKeys: number }
    serviceWorker: Promise<{ cacheCount: number; totalSize: string }>
  } {
    const offlineStats = offlineDataService.getCacheStats()
    
    // 统计持久化缓存
    const persistentStats = {
      totalKeys: Object.keys(localStorage).filter(key => key.startsWith('cache_')).length
    }
    
    // 统计Service Worker缓存
    const serviceWorkerStats = (async () => {
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys()
          let totalSize = 0
          let cacheCount = 0
          
          for (const name of cacheNames) {
            const cache = await caches.open(name)
            const keys = await cache.keys()
            cacheCount += keys.length
          }
          
          // 估算大小
          if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate()
            totalSize = estimate.usage || 0
          }
          
          return {
            cacheCount,
            totalSize: `${Math.round(totalSize / 1024 / 1024 * 100) / 100}MB`
          }
        } catch (error) {
          return { cacheCount: 0, totalSize: '0MB' }
        }
      }
      return { cacheCount: 0, totalSize: '0MB' }
    })()
    
    return {
      offlineService: offlineStats,
      persistent: persistentStats,
      serviceWorker: serviceWorkerStats
    }
  }
}

// 导出单例
export const cacheValidator = CacheValidator