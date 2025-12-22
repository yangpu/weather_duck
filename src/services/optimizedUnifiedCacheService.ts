// 优化的统一缓存服务 - 实现缓存优先策略和智能数据加载
import { weatherService } from './weatherService'
import { diaryService } from './diaryService'
import { enhancedOfflineCacheService } from './enhancedOfflineCacheService'
import { requestDeduplicator } from './requestDeduplicator'
import { dateRangeManager } from './dateRangeManager'
import type { WeatherData } from '../types/weather'
import type { DiaryData } from '../types/diary'
import type { InitializeDataResult } from '../types/services'

interface OptimizedCacheStats {
  isInitialized: boolean
  currentDateRange: string | null
  cacheStats: any
  networkStatus: 'online' | 'offline'
  lastUpdateTime: number
}

class OptimizedUnifiedCacheService {
  private isInitialized: boolean = false
  private currentDateRange: string | null = null
  private lastUpdateTime: number = 0
  private requestPromises: Map<string, Promise<InitializeDataResult>> = new Map()

  constructor() {
    this.setupEventListeners()
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    // 监听网络状态变化
    window.addEventListener('online', () => {
      this.handleNetworkOnline()
    })

    window.addEventListener('offline', () => {
      // 网络已断开，使用离线缓存
    })

    // 监听缓存更新事件
    window.addEventListener('cache:weather:updated', (event: any) => {
      this.notifyDataUpdated('weather', event.detail)
    })

    window.addEventListener('cache:diary:updated', (event: any) => {
      this.notifyDataUpdated('diary', event.detail)
    })
  }

  // 优化的数据初始化 - 缓存优先策略
  async initializeDataOptimized(
    startDate: string, 
    endDate: string, 
    latitude: number, 
    longitude: number, 
    forceRefresh: boolean = false
  ): Promise<InitializeDataResult> {
    const cacheKey = `optimized_init_${startDate}_${endDate}_${latitude}_${longitude}`

    // 更新全局日期范围
    dateRangeManager.setDateRange(startDate, endDate)

    // 使用请求去重机制
    return await requestDeduplicator.executeRequest(
      cacheKey,
      () => this._performOptimizedInitialization(startDate, endDate, latitude, longitude, forceRefresh),
      { 
        forceRefresh,
        timeout: 30000,
        maxRetries: 2
      }
    )
  }

  // 执行优化的初始化流程
  private async _performOptimizedInitialization(
    startDate: string, 
    endDate: string, 
    latitude: number, 
    longitude: number, 
    forceRefresh: boolean
  ): Promise<InitializeDataResult> {
    try {
      const isOnline = navigator.onLine

      // 第一步：缓存优先获取数据（立即返回，确保性能）
      const weatherDataPromise = enhancedOfflineCacheService.getWeatherDataCacheFirst(
        startDate, 
        endDate,
        // 在线加载器 - 只有在线且不强制刷新时才提供
        isOnline && !forceRefresh ? undefined : () => this.loadWeatherDataOnline(latitude, longitude, startDate, endDate, forceRefresh)
      )

      const diaryDataPromise = enhancedOfflineCacheService.getDiaryDataCacheFirst(
        startDate,
        endDate,
        // 在线加载器 - 只有在线且不强制刷新时才提供
        isOnline && !forceRefresh ? undefined : () => this.loadDiaryDataOnline(startDate, endDate)
      )

      // 并行获取缓存数据
      const [weatherData, diariesData] = await Promise.all([
        weatherDataPromise,
        diaryDataPromise
      ])

      // 离线模式特殊处理：如果离线且有数据（包括占位数据），立即返回
      if (!isOnline) {
        return this.finalizeInitialization(weatherData, diariesData, `${startDate}_${endDate}`)
      }

      // 第二步：如果强制刷新或在线且缓存不足，立即加载在线数据
      if (forceRefresh || (isOnline && this.shouldLoadOnlineData(weatherData, diariesData))) {
        try {
          const [onlineWeatherData, onlineDiariesData] = await Promise.all([
            this.loadWeatherDataOnline(latitude, longitude, startDate, endDate, true),
            this.loadDiaryDataOnline(startDate, endDate)
          ])

          // 批量缓存新数据
          enhancedOfflineCacheService.batchCacheWeatherData(onlineWeatherData)
          enhancedOfflineCacheService.batchCacheDiaryData(onlineDiariesData)

          // 合并数据（在线数据优先）
          const mergedWeatherData = this.mergeWeatherData(weatherData, onlineWeatherData)
          const mergedDiariesData = this.mergeDiaryData(diariesData, onlineDiariesData)

          // 预缓存日记中的图片和视频到 Workbox
          this.precacheDiaryMedia(mergedDiariesData)

          return this.finalizeInitialization(mergedWeatherData, mergedDiariesData, `${startDate}_${endDate}`)
        } catch (onlineError) {
          console.warn('⚠️ 在线数据加载失败，使用缓存数据:', onlineError)
          return this.finalizeInitialization(weatherData, diariesData, `${startDate}_${endDate}`)
        }
      }

      // 第三步：如果在线且不强制刷新，启动后台更新
      if (isOnline && !forceRefresh) {
        this.updateDataInBackground(startDate, endDate, latitude, longitude)
      }

      return this.finalizeInitialization(weatherData, diariesData, `${startDate}_${endDate}`)

    } catch (error) {
      console.error('❌ 优化初始化失败:', error)
      
      // 最后的兜底：尝试从增强缓存获取任何可用数据
      try {
        const fallbackWeatherData = await enhancedOfflineCacheService.getWeatherDataCacheFirst(startDate, endDate)
        const fallbackDiariesData = await enhancedOfflineCacheService.getDiaryDataCacheFirst(startDate, endDate)
        
        return this.finalizeInitialization(fallbackWeatherData, fallbackDiariesData, `${startDate}_${endDate}`)
      } catch (fallbackError) {
        console.error('❌ 兜底缓存也失败:', fallbackError)
        throw error
      }
    }
  }

  // 预缓存日记中的媒体文件到 Workbox - 已禁用自动预缓存
  // 图片只在需要时懒加载，视频不缓存
  private async precacheDiaryMedia(_diaries: DiaryData[]): Promise<void> {
    // 不再自动预缓存所有图片和视频
    // 图片将在卡片可见时懒加载第一张
    // 所有图片在打开日记详情时加载
    // 视频不缓存，每次在线加载
  }

  // 加载在线天气数据
  private async loadWeatherDataOnline(
    latitude: number, 
    longitude: number, 
    startDate: string, 
    endDate: string, 
    forceRefresh: boolean = false
  ): Promise<WeatherData[]> {
    const weatherKey = `online_weather_${latitude}_${longitude}_${startDate}_${endDate}`
    
    return await requestDeduplicator.executeRequest(
      weatherKey,
      async () => {

        
        // 使用优化的天气API
        const weatherData = await weatherService.getWeatherForDateRange(
          latitude,
          longitude,
          startDate,
          endDate,
          forceRefresh
        )

        // 补充当前天气信息
        const today = new Date().toISOString().slice(0, 10)
        const todayWeather = weatherData.find(w => w.date === today)

        if (todayWeather) {
          try {
            const currentWeather = await weatherService.getCurrentWeather(latitude, longitude, forceRefresh)
            if (currentWeather?.temperature?.current !== undefined) {
              Object.assign(todayWeather, {
                temperature: {
                  ...todayWeather.temperature,
                  current: Math.round(currentWeather.temperature.current)
                },
                windSpeed: currentWeather.windSpeed ?? todayWeather.windSpeed,
                windDirection: currentWeather.windDirection ?? todayWeather.windDirection,
                description: currentWeather.description ?? todayWeather.description,
                icon: currentWeather.icon ?? todayWeather.icon
              })
            }
          } catch (error) {
            console.warn('获取当前天气补充信息失败:', error)
          }
        }

        return weatherData
      },
      { forceRefresh, timeout: 25000, maxRetries: 2 }
    )
  }

  // 加载在线日记数据
  private async loadDiaryDataOnline(startDate: string, endDate: string): Promise<DiaryData[]> {
    const diaryKey = `online_diary_${startDate}_${endDate}`
    
    return await requestDeduplicator.executeRequest(
      diaryKey,
      async () => {

        return await diaryService.getDiariesByDateRange(startDate, endDate)
      },
      { forceRefresh: false, timeout: 15000, maxRetries: 2 }
    )
  }

  // 判断是否需要加载在线数据
  private shouldLoadOnlineData(weatherData: WeatherData[], _diariesData: DiaryData[]): boolean {
    // 如果天气数据大部分是占位数据，需要加载在线数据
    const placeholderCount = weatherData.filter(w => w.isPlaceholder).length
    const placeholderRatio = placeholderCount / weatherData.length
    
    // 如果超过30%是占位数据，则需要在线加载
    return placeholderRatio > 0.3
  }

  // 合并天气数据（在线数据优先）
  private mergeWeatherData(cachedData: WeatherData[], onlineData: WeatherData[]): WeatherData[] {
    const merged = new Map<string, WeatherData>()
    
    // 先添加缓存数据
    cachedData.forEach(weather => {
      merged.set(weather.date, weather)
    })
    
    // 在线数据覆盖缓存数据
    onlineData.forEach(weather => {
      if (!weather.isPlaceholder) {
        merged.set(weather.date, weather)
      }
    })
    
    return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  // 合并日记数据（在线数据优先）
  private mergeDiaryData(cachedData: DiaryData[], onlineData: DiaryData[]): DiaryData[] {
    const merged = new Map<string, DiaryData>()
    
    // 先添加缓存数据
    cachedData.forEach(diary => {
      merged.set(diary.date, diary)
    })
    
    // 在线数据覆盖缓存数据
    onlineData.forEach(diary => {
      merged.set(diary.date, diary)
    })
    
    return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  // 完成初始化
  private finalizeInitialization(
    weatherData: WeatherData[], 
    diariesData: DiaryData[], 
    dateRange: string
  ): InitializeDataResult {
    // 更新状态
    this.currentDateRange = dateRange
    this.isInitialized = true
    this.lastUpdateTime = Date.now()

    // 暴露到全局供组件使用
    this.exposeToGlobal(weatherData, diariesData)

    // 通知组件数据就绪
    this.notifyDataReady(weatherData, diariesData)



    return { weatherData, diariesData }
  }

  // 后台更新数据
  private async updateDataInBackground(
    startDate: string, 
    endDate: string, 
    latitude: number, 
    longitude: number
  ): Promise<void> {
    const backgroundKey = `background_update_${startDate}_${endDate}_${latitude}_${longitude}`
    
    try {
      await requestDeduplicator.executeRequest(
        backgroundKey,
        async () => {
          // 后台加载最新数据
          const [newWeatherData, newDiariesData] = await Promise.all([
            this.loadWeatherDataOnline(latitude, longitude, startDate, endDate, true),
            this.loadDiaryDataOnline(startDate, endDate)
          ])
          
          // 批量缓存新数据
          enhancedOfflineCacheService.batchCacheWeatherData(newWeatherData)
          enhancedOfflineCacheService.batchCacheDiaryData(newDiariesData)
          
          // 预缓存日记中的图片和视频到 Workbox
          this.precacheDiaryMedia(newDiariesData)
          
          // 发送后台更新完成事件
          window.dispatchEvent(new CustomEvent('unified:background:updated', {
            detail: { 
              weatherData: newWeatherData, 
              diariesData: newDiariesData,
              silent: true
            }
          }))
          
          return { weatherData: newWeatherData, diariesData: newDiariesData }
        },
        { forceRefresh: false, timeout: 30000, maxRetries: 1 }
      )
    } catch (error) {
      console.warn('⚠️ 后台更新失败:', error)
    }
  }

  // 处理网络重新连接
  private async handleNetworkOnline(): Promise<void> {
    if (!this.isInitialized || !this.currentDateRange) return
    
    // 解析当前日期范围
    const match = this.currentDateRange.match(/optimized_init_(.+)_(.+)_(.+)_(.+)/)
    if (!match) return
    
    const [, startDate, endDate, latitude, longitude] = match
    
    // 网络恢复后，启动后台同步
    setTimeout(() => {
      this.updateDataInBackground(startDate, endDate, parseFloat(latitude), parseFloat(longitude))
    }, 1000) // 延迟1秒，确保网络稳定
  }

  // 暴露到全局供组件使用
  private exposeToGlobal(weatherData: WeatherData[], diariesData: DiaryData[]): void {
    // 获取现有的缓存，如果不存在则创建新的
    const existingWeatherCache = window.__weatherCache || new Map<string, WeatherData>()
    const existingDiaryCache = window.__diaryCache || new Map<string, DiaryData>()
    
    // 增量更新天气缓存，保留现有数据
    weatherData.forEach(weather => existingWeatherCache.set(weather.date, weather))
    
    // 增量更新日记缓存，保留现有数据
    diariesData.forEach(diary => existingDiaryCache.set(diary.date, diary))
    
    // 更新全局引用
    window.__unifiedCacheService = this
    window.__weatherCache = existingWeatherCache
    window.__diaryCache = existingDiaryCache
    window.__weatherList = weatherData
    
    // console.log(`🌐 更新全局缓存 - 天气数据: ${existingWeatherCache.size} 条, 日记数据: ${existingDiaryCache.size} 条`)
  }

  // 通知组件数据就绪
  private notifyDataReady(weatherData: WeatherData[], diariesData: DiaryData[]): void {
    window.dispatchEvent(new CustomEvent('weather:data:ready', {
      detail: { weatherData }
    }))

    window.dispatchEvent(new CustomEvent('diaries:data:ready', {
      detail: { diariesData }
    }))

    window.dispatchEvent(new CustomEvent('unified:data:ready', {
      detail: { weatherData, diariesData }
    }))
  }

  // 通知数据更新
  private notifyDataUpdated(type: 'weather' | 'diary', detail: any): void {
    window.dispatchEvent(new CustomEvent(`unified:${type}:updated`, { detail }))
  }

  // 立即获取缓存数据（不触发网络请求）
  async getCachedDataImmediate(startDate: string, endDate: string): Promise<{ weatherData: WeatherData[], diariesData: any[] } | null> {
    try {

      
      // 直接从增强缓存服务获取数据，不触发网络请求
      const [weatherData, diariesData] = await Promise.all([
        enhancedOfflineCacheService.getWeatherDataCacheFirst(startDate, endDate),
        enhancedOfflineCacheService.getDiaryDataCacheFirst(startDate, endDate)
      ])
      
      // 过滤掉占位数据，只返回真实缓存数据
      const realWeatherData = weatherData.filter(w => !w.isPlaceholder)
      

      
      // 如果有真实的缓存数据，返回结果
      if (realWeatherData.length > 0 || diariesData.length > 0) {
        return {
          weatherData: realWeatherData,
          diariesData
        }
      }
      
      return null
    } catch (error) {
      console.warn('⚠️ 获取缓存数据失败:', error)
      return null
    }
  }

  // 获取天气数据
  getWeatherData(date?: string): WeatherData | WeatherData[] | null {
    if (date) {
      // 从增强缓存服务获取单个日期的天气数据
      const weatherData = enhancedOfflineCacheService.getWeatherDataCacheFirst(date, date)
      return weatherData.then(data => Array.isArray(data) && data.length > 0 ? data[0] : null).catch(() => null) as any
    }
    // 返回所有天气数据（从全局缓存获取）
    return window.__weatherList || []
  }

  // 获取日记数据
  getDiaryData(date?: string): DiaryData | DiaryData[] | null {
    if (date) {
      // 从全局缓存获取单个日期的日记数据
      const diaryCache = window.__diaryCache
      if (diaryCache && diaryCache.has(date)) {
        return diaryCache.get(date) || null
      }
      return null
    }
    // 返回所有日记数据（从全局缓存获取）
    const diaryCache = window.__diaryCache
    return diaryCache ? Array.from(diaryCache.values()) : []
  }

  // 设置日记数据
  setDiaryData(date: string, diary: DiaryData | null): void {
    // 确保全局日记缓存存在
    if (!window.__diaryCache) {
      window.__diaryCache = new Map<string, DiaryData>()
    }
    
    const diaryCache = window.__diaryCache
    if (diary) {
      diaryCache.set(date, diary)
      // console.log(`📝 设置日记数据 [${date}]: ${diary.content ? '有内容' : '空内容'}`)
    } else {
      diaryCache.delete(date)
      // console.log(`📝 删除日记数据 [${date}]`)
    }
    
    // console.log(`📝 当前全局日记缓存总数: ${diaryCache.size}`)
  }

  // 刷新特定日期的日记数据
  async refreshDiaryData(date: string): Promise<DiaryData | null> {
    try {
      const diary = await diaryService.getDiaryByDate(date, true) // 强制刷新

      // 更新全局缓存
      this.setDiaryData(date, diary)

      // 通知组件更新
      window.dispatchEvent(new CustomEvent('diary:updated', {
        detail: { date, diary }
      }))

      return diary
    } catch (error) {
      console.error(`刷新日记数据失败 (${date}):`, error)
      throw error
    }
  }

  // 获取缓存统计信息
  getCacheStats(): OptimizedCacheStats {
    return {
      isInitialized: this.isInitialized,
      currentDateRange: this.currentDateRange,
      cacheStats: enhancedOfflineCacheService.getCacheStats(),
      networkStatus: navigator.onLine ? 'online' : 'offline',
      lastUpdateTime: this.lastUpdateTime
    }
  }

  // 清理缓存
  clearCache(): void {
    enhancedOfflineCacheService.clearAllCache()
    this.requestPromises.clear()
    this.isInitialized = false
    this.currentDateRange = null
    this.lastUpdateTime = 0
    
    requestDeduplicator.clearAll()
    
    delete window.__unifiedCacheService
    delete window.__weatherCache
    delete window.__diaryCache
    delete window.__weatherList
    

  }

  // 手动刷新数据
  async refreshData(
    startDate: string, 
    endDate: string, 
    latitude: number, 
    longitude: number
  ): Promise<InitializeDataResult> {

    return await this.initializeDataOptimized(startDate, endDate, latitude, longitude, true)
  }
}

// 创建并导出单例实例
export const optimizedUnifiedCacheService = new OptimizedUnifiedCacheService()
export default optimizedUnifiedCacheService