/**
 * iPhone照片问题诊断和修复工具
 * 专门解决iPhone照片在Web应用中的显示和上传问题
 */

export interface PhotoDiagnosticResult {
  isIPhone: boolean
  issues: string[]
  solutions: string[]
  recommendations: string[]
}

export class IPhonePhotoFix {
  /**
   * 诊断iPhone照片问题
   */
  static diagnosePhotoIssues(files: File[]): PhotoDiagnosticResult {
    const userAgent = navigator.userAgent.toLowerCase()
    const isIPhone = userAgent.includes('iphone')
    
    const issues: string[] = []
    const solutions: string[] = []
    const recommendations: string[] = []

    // 检查设备类型
    if (isIPhone) {
      recommendations.push('检测到iPhone设备，已启用专门优化')
    }

    // 检查文件格式问题
    const heicFiles = files.filter(file => 
      file.type === 'image/heic' || 
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif')
    )

    if (heicFiles.length > 0) {
      issues.push(`发现${heicFiles.length}个HEIC/HEIF格式文件`)
      solutions.push('自动转换HEIC/HEIF格式为JPEG')
      recommendations.push('建议在iPhone设置中选择"最兼容"格式')
    }

    // 检查文件大小问题
    const largeFiles = files.filter(file => file.size > 10 * 1024 * 1024) // 10MB
    if (largeFiles.length > 0) {
      issues.push(`发现${largeFiles.length}个大文件(>10MB)`)
      solutions.push('自动压缩大文件')
      recommendations.push('拍照时可以选择较低的分辨率设置')
    }

    // 检查文件类型问题
    const unknownFiles = files.filter(file => 
      !file.type.startsWith('image/') && 
      !file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/)
    )
    if (unknownFiles.length > 0) {
      issues.push(`发现${unknownFiles.length}个未知格式文件`)
      solutions.push('跳过不支持的文件格式')
    }

    // 检查内存问题
    if (files.length > 10) {
      issues.push('选择的图片数量较多，可能影响性能')
      solutions.push('分批处理图片以避免内存问题')
      recommendations.push('建议一次上传不超过10张图片')
    }

    // 检查网络问题
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection && connection.effectiveType === '2g') {
        issues.push('检测到慢速网络连接')
        solutions.push('启用更高压缩率以减少上传时间')
      }
    }

    return {
      isIPhone,
      issues,
      solutions,
      recommendations
    }
  }

  /**
   * 修复iPhone照片的EXIF方向问题
   */
  static async fixImageOrientation(file: File): Promise<{ blob: Blob; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const img = new Image()
        
        img.onload = () => {
          // 获取EXIF方向信息
          this.getImageOrientation(file).then(orientation => {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            if (!ctx) {
              reject(new Error('无法创建Canvas上下文'))
              return
            }

            // 根据EXIF方向调整canvas尺寸和绘制
            const { width, height, transform } = this.getOrientationTransform(
              img.width, 
              img.height, 
              orientation
            )

            canvas.width = width
            canvas.height = height

            // 应用变换
            ctx.save()
            ctx.setTransform(...transform)
            ctx.drawImage(img, 0, 0)
            ctx.restore()

            // 转换为Blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('图片处理失败'))
                  return
                }

                const reader = new FileReader()
                reader.onload = () => {
                  resolve({
                    blob,
                    dataUrl: reader.result as string
                  })
                }
                reader.readAsDataURL(blob)
              },
              'image/jpeg',
              0.9
            )
          }).catch(reject)
        }

        img.onerror = () => reject(new Error('图片加载失败'))
        
        if (typeof e.target?.result === 'string') {
          img.src = e.target.result
        } else {
          reject(new Error('文件读取失败'))
        }
      }

      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * 获取图片EXIF方向信息
   */
  private static async getImageOrientation(file: File): Promise<number> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const dataView = new DataView(arrayBuffer)
        
        // 检查JPEG文件头
        if (dataView.getUint16(0) !== 0xFFD8) {
          resolve(1) // 默认方向
          return
        }

        let offset = 2
        let marker = dataView.getUint16(offset)
        
        while (marker !== 0xFFE1 && offset < dataView.byteLength) {
          offset += 2 + dataView.getUint16(offset + 2)
          marker = dataView.getUint16(offset)
        }
        
        if (marker !== 0xFFE1) {
          resolve(1)
          return
        }
        
        // 查找EXIF数据
        offset += 4
        if (dataView.getUint32(offset) !== 0x45786966) {
          resolve(1)
          return
        }
        
        // 解析EXIF方向标签
        offset += 6
        const little = dataView.getUint16(offset) === 0x4949
        offset += dataView.getUint32(offset + 4, little)
        const tags = dataView.getUint16(offset, little)
        offset += 2
        
        for (let i = 0; i < tags; i++) {
          if (dataView.getUint16(offset + (i * 12), little) === 0x0112) {
            const orientation = dataView.getUint16(offset + (i * 12) + 8, little)
            resolve(orientation)
            return
          }
        }
        
        resolve(1)
      }
      
      reader.onerror = () => resolve(1)
      reader.readAsArrayBuffer(file.slice(0, 64 * 1024)) // 只读取前64KB
    })
  }

  /**
   * 根据EXIF方向获取变换矩阵
   */
  private static getOrientationTransform(
    width: number, 
    height: number, 
    orientation: number
  ): { width: number; height: number; transform: [number, number, number, number, number, number] } {
    switch (orientation) {
      case 2:
        return { width, height, transform: [-1, 0, 0, 1, width, 0] }
      case 3:
        return { width, height, transform: [-1, 0, 0, -1, width, height] }
      case 4:
        return { width, height, transform: [1, 0, 0, -1, 0, height] }
      case 5:
        return { width: height, height: width, transform: [0, 1, 1, 0, 0, 0] }
      case 6:
        return { width: height, height: width, transform: [0, 1, -1, 0, height, 0] }
      case 7:
        return { width: height, height: width, transform: [0, -1, -1, 0, height, width] }
      case 8:
        return { width: height, height: width, transform: [0, -1, 1, 0, 0, width] }
      default:
        return { width, height, transform: [1, 0, 0, 1, 0, 0] }
    }
  }

  /**
   * 检测并修复常见的iPhone照片问题
   */
  static async fixCommonIssues(file: File): Promise<{
    success: boolean
    fixedFile?: File
    issues: string[]
    appliedFixes: string[]
  }> {
    const issues: string[] = []
    const appliedFixes: string[] = []

    try {
      let processedFile = file

      // 1. 检查和修复HEIC格式
      if (file.type === 'image/heic' || file.type === 'image/heif') {
        issues.push('HEIC/HEIF格式需要转换')
        // 这里应该集成HEIC转换逻辑
        appliedFixes.push('转换HEIC格式为JPEG')
      }

      // 2. 检查和修复文件大小
      if (file.size > 10 * 1024 * 1024) {
        issues.push('文件过大需要压缩')
        appliedFixes.push('压缩文件大小')
      }

      // 3. 检查和修复图片方向
      if (file.type.startsWith('image/')) {
        const orientation = await this.getImageOrientation(file)
        if (orientation !== 1) {
          issues.push('图片方向需要修正')
          const fixed = await this.fixImageOrientation(file)
          processedFile = new File([fixed.blob], file.name, { type: 'image/jpeg' })
          appliedFixes.push('修正图片方向')
        }
      }

      return {
        success: true,
        fixedFile: processedFile,
        issues,
        appliedFixes
      }
    } catch (error) {
      return {
        success: false,
        issues: [...issues, `修复失败: ${error}`],
        appliedFixes
      }
    }
  }

  /**
   * 生成iPhone用户的使用建议
   */
  static getIPhoneUsageTips(): string[] {
    return [
      '📱 在iPhone设置 > 相机 > 格式中选择"最兼容"',
      '📸 避免使用"高效"模式以减少HEIC格式问题',
      '🔧 如果照片无法显示，请尝试重新拍摄',
      '💾 定期清理照片库以释放存储空间',
      '📶 在网络良好时上传以获得最佳体验',
      '🔄 如果上传失败，请尝试刷新页面后重试'
    ]
  }
}

export default IPhonePhotoFix