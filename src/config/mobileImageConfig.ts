/**
 * 移动端图片处理配置
 * 专门针对iPhone和其他移动设备的图片上传优化
 */

export interface MobileImageConfig {
  // 图片尺寸限制
  maxWidth: number
  maxHeight: number
  
  // 文件大小限制
  maxFileSize: number // MB
  
  // 压缩质量
  quality: number
  
  // 支持的格式
  supportedFormats: string[]
  
  // 是否启用HEIC转换
  enableHEICConversion: boolean
  
  // 是否启用自动压缩
  enableAutoCompression: boolean
  
  // 预览缩略图尺寸
  thumbnailSize: number
}

// iPhone优化配置
export const IPHONE_OPTIMIZED_CONFIG: MobileImageConfig = {
  maxWidth: 1920,
  maxHeight: 1080,
  maxFileSize: 10, // 10MB
  quality: 0.85,
  supportedFormats: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic', // iPhone HEIC
    'image/heif'  // iPhone HEIF
  ],
  enableHEICConversion: true,
  enableAutoCompression: true,
  thumbnailSize: 150
}

// 通用移动端配置
export const MOBILE_GENERAL_CONFIG: MobileImageConfig = {
  maxWidth: 1600,
  maxHeight: 900,
  maxFileSize: 8, // 8MB
  quality: 0.8,
  supportedFormats: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ],
  enableHEICConversion: false,
  enableAutoCompression: true,
  thumbnailSize: 120
}

// 高质量配置（适用于专业摄影）
export const HIGH_QUALITY_CONFIG: MobileImageConfig = {
  maxWidth: 3840,
  maxHeight: 2160,
  maxFileSize: 20, // 20MB
  quality: 0.95,
  supportedFormats: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ],
  enableHEICConversion: true,
  enableAutoCompression: false,
  thumbnailSize: 200
}

/**
 * 检测设备类型并返回适合的配置
 */
export function getOptimalImageConfig(): MobileImageConfig {
  const userAgent = navigator.userAgent.toLowerCase()
  
  // 检测iPhone
  if (userAgent.includes('iphone')) {
    return IPHONE_OPTIMIZED_CONFIG
  }
  
  // 检测iPad
  if (userAgent.includes('ipad')) {
    return {
      ...IPHONE_OPTIMIZED_CONFIG,
      maxWidth: 2048,
      maxHeight: 1536
    }
  }
  
  // 检测Android
  if (userAgent.includes('android')) {
    return MOBILE_GENERAL_CONFIG
  }
  
  // 桌面端或其他设备
  return HIGH_QUALITY_CONFIG
}

/**
 * 获取设备特定的文件接受类型
 */
export function getAcceptTypes(): string {
  const config = getOptimalImageConfig()
  const types = [...config.supportedFormats]
  
  // 添加文件扩展名
  const extensions = []
  if (config.enableHEICConversion) {
    extensions.push('.heic', '.heif')
  }
  
  return [...types, ...extensions].join(',')
}

/**
 * 检查当前设备是否支持HEIC格式
 */
export function isHEICSupported(): boolean {
  // 检测iOS版本和浏览器支持
  const userAgent = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent)
  
  // iOS 11+ 的Safari支持HEIC
  if (isIOS && isSafari) {
    const match = userAgent.match(/OS (\d+)_/)
    if (match && parseInt(match[1]) >= 11) {
      return true
    }
  }
  
  return false
}

/**
 * 获取设备相机设置建议
 */
export function getCameraRecommendations(): {
  title: string
  recommendations: string[]
} {
  const userAgent = navigator.userAgent.toLowerCase()
  
  if (userAgent.includes('iphone')) {
    return {
      title: 'iPhone拍照建议',
      recommendations: [
        '在设置 > 相机 > 格式中选择"最兼容"以使用JPEG格式',
        '避免使用"高效"模式（HEIC格式）以获得更好的兼容性',
        '如果照片过大，可以在设置 > 相机中调整照片质量',
        '确保有足够的存储空间以避免压缩过度'
      ]
    }
  }
  
  return {
    title: '拍照建议',
    recommendations: [
      '使用JPEG或PNG格式以获得最佳兼容性',
      '避免过大的图片文件（建议小于10MB）',
      '确保图片清晰度适中，避免过度压缩'
    ]
  }
}

export default {
  IPHONE_OPTIMIZED_CONFIG,
  MOBILE_GENERAL_CONFIG,
  HIGH_QUALITY_CONFIG,
  getOptimalImageConfig,
  getAcceptTypes,
  isHEICSupported,
  getCameraRecommendations
}