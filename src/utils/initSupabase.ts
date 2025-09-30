import { supabase } from '../config/supabase'

/**
 * 简单的Supabase连接检查
 * 不执行任何数据库初始化操作
 */
export async function initializeSupabase() {
  try {

    
    // 检查环境变量
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase环境变量未配置，将使用本地存储模式')
      return false
    }
    
    if (!supabase) {
      console.warn('Supabase客户端未初始化，将使用本地存储模式')
      return false
    }
    

    return true
  } catch (error) {
    console.warn('Supabase配置检查失败，将使用本地存储模式:', error)
    return false
  }
}