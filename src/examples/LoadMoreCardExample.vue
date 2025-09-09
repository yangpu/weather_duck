<template>
  <div class="load-more-example">
    <h2>LoadNextCard 和 LoadPreviousCard 使用示例</h2>
    
    <div class="current-range">
      <p>当前数据范围: {{ currentStartDate }} 至 {{ currentEndDate }}</p>
    </div>
    
    <!-- LoadNextCard 放在列表前面 -->
    <LoadNextCard
      :loading="loadingNext"
      :current-end-date="currentEndDate"
      @load-next="handleLoadNext"
    />
    
    <!-- 这里是天气卡片列表 -->
    <div class="weather-cards-placeholder">
      <div class="placeholder-card">天气卡片 1</div>
      <div class="placeholder-card">天气卡片 2</div>
      <div class="placeholder-card">天气卡片 3</div>
      <div class="placeholder-card">...</div>
    </div>
    
    <!-- LoadPreviousCard 放在列表后面 -->
    <LoadPreviousCard
      :loading="loadingPrevious"
      :current-start-date="currentStartDate"
      @load-previous="handleLoadPrevious"
    />
    
    <div class="data-display" v-if="weatherData.length > 0">
      <h3>已加载的天气数据</h3>
      <div class="weather-list">
        <div 
          v-for="item in weatherData" 
          :key="item.date"
          class="weather-item"
          :class="{ forecast: item.isForecast }"
        >
          <span class="date">{{ formatDate(item.date) }}</span>
          <span class="temp">{{ item.temperature }}°C</span>
          <span class="type">{{ item.isForecast ? '预测' : '历史' }}</span>
        </div>
      </div>
    </div>
    
    <div class="diary-display" v-if="diaryData.length > 0">
      <h3>已加载的天气日记</h3>
      <div class="diary-list">
        <div 
          v-for="diary in diaryData" 
          :key="diary.date"
          class="diary-item"
        >
          <span class="date">{{ formatDate(diary.date) }}</span>
          <span class="content">{{ diary.content }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LoadNextCard from '../components/LoadNextCard.vue'
import LoadPreviousCard from '../components/LoadPreviousCard.vue'
import { DateUtils } from '../utils/dateUtils'

// 状态管理
const loadingPrevious = ref(false)
const loadingNext = ref(false)
const currentStartDate = ref('2024-01-15')
const currentEndDate = ref('2024-01-21')

// 数据存储
const weatherData = ref<Array<{
  date: string
  temperature: number
  isForecast: boolean
}>>([])

const diaryData = ref<Array<{
  date: string
  content: string
}>>([])

// 格式化日期显示
function formatDate(dateString: string) {
  return DateUtils.formatDate(dateString)
}

// 模拟API延迟
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 处理加载前7天数据
async function handleLoadPrevious(startDate: string, endDate: string) {
  loadingPrevious.value = true
  
  try {
    console.log(`🔄 开始加载前7天数据: ${startDate} 至 ${endDate}`)
    
    // 模拟API请求延迟
    await delay(1200)
    
    // 模拟天气数据
    const mockWeatherData = [
      { date: startDate, temperature: 15, isForecast: false },
      { date: new Date(new Date(startDate).getTime() + 86400000).toISOString().slice(0, 10), temperature: 18, isForecast: false }
    ]
    
    // 模拟日记数据
    const mockDiaryData = [
      { date: startDate, content: '今天天气不错，心情很好' }
    ]
    
    // 更新数据
    weatherData.value = [...mockWeatherData, ...weatherData.value]
    diaryData.value = [...mockDiaryData, ...diaryData.value]
    
    // 更新当前日期范围
    currentStartDate.value = startDate
    
    console.log(`✅ 成功加载前7天数据: ${startDate} 至 ${endDate}`)
  } catch (error) {
    console.error('❌ 加载前7天数据失败:', error)
  } finally {
    loadingPrevious.value = false
  }
}

// 处理加载后7天数据
async function handleLoadNext(startDate: string, endDate: string, isForecast: boolean) {
  loadingNext.value = true
  
  try {
    const dataType = isForecast ? '预测' : '历史'
    console.log(`🔄 开始加载后7天${dataType}数据: ${startDate} 至 ${endDate}`)
    
    // 模拟API请求延迟
    await delay(1500)
    
    // 模拟天气数据
    const mockWeatherData = [
      { date: startDate, temperature: 22, isForecast },
      { date: new Date(new Date(startDate).getTime() + 86400000).toISOString().slice(0, 10), temperature: 25, isForecast }
    ]
    
    // 模拟日记数据（预测数据通常没有日记）
    const mockDiaryData = isForecast ? [] : [
      { date: startDate, content: '计划明天去公园散步' }
    ]
    
    // 更新数据
    weatherData.value = [...weatherData.value, ...mockWeatherData]
    diaryData.value = [...diaryData.value, ...mockDiaryData]
    
    // 更新当前日期范围
    currentEndDate.value = endDate
    
    console.log(`✅ 成功加载后7天${dataType}数据: ${startDate} 至 ${endDate}`)
  } catch (error) {
    console.error('❌ 加载后7天数据失败:', error)
  } finally {
    loadingNext.value = false
  }
}
</script>

<style scoped>
.load-more-example {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.current-range {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  text-align: center;
}

.current-range p {
  margin: 0;
  font-weight: 500;
  color: #333;
}

.weather-cards-placeholder {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.placeholder-card {
  padding: 20px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

.data-display, .diary-display {
  margin-top: 30px;
}

.data-display h3, .diary-display h3 {
  margin-bottom: 16px;
  color: #333;
}

.weather-list, .diary-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.weather-item, .diary-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 6px;
  border-left: 4px solid #ddd;
}

.weather-item.forecast {
  background: #e8f5e8;
  border-left-color: #4caf50;
}

.weather-item .date, .diary-item .date {
  font-weight: 500;
  min-width: 80px;
}

.weather-item .temp {
  font-weight: bold;
  color: #1976d2;
}

.weather-item .type {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  background: #e0e0e0;
  color: #666;
}

.weather-item.forecast .type {
  background: #4caf50;
  color: white;
}

.diary-item .content {
  flex: 1;
  color: #666;
}

@media (max-width: 768px) {
  .load-more-example {
    padding: 16px;
  }
  
  .weather-item, .diary-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .weather-item .date, .diary-item .date {
    min-width: auto;
  }
}
</style>