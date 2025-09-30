// 全局数据管理器 - 确保所有数据请求都通过缓存
import { diaryService } from './diaryService'
import { weatherService } from './weatherService'
import type { DiaryData } from '../types/diary'
import type { WeatherData } from '../types/weather'
import type { GlobalDataManagerInterface } from '../types/services'

interface DateRange {
  startDate: string
  endDate: string
}

interface GlobalDataReadyEvent extends CustomEvent {
  detail: {
    weatherData: WeatherData[]
    diariesData: DiaryData[]
  }
}

interface DiaryUpdatedEvent extends CustomEvent {
  detail: {
    date: string
    diary: DiaryData | null
  }
}

declare global {
  interface Window {
    __globalDataManager?: GlobalDataManager
    __diaryCache?: any
    __weatherList?: any
  }

  interface WindowEventMap {
    'global:data:ready': GlobalDataReadyEvent
    'diary:updated': DiaryUpdatedEvent
  }
}

class GlobalDataManager implements GlobalDataManagerInterface {
  public isInitialized: boolean
  public currentDateRange: DateRange | null
  private dataCache: Map<string, any>

  constructor() {
    this.isInitialized = false
    this.currentDateRange = null
    this.dataCache = new Map()
  }

  // 初始化并预加载数据
  async initialize(startDate: string, endDate: string, latitude: number, longitude: number): Promise<void> {
    if (this.isInitialized && 
        this.currentDateRange && 
        this.currentDateRange.startDate === startDate && 
        this.currentDateRange.endDate === endDate) {
      return
    }

    try {
      // 并行加载天气和日记数据
      const [weatherData, diariesData] = await Promise.all([
        weatherService.getWeatherForDateRange(latitude, longitude, startDate, endDate),
        diaryService.getDiariesByDateRange(startDate, endDate)
      ])

      // 将日记数据映射到缓存中
      const diariesMap = new Map<string, DiaryData>()
      diariesData.forEach(diary => {
        if (diary.date) {
          diariesMap.set(diary.date, diary)
        }
      })

      // 更新全局状态
      this.currentDateRange = { startDate, endDate }
      this.dataCache.set('weather', weatherData)
      this.dataCache.set('diaries', diariesMap)
      this.isInitialized = true

      // 暴露到全局供组件使用
      window.__globalDataManager = this
      window.__diaryCache = diariesMap
      window.__weatherList = weatherData

      // 通知所有组件数据已准备就绪
      window.dispatchEvent(new CustomEvent('global:data:ready', {
        detail: { weatherData, diariesData }
      }) as GlobalDataReadyEvent)

    } catch (error) {
      console.error('❌ 全局数据管理器：初始化失败', error)
      throw error
    }
  }

  // 获取日记数据（优先从缓存）
  getDiary(date: string): DiaryData | null {
    const diariesMap = this.dataCache.get('diaries') as Map<string, DiaryData>
    return diariesMap ? diariesMap.get(date) || null : null
  }

  // 获取天气数据
  getWeatherList(): WeatherData[] {
    return this.dataCache.get('weather') || []
  }

  // 刷新特定日期的数据
  async refreshDate(date: string): Promise<DiaryData | null> {
    try {
      const diary = await diaryService.getDiaryByDate(date, true) // 强制刷新
      
      const diariesMap = this.dataCache.get('diaries') as Map<string, DiaryData>
      if (diariesMap) {
        if (diary) {
          diariesMap.set(date, diary)
        } else {
          diariesMap.delete(date)
        }
      }

      // 通知组件更新
      window.dispatchEvent(new CustomEvent('diary:updated', {
        detail: { date, diary }
      }) as DiaryUpdatedEvent)

      return diary
    } catch (error) {
      console.error(`刷新日期数据失败 (${date}):`, error)
      throw error
    }
  }

  // 清理缓存
  clearCache(): void {
    this.dataCache.clear()
    this.isInitialized = false
    this.currentDateRange = null

    // 清理全局引用
    delete window.__globalDataManager
    delete window.__diaryCache
    delete window.__weatherList
  }
}

export const globalDataManager = new GlobalDataManager()
export default globalDataManager