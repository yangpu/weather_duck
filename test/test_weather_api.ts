// 测试天气API的完整性和占位数据生成
import { WeatherApiService } from '../src/services/weatherApi'
import type { WeatherData } from '../src/types/weather'

async function testWeatherAPI(): Promise<void> {
  console.log('🧪 开始测试天气API...')
  
  // 测试1: 获取包含今天的日期范围
  const today = new Date().toISOString().slice(0, 10)
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const endDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  
  console.log(`📅 测试日期范围: ${startDate} 到 ${endDate}`)
  
  try {
    const weatherData: WeatherData[] = await WeatherApiService.getEnhancedWeatherData(
      22.5429, // 深圳坐标
      114.0596,
      startDate,
      endDate
    )
    
    console.log(`✅ 获取到 ${weatherData.length} 天的天气数据`)
    
    // 检查数据完整性
    const expectedDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1
    console.log(`📊 预期天数: ${expectedDays}, 实际天数: ${weatherData.length}`)
    
    if (weatherData.length === expectedDays) {
      console.log('✅ 数据完整性检查通过')
    } else {
      console.log('❌ 数据不完整')
    }
    
    // 检查占位数据
    const placeholderCount = weatherData.filter(w => w.isPlaceholder).length
    console.log(`📊 占位数据数量: ${placeholderCount}`)
    
    // 显示每天的数据状态
    weatherData.forEach(weather => {
      const status = weather.isPlaceholder ? '🔄 占位' : '✅ 真实'
      console.log(`${weather.date}: ${status} - ${weather.description} (${weather.temperature.current}°C)`)
    })
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

// 如果在Node.js环境中运行
if (typeof window === 'undefined') {
  testWeatherAPI()
}

export { testWeatherAPI }