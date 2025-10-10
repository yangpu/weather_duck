import axios from 'axios'
import { WeatherApiResponse, WeatherData } from '../types/weather'

// 使用免费的Open-Meteo API
const ARCHIVE_API_URL = 'https://archive-api.open-meteo.com/v1/archive'
const FORECAST_API_URL = 'https://api.open-meteo.com/v1/forecast'

// 天气代码对应的描述和图标 - 完整的 Open-Meteo API 天气代码映射
const weatherCodes: Record<number, { description: string; icon: string }> = {
  // 晴朗天气
  0: { description: '晴天', icon: '☀️' },
  
  // 多云天气
  1: { description: '晴间多云', icon: '🌤️' },
  2: { description: '多云', icon: '⛅' },
  3: { description: '阴天', icon: '☁️' },
  
  // 雾天
  45: { description: '雾', icon: '🌫️' },
  48: { description: '雾凇', icon: '🌫️' },
  
  // 毛毛雨
  51: { description: '小毛毛雨', icon: '🌦️' },
  53: { description: '中毛毛雨', icon: '🌦️' },
  55: { description: '大毛毛雨', icon: '🌧️' },
  
  // 冻毛毛雨
  56: { description: '轻度冻毛毛雨', icon: '🌨️' },
  57: { description: '重度冻毛毛雨', icon: '🌨️' },
  
  // 降雨
  61: { description: '小雨', icon: '🌦️' },
  63: { description: '中雨', icon: '🌧️' },
  65: { description: '大雨', icon: '🌧️' },
  
  // 冻雨
  66: { description: '轻度冻雨', icon: '🌨️' },
  67: { description: '重度冻雨', icon: '🌨️' },
  
  // 降雪
  71: { description: '小雪', icon: '🌨️' },
  73: { description: '中雪', icon: '❄️' },
  75: { description: '大雪', icon: '❄️' },
  
  // 雪粒
  77: { description: '雪粒', icon: '🌨️' },
  
  // 阵雨
  80: { description: '小阵雨', icon: '🌦️' },
  81: { description: '中阵雨', icon: '🌧️' },
  82: { description: '大阵雨', icon: '🌧️' },
  
  // 阵雪
  85: { description: '小阵雪', icon: '🌨️' },
  86: { description: '大阵雪', icon: '❄️' },
  
  // 雷暴
  95: { description: '雷雨', icon: '⛈️' },
  
  // 雷暴伴冰雹
  96: { description: '雷阵雨伴小冰雹', icon: '⛈️' },
  99: { description: '雷阵雨伴大冰雹', icon: '⛈️' }
}

export class WeatherApiService {
  // 通用的API请求方法，带重试机制
  private static async makeApiRequest<T>(
    url: string,
    params: Record<string, any>,
    maxRetries: number = 3
  ): Promise<T> {
    // 离线快速失败
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {

      throw new Error('网络不可用，请检查连接后重试')
    }

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const shouldRetry = (err: any): boolean => {
      const code = err?.code
      const msg = String(err?.message || '')
      const status = err?.response?.status
      if (code === 'ERR_NETWORK') return true
      if (/Network Error|ERR_NETWORK_CHANGED/i.test(msg)) return true
      if (status === 429 || (status >= 500 && status < 600)) return true
      return false
    }

    let lastError: any = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get<T>(url, {
          params,
          timeout: 10000
        })
        return response.data
      } catch (error: any) {
        lastError = error
        if (attempt < maxRetries && shouldRetry(error)) {
          const base = 500
          const wait = base * Math.pow(2, attempt) + Math.floor(Math.random() * 300)
          console.warn(`API请求失败，准备重试(${attempt + 1}/${maxRetries})，等待 ${wait}ms`, error)
          await sleep(wait)
          continue
        }
        break
      }
    }

    // 详细记录错误信息
    const errorDetails = {
      url,
      params,
      status: lastError?.response?.status,
      statusText: lastError?.response?.statusText,
      responseData: lastError?.response?.data,
      message: lastError?.message,
      code: lastError?.code
    }
    
    console.error(`API请求最终失败:`, errorDetails)
    
    // 构造详细的错误信息
    let errorMessage = '请求失败，请稍后重试'
    if (lastError?.response?.data?.reason) {
      errorMessage = `API错误: ${lastError.response.data.reason}`
    } else if (lastError?.response?.data?.error) {
      errorMessage = `API错误: ${JSON.stringify(lastError.response.data)}`
    } else if (shouldRetry(lastError)) {
      errorMessage = '网络波动，请求失败，请稍后重试'
    }
    
    throw new Error(errorMessage)
  }

  // 获取历史天气数据（archive接口）
  private static async getArchiveWeather(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string
  ): Promise<{ data: WeatherData[]; missingDates: string[] }> {
    try {
      const response = await this.makeApiRequest<WeatherApiResponse>(ARCHIVE_API_URL, {
        latitude,
        longitude,
        start_date: startDate,
        end_date: endDate,
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,winddirection_10m_dominant,cloudcover_mean,weathercode',
        timezone: 'Asia/Shanghai'
      })

      const daily = response?.daily
      if (!daily || !Array.isArray(daily.time)) {
        throw new Error('天气数据格式异常')
      }

      const result: WeatherData[] = []
      const missingDates: string[] = []
      const expectedDates = this.generateDateRange(startDate, endDate)
      
      // 创建实际返回数据的映射
      const actualDataMap = new Map<string, number>()
      daily.time.forEach((date, index) => {
        actualDataMap.set(date, index)
      })

      // 检查每个期望日期的数据
      expectedDates.forEach(date => {
        const index = actualDataMap.get(date)
        
        if (index === undefined) {
          // 完全缺失的日期
          missingDates.push(date)
          return
        }

        const tmax = daily.temperature_2m_max?.[index]
        const tmin = daily.temperature_2m_min?.[index]
        const precip = daily.precipitation_sum?.[index] ?? 0
        const windSpeed = daily.windspeed_10m_max?.[index] ?? 0
        const windDirDeg = daily.winddirection_10m_dominant?.[index]
        const cloud = daily.cloudcover_mean?.[index] ?? 0
        const wcode = daily.weathercode?.[index] ?? 0

        // 检查关键数据是否缺失
        const hasValidTemp = typeof tmax === 'number' && typeof tmin === 'number' && 
                            !isNaN(tmax) && !isNaN(tmin)
        
        if (!hasValidTemp) {
          // 温度数据缺失，标记为需要补缺
          missingDates.push(date)
          return
        }

        // 数据完整，添加到结果中
        const info = weatherCodes[wcode]
        if (!info) {
          console.warn(`未知天气代码: ${wcode} (日期: ${date})`)
        }
        const weatherInfo = info || { description: '未知', icon: '❓' }
        const windDirection = typeof windDirDeg === 'number' ? this.getWindDirection(windDirDeg) : '不详'

        result.push({
          date,
          temperature: {
            min: Math.round(tmin),
            max: Math.round(tmax),
            current: Math.round((tmin + tmax) / 2)
          },
          humidity: 60,
          windSpeed: Math.round(windSpeed),
          windDirection,
          precipitation: Math.round(precip * 100) / 100,
          cloudCover: Math.round(cloud),
          description: weatherInfo.description,
          icon: weatherInfo.icon
        })
      })

      return { data: result, missingDates }
    } catch (error) {
      console.warn('Archive API请求失败:', error)
      // 如果archive完全失败，所有日期都需要通过forecast补缺
      const allDates = this.generateDateRange(startDate, endDate)
      return { data: [], missingDates: allDates }
    }
  }

  // 获取预报天气数据（forecast接口）
  private static async getForecastWeather(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string
  ): Promise<WeatherData[]> {
    const today = new Date().toISOString().slice(0, 10)
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)
    const todayObj = new Date(today)
    
    // 计算需要的预报天数和过去天数
    let forecastDays = 16 // 获取最大天数以确保覆盖所需范围
    let pastDays = 0
    
    // 如果开始日期在今天之前，需要使用past_days参数
    if (startDateObj < todayObj) {
      pastDays = Math.ceil((todayObj.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000))
      pastDays = Math.min(pastDays, 92) // past_days最多92天
    }
    
    // 计算实际需要的forecast_days
    // Open-Meteo的forecast API从今天开始计算，包含今天
    const maxRequestDate = endDateObj > startDateObj ? endDateObj : startDateObj
    
    if (maxRequestDate > todayObj) {
      const daysFromToday = Math.ceil((maxRequestDate.getTime() - todayObj.getTime()) / (24 * 60 * 60 * 1000))
      // 需要包含今天，所以是daysFromToday + 1
      forecastDays = Math.min(Math.max(daysFromToday + 1, 1), 16)

    }
    
    // 特别处理：如果请求的都是未来日期，确保forecast_days足够
    if (startDateObj > todayObj) {
      const startDaysFromToday = Math.ceil((startDateObj.getTime() - todayObj.getTime()) / (24 * 60 * 60 * 1000))
      const endDaysFromToday = Math.ceil((endDateObj.getTime() - todayObj.getTime()) / (24 * 60 * 60 * 1000))
      // 需要获取到结束日期，所以至少需要endDaysFromToday + 1天的数据
      forecastDays = Math.min(Math.max(endDaysFromToday + 1, startDaysFromToday + 1), 16)

    }

    // 构建API参数 - 不能同时使用start_date/end_date和forecast_days/past_days
    const params: any = {
      latitude,
      longitude,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,winddirection_10m_dominant,cloudcover_mean,weathercode',
      timezone: 'Asia/Shanghai'
    }
    
    // 只使用forecast_days和past_days参数，不使用start_date/end_date
    if (pastDays > 0) {
      params.past_days = pastDays
    }
    params.forecast_days = forecastDays


    const response = await this.makeApiRequest<WeatherApiResponse>(FORECAST_API_URL, params)

    const daily = response?.daily
    if (!daily || !Array.isArray(daily.time)) {
      throw new Error('预报数据格式异常')
    }



    const result: WeatherData[] = []
    
    // 检查是否有请求范围内的数据
    const availableDatesInRange = daily.time.filter(date => date >= startDate && date <= endDate)

    
    if (availableDatesInRange.length === 0) {
      console.warn(`警告: Forecast API没有返回请求范围 ${startDate} 到 ${endDate} 内的任何数据`)
      console.warn(`API返回的日期范围: ${daily.time[0]} 到 ${daily.time[daily.time.length - 1]}`)
    }
    
    daily.time.forEach((date, index) => {
      // 只处理在请求日期范围内的数据
      if (date < startDate || date > endDate) {

        return
      }

      const tmax = daily.temperature_2m_max?.[index]
      const tmin = daily.temperature_2m_min?.[index]
      const precip = daily.precipitation_sum?.[index] ?? 0
      const windSpeed = daily.windspeed_10m_max?.[index] ?? 0
      const windDirDeg = daily.winddirection_10m_dominant?.[index]
      const cloud = daily.cloudcover_mean?.[index] ?? 0
      const wcode = daily.weathercode?.[index] ?? 0

      const hasValidTemp = typeof tmax === 'number' && typeof tmin === 'number' && 
                          !isNaN(tmax) && !isNaN(tmin)
      
      if (!hasValidTemp) {
        console.warn(`Forecast数据中日期 ${date} 缺少有效温度数据`)
        return
      }



      const info = weatherCodes[wcode]
      if (!info) {
        console.warn(`未知天气代码: ${wcode} (日期: ${date})`)
      }
      const weatherInfo = info || { description: '未知', icon: '❓' }
      const windDirection = typeof windDirDeg === 'number' ? this.getWindDirection(windDirDeg) : '不详'

      result.push({
        date,
        temperature: {
          min: Math.round(tmin),
          max: Math.round(tmax),
          current: Math.round((tmin + tmax) / 2)
        },
        humidity: 60,
        windSpeed: Math.round(windSpeed),
        windDirection,
        precipitation: Math.round(precip * 100) / 100,
        cloudCover: Math.round(cloud),
        description: weatherInfo.description,
        icon: weatherInfo.icon
      })
    })


    return result
  }

  // 智能获取天气数据 - 主要入口方法
  static async getHistoricalWeather(
    latitude: number = 22.5429,
    longitude: number = 114.0596,
    startDate: string,
    endDate: string
  ): Promise<WeatherData[]> {

    
    const archiveMaxDate = '2025-09-09' // Archive API的最大支持日期
    
    try {
      let archiveData: WeatherData[] = []
      let missingDates: string[] = []
      
      // 1. 判断是否需要调用archive接口
      if (startDate <= archiveMaxDate) {
        // 只对archive支持的日期范围调用archive接口
        const archiveEndDate = endDate <= archiveMaxDate ? endDate : archiveMaxDate
        

        const archiveResult = await this.getArchiveWeather(
          latitude, longitude, startDate, archiveEndDate
        )
        archiveData = archiveResult.data
        missingDates = archiveResult.missingDates
        

      }
      
      // 2. 处理超出archive范围的日期（未来日期）
      const futureStartDate = new Date(archiveMaxDate)
      futureStartDate.setDate(futureStartDate.getDate() + 1)
      const futureStartDateStr = futureStartDate.toISOString().slice(0, 10)
      
      if (endDate > archiveMaxDate) {
        const futureEndDate = endDate
        const futureDateRange = this.generateDateRange(
          startDate > futureStartDateStr ? startDate : futureStartDateStr,
          futureEndDate
        )
        

        missingDates.push(...futureDateRange)
      }
      
      // 3. 如果有缺失日期，通过forecast接口补缺
      let forecastData: WeatherData[] = []
      if (missingDates.length > 0) {

        
        // 将连续的缺失日期分组，减少API调用次数
        const dateRanges = this.groupConsecutiveDates(missingDates)
        
        for (const range of dateRanges) {
          try {
            const rangeData = await this.getForecastWeather(
              latitude, longitude, range.start, range.end
            )
            forecastData.push(...rangeData)

          } catch (error) {
            console.warn(`补缺日期范围 ${range.start} 到 ${range.end} 失败:`, error)
          }
        }
      }
      
      // 4. 合并数据并生成完整结果
      const allData = [...archiveData, ...forecastData]
      const completeData = this.generateCompleteWeatherData(startDate, endDate, allData)
      

      return completeData
      
    } catch (error) {
      console.error('获取天气数据失败:', error)
      // 即使完全失败，也返回占位数据
      return this.generateCompleteWeatherData(startDate, endDate, [])
    }
  }

  // 获取实时天气（用于今天的补充信息）
  static async getCurrentWeather(
    latitude: number = 22.5429,
    longitude: number = 114.0596
  ): Promise<Partial<WeatherData> | null> {
    try {
      const response = await this.makeApiRequest<any>(FORECAST_API_URL, {
        latitude,
        longitude,
        current_weather: true,
        timezone: 'Asia/Shanghai'
      })
      
      const cw = response?.current_weather
      if (!cw) return null
      
      const info = weatherCodes[cw.weathercode]
      if (!info) {
        console.warn(`未知天气代码: ${cw.weathercode} (实时天气)`)
      }
      const weatherInfo = info || { description: '未知', icon: '❓' }
      return {
        date: String(cw.time).slice(0, 10),
        temperature: { current: Math.round(cw.temperature), min: 0, max: 0 },
        windSpeed: Math.round(cw.windspeed),
        windDirection: this.getWindDirection(cw.winddirection),
        description: weatherInfo.description,
        icon: weatherInfo.icon
      }
    } catch (e) {
      console.warn('实时天气获取失败', e)
      return null
    }
  }

  // 获取最近几天的完整天气数据（包括今天和未来几天）
  static async getRecentWeather(
    latitude: number = 22.5429,
    longitude: number = 114.0596,
    days: number = 7
  ): Promise<WeatherData[]> {
    const today = new Date().toISOString().slice(0, 10)
    const endDate = new Date(Date.now() + (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    
    return this.getForecastWeather(latitude, longitude, today, endDate)
  }

  // 增强版获取天气数据 - 主要保持向后兼容
  static async getEnhancedWeatherData(
    latitude: number = 22.5429,
    longitude: number = 114.0596,
    startDate: string,
    endDate: string
  ): Promise<WeatherData[]> {
    // 直接使用优化后的主方法
    return this.getHistoricalWeather(latitude, longitude, startDate, endDate)
  }

  // 工具方法：生成日期范围
  private static generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10))
    }
    
    return dates
  }

  // 工具方法：将连续日期分组以减少API调用
  private static groupConsecutiveDates(dates: string[]): { start: string; end: string }[] {
    if (dates.length === 0) return []
    
    const sortedDates = [...dates].sort()
    const groups: { start: string; end: string }[] = []
    let currentStart = sortedDates[0]
    let currentEnd = sortedDates[0]
    
    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i])
      const expectedDate = new Date(currentEnd)
      expectedDate.setDate(expectedDate.getDate() + 1)
      
      if (currentDate.getTime() === expectedDate.getTime()) {
        // 连续日期，扩展当前组
        currentEnd = sortedDates[i]
      } else {
        // 不连续，保存当前组并开始新组
        groups.push({ start: currentStart, end: currentEnd })
        currentStart = sortedDates[i]
        currentEnd = sortedDates[i]
      }
    }
    
    // 添加最后一组
    groups.push({ start: currentStart, end: currentEnd })
    
    return groups
  }

  // 工具方法：生成完整的天气数据，包含占位数据
  private static generateCompleteWeatherData(
    startDate: string,
    endDate: string,
    availableData: WeatherData[]
  ): WeatherData[] {
    const result: WeatherData[] = []
    const dataMap = new Map<string, WeatherData>()
    const today = new Date().toISOString().slice(0, 10)
    
    // 创建可用数据的映射
    availableData.forEach(item => {
      dataMap.set(item.date, item)
    })
    
    // 生成完整日期范围
    const allDates = this.generateDateRange(startDate, endDate)
    
    allDates.forEach(date => {
      if (dataMap.has(date)) {
        result.push(dataMap.get(date)!)
      } else {
        // 生成占位数据
        result.push(this.generatePlaceholderWeatherData(date, today))
      }
    })
    
    return result.sort((a, b) => a.date.localeCompare(b.date))
  }

  // 生成占位天气数据
  private static generatePlaceholderWeatherData(date: string, today: string): WeatherData {
    const isPast = date < today
    const isToday = date === today
    const isFuture = date > today
    
    let description = '数据缺失'
    if (isPast) {
      description = '历史数据缺失'
    } else if (isToday) {
      description = '实时数据缺失'
    } else if (isFuture) {
      description = '预报数据缺失'
    }
    
    return {
      date,
      temperature: { min: 0, max: 0, current: 0 },
      humidity: 0,
      windSpeed: 0,
      windDirection: '未知',
      precipitation: 0,
      cloudCover: 0,
      description,
      icon: '❓',
      isPlaceholder: true
    }
  }



  // 根据角度计算风向
  private static getWindDirection(angle: number): string {
    if (angle >= 337.5 || angle < 22.5) return '北风'
    if (angle >= 22.5 && angle < 67.5) return '东北风'
    if (angle >= 67.5 && angle < 112.5) return '东风'
    if (angle >= 112.5 && angle < 157.5) return '东南风'
    if (angle >= 157.5 && angle < 202.5) return '南风'
    if (angle >= 202.5 && angle < 247.5) return '西南风'
    if (angle >= 247.5 && angle < 292.5) return '西风'
    if (angle >= 292.5 && angle < 337.5) return '西北风'
    return '北风'
  }

  // 获取当前位置（使用增强的LocationHelper）
  static async getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
    try {
      // 动态导入LocationHelper以避免循环依赖
      const { LocationHelper } = await import('../utils/locationHelper')
      
      // 获取位置信息
      const locationResult = await LocationHelper.getCurrentLocation()
      
      return {
        latitude: locationResult.latitude,
        longitude: locationResult.longitude
      }
    } catch (error) {
      // 最后的兜底方案：直接返回深圳坐标
      const defaultLocation = { latitude: 22.5429, longitude: 114.0596 }
      
      return defaultLocation
    }
  }
}
