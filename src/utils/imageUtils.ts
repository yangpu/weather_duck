/**
 * 图片处理工具类
 * 解决iPhone照片上传和预览问题
 */

export interface ImageProcessOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'webp' | 'png'
  maxFileSize?: number // MB
}

export class ImageUtils {
  // 默认配置 - 针对移动端优化
  static readonly DEFAULT_OPTIONS: Required<ImageProcessOptions> = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    format: 'jpeg',
    maxFileSize: 5 // 5MB
  }

  /**
   * 检查文件是否为支持的图片格式
   */
  static isSupportedImageType(file: File): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp',
      'image/heic', // iPhone HEIC格式
      'image/heif'  // iPhone HEIF格式
    ]
    return supportedTypes.includes(file.type.toLowerCase())
  }

  /**
   * 检查文件大小是否超限
   */
  static isFileSizeValid(file: File, maxSizeMB: number = 10): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    return file.size <= maxSizeBytes
  }

  /**
   * 压缩和转换图片
   * 解决iPhone HEIC/HEIF格式问题和大文件问题
   */
  static async processImage(
    file: File, 
    options: ImageProcessOptions = {}
  ): Promise<{ blob: Blob; dataUrl: string; originalSize: number; compressedSize: number }> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    
    return new Promise((resolve, reject) => {
      // 检查文件类型
      if (!this.isSupportedImageType(file)) {
        reject(new Error(`不支持的图片格式: ${file.type}`))
        return
      }

      // 检查文件大小
      if (!this.isFileSizeValid(file, 50)) { // 50MB硬限制
        reject(new Error(`文件过大: ${(file.size / 1024 / 1024).toFixed(2)}MB，最大支持50MB`))
        return
      }

      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            if (!ctx) {
              reject(new Error('无法创建Canvas上下文'))
              return
            }

            // 计算压缩后的尺寸
            const { width, height } = this.calculateDimensions(
              img.width, 
              img.height, 
              opts.maxWidth, 
              opts.maxHeight
            )

            canvas.width = width
            canvas.height = height

            // 设置高质量渲染
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'

            // 绘制图片
            ctx.drawImage(img, 0, 0, width, height)

            // 转换为Blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('图片处理失败'))
                  return
                }

                // 检查压缩后大小
                const compressedSizeMB = blob.size / 1024 / 1024
                if (compressedSizeMB > opts.maxFileSize) {
                  // 如果还是太大，降低质量重新压缩
                  const newQuality = Math.max(0.3, opts.quality * 0.7)
                  canvas.toBlob(
                    (retryBlob) => {
                      if (!retryBlob) {
                        reject(new Error('图片压缩失败'))
                        return
                      }
                      
                      const reader = new FileReader()
                      reader.onload = () => {
                        resolve({
                          blob: retryBlob,
                          dataUrl: reader.result as string,
                          originalSize: file.size,
                          compressedSize: retryBlob.size
                        })
                      }
                      reader.readAsDataURL(retryBlob)
                    },
                    `image/${opts.format}`,
                    newQuality
                  )
                } else {
                  const reader = new FileReader()
                  reader.onload = () => {
                    resolve({
                      blob,
                      dataUrl: reader.result as string,
                      originalSize: file.size,
                      compressedSize: blob.size
                    })
                  }
                  reader.readAsDataURL(blob)
                }
              },
              `image/${opts.format}`,
              opts.quality
            )
          } catch (error) {
            reject(error)
          }
        }

        img.onerror = () => {
          reject(new Error('图片加载失败，可能是格式不支持或文件损坏'))
        }

        // 设置图片源
        if (typeof e.target?.result === 'string') {
          img.src = e.target.result
        } else {
          reject(new Error('文件读取失败'))
        }
      }

      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }

      // 读取文件
      reader.readAsDataURL(file)
    })
  }

  /**
   * 批量处理图片
   */
  static async processImages(
    files: File[], 
    options: ImageProcessOptions = {},
    onProgress?: (index: number, total: number, fileName: string) => void
  ): Promise<Array<{ blob: Blob; dataUrl: string; originalSize: number; compressedSize: number; fileName: string }>> {
    const results = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      onProgress?.(i, files.length, file.name)
      
      try {
        const result = await this.processImage(file, options)
        results.push({
          ...result,
          fileName: file.name
        })
      } catch (error) {
        console.error(`处理图片 ${file.name} 失败:`, error)
        // 继续处理其他图片
      }
    }
    
    return results
  }

  /**
   * 计算压缩后的尺寸
   */
  private static calculateDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxWidth: number, 
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight }

    // 按比例缩放
    if (width > maxWidth) {
      height = (height * maxWidth) / width
      width = maxWidth
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height
      height = maxHeight
    }

    return { 
      width: Math.round(width), 
      height: Math.round(height) 
    }
  }

  /**
   * 创建图片预览缩略图
   */
  static async createThumbnail(
    file: File, 
    size: number = 150
  ): Promise<string> {
    const result = await this.processImage(file, {
      maxWidth: size,
      maxHeight: size,
      quality: 0.7,
      format: 'jpeg'
    })
    return result.dataUrl
  }

  /**
   * 验证图片文件
   */
  static validateImageFile(file: File): { valid: boolean; error?: string } {
    // 检查文件类型
    if (!this.isSupportedImageType(file)) {
      return {
        valid: false,
        error: `不支持的图片格式: ${file.type}。支持的格式: JPEG, PNG, WebP, HEIC, HEIF`
      }
    }

    // 检查文件大小 (50MB限制)
    if (!this.isFileSizeValid(file, 50)) {
      return {
        valid: false,
        error: `文件过大: ${(file.size / 1024 / 1024).toFixed(2)}MB，最大支持50MB`
      }
    }

    return { valid: true }
  }

  /**
   * 获取图片元数据
   */
  static async getImageMetadata(file: File): Promise<{
    width: number
    height: number
    size: number
    type: string
    name: string
  }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          size: file.size,
          type: file.type,
          name: file.name
        })
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('无法读取图片元数据'))
      }
      
      img.src = url
    })
  }
}

/**
 * HEIC/HEIF格式转换工具
 * 针对iPhone照片格式问题
 */
export class HEICConverter {
  /**
   * 检查是否为HEIC/HEIF格式
   */
  static isHEICFormat(file: File): boolean {
    return file.type === 'image/heic' || 
           file.type === 'image/heif' ||
           file.name.toLowerCase().endsWith('.heic') ||
           file.name.toLowerCase().endsWith('.heif')
  }

  /**
   * 转换HEIC/HEIF为JPEG
   * 注意：这需要浏览器支持或使用第三方库
   */
  static async convertToJPEG(file: File): Promise<File> {
    // 如果不是HEIC格式，直接返回
    if (!this.isHEICFormat(file)) {
      return file
    }

    try {
      // 尝试使用ImageUtils处理
      const result = await ImageUtils.processImage(file, {
        format: 'jpeg',
        quality: 0.9
      })

      // 创建新的File对象
      const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
      return new File([result.blob], newFileName, { type: 'image/jpeg' })
    } catch (error) {
      console.error('HEIC转换失败:', error)
      throw new Error('HEIC格式转换失败，请尝试使用其他格式的图片')
    }
  }
}