// 离线数据处理服务
import { WeatherData } from '../types/weather'
import { DiaryData } from '../types/diary'
import { cacheService } from './cacheService'

export class OfflineDataService {
  private static instance: OfflineDataService
  private weatherCache = new Map<string, WeatherData>()
  private diaryCache = new Map<string, DiaryData>()
  
  static getInstance(): OfflineDataService {
    if (!this.instance) {
      this.instance = new OfflineDataService()
      // 初始化时恢复缓存数据
      this.instance.initializeFromStorage()
    }
    return this.instance
  }

  // 从存储中恢复缓存数据
  private initializeFromStorage(): void {
    try {
      // 恢复天气数据
      let weatherCount = 0
      let diaryCount = 0
      
      // 从localStorage恢复数据
      Object.keys(localStorage).forEach(key => {
        try {
          if (key.startsWith('weather_')) {
            const date = key.replace('weather_', '')
            const data = JSON.parse(localStorage.getItem(key) || '{}')
            if (data && data.date && !data.isPlaceholder) {
              this.weatherCache.set(date, data)
              weatherCount++
            }
          } else if (key.startsWith('diary_')) {
            const date = key.replace('diary_', '')
            const data = JSON.parse(localStorage.getItem(key) || '{}')
            if (data && data.date) {
              this.diaryCache.set(date, data)
              diaryCount++
            }
          }
        } catch (error) {
          console.warn('恢复缓存数据失败:', key, error)
        }
      })
      
    } catch (error) {
      console.error('从存储恢复缓存数据失败:', error)
    }
  }

  // 缓存天气数据
  async cacheWeatherData(data: WeatherData[]): Promise<void> {
    if (!data || data.length === 0) {
      return
    }
    
    let cachedCount = 0
    let errorCount = 0
    
    for (const weather of data) {
      try {
        if (weather && weather.date && !weather.isPlaceholder) {
          // 缓存到内存
          this.weatherCache.set(weather.date, weather)
          
          // 同时存储到持久化缓存
          const key = cacheService.generateKey('weather_by_date', { date: weather.date })
          try {
            await cacheService.set(key, weather, 24 * 60 * 60 * 1000) // 24小时
          } catch (cacheError) {
            console.warn('IndexedDB缓存失败，使用localStorage:', cacheError)
          }
          
          // 兜底：总是存储到localStorage
          try {
            const localStorageKey = `weather_${weather.date}`
            localStorage.setItem(localStorageKey, JSON.stringify(weather))
          } catch (localError) {
            console.warn('localStorage缓存失败:', localError)
          }
          
          cachedCount++
        }
      } catch (error) {
        console.error('缓存天气数据失败:', weather?.date, error)
        errorCount++
      }
    }
  }

  // 缓存日记数据
  async cacheDiaryData(data: DiaryData[]): Promise<void> {
    if (!data || data.length === 0) {
      return
    }
    
    let cachedCount = 0
    let errorCount = 0
    
    for (const diary of data) {
      try {
        if (diary && diary.date) {
          // 缓存到内存
          this.diaryCache.set(diary.date, diary)
          
          // 同时存储到持久化缓存
          const key = cacheService.generateKey('diary_by_date', { date: diary.date })
          try {
            await cacheService.set(key, diary, 24 * 60 * 60 * 1000) // 24小时
          } catch (cacheError) {
            console.warn('IndexedDB缓存失败，使用localStorage:', cacheError)
          }
          
          // 兜底：总是存储到localStorage
          try {
            const localStorageKey = `diary_${diary.date}`
            localStorage.setItem(localStorageKey, JSON.stringify(diary))
          } catch (localError) {
            console.warn('localStorage缓存失败:', localError)
          }
          
          cachedCount++
        }
      } catch (error) {
        console.error('缓存日记数据失败:', diary?.date, error)
        errorCount++
      }
    }
  }

  // 获取离线天气数据
  getOfflineWeatherData(startDate: string, endDate: string): WeatherData[] {
    const result: WeatherData[] = []
    const dates = this.generateDateRange(startDate, endDate)
    
    dates.forEach(date => {
      // 先从内存缓存获取
      let weather = this.weatherCache.get(date)
      
      // 如果内存缓存没有，尝试从持久化缓存获取
      if (!weather) {
        const key = cacheService.generateKey('weather_by_date', { date })
        weather = cacheService.get<WeatherData>(key) || undefined
        if (weather) {
          // 重新加载到内存缓存
          this.weatherCache.set(date, weather)
        }
      }
      
      // 如果还是没有，尝试从localStorage获取
      if (!weather) {
        try {
          const localStorageKey = `weather_${date}`
          const localData = localStorage.getItem(localStorageKey)
          if (localData) {
            weather = JSON.parse(localData)
            // 重新加载到内存缓存
            if (weather) {
              this.weatherCache.set(date, weather)
            }
          }
        } catch (error) {
          console.warn('从localStorage恢复天气数据失败:', date, error)
        }
      }
      
      if (weather && !weather.isPlaceholder) {
        result.push(weather)
      } else {
        // 生成占位数据
        const placeholder = this.generatePlaceholderWeatherData(date)
        result.push(placeholder)
      }
    })
    
    return result
  }

  // 获取离线日记数据
  getOfflineDiaryData(startDate: string, endDate: string): DiaryData[] {
    const result: DiaryData[] = []
    const dates = this.generateDateRange(startDate, endDate)
    
    dates.forEach(date => {
      // 先从内存缓存获取
      let diary = this.diaryCache.get(date)
      
      // 如果内存缓存没有，尝试从持久化缓存获取
      if (!diary) {
        const key = cacheService.generateKey('diary_by_date', { date })
        diary = cacheService.get<DiaryData>(key) || undefined
        if (diary) {
          // 重新加载到内存缓存
          this.diaryCache.set(date, diary)
        }
      }
      
      // 如果还是没有，尝试从localStorage获取
      if (!diary) {
        try {
          const localStorageKey = `diary_${date}`
          const localData = localStorage.getItem(localStorageKey)
          if (localData) {
            diary = JSON.parse(localData)
            // 重新加载到内存缓存
            if (diary) {
              this.diaryCache.set(date, diary)
            }
          }
        } catch (error) {
          console.warn('从localStorage恢复日记数据失败:', date, error)
        }
      }
      
      if (diary) {
        result.push(diary)
      }
    })
    
    return result
  }

  // 检查是否有缓存数据
  hasCachedData(startDate: string, endDate: string): { hasWeather: boolean; hasDiary: boolean } {
    const dates = this.generateDateRange(startDate, endDate)
    let hasWeather = false
    let hasDiary = false
    
    for (const date of dates) {
      // 检查天气缓存
      if (!hasWeather) {
        const weatherInMemory = this.weatherCache.has(date)
        const weatherKey = cacheService.generateKey('weather_by_date', { date })
        const weatherInCache = cacheService.get(weatherKey) !== null
        hasWeather = weatherInMemory || weatherInCache
      }
      
      // 检查日记缓存
      if (!hasDiary) {
        const diaryInMemory = this.diaryCache.has(date)
        const diaryKey = cacheService.generateKey('diary_by_date', { date })
        const diaryInCache = cacheService.get(diaryKey) !== null
        hasDiary = diaryInMemory || diaryInCache
      }
      
      // 如果都有缓存，可以提前退出
      if (hasWeather && hasDiary) {
        break
      }
    }
    
    return { hasWeather, hasDiary }
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
    
    let description = '离线模式'
    if (isPast) {
      description = '历史数据离线'
    } else if (isToday) {
      description = '实时数据离线'
    } else {
      description = '预报数据离线'
    }
    
    return {
      date,
      temperature: { min: 0, max: 0, current: 0 },
      humidity: 0,
      windSpeed: 0,
      windDirection: '未知',
      precipitation: 0,
      cloudCover: 0,
      description,
      icon: '📱',
      isPlaceholder: true
    }
  }

  // 清理过期缓存
  clearExpiredCache(): void {
    const now = Date.now()
    const expireTime = 24 * 60 * 60 * 1000 // 24小时
    
    // 清理内存缓存中的过期数据
    for (const [date] of this.weatherCache.entries()) {
      const cacheTime = new Date(date).getTime()
      if (now - cacheTime > expireTime) {
        this.weatherCache.delete(date)
      }
    }
    
    for (const [date] of this.diaryCache.entries()) {
      const cacheTime = new Date(date).getTime()
      if (now - cacheTime > expireTime) {
        this.diaryCache.delete(date)
      }
    }
    

  }

  // 获取缓存统计信息
  getCacheStats(): { weatherCount: number; diaryCount: number } {
    return {
      weatherCount: this.weatherCache.size,
      diaryCount: this.diaryCache.size
    }
  }
}

// 导出单例实例
export const offlineDataService = OfflineDataService.getInstance()