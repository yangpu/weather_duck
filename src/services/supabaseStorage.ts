import { supabase, STORAGE_BUCKETS, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase'

/**
 * Supabase存储服务 - 优化版本
 * 支持批量上传、用户隔离、真实上传进度
 */
export class SupabaseStorageService {
  
  /**
   * 使用 XMLHttpRequest 上传文件并获取真实进度
   */
  private static async uploadWithProgress(
    bucket: string,
    filePath: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        // 回退到普通上传
        this.uploadWithoutProgress(bucket, filePath, file)
          .then(resolve)
          .catch(reject)
        return
      }
      
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`
      
      const xhr = new XMLHttpRequest()
      
      // 监听上传进度
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })
      
      // 监听完成
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // 获取公共URL
          const { data: urlData } = supabase!.storage
            .from(bucket)
            .getPublicUrl(filePath)
          resolve(urlData.publicUrl)
        } else {
          reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`))
        }
      })
      
      // 监听错误
      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'))
      })
      
      xhr.addEventListener('abort', () => {
        reject(new Error('上传已取消'))
      })
      
      // 发送请求
      xhr.open('POST', uploadUrl)
      xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`)
      xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.setRequestHeader('Cache-Control', 'max-age=3600')
      
      xhr.send(file)
    })
  }
  
  /**
   * 无进度回调的普通上传（回退方案）
   */
  private static async uploadWithoutProgress(
    bucket: string,
    filePath: string,
    file: File
  ): Promise<string> {
    const { data, error } = await supabase!.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw error
    }

    const { data: urlData } = supabase!.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return urlData.publicUrl
  }
  
  /**
   * 上传图片文件 - 支持用户隔离和真实进度回调
   */
  static async uploadImage(
    file: File, 
    fileName?: string, 
    userId?: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop()
      const finalFileName = fileName || `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      // 如果提供了用户ID，则在路径中包含用户文件夹
      const filePath = userId ? `${userId}/${finalFileName}` : finalFileName
      
      // 使用带进度的上传
      return await this.uploadWithProgress(STORAGE_BUCKETS.IMAGES, filePath, file, onProgress)
    } catch (error) {
      console.error('上传图片时发生错误:', error)
      throw error
    }
  }

  /**
   * 批量上传图片 - 支持进度回调
   */
  static async uploadImages(
    files: File[], 
    userId?: string,
    onProgress?: (fileIndex: number, progress: number, fileName: string) => void
  ): Promise<string[]> {
    try {
      const successUrls: string[] = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const url = await this.uploadImage(
            file, 
            undefined, 
            userId,
            (progress) => onProgress?.(i, progress, file.name)
          )
          successUrls.push(url)
        } catch (error) {
          console.error(`上传图片 ${file.name} 失败:`, error)
          // 继续上传其他文件
        }
      }
      
      return successUrls
    } catch (error) {
      console.error('批量上传图片失败:', error)
      throw error
    }
  }

  /**
   * 上传视频文件 - 支持用户隔离和真实进度回调
   */
  static async uploadVideo(
    file: File, 
    fileName?: string, 
    userId?: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      const fileExt = file.name.split('.').pop()
      const finalFileName = fileName || `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      // 如果提供了用户ID，则在路径中包含用户文件夹
      const filePath = userId ? `${userId}/${finalFileName}` : finalFileName
      
      // 使用带进度的上传
      return await this.uploadWithProgress(STORAGE_BUCKETS.VIDEOS, filePath, file, onProgress)
    } catch (error) {
      console.error('上传视频时发生错误:', error)
      throw error
    }
  }

  /**
   * 删除文件
   */
  static async deleteFile(url: string): Promise<boolean> {
    try {
      // 从URL中提取文件路径和桶名
      const urlParts = url.split('/')
      const fileName = urlParts[urlParts.length - 1]
      
      // 判断是图片还是视频
      const isImage = url.includes(STORAGE_BUCKETS.IMAGES)
      const bucket = isImage ? STORAGE_BUCKETS.IMAGES : STORAGE_BUCKETS.VIDEOS
      
      const { error } = await supabase!.storage
        .from(bucket)
        .remove([fileName])

      if (error) {
        console.error('删除文件失败:', error)
        throw error
      }

      return true
    } catch (error) {
      console.error('删除文件时发生错误:', error)
      return false
    }
  }

  /**
   * 批量上传视频 - 支持进度回调
   */
  static async uploadVideos(
    files: File[], 
    userId?: string,
    onProgress?: (fileIndex: number, progress: number, fileName: string) => void
  ): Promise<string[]> {
    try {
      const successUrls: string[] = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const url = await this.uploadVideo(
            file, 
            undefined, 
            userId,
            (progress) => onProgress?.(i, progress, file.name)
          )
          successUrls.push(url)
        } catch (error) {
          console.error(`上传视频 ${file.name} 失败:`, error)
          // 继续上传其他文件
        }
      }
      
      return successUrls
    } catch (error) {
      console.error('批量上传视频失败:', error)
      throw error
    }
  }

  /**
   * 批量删除文件
   */
  static async deleteFiles(urls: string[]): Promise<boolean> {
    try {
      const deletePromises = urls.map(url => this.deleteFile(url))
      await Promise.all(deletePromises)
      return true
    } catch (error) {
      console.error('批量删除文件失败:', error)
      return false
    }
  }
}
