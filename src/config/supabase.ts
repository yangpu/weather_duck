import { createClient } from '@supabase/supabase-js'

// Supabase配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 检查配置是否正确
if (!supabaseUrl || !supabaseAnonKey || 
    supabaseUrl === 'https://your-project.supabase.co' || 
    supabaseAnonKey === 'your-anon-key') {
  console.warn('⚠️ Supabase配置未完成，将使用本地存储模式')
  console.warn('请在.env文件中配置VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY')
  console.warn('当前配置:', { supabaseUrl, supabaseAnonKey: supabaseAnonKey ? '已设置' : '未设置' })
} else {
}

export const supabase = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' && 
  supabaseAnonKey !== 'your-anon-key' 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null

// 是否启用Supabase
export const isSupabaseEnabled = !!supabase

// 数据库表结构定义
export interface WeatherDiary {
  id?: string
  date: string
  weather_data: any // JSON字段存储天气数据
  content?: string
  mood?: string
  city?: string
  images?: string[] // 存储图片URL数组
  videos?: string[] // 存储视频URL数组
  created_at?: string
  updated_at?: string
}

// Storage桶名称
export const STORAGE_BUCKETS = {
  IMAGES: 'diary-images',
  VIDEOS: 'diary-videos'
} as const