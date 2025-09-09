// 优化的日记服务
import { supabase } from '../config/supabase'
import { cacheService } from './cacheService'
import type { DiaryData, DiaryServiceInterface } from '../types/diary'

class DiaryService implements DiaryServiceInterface {
  private defaultTTL: number

  constructor() {
    this.defaultTTL = 300000 // 5分钟缓存
  }

  async getDiaries(limit: number = 50, forceRefresh: boolean = false): Promise<DiaryData[]> {
    const key = cacheService.generateKey('diaries', { limit })
    
    if (!forceRefresh && cacheService.has(key)) {
      return cacheService.get<DiaryData[]>(key) || []
    }

    try {
      if (!supabase) {
        throw new Error('Supabase not configured')
      }

      const { data, error } = await supabase
        .from('weather_diaries')
        .select('id,date,content,mood,city,weather_data,images,videos,created_at,updated_at')
        .order('date', { ascending: false })
        .limit(limit)

      if (error) throw error

      const diaries = data || []
      cacheService.set(key, diaries, this.defaultTTL)
      
      // 同时缓存单个日记
      diaries.forEach(diary => {
        const singleKey = cacheService.generateKey('diary_by_date', { date: diary.date })
        cacheService.set(singleKey, diary, this.defaultTTL)
      })

      return diaries
    } catch (error) {
      console.error('获取日记列表失败:', error)
      const cachedData = cacheService.get<DiaryData[]>(key)
      if (cachedData) {
        return cachedData
      }
      throw error
    }
  }

  async getDiariesByDateRange(startDate: string, endDate: string, forceRefresh: boolean = false): Promise<DiaryData[]> {
    const key = cacheService.generateKey('diaries_range', { startDate, endDate })
    
    if (!forceRefresh && cacheService.has(key)) {
      return cacheService.get<DiaryData[]>(key) || []
    }

    try {
      if (!supabase) {
        throw new Error('Supabase not configured')
      }

      const { data, error } = await supabase
        .from('weather_diaries')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      if (error) throw error

      const diaries = data || []
      cacheService.set(key, diaries, this.defaultTTL)
      
      // 同时缓存单个日记
      diaries.forEach(diary => {
        const singleKey = cacheService.generateKey('diary_by_date', { date: diary.date })
        cacheService.set(singleKey, diary, this.defaultTTL)
      })

      return diaries
    } catch (error) {
      console.error('获取日期范围日记失败:', error)
      const cachedData = cacheService.get<DiaryData[]>(key)
      if (cachedData) {
        return cachedData
      }
      throw error
    }
  }

  async getDiaryByDate(date: string, forceRefresh: boolean = false): Promise<DiaryData | null> {
    const key = cacheService.generateKey('diary_by_date', { date })
    
    if (!forceRefresh && cacheService.has(key)) {
      return cacheService.get<DiaryData>(key)
    }

    try {
      if (!supabase) {
        throw new Error('Supabase not configured')
      }

      const { data, error } = await supabase
        .from('weather_diaries')
        .select('id,date,content,mood,city,weather_data,images,videos,created_at,updated_at')
        .eq('date', date)
        .maybeSingle()

      if (error) {
        throw error
      }

      const diary = data || null
      cacheService.set(key, diary, this.defaultTTL)
      return diary
    } catch (error) {
      console.error(`获取日记失败 (${date}):`, error)
      const cachedData = cacheService.get<DiaryData>(key)
      if (cachedData) {
        return cachedData
      }
      return null // 对于日记，如果获取失败就返回null
    }
  }

  async createDiary(diaryData: Omit<DiaryData, 'id' | 'created_at' | 'updated_at'>): Promise<DiaryData> {
    try {
      if (!supabase) {
        throw new Error('Supabase not configured')
      }

      // 先检查是否已存在该日期的日记
      const existingDiary = await this.getDiaryByDate(diaryData.date, true)
      
      let data: DiaryData
      if (existingDiary) {
        // 如果存在，则更新
        const { data: updateData, error } = await supabase
          .from('weather_diaries')
          .update(diaryData)
          .eq('id', existingDiary.id!)
          .select()
          .single()
        
        if (error) throw error
        data = updateData
      } else {
        // 如果不存在，则创建
        const { data: insertData, error } = await supabase
          .from('weather_diaries')
          .insert([diaryData])
          .select()
          .single()
        
        if (error) throw error
        data = insertData
      }

      // 更新缓存
      this.updateCacheAfterModification(data)
      return data
    } catch (error) {
      console.error('保存日记失败:', error)
      throw error
    }
  }

  async updateDiary(id: string, diaryData: Partial<DiaryData>): Promise<DiaryData> {
    try {
      if (!supabase) {
        throw new Error('Supabase not configured')
      }

      const { data, error } = await supabase
        .from('weather_diaries')
        .update(diaryData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // 更新缓存
      this.updateCacheAfterModification(data)
      return data
    } catch (error) {
      console.error('更新日记失败:', error)
      throw error
    }
  }

  async deleteDiary(id: string): Promise<boolean> {
    try {
      if (!supabase) {
        throw new Error('Supabase not configured')
      }

      const { error } = await supabase
        .from('weather_diaries')
        .delete()
        .eq('id', id)

      if (error) throw error

      // 清理相关缓存
      this.clearDiaryCache()
      return true
    } catch (error) {
      console.error('删除日记失败:', error)
      throw error
    }
  }

  private updateCacheAfterModification(diary: DiaryData): void {
    // 更新单个日记缓存
    const singleKey = cacheService.generateKey('diary_by_date', { date: diary.date })
    cacheService.set(singleKey, diary, this.defaultTTL)
    
    // 清理列表缓存，强制重新加载
    cacheService.invalidateByType('diaries')
    cacheService.invalidateByType('diaries_range')
  }

  clearDiaryCache(): void {
    cacheService.invalidateByType('diary_by_date')
    cacheService.invalidateByType('diaries')
    cacheService.invalidateByType('diaries_range')
  }

  async refreshDiaryByDate(date: string): Promise<DiaryData | null> {
    return this.getDiaryByDate(date, true)
  }

  async preloadAdjacentDiaries(currentDate: string): Promise<void> {
    const current = new Date(currentDate)
    const prevDate = new Date(current.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const nextDate = new Date(current.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // 预加载相邻日期的日记（不等待结果）
    Promise.all([
      this.getDiaryByDate(prevDate).catch(() => null),
      this.getDiaryByDate(nextDate).catch(() => null)
    ])
  }
}

export const diaryService = new DiaryService()
export default diaryService