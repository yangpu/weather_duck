// 增强的离线缓存服务 - 实现缓存优先和按日期索引的智能缓存策略
import { WeatherData } from '../types/weather'
import { DiaryData } from '../types/diary'

interface CacheConfig {
  maxDateCount: number // 最大缓存日期数量
  weatherTTL: number   // 天气数据TTL (毫秒)
  diaryTTL: number     // 日记数据TTL (毫秒)
}

interface DateCacheItem<T> {
  data: T
  timestamp: number
  lastAccessed: number
}

interface CacheStats {
  weatherDates: number
  diaryDates: number
  totalSize: string
  oldestDate: string | null
  newestDate: string | null
}

export class EnhancedOfflineCacheService {
  private static instance: EnhancedOfflineCacheService
  
  // 按日期索引的缓存存储
  private weatherCache = new Map<string, DateCacheItem<WeatherData>>()
  private diaryCache = new Map<string, DateCacheItem<DiaryData>>()
  
  private config: CacheConfig = {
    maxDateCount: 90,        // 最多缓存90天的数据
    weatherTTL: 24 * 60 * 60 * 1000, // 天气数据24小时TTL
    diaryTTL: 7 * 24 * 60 * 60 * 1000 // 日记数据7天TTL
  }

  private constructor() {
    this.initializeFromStorage()
    this.startCleanupTimer()
  }

  static getInstance(): EnhancedOfflineCacheService {
    if (!this.instance) {
      this.instance = new EnhancedOfflineCacheService()
    }
    return this.instance
  }

  // 从localStorage恢复缓存数据
  private initializeFromStorage(): void {
    try {

      
      // 恢复天气数据
      const weatherData = localStorage.getItem('enhanced_weather_cache')
      if (weatherData) {
        const parsed = JSON.parse(weatherData)
        Object.entries(parsed).forEach(([date, item]: [string, any]) => {
          if (this.isValidCacheItem(item)) {
            this.weatherCache.set(date, item)
          }
        })
      }

      // 恢复日记数据
      const diaryData = localStorage.getItem('enhanced_diary_cache')
      if (diaryData) {
        const parsed = JSON.parse(diaryData)
        Object.entries(parsed).forEach(([date, item]: [string, any]) => {
          if (this.isValidCacheItem(item)) {
            this.diaryCache.set(date, item)
          }
        })
      }


      
      // 清理过期数据
      this.cleanupExpiredData()
      
    } catch (error) {
      console.error('❌ 缓存恢复失败:', error)
      this.weatherCache.clear()
      this.diaryCache.clear()
    }
  }

  // 验证缓存项是否有效
  private isValidCacheItem(item: any): boolean {
    return item && 
           typeof item === 'object' && 
           item.data && 
           typeof item.timestamp === 'number' && 
           typeof item.lastAccessed === 'number'
  }

  // 缓存优先获取天气数据
  async getWeatherDataCacheFirst(startDate: string, endDate: string, onlineLoader?: () => Promise<WeatherData[]>): Promise<WeatherData[]> {

    
    const dates = this.generateDateRange(startDate, endDate)
    const result: WeatherData[] = []
    const missingDates: string[] = []
    
    // 第一步：从缓存获取数据
    dates.forEach(date => {
      const cached = this.getWeatherFromCache(date)
      if (cached) {
        result.push(cached)
      } else {
        missingDates.push(date)
        // 添加占位数据，确保UI立即显示
        result.push(this.generatePlaceholderWeatherData(date))
      }
    })
    
    // 按日期排序
    result.sort((a, b) => a.date.localeCompare(b.date))
    

    
    // 第二步：如果有在线加载器且有缺失数据，后台加载
    if (onlineLoader && missingDates.length > 0 && navigator.onLine) {
      this.loadMissingDataInBackground(missingDates, onlineLoader, result)
    }
    
    return result
  }

  // 缓存优先获取日记数据
  async getDiaryDataCacheFirst(startDate: string, endDate: string, onlineLoader?: () => Promise<DiaryData[]>): Promise<DiaryData[]> {

    
    const dates = this.generateDateRange(startDate, endDate)
    const result: DiaryData[] = []
    const missingDates: string[] = []
    
    // 从缓存获取数据
    dates.forEach(date => {
      const cached = this.getDiaryFromCache(date)
      if (cached) {
        result.push(cached)
      } else {
        missingDates.push(date)
      }
    })
    
    // 按日期排序
    result.sort((a, b) => a.date.localeCompare(b.date))
    

    
    // 如果有在线加载器且有缺失数据，后台加载
    if (onlineLoader && missingDates.length > 0 && navigator.onLine) {
      this.loadMissingDiaryDataInBackground(missingDates, onlineLoader, result)
    }
    
    return result
  }

  // 后台加载缺失的天气数据
  private async loadMissingDataInBackground(_missingDates: string[], onlineLoader: () => Promise<WeatherData[]>, currentResult: WeatherData[]): Promise<void> {
    try {

      
      const onlineData = await onlineLoader()
      const updatedDates: string[] = []
      
      // 缓存新数据
      for (const weather of onlineData) {
        if (weather && weather.date && !weather.isPlaceholder) {
          this.cacheWeatherData(weather.date, weather)
          updatedDates.push(weather.date)
          
          // 更新当前结果中的占位数据
          const index = currentResult.findIndex(w => w.date === weather.date)
          if (index !== -1) {
            currentResult[index] = weather
          }
        }
      }
      
      if (updatedDates.length > 0) {

        
        // 触发数据更新事件
        window.dispatchEvent(new CustomEvent('cache:weather:updated', {
          detail: { 
            updatedDates, 
            weatherData: currentResult.filter(w => updatedDates.includes(w.date))
          }
        }))
      }
      
    } catch (error) {
      console.warn('⚠️ 后台加载天气数据失败:', error)
    }
  }

  // 后台加载缺失的日记数据
  private async loadMissingDiaryDataInBackground(_missingDates: string[], onlineLoader: () => Promise<DiaryData[]>, currentResult: DiaryData[]): Promise<void> {
    try {

      
      const onlineData = await onlineLoader()
      const updatedDates: string[] = []
      
      // 缓存新数据
      for (const diary of onlineData) {
        if (diary && diary.date) {
          this.cacheDiaryData(diary.date, diary)
          updatedDates.push(diary.date)
          currentResult.push(diary)
        }
      }
      
      if (updatedDates.length > 0) {
        // 重新排序
        currentResult.sort((a, b) => a.date.localeCompare(b.date))
        

        
        // 触发数据更新事件
        window.dispatchEvent(new CustomEvent('cache:diary:updated', {
          detail: { 
            updatedDates, 
            diaryData: currentResult.filter(d => updatedDates.includes(d.date))
          }
        }))
      }
      
    } catch (error) {
      console.warn('⚠️ 后台加载日记数据失败:', error)
    }
  }

  // 从缓存获取天气数据
  private getWeatherFromCache(date: string): WeatherData | null {
    const cached = this.weatherCache.get(date)
    if (!cached) return null
    
    // 检查是否过期
    if (this.isExpired(cached, this.config.weatherTTL)) {
      this.weatherCache.delete(date)
      return null
    }
    
    // 更新访问时间
    cached.lastAccessed = Date.now()
    return cached.data
  }

  // 从缓存获取日记数据
  private getDiaryFromCache(date: string): DiaryData | null {
    const cached = this.diaryCache.get(date)
    if (!cached) return null
    
    // 检查是否过期
    if (this.isExpired(cached, this.config.diaryTTL)) {
      this.diaryCache.delete(date)
      return null
    }
    
    // 更新访问时间
    cached.lastAccessed = Date.now()
    return cached.data
  }

  // 缓存天气数据（按日期索引，支持合并）
  cacheWeatherData(date: string, weather: WeatherData): void {
    if (!weather || !date) return
    
    const _now = Date.now()
    const cacheItem: DateCacheItem<WeatherData> = {
      data: weather,
      timestamp: _now,
      lastAccessed: _now
    }
    
    // 如果是重复日期，以最新数据为准
    this.weatherCache.set(date, cacheItem)
    
    // 检查缓存容量并清理
    this.enforceWeatherCacheLimit()
    
    // 持久化到localStorage
    this.persistWeatherCache()
  }

  // 缓存日记数据（按日期索引，支持合并）
  cacheDiaryData(date: string, diary: DiaryData): void {
    if (!diary || !date) return
    
    const _now = Date.now()
    const cacheItem: DateCacheItem<DiaryData> = {
      data: diary,
      timestamp: _now,
      lastAccessed: _now
    }
    
    // 如果是重复日期，以最新数据为准
    this.diaryCache.set(date, cacheItem)
    
    // 检查缓存容量并清理
    this.enforceDiaryCacheLimit()
    
    // 持久化到localStorage
    this.persistDiaryCache()
  }

  // 批量缓存天气数据
  batchCacheWeatherData(weatherList: WeatherData[]): void {
    if (!weatherList || weatherList.length === 0) return
    

    
    const now = Date.now()
    let newCount = 0
    let updateCount = 0
    
    weatherList.forEach(weather => {
      if (weather && weather.date && !weather.isPlaceholder) {
        const existed = this.weatherCache.has(weather.date)
        
        const cacheItem: DateCacheItem<WeatherData> = {
          data: weather,
          timestamp: now,
          lastAccessed: now
        }
        
        this.weatherCache.set(weather.date, cacheItem)
        
        if (existed) {
          updateCount++
        } else {
          newCount++
        }
      }
    })
    

    
    // 检查缓存容量并清理
    this.enforceWeatherCacheLimit()
    
    // 持久化到localStorage
    this.persistWeatherCache()
  }

  // 批量缓存日记数据
  batchCacheDiaryData(diaryList: DiaryData[]): void {
    if (!diaryList || diaryList.length === 0) return
    

    
    const now = Date.now()
    let newCount = 0
    let updateCount = 0
    
    diaryList.forEach(diary => {
      if (diary && diary.date) {
        const existed = this.diaryCache.has(diary.date)
        
        const cacheItem: DateCacheItem<DiaryData> = {
          data: diary,
          timestamp: now,
          lastAccessed: now
        }
        
        this.diaryCache.set(diary.date, cacheItem)
        
        if (existed) {
          updateCount++
        } else {
          newCount++
        }
      }
    })
    

    
    // 检查缓存容量并清理
    this.enforceDiaryCacheLimit()
    
    // 持久化到localStorage
    this.persistDiaryCache()
  }

  // 强制执行天气缓存容量限制
  private enforceWeatherCacheLimit(): void {
    if (this.weatherCache.size <= this.config.maxDateCount) return
    

    
    // 按日期排序，删除最远的日期数据
    const sortedDates = Array.from(this.weatherCache.keys()).sort()
    const toDelete = this.weatherCache.size - this.config.maxDateCount
    
    for (let i = 0; i < toDelete; i++) {
      const dateToDelete = sortedDates[i]
      this.weatherCache.delete(dateToDelete)

    }
    

  }

  // 强制执行日记缓存容量限制
  private enforceDiaryCacheLimit(): void {
    if (this.diaryCache.size <= this.config.maxDateCount) return
    

    
    // 按日期排序，删除最远的日期数据
    const sortedDates = Array.from(this.diaryCache.keys()).sort()
    const toDelete = this.diaryCache.size - this.config.maxDateCount
    
    for (let i = 0; i < toDelete; i++) {
      const dateToDelete = sortedDates[i]
      this.diaryCache.delete(dateToDelete)

    }
    

  }

  // 检查缓存项是否过期
  private isExpired(item: DateCacheItem<any>, ttl: number): boolean {
    return Date.now() - item.timestamp > ttl
  }

  // 生成日期范围
  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10))
    }
    
    return dates
  }

  // 生成占位天气数据
  private generatePlaceholderWeatherData(date: string): WeatherData {
    const today = new Date().toISOString().slice(0, 10)
    const isPast = date < today
    const isToday = date === today
    
    let description = '缓存加载中...'
    if (isPast) {
      description = '历史数据加载中...'
    } else if (isToday) {
      description = '实时数据加载中...'
    } else {
      description = '预报数据加载中...'
    }
    
    return {
      date,
      temperature: { min: 0, max: 0, current: 0 },
      humidity: 0,
      windSpeed: 0,
      windDirection: '加载中',
      precipitation: 0,
      cloudCover: 0,
      description,
      icon: '⏳',
      isPlaceholder: true
    }
  }

  // 持久化天气缓存到localStorage
  private persistWeatherCache(): void {
    try {
      const cacheObject = Object.fromEntries(this.weatherCache.entries())
      localStorage.setItem('enhanced_weather_cache', JSON.stringify(cacheObject))
    } catch (error) {
      console.warn('⚠️ 天气缓存持久化失败:', error)
    }
  }

  // 持久化日记缓存到localStorage
  private persistDiaryCache(): void {
    try {
      const cacheObject = Object.fromEntries(this.diaryCache.entries())
      localStorage.setItem('enhanced_diary_cache', JSON.stringify(cacheObject))
    } catch (error) {
      console.warn('⚠️ 日记缓存持久化失败:', error)
    }
  }

  // 清理过期数据
  private cleanupExpiredData(): void {
    let weatherCleaned = 0
    let diaryCleaned = 0
    
    // 清理过期天气数据
    for (const [date, item] of this.weatherCache.entries()) {
      if (this.isExpired(item, this.config.weatherTTL)) {
        this.weatherCache.delete(date)
        weatherCleaned++
      }
    }
    
    // 清理过期日记数据
    for (const [date, item] of this.diaryCache.entries()) {
      if (this.isExpired(item, this.config.diaryTTL)) {
        this.diaryCache.delete(date)
        diaryCleaned++
      }
    }
    
    if (weatherCleaned > 0 || diaryCleaned > 0) {

      this.persistWeatherCache()
      this.persistDiaryCache()
    }
  }

  // 启动定期清理定时器
  private startCleanupTimer(): void {
    // 每小时清理一次过期数据
    setInterval(() => {
      this.cleanupExpiredData()
    }, 60 * 60 * 1000)
  }

  // 获取缓存统计信息
  getCacheStats(): CacheStats {
    const weatherDates = Array.from(this.weatherCache.keys()).sort()
    const diaryDates = Array.from(this.diaryCache.keys()).sort()
    
    const totalSize = this.calculateCacheSize()
    
    return {
      weatherDates: weatherDates.length,
      diaryDates: diaryDates.length,
      totalSize,
      oldestDate: weatherDates.length > 0 ? weatherDates[0] : null,
      newestDate: weatherDates.length > 0 ? weatherDates[weatherDates.length - 1] : null
    }
  }

  // 计算缓存大小
  private calculateCacheSize(): string {
    try {
      const weatherSize = JSON.stringify(Object.fromEntries(this.weatherCache.entries())).length
      const diarySize = JSON.stringify(Object.fromEntries(this.diaryCache.entries())).length
      const totalBytes = weatherSize + diarySize
      
      if (totalBytes < 1024) return `${totalBytes}B`
      if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)}KB`
      return `${(totalBytes / (1024 * 1024)).toFixed(1)}MB`
    } catch {
      return '未知'
    }
  }

  // 清空所有缓存
  clearAllCache(): void {
    this.weatherCache.clear()
    this.diaryCache.clear()
    localStorage.removeItem('enhanced_weather_cache')
    localStorage.removeItem('enhanced_diary_cache')

  }

  // 更新配置
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig }

    
    // 重新检查缓存限制
    this.enforceWeatherCacheLimit()
    this.enforceDiaryCacheLimit()
  }
}

// 导出单例实例
export const enhancedOfflineCacheService = EnhancedOfflineCacheService.getInstance()