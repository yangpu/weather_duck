// 统一缓存服务 - 优化天气和日记数据请求
import { weatherService } from './weatherService'
import { diaryService } from './diaryService'
import { offlineDataService } from './offlineDataService'
import { requestDeduplicator } from './requestDeduplicator'
import { dateRangeManager } from './dateRangeManager'
import type { WeatherData } from '../types/weather'
import type { DiaryData } from '../types/diary'
import type { UnifiedCacheStats, InitializeDataResult } from '../types/services'

interface WeatherDataReadyEvent extends CustomEvent {
  detail: { weatherData: WeatherData[] }
}

interface DiariesDataReadyEvent extends CustomEvent {
  detail: { diariesData: DiaryData[] }
}

interface UnifiedDataReadyEvent extends CustomEvent {
  detail: { weatherData: WeatherData[]; diariesData: DiaryData[] }
}

interface DiaryUpdatedEvent extends CustomEvent {
  detail: { date: string; diary: DiaryData | null }
}

declare global {
  interface Window {
    __unifiedCacheService?: any
    __diaryCache?: any
    __weatherCache?: any
    __weatherList?: any
  }

  interface WindowEventMap {
    'weather:data:ready': WeatherDataReadyEvent
    'diaries:data:ready': DiariesDataReadyEvent
    'unified:data:ready': UnifiedDataReadyEvent
    'diary:updated': DiaryUpdatedEvent
  }
}

class UnifiedCacheService {
  private isInitialized: boolean
  private currentDateRange: string | null
  private weatherCache: Map<string, WeatherData>
  private diaryCache: Map<string, DiaryData>
  private requestPromises: Map<string, Promise<InitializeDataResult>> // 防止重复请求

  constructor() {
    this.isInitialized = false
    this.currentDateRange = null
    this.weatherCache = new Map()
    this.diaryCache = new Map()
    this.requestPromises = new Map()
  }

  // 统一初始化天气和日记数据
  async initializeData(startDate: string, endDate: string, latitude: number, longitude: number, forceRefresh: boolean = false): Promise<InitializeDataResult> {
    const cacheKey = `unified_init_${startDate}_${endDate}_${latitude}_${longitude}`



    // 更新全局日期范围
    dateRangeManager.setDateRange(startDate, endDate);

    // 使用请求去重机制
    return await requestDeduplicator.executeRequest(
      cacheKey,
      () => this._performInitialization(startDate, endDate, latitude, longitude, cacheKey, forceRefresh),
      { 
        forceRefresh,
        timeout: 30000, // 30秒超时
        maxRetries: 2   // 最多重试2次
      }
    );
  }

  private async _performInitialization(startDate: string, endDate: string, latitude: number, longitude: number, cacheKey: string, forceRefresh: boolean = false): Promise<InitializeDataResult> {
    try {
      // 检查网络状态
      const isOnline = navigator.onLine


      let weatherData: WeatherData[] = []
      let diariesData: DiaryData[] = []

      // 首先尝试获取缓存数据（缓存优先策略）
      const cachedWeatherData = offlineDataService.getOfflineWeatherData(startDate, endDate)
      const cachedDiariesData = offlineDataService.getOfflineDiaryData(startDate, endDate)
      
      const hasCachedWeather = cachedWeatherData.some(w => !w.isPlaceholder)
      const hasCachedDiary = cachedDiariesData.length > 0
      


      if (!isOnline) {
        // 离线模式：只使用缓存数据

        weatherData = cachedWeatherData
        diariesData = cachedDiariesData
      } else if ((hasCachedWeather || hasCachedDiary) && !forceRefresh) {
        // 有缓存且不强制刷新：先返回缓存，后台更新

        weatherData = cachedWeatherData
        diariesData = cachedDiariesData
        
        // 后台更新数据（不等待结果）
        this.updateDataInBackground(startDate, endDate, latitude, longitude)
      } else if (isOnline) {
        // 在线模式：正常请求数据
        try {
          // 优化1: 合并天气请求 - 使用单一的增强天气API替代多次forecast请求
          const weatherPromise = this._getOptimizedWeatherData(latitude, longitude, startDate, endDate, forceRefresh)

          // 优化2: 统一日记请求 - 一次性获取日期范围内的所有日记
          const diariesPromise = this._getOptimizedDiariesData(startDate, endDate)

          // 并行执行请求
          const [onlineWeatherData, onlineDiariesData] = await Promise.all([
            weatherPromise,
            diariesPromise
          ])

          weatherData = onlineWeatherData
          diariesData = onlineDiariesData

          // 缓存到离线服务

          await offlineDataService.cacheWeatherData(weatherData)
          await offlineDataService.cacheDiaryData(diariesData)

        } catch (error) {
          console.warn('⚠️ 在线数据获取失败，使用离线缓存:', error)
          // 在线请求失败，使用缓存数据
          weatherData = cachedWeatherData
          diariesData = cachedDiariesData
        }
      }

      // 更新缓存
      this._updateWeatherCache(weatherData)
      this._updateDiariesCache(diariesData)

      // 更新状态
      this.currentDateRange = cacheKey
      this.isInitialized = true

      // 暴露到全局供组件使用
      this._exposeToGlobal()

      // 通知组件数据就绪
      this._notifyDataReady(weatherData, diariesData)

      return { weatherData, diariesData }

    } catch (error) {
      console.error('❌ 统一缓存服务：初始化失败', error)
      
      // 最后的兜底：尝试离线数据
      try {

        const fallbackWeatherData = offlineDataService.getOfflineWeatherData(startDate, endDate)
        const fallbackDiariesData = offlineDataService.getOfflineDiaryData(startDate, endDate)
        
        this._updateWeatherCache(fallbackWeatherData)
        this._updateDiariesCache(fallbackDiariesData)
        
        return { weatherData: fallbackWeatherData, diariesData: fallbackDiariesData }
      } catch (fallbackError) {
        console.error('离线数据兜底也失败:', fallbackError)
        throw error
      }
    }
  }

  // 优化的天气数据获取 - 合并多个forecast请求
  private async _getOptimizedWeatherData(latitude: number, longitude: number, startDate: string, endDate: string, forceRefresh: boolean = false): Promise<WeatherData[]> {
    const weatherKey = `weather_${latitude}_${longitude}_${startDate}_${endDate}`;
    
    return await requestDeduplicator.executeRequest(
      weatherKey,
      async () => {
        try {

          
          // 使用增强版天气API，一次性获取历史+当前+预测数据
          const weatherData = await weatherService.getWeatherForDateRange(
            latitude,
            longitude,
            startDate,
            endDate,
            forceRefresh
          )



          // 如果需要当前天气补充信息，只在今天的数据需要时才请求
          const today = new Date().toISOString().slice(0, 10)
          const todayWeather = weatherData.find(w => w.date === today)

          if (todayWeather) {
            try {
              const currentWeatherKey = `current_weather_${latitude}_${longitude}`;
              const currentWeather = await requestDeduplicator.executeRequest(
                currentWeatherKey,
                () => weatherService.getCurrentWeather(latitude, longitude, forceRefresh),
                { forceRefresh, timeout: 10000 }
              );
              
              if (currentWeather && currentWeather.temperature?.current !== undefined) {
                // 合并当前天气信息到今天的数据中
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
              console.warn('获取当前天气补充信息失败，使用预测数据:', error)
            }
          }

          return weatherData

        } catch (error) {
          console.error('获取优化天气数据失败:', error)
          throw error
        }
      },
      { 
        forceRefresh,
        timeout: 25000, // 25秒超时
        maxRetries: 2
      }
    );
  }

  // 优化的日记数据获取 - 统一批量请求
  private async _getOptimizedDiariesData(startDate: string, endDate: string): Promise<DiaryData[]> {
    const diaryKey = `diaries_${startDate}_${endDate}`;
    
    return await requestDeduplicator.executeRequest(
      diaryKey,
      async () => {
        try {

          
          // 一次性获取日期范围内的所有日记，避免多次单独请求
          const diariesData = await diaryService.getDiariesByDateRange(startDate, endDate)


          return diariesData

        } catch (error) {
          console.error('获取优化日记数据失败:', error)
          // 即使失败也返回空数组，不影响天气数据显示
          return []
        }
      },
      { 
        forceRefresh: false, // 日记数据通常不需要强制刷新
        timeout: 15000,     // 15秒超时
        maxRetries: 2
      }
    );
  }

  // 更新天气缓存
  private _updateWeatherCache(weatherData: WeatherData[]): void {
    this.weatherCache.clear()
    weatherData.forEach(weather => {
      this.weatherCache.set(weather.date, weather)
    })
  }

  // 更新日记缓存
  private _updateDiariesCache(diariesData: DiaryData[] | any): void {
    this.diaryCache.clear()
    
    // 确保数据是数组格式
    const diaries = Array.isArray(diariesData) ? diariesData : 
                   (diariesData?.data && Array.isArray(diariesData.data)) ? diariesData.data : []
    

    
    diaries.forEach((diary: any) => {
      if (diary && diary.date) {
        this.diaryCache.set(diary.date, diary)
      }
    })
  }

  // 暴露到全局供组件使用
  private _exposeToGlobal(): void {
    window.__unifiedCacheService = this
    window.__diaryCache = this.diaryCache
    window.__weatherCache = this.weatherCache
    window.__weatherList = Array.from(this.weatherCache.values())
  }

  // 通知组件数据就绪
  private _notifyDataReady(weatherData: WeatherData[], diariesData: DiaryData[]): void {
    // 通知天气数据就绪
    window.dispatchEvent(new CustomEvent('weather:data:ready', {
      detail: { weatherData }
    }) as WeatherDataReadyEvent)

    // 通知日记数据就绪
    window.dispatchEvent(new CustomEvent('diaries:data:ready', {
      detail: { diariesData }
    }) as DiariesDataReadyEvent)

    // 通知所有数据就绪
    window.dispatchEvent(new CustomEvent('unified:data:ready', {
      detail: { weatherData, diariesData }
    }) as UnifiedDataReadyEvent)
  }

  // 获取天气数据
  getWeatherData(date?: string): WeatherData | WeatherData[] | null {
    if (date) {
      return this.weatherCache.get(date) || null
    }
    return Array.from(this.weatherCache.values())
  }

  // 获取日记数据
  getDiaryData(date?: string): DiaryData | DiaryData[] | null {
    if (date) {
      return this.diaryCache.get(date) || null
    }
    return Array.from(this.diaryCache.values())
  }

  // 设置日记数据
  setDiaryData(date: string, diary: DiaryData | null): void {
    if (diary) {
      this.diaryCache.set(date, diary)
    } else {
      this.diaryCache.delete(date)
    }

    // 更新全局缓存
    window.__diaryCache = this.diaryCache
  }

  // 刷新特定日期的日记数据
  async refreshDiaryData(date: string): Promise<DiaryData | null> {
    try {
      const diary = await diaryService.getDiaryByDate(date, true) // 强制刷新

      if (diary) {
        this.diaryCache.set(date, diary)
      } else {
        this.diaryCache.delete(date)
      }

      // 更新全局缓存
      window.__diaryCache = this.diaryCache

      // 通知组件更新
      window.dispatchEvent(new CustomEvent('diary:updated', {
        detail: { date, diary }
      }) as DiaryUpdatedEvent)

      return diary
    } catch (error) {
      console.error(`刷新日记数据失败 (${date}):`, error)
      throw error
    }
  }

  // 后台更新数据（不阻塞主流程，不触发UI重新渲染）
  private async updateDataInBackground(startDate: string, endDate: string, latitude: number, longitude: number): Promise<void> {
    const backgroundKey = `background_update_${startDate}_${endDate}_${latitude}_${longitude}`;
    
    // 使用请求去重确保后台更新不会重复执行
    try {
      await requestDeduplicator.executeRequest(
        backgroundKey,
        async () => {

          
          // 后台获取最新数据
          const [newWeatherData, newDiariesData] = await Promise.all([
            this._getOptimizedWeatherData(latitude, longitude, startDate, endDate, true),
            this._getOptimizedDiariesData(startDate, endDate)
          ])
          
          // 缓存新数据到离线服务
          await offlineDataService.cacheWeatherData(newWeatherData)
          await offlineDataService.cacheDiaryData(newDiariesData)
          
          // 检查数据是否有实质性变化
          const hasWeatherChanges = this._hasDataChanges(Array.from(this.weatherCache.values()), newWeatherData)
          const hasDiaryChanges = this._hasDataChanges(Array.from(this.diaryCache.values()), newDiariesData)
          
          if (hasWeatherChanges || hasDiaryChanges) {

            
            // 静默更新内存缓存（不触发重新渲染）
            this._updateWeatherCache(newWeatherData)
            this._updateDiariesCache(newDiariesData)
            this._exposeToGlobal()
            
            // 发送静默更新事件，让组件可以选择性地处理
            window.dispatchEvent(new CustomEvent('unified:data:updated', {
              detail: { 
                weatherData: newWeatherData, 
                diariesData: newDiariesData,
                hasWeatherChanges,
                hasDiaryChanges,
                silent: true // 标记为静默更新
              }
            }))
            

          } else {

          }
          
          return { weatherData: newWeatherData, diariesData: newDiariesData };
        },
        { 
          forceRefresh: false, // 后台更新不强制刷新请求去重
          timeout: 30000,      // 30秒超时
          maxRetries: 1        // 后台更新失败不重试太多次
        }
      );
    } catch (error) {
      console.warn('⚠️ 后台更新失败:', error)
    }
  }

  // 检查数据是否有实质性变化
  private _hasDataChanges(oldData: any[], newData: any[]): boolean {
    if (oldData.length !== newData.length) return true
    
    // 简单的数据变化检测
    for (let i = 0; i < oldData.length; i++) {
      const oldItem = oldData[i]
      const newItem = newData[i]
      
      if (!oldItem || !newItem) return true
      if (oldItem.date !== newItem.date) return true
      
      // 对于天气数据，检查关键字段
      if (oldItem.temperature && newItem.temperature) {
        if (JSON.stringify(oldItem.temperature) !== JSON.stringify(newItem.temperature)) return true
      }
      
      // 对于日记数据，检查内容和心情
      if (oldItem.content !== newItem.content) return true
      if (oldItem.mood !== newItem.mood) return true
    }
    
    return false
  }

  // 预加载相邻日期的数据
  async preloadAdjacentData(currentDate: string): Promise<void> {
    const current = new Date(currentDate)
    const prevDate = new Date(current.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const nextDate = new Date(current.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 预加载相邻日期的日记（不等待结果）
    Promise.all([
      this.getDiaryData(prevDate) || diaryService.getDiaryByDate(prevDate).catch(() => null),
      this.getDiaryData(nextDate) || diaryService.getDiaryByDate(nextDate).catch(() => null)
    ])
  }

  // 清理缓存
  clearCache(): void {
    this.weatherCache.clear()
    this.diaryCache.clear()
    this.requestPromises.clear()
    this.isInitialized = false
    this.currentDateRange = null

    // 清理请求去重记录
    requestDeduplicator.clearAll()

    // 清理全局引用
    delete window.__unifiedCacheService
    delete window.__diaryCache
    delete window.__weatherCache
    delete window.__weatherList
    

  }

  // 获取缓存统计信息
  getCacheStats(): UnifiedCacheStats & { requestDeduplicator: any } {
    const deduplicatorStats = requestDeduplicator.getStats();
    
    return {
      weatherCacheSize: this.weatherCache.size,
      diaryCacheSize: this.diaryCache.size,
      isInitialized: this.isInitialized,
      currentDateRange: this.currentDateRange,
      pendingRequests: this.requestPromises.size,
      requestDeduplicator: deduplicatorStats
    }
  }
}

// 创建并导出单例实例
export const unifiedCacheService = new UnifiedCacheService()
export default unifiedCacheService