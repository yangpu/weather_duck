/**
 * 定位错误处理工具
 * 专门处理各种定位相关的错误和异常情况
 */

export interface LocationError {
  code: number
  message: string
  originalError?: GeolocationPositionError
}

export class LocationErrorHandler {
  /**
   * 解析和处理定位错误
   */
  static handleLocationError(error: GeolocationPositionError): LocationError {
    let userFriendlyMessage = ''

    switch (error.code) {
      case error.PERMISSION_DENIED:
        userFriendlyMessage = '定位权限被拒绝，请在浏览器设置中允许访问位置信息'
        break

      case error.POSITION_UNAVAILABLE:
        userFriendlyMessage = '定位服务暂时不可用，请检查网络连接'
        break

      case error.TIMEOUT:
        userFriendlyMessage = '定位请求超时，请检查网络连接和GPS信号'
        break

      default:
        userFriendlyMessage = '定位功能遇到问题，将使用IP定位'
    }

    return {
      code: error.code,
      message: userFriendlyMessage,
      originalError: error
    }
  }

  /**
   * 获取错误的解决建议
   */
  static getErrorSolutions(locationError: LocationError): string[] {
    const solutions: string[] = []

    switch (locationError.code) {
      case 1: // PERMISSION_DENIED
        solutions.push(
          '点击浏览器地址栏的定位图标允许访问',
          '检查浏览器定位权限设置',
          '确保使用HTTPS访问网站'
        )
        break
      case 2: // POSITION_UNAVAILABLE
        solutions.push(
          '检查网络连接',
          '确保GPS/定位服务已开启',
          '尝试刷新页面'
        )
        break
      case 3: // TIMEOUT
        solutions.push(
          '检查网络连接稳定性',
          '确保GPS信号良好',
          '尝试刷新页面'
        )
        break
      default:
        solutions.push(
          '刷新页面重试',
          '检查浏览器是否支持定位API'
        )
    }

    return solutions
  }
}