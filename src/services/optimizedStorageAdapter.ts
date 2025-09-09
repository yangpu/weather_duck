import { isSupabaseEnabled } from '../config/supabase'
import { diaryService } from './diaryService'
import { WeatherDiary } from '../config/supabase'

/**
 * 优化版存储适配器
 * 支持批量操作和更好的性能
 */
export class OptimizedStorageAdapter {
  
  /**
   * 获取单个日记
   */
  static async getDiary(date: string): Promise<WeatherDiary | null> {
    if (isSupabaseEnabled) {
      return await diaryService.getDiaryByDate(date)
    } else {
      // 本地存储fallback
      const stored = localStorage.getItem(`diary_${date}`)
      return stored ? JSON.parse(stored) : null
    }
  }

  /**
   * 批量获取日记 - 优化版本
   * 用于日历组件，避免多次请求
   */
  static async getDiariesByDates(dates: string[]): Promise<Record<string, WeatherDiary>> {
    if (isSupabaseEnabled) {
      const diaries = await diaryService.getDiariesByDateRange(dates[0], dates[dates.length - 1])
      const diariesMap: Record<string, WeatherDiary> = {}
      diaries.forEach(diary => {
        if (diary.date && dates.includes(diary.date)) {
          diariesMap[diary.date] = diary
        }
      })
      return diariesMap
    } else {
      // 本地存储fallback
      const diariesMap: Record<string, WeatherDiary> = {}
      dates.forEach(date => {
        const stored = localStorage.getItem(`diary_${date}`)
        if (stored) {
          diariesMap[date] = JSON.parse(stored)
        }
      })
      return diariesMap
    }
  }

  /**
   * 获取月份日记 - 用于日历优化
   */
  static async getMonthDiaries(year: number, month: number): Promise<Record<string, WeatherDiary>> {
    if (isSupabaseEnabled) {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`
      const diaries = await diaryService.getDiariesByDateRange(startDate, endDate)
      const diariesMap: Record<string, WeatherDiary> = {}
      diaries.forEach(diary => {
        if (diary.date) {
          diariesMap[diary.date] = diary
        }
      })
      return diariesMap
    } else {
      // 本地存储fallback - 扫描整个月
      const diariesMap: Record<string, WeatherDiary> = {}
      const daysInMonth = new Date(year, month, 0).getDate()
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        const stored = localStorage.getItem(`diary_${date}`)
        if (stored) {
          diariesMap[date] = JSON.parse(stored)
        }
      }
      
      return diariesMap
    }
  }

  /**
   * 保存日记 - 直接保存，文件上传在组件中处理
   */
  static async saveDiary(
    diary: Omit<WeatherDiary, 'id' | 'created_at' | 'updated_at'>
  ): Promise<WeatherDiary> {
    if (isSupabaseEnabled) {
      return await diaryService.createDiary(diary)
    } else {
      // 本地存储fallback
      const diaryData: WeatherDiary = {
        ...diary,
        id: `local_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      localStorage.setItem(`diary_${diary.date}`, JSON.stringify(diaryData))
      return diaryData
    }
  }

  /**
   * 删除日记
   */
  static async deleteDiary(date: string): Promise<boolean> {
    if (isSupabaseEnabled) {
      return await diaryService.deleteDiary(date)
    } else {
      localStorage.removeItem(`diary_${date}`)
      return true
    }
  }

  /**
   * 搜索日记
   */
  static async searchDiaries(keyword: string, limit: number = 20): Promise<WeatherDiary[]> {
    if (isSupabaseEnabled) {
      const allDiaries = await diaryService.getDiaries(1000)
      return allDiaries.filter(diary => 
        diary.content?.includes(keyword) || 
        diary.city?.includes(keyword) || 
        diary.mood?.includes(keyword)
      ).slice(0, limit)
    } else {
      // 本地存储搜索
      const results: WeatherDiary[] = []
      const keys = Object.keys(localStorage).filter(key => key.startsWith('diary_'))
      
      for (const key of keys) {
        if (results.length >= limit) break
        
        const stored = localStorage.getItem(key)
        if (stored) {
          const diary = JSON.parse(stored)
          const searchText = `${diary.content || ''} ${diary.city || ''} ${diary.mood || ''}`.toLowerCase()
          if (searchText.includes(keyword.toLowerCase())) {
            results.push(diary)
          }
        }
      }
      
      return results.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    }
  }

  /**
   * 获取统计信息
   */
  static async getStatistics() {
    if (isSupabaseEnabled) {
      const allDiaries = await diaryService.getDiaries(1000)
      const stats = {
        totalDiaries: allDiaries.length,
        totalImages: 0,
        totalVideos: 0,
        moodStats: {} as Record<string, number>,
        cityStats: {} as Record<string, number>,
        monthlyStats: {} as Record<string, number>
      }
      
      allDiaries.forEach(diary => {
        if (diary.images) stats.totalImages += diary.images.length
        if (diary.videos) stats.totalVideos += diary.videos.length
        if (diary.mood) stats.moodStats[diary.mood] = (stats.moodStats[diary.mood] || 0) + 1
        if (diary.city) stats.cityStats[diary.city] = (stats.cityStats[diary.city] || 0) + 1
        if (diary.date) {
          const month = diary.date.substring(0, 7)
          stats.monthlyStats[month] = (stats.monthlyStats[month] || 0) + 1
        }
      })
      
      return stats
    } else {
      // 本地存储统计
      const stats = {
        totalDiaries: 0,
        totalImages: 0,
        totalVideos: 0,
        moodStats: {} as Record<string, number>,
        cityStats: {} as Record<string, number>,
        monthlyStats: {} as Record<string, number>
      }

      const keys = Object.keys(localStorage).filter(key => key.startsWith('diary_'))
      
      keys.forEach(key => {
        const stored = localStorage.getItem(key)
        if (stored) {
          const diary = JSON.parse(stored)
          stats.totalDiaries++
          
          if (diary.images) {
            stats.totalImages += diary.images.length
          }
          if (diary.videos) {
            stats.totalVideos += diary.videos.length
          }
          if (diary.mood) {
            stats.moodStats[diary.mood] = (stats.moodStats[diary.mood] || 0) + 1
          }
          if (diary.city) {
            stats.cityStats[diary.city] = (stats.cityStats[diary.city] || 0) + 1
          }
          if (diary.date) {
            const month = diary.date.substring(0, 7)
            stats.monthlyStats[month] = (stats.monthlyStats[month] || 0) + 1
          }
        }
      })

      return stats
    }
  }

  /**
   * 文件转Base64 - 本地存储使用
   */
  // 已删除未使用的 _fileToBase64 方法

  /**
   * 批量删除日记
   */
  static async deleteDiaries(dates: string[]): Promise<boolean> {
    if (isSupabaseEnabled) {
      for (const date of dates) {
        await diaryService.deleteDiary(date)
      }
      return true
    } else {
      dates.forEach(date => {
        localStorage.removeItem(`diary_${date}`)
      })
      return true
    }
  }

  /**
   * 获取日期范围内的日记
   */
  static async getDiariesInRange(startDate: string, endDate: string): Promise<WeatherDiary[]> {
    if (isSupabaseEnabled) {
      return await diaryService.getDiariesByDateRange(startDate, endDate)
    } else {
      const results: WeatherDiary[] = []
      const keys = Object.keys(localStorage).filter(key => key.startsWith('diary_'))
      
      keys.forEach(key => {
        const stored = localStorage.getItem(key)
        if (stored) {
          const diary = JSON.parse(stored)
          if (diary.date >= startDate && diary.date <= endDate) {
            results.push(diary)
          }
        }
      })
      
      return results.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    }
  }
}