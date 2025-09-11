// 统一缓存服务 - 优化天气和日记数据请求
import { weatherService } from './weatherService'
import { diaryService } from './diaryService'
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
    __unifiedCacheService?: UnifiedCacheService
    __diaryCache?: Map<string, DiaryData>
    __weatherCache?: Map<string, WeatherData>
    __weatherList?: WeatherData[]
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
    const cacheKey = `${startDate}-${endDate}-${latitude}-${longitude}`

    // 如果强制刷新，清除相关的请求Promise
    if (forceRefresh) {
      this.requestPromises.delete(cacheKey)
    }

    // 检查是否已经初始化相同的数据范围
    if (!forceRefresh &&
      this.isInitialized &&
      this.currentDateRange === cacheKey) {
      return {
        weatherData: Array.from(this.weatherCache.values()),
        diariesData: Array.from(this.diaryCache.values())
      }
    }

    // 防止重复请求（除非强制刷新）
    if (!forceRefresh && this.requestPromises.has(cacheKey)) {
      return await this.requestPromises.get(cacheKey)!
    }

    const requestPromise = this._performInitialization(startDate, endDate, latitude, longitude, cacheKey, forceRefresh)
    this.requestPromises.set(cacheKey, requestPromise)

    try {
      const result = await requestPromise
      return result
    } finally {
      this.requestPromises.delete(cacheKey)
    }
  }

  private async _performInitialization(startDate: string, endDate: string, latitude: number, longitude: number, cacheKey: string, forceRefresh: boolean = false): Promise<InitializeDataResult> {
    try {
      // 优化1: 合并天气请求 - 使用单一的增强天气API替代多次forecast请求
      const weatherPromise = this._getOptimizedWeatherData(latitude, longitude, startDate, endDate, forceRefresh)

      // 优化2: 统一日记请求 - 一次性获取日期范围内的所有日记
      const diariesPromise = this._getOptimizedDiariesData(startDate, endDate)

      // 并行执行请求
      const [weatherData, diariesData] = await Promise.all([
        weatherPromise,
        diariesPromise
      ])

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
      throw error
    }
  }

  // 优化的天气数据获取 - 合并多个forecast请求
  private async _getOptimizedWeatherData(latitude: number, longitude: number, startDate: string, endDate: string, forceRefresh: boolean = false): Promise<WeatherData[]> {
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
          const currentWeather = await weatherService.getCurrentWeather(latitude, longitude, forceRefresh)
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
  }

  // 优化的日记数据获取 - 统一批量请求
  private async _getOptimizedDiariesData(startDate: string, endDate: string): Promise<DiaryData[]> {
    try {
      // 一次性获取日期范围内的所有日记，避免多次单独请求
      const diariesData = await diaryService.getDiariesByDateRange(startDate, endDate)

      return diariesData

    } catch (error) {
      console.error('获取优化日记数据失败:', error)
      // 即使失败也返回空数组，不影响天气数据显示
      return []
    }
  }

  // 更新天气缓存
  private _updateWeatherCache(weatherData: WeatherData[]): void {
    this.weatherCache.clear()
    weatherData.forEach(weather => {
      this.weatherCache.set(weather.date, weather)
    })
  }

  // 更新日记缓存
  private _updateDiariesCache(diariesData: DiaryData[]): void {
    this.diaryCache.clear()
    diariesData.forEach(diary => {
      if (diary.date) {
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

    // 清理全局引用
    delete window.__unifiedCacheService
    delete window.__diaryCache
    delete window.__weatherCache
    delete window.__weatherList
  }

  // 获取缓存统计信息
  getCacheStats(): UnifiedCacheStats {
    return {
      weatherCacheSize: this.weatherCache.size,
      diaryCacheSize: this.diaryCache.size,
      isInitialized: this.isInitialized,
      currentDateRange: this.currentDateRange,
      pendingRequests: this.requestPromises.size
    }
  }
}

export const unifiedCacheService = new UnifiedCacheService()
export default unifiedCacheService