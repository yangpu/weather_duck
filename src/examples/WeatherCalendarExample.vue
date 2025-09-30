<template>
  <div class="weather-calendar-example">
    <h2>天气日历示例</h2>
    
    <div class="date-controls">
      <t-button @click="loadPreviousWeek">上一周</t-button>
      <span>{{ formatDateRange(startDate, endDate) }}</span>
      <t-button @click="loadNextWeek">下一周</t-button>
    </div>
    
    <div class="weather-grid" v-if="!loading">
      <WeatherCard 
        v-for="weather in weatherData" 
        :key="weather.date"
        :weather="weather"
        @click="openDiary"
      />
    </div>
    
    <div v-else class="loading-state">
      <t-loading size="large" text="正在加载天气数据..." />
    </div>
    
    <!-- 天气日记对话框 -->
    <WeatherDiary
      v-if="selectedWeather"
      :visible="diaryVisible"
      :weather="selectedWeather"
      @update:visible="diaryVisible = $event"
      @saved="onDiarySaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { WeatherApiService } from '../services/weatherApi'
import { WeatherData } from '../types/weather'
import WeatherCard from '../components/WeatherCard.vue'
import WeatherDiary from '../components/WeatherDiary.vue'

const loading = ref(false)
const weatherData = ref<WeatherData[]>([])
const startDate = ref('')
const endDate = ref('')
const diaryVisible = ref(false)
const selectedWeather = ref<WeatherData | null>(null)

// 初始化日期范围（最近一周）
function initializeDateRange() {
  const today = new Date()
  const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
  
  startDate.value = start.toISOString().slice(0, 10)
  endDate.value = today.toISOString().slice(0, 10)
}

// 加载天气数据
async function loadWeatherData() {
  loading.value = true
  try {

    
    // 使用增强的天气API，确保返回完整的日期范围
    const data = await WeatherApiService.getEnhancedWeatherData(
      22.5429, // 深圳坐标，可以根据用户位置调整
      114.0596,
      startDate.value,
      endDate.value
    )
    
    weatherData.value = data

    
    // 统计占位数据
    const placeholderCount = data.filter(w => w.isPlaceholder).length
    if (placeholderCount > 0) {

    }
    
  } catch (error) {
    console.error('❌ 加载天气数据失败:', error)
    // 即使API失败，也要显示占位数据
    weatherData.value = generateFallbackData()
  } finally {
    loading.value = false
  }
}

// 生成降级数据（当API完全失败时）
function generateFallbackData(): WeatherData[] {
  const data: WeatherData[] = []
  const start = new Date(startDate.value)
  const end = new Date(endDate.value)
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    data.push({
      date: dateStr,
      temperature: { min: 15, max: 25, current: 20 },
      humidity: 60,
      windSpeed: 5,
      windDirection: '东南风',
      precipitation: 0,
      cloudCover: 50,
      description: '网络异常，数据不可用',
      icon: '❓',
      isPlaceholder: true
    })
  }
  
  return data
}

// 上一周
function loadPreviousWeek() {
  const start = new Date(startDate.value)
  const end = new Date(endDate.value)
  
  start.setDate(start.getDate() - 7)
  end.setDate(end.getDate() - 7)
  
  startDate.value = start.toISOString().slice(0, 10)
  endDate.value = end.toISOString().slice(0, 10)
  
  loadWeatherData()
}

// 下一周
function loadNextWeek() {
  const start = new Date(startDate.value)
  const end = new Date(endDate.value)
  
  start.setDate(start.getDate() + 7)
  end.setDate(end.getDate() + 7)
  
  startDate.value = start.toISOString().slice(0, 10)
  endDate.value = end.toISOString().slice(0, 10)
  
  loadWeatherData()
}

// 格式化日期范围显示
function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  
  const startStr = `${startDate.getMonth() + 1}月${startDate.getDate()}日`
  const endStr = `${endDate.getMonth() + 1}月${endDate.getDate()}日`
  
  return `${startStr} - ${endStr}`
}

// 打开天气日记
function openDiary(weather: WeatherData) {
  selectedWeather.value = weather
  diaryVisible.value = true
}

// 日记保存回调
function onDiarySaved(_date: string, _content: string) {

  // 可以在这里更新UI或触发其他操作
}

// 组件挂载时初始化
onMounted(() => {
  initializeDateRange()
  loadWeatherData()
})
</script>

<style scoped>
.weather-calendar-example {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.date-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.weather-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

@media (max-width: 768px) {
  .weather-grid {
    grid-template-columns: 1fr;
  }
  
  .date-controls {
    flex-direction: column;
    gap: 12px;
  }
}
</style>