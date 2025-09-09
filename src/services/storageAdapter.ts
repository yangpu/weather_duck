import { isSupabaseEnabled, supabase } from '../config/supabase'
import { diaryService } from './diaryService'
import { diaryDb } from './diaryDb'
import type { WeatherDiary } from '../config/supabase'

/**
 * 存储适配器 - 根据配置自动选择Supabase或本地存储
 */
export class StorageAdapter {
  
  /**
   * 保存日记
   */
  static async saveDiary(data: Partial<WeatherDiary> & { date: string }): Promise<void> {
    if (isSupabaseEnabled && supabase) {
      try {
        await diaryService.createDiary(data as any)
        return
      } catch (error) {
        console.warn('Supabase保存日记失败，回退到本地存储:', error)
        // 如果是表不存在的错误，给出明确提示
        if (error && typeof error === 'object' && 'code' in error && error.code === 'PGRST204') {
          console.error('❌ 数据库表不存在！请在Supabase Dashboard中执行setup_database.sql脚本')
        }
      }
    }
    
    // 使用本地存储
    await diaryDb.saveDiary(
      data.date,
      data.content || '',
      data.weather_data,
      data.images?.[0] || '',
      data.images || [],
      data.mood || '',
      data.city || '',
      (data.videos && data.videos.length > 0 ? data.videos[0] : '') || ''
    )
  }

  /**
   * 获取指定日期的日记
   */
  static async getDiary(date: string): Promise<WeatherDiary | null> {
    if (isSupabaseEnabled && supabase) {
      try {
        return await diaryService.getDiaryByDate(date)
      } catch (error) {
        console.warn('Supabase获取日记失败，回退到本地存储:', error)
      }
    }
    
    // 使用本地存储
    const localDiary = await diaryDb.getDiary(date)
    if (!localDiary) return null
    
    // 转换为Supabase格式
    return {
      date: localDiary.date,
      content: localDiary.content,
      weather_data: localDiary.weather,
      images: localDiary.images,
      mood: localDiary.mood,
      city: localDiary.city,
      videos: localDiary.video ? [localDiary.video] : []
    }
  }

  /**
   * 删除日记
   */
  static async deleteDiary(date: string): Promise<void> {
    if (isSupabaseEnabled && supabase) {
      try {
        await diaryService.deleteDiary(date)
        return
      } catch (error) {
        console.warn('Supabase删除日记失败，回退到本地存储:', error)
      }
    }
    
    // 使用本地存储
    await diaryDb.deleteDiary(date)
  }

  /**
   * 获取所有日记（优化版本）
   */
  static async getAllDiaries(_limit: number = 50, _offset: number = 0): Promise<WeatherDiary[]> {
    if (isSupabaseEnabled && supabase) {
      try {
        return await diaryService.getDiaries()
      } catch (error) {
        console.warn('Supabase获取所有日记失败，回退到本地存储:', error)
      }
    }
    
    // 使用本地存储
    const localDiaries = await diaryDb.getAllDiaries()
    return localDiaries.map(diary => ({
      date: diary.date,
      content: diary.content,
      weather_data: diary.weather,
      images: diary.images,
      mood: diary.mood,
      city: diary.city,
      video: diary.video
    }))
  }

  /**
   * 获取日期范围内的日记
   */
  static async getDiariesByDateRange(startDate: string, endDate: string): Promise<WeatherDiary[]> {
    if (isSupabaseEnabled && supabase) {
      try {
        return await diaryService.getDiariesByDateRange(startDate, endDate)
      } catch (error) {
        console.warn('Supabase获取日期范围日记失败，回退到本地存储:', error)
      }
    }
    
    const allDiaries = await this.getAllDiaries()
    return allDiaries.filter(diary => 
      diary.date >= startDate && diary.date <= endDate
    )
  }
}