<template>
  <div class="weather-app">
    <div class="app-header">
      <h1>天气日记应用</h1>
      <p>当前显示: {{ formatDateRange(currentStartDate, currentEndDate) }}</p>
    </div>

    <!-- LoadNextCard 放在列表前面 -->
    <LoadNextCard
      :loading="loadingNext"
      :current-end-date="currentEndDate"
      @load-next="handleLoadNext"
    />
    
    <!-- 天气卡片列表 -->
    <div class="weather-cards" v-if="weatherList.length > 0">
      <WeatherCard 
        v-for="weather in weatherList" 
        :key="weather.date"
        :weather="weather"
        @click="handleWeatherCardClick"
      />
    </div>
    
    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <t-icon name="cloud" size="48" />
      <p>暂无天气数据</p>
      <p>点击上方按钮加载数据</p>
    </div>
    
    <!-- LoadPreviousCard 放在列表后面 -->
    <LoadPreviousCard
      :loading="loadingPrevious"
      :current-start-date="currentStartDate"
      @load-previous="handleLoadPrevious"
    />

    <!-- 加载统计信息 -->
    <div class="load-stats" v-if="loadStats.totalLoads > 0">
      <t-card class="stats-card">
        <h3>加载统计</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">总加载次数:</span>
            <span class="stat-value">{{ loadStats.totalLoads }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">历史数据:</span>
            <span class="stat-value">{{ loadStats.historicalLoads }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">预测数据:</span>
            <span class="stat-value">{{ loadStats.forecastLoads }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">日记条数:</span>
            <span class="stat-value">{{ loadStats.diaryCount }}</span>
          </div>
        </div>
      </t-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import LoadNextCard from '../components/LoadNextCard.vue'
import LoadPreviousCard from '../components/LoadPreviousCard.vue'
import WeatherCard from '../components/WeatherCard.vue'
import { DateUtils } from '../utils/dateUtils'
import type { WeatherData } from '../types/weather'

// 状态管理
const loadingNext = ref(false)
const loadingPrevious = ref(false)
const currentStartDate = ref('2024-01-15')
const currentEndDate = ref('2024-01-21')
const weatherList = ref<WeatherData[]>([])

// 加载统计
const loadStats = ref({
  totalLoads: 0,
  historicalLoads: 0,
  forecastLoads: 0,
  diaryCount: 0
})

// 格式化日期范围显示
function formatDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) return '未设置'
  const start = DateUtils.formatDate(startDate)
  const end = DateUtils.formatDate(endDate)
  return `${start} 至 ${end}`
}

// 模拟天气数据生成
function generateMockWeatherData(startDate: string, endDate: string, isForecast = false): WeatherData[] {
  const data: WeatherData[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  let current = new Date(start)
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10)
    
    data.push({
      date: dateStr,
      temperature: {
        current: Math.round(Math.random() * 20 + 10),
        min: Math.round(Math.random() * 10 + 5),
        max: Math.round(Math.random() * 10 + 20)
      },
      description: isForecast ? '预测晴天' : '多云',
      icon: isForecast ? '🌤️' : '☁️',
      precipitation: Math.round(Math.random() * 10),
      cloudCover: Math.round(Math.random() * 100),
      windDirection: '东南风',
      windSpeed: Math.round(Math.random() * 20 + 5),
      humidity: Math.round(Math.random() * 40 + 40),
      pressure: Math.round(Math.random() * 50 + 1000)
    })
    
    current.setDate(current.getDate() + 1)
  }
  
  return data
}

// 模拟API延迟
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 处理加载后7天数据
async function handleLoadNext(startDate: string, endDate: string, isForecast: boolean) {
  loadingNext.value = true
  
  try {
    console.log(`🔄 开始加载后7天数据: ${startDate} 至 ${endDate} (预测: ${isForecast})`)
    
    // 模拟API请求延迟
    await delay(1500)
    
    // 生成模拟数据
    const newWeatherData = generateMockWeatherData(startDate, endDate, isForecast)
    
    // 模拟日记数据
    const mockDiaryCount = Math.floor(Math.random() * 5) + 1
    
    // 添加到现有数据
    weatherList.value.push(...newWeatherData)
    
    // 更新统计
    loadStats.value.totalLoads++
    if (isForecast) {
      loadStats.value.forecastLoads++
    } else {
      loadStats.value.historicalLoads++
    }
    loadStats.value.diaryCount += mockDiaryCount
    
    // 更新当前结束日期
    currentEndDate.value = endDate
    
    const dataType = isForecast ? '预测' : '历史'
    console.log(`✅ 成功加载后7天${dataType}数据: ${newWeatherData.length} 条天气数据, ${mockDiaryCount} 条日记`)
    
  } catch (error) {
    console.error('❌ 加载后7天数据失败:', error)
    // 这里可以添加错误提示
  } finally {
    loadingNext.value = false
  }
}

// 处理加载前7天数据
async function handleLoadPrevious(startDate: string, endDate: string) {
  loadingPrevious.value = true
  
  try {
    console.log(`🔄 开始加载前7天数据: ${startDate} 至 ${endDate}`)
    
    // 模拟API请求延迟
    await delay(1200)
    
    // 生成模拟数据
    const newWeatherData = generateMockWeatherData(startDate, endDate, false)
    
    // 模拟日记数据
    const mockDiaryCount = Math.floor(Math.random() * 7) + 2
    
    // 添加到现有数据前面
    weatherList.value.unshift(...newWeatherData)
    
    // 更新统计
    loadStats.value.totalLoads++
    loadStats.value.historicalLoads++
    loadStats.value.diaryCount += mockDiaryCount
    
    // 更新当前开始日期
    currentStartDate.value = startDate
    
    console.log(`✅ 成功加载前7天历史数据: ${newWeatherData.length} 条天气数据, ${mockDiaryCount} 条日记`)
    
  } catch (error) {
    console.error('❌ 加载前7天数据失败:', error)
    // 这里可以添加错误提示
  } finally {
    loadingPrevious.value = false
  }
}

// 处理天气卡片点击
function handleWeatherCardClick(weather: WeatherData) {
  console.log('点击天气卡片:', weather.date)
  // 这里可以打开天气详情或日记编辑
}
</script>

<style scoped>
.weather-app {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.app-header {
  text-align: center;
  margin-bottom: 30px;
}

.app-header h1 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 28px;
  font-weight: 600;
}

.app-header p {
  margin: 0;
  color: #666;
  font-size: 16px;
}

.weather-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin: 20px 0;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-state p {
  margin: 8px 0;
  font-size: 16px;
}

.load-stats {
  margin-top: 30px;
}

.stats-card {
  padding: 20px;
}

.stats-card h3 {
  margin: 0 0 16px 0;
  color: #333;
  font-size: 18px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .weather-app {
    padding: 16px;
  }
  
  .weather-cards {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .app-header h1 {
    font-size: 24px;
  }
  
  .app-header p {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .weather-app {
    padding: 12px;
  }
  
  .empty-state {
    padding: 40px 16px;
  }
  
  .stats-card {
    padding: 16px;
  }
}
</style>