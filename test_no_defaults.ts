// 测试修改后的天气API - 不使用默认值
import { WeatherApiService } from './src/services/weatherApi'
import type { WeatherData } from './src/types/weather'

async function testNoDefaultsAPI(): Promise<void> {
  console.log('🧪 测试无默认值的天气API...')
  
  // 测试占位数据生成
  const testDate = '2024-01-15'
  const today = new Date().toISOString().slice(0, 10)
  
  // 模拟生成占位数据
  const placeholderData: WeatherData = {
    date: testDate,
    temperature: { min: 0, max: 0, current: 0 },
    humidity: 0,
    windSpeed: 0,
    windDirection: '未知',
    precipitation: 0,
    cloudCover: 0,
    description: testDate < today ? '历史数据缺失' : '预报数据缺失',
    icon: '❓',
    isPlaceholder: true
  }
  
  console.log('📊 占位数据示例:')
  console.log(`日期: ${placeholderData.date}`)
  console.log(`图标: ${placeholderData.icon}`)
  console.log(`描述: ${placeholderData.description}`)
  console.log(`温度: ${placeholderData.temperature.current}°C (min: ${placeholderData.temperature.min}°, max: ${placeholderData.temperature.max}°)`)
  console.log(`湿度: ${placeholderData.humidity}%`)
  console.log(`风速: ${placeholderData.windSpeed}km/h`)
  console.log(`降雨: ${placeholderData.precipitation}mm`)
  
  console.log('\n✅ 特点:')
  console.log('- 统一使用❓图标')
  console.log('- 数值字段为0，不提供估算值')
  console.log('- 简洁的缺失描述')
  console.log('- 无视觉区分，保持界面一致性')
}

// 如果在Node.js环境中运行
if (typeof window === 'undefined') {
  testNoDefaultsAPI()
}

export { testNoDefaultsAPI }