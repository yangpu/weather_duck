/**
 * 定位助手工具
 * 提供简洁的定位功能
 */

export interface LocationResult {
  latitude: number
  longitude: number
  source: 'geolocation' | 'ip' | 'default'
  accuracy?: number
  timestamp?: number
}

export class LocationHelper {
  private static readonly DEFAULT_LOCATION = {
    latitude: 22.5429,
    longitude: 114.0596,
    source: 'default' as const
  }

  /**
   * 获取当前位置（多重备选方案）
   */
  static async getCurrentLocation(): Promise<LocationResult> {
    // 方案1: 尝试HTML5 Geolocation API
    try {
      const geoResult = await this.tryGeolocationAPI()
      return geoResult
    } catch (geoError) {
      // GPS定位失败，继续尝试IP定位
    }

    // 方案2: 尝试IP定位
    try {
      const ipResult = await this.tryIPLocation()
      return ipResult
    } catch (ipError) {
      // IP定位失败，使用默认位置
    }

    // 方案3: 使用默认位置
    return this.DEFAULT_LOCATION
  }

  /**
   * 尝试HTML5 Geolocation API
   */
  private static async tryGeolocationAPI(): Promise<LocationResult> {
    return new Promise((resolve, reject) => {
      // 检查浏览器支持
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持定位API'))
        return
      }

      // 检查安全上下文
      const isSecureContext = window.isSecureContext || 
                             location.protocol === 'https:' || 
                             location.hostname === 'localhost' || 
                             location.hostname === '127.0.0.1'

      if (!isSecureContext) {
        reject(new Error('非HTTPS环境，定位API不可用'))
        return
      }

      // 简化的定位选项
      const options: PositionOptions = {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 300000
      }

      const success = (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = position.coords
        
        // 验证坐标有效性
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          reject(new Error('坐标超出有效范围'))
          return
        }

        resolve({
          latitude,
          longitude,
          source: 'geolocation',
          accuracy,
          timestamp: position.timestamp
        })
      }

      const error = (err: GeolocationPositionError) => {
        let message = '定位失败'
        
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = '用户拒绝了定位请求'
            break
          case err.POSITION_UNAVAILABLE:
            message = '位置信息不可用'
            break
          case err.TIMEOUT:
            message = '定位请求超时'
            break
          default:
            message = '定位服务暂时不可用'
        }

        reject(new Error(message))
      }

      navigator.geolocation.getCurrentPosition(success, error, options)
    })
  }

  /**
   * 尝试IP定位（备选方案）
   */
  private static async tryIPLocation(): Promise<LocationResult> {
    const ipServices = [
      {
        url: 'https://ipinfo.io/json',
        parser: (data: any) => {
          if (data.loc) {
            const [lat, lng] = data.loc.split(',').map(parseFloat)
            return { lat, lng }
          }
          return null
        }
      },
      {
        url: 'http://ip-api.com/json/',
        parser: (data: any) => ({ lat: data.lat, lng: data.lon })
      },
      {
        url: 'http://ipapi.co/json/',
        parser: (data: any) => ({ lat: data.latitude, lng: data.longitude })
      }
    ]
    
    for (const service of ipServices) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        
        const response = await fetch(service.url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          continue
        }
        
        const data = await response.json()
        const coords = service.parser(data)
        
        if (coords && coords.lat && coords.lng && 
            coords.lat >= -90 && coords.lat <= 90 && 
            coords.lng >= -180 && coords.lng <= 180) {
          
          return {
            latitude: parseFloat(coords.lat),
            longitude: parseFloat(coords.lng),
            source: 'ip'
          }
        }
        
      } catch (error) {
        // 静默失败，尝试下一个服务
        continue
      }
    }
    
    throw new Error('所有IP定位服务都不可用')
  }

  /**
   * 检查定位功能可用性
   */
  static async checkLocationAvailability(): Promise<{
    geolocationSupported: boolean
    secureContext: boolean
    permissionStatus?: string
  }> {
    const result = {
      geolocationSupported: !!navigator.geolocation,
      secureContext: window.isSecureContext || 
                    location.protocol === 'https:' || 
                    location.hostname === 'localhost' || 
                    location.hostname === '127.0.0.1',
      permissionStatus: undefined as string | undefined
    }

    if (result.geolocationSupported && 'permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' })
        result.permissionStatus = permission.state
      } catch (error) {
        // 静默处理权限查询失败
      }
    }

    return result
  }

  /**
   * 格式化位置信息用于显示
   */
  static formatLocationInfo(location: LocationResult): string {
    const sourceText = {
      geolocation: 'GPS定位',
      ip: 'IP定位',
      default: '默认位置'
    }

    let info = `${sourceText[location.source]} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`
    
    if (location.accuracy) {
      info += ` ±${Math.round(location.accuracy)}m`
    }

    return info
  }
}