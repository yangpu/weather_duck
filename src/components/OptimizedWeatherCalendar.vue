<template>
  <div class="weather-calendar">
    <div class="calendar-header">
      <t-button variant="outline" @click="previousMonth">
        <ChevronLeftIcon />
      </t-button>
      <h3>{{ currentMonthText }}</h3>
      <t-button variant="outline" @click="nextMonth">
        <ChevronRightIcon />
      </t-button>
    </div>

    <div class="calendar-grid">
      <div class="weekday-header">
        <div v-for="day in weekdays" :key="day" class="weekday">{{ day }}</div>
      </div>
      
      <div class="calendar-days">
        <div
          v-for="day in calendarDays"
          :key="`${day.date}-${day.isCurrentMonth}`"
          :class="[
            'calendar-day',
            {
              'other-month': !day.isCurrentMonth,
              'has-diary': day.hasDiary,
              'today': day.isToday,
              'selected': day.date === selectedDate
            }
          ]"
          @click="selectDate(day.date)"
        >
          <div class="day-number">{{ day.dayNumber }}</div>
          <div v-if="day.hasDiary" class="diary-indicator">
            <div class="diary-preview">
              <img v-if="day.diary?.images?.[0]" :src="day.diary.images[0]" alt="日记图片" class="diary-thumb" />
              <div class="diary-text">{{ getDiaryPreview(day.diary) }}</div>
            </div>
          </div>
          <div v-if="day.weather" class="weather-info">
            <span class="weather-icon">{{ day.weather.icon || '🌤️' }}</span>
            <span class="temperature">{{ day.weather.temperature?.current || 0 }}°</span>
          </div>
        </div>
      </div>
    </div>

    <t-loading :loading="loading" text="加载中..." />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ChevronLeftIcon } from 'tdesign-icons-vue-next'
import { OptimizedStorageAdapter } from '../services/optimizedStorageAdapter'
import { WeatherDiary } from '../config/supabase'
import { WeatherData } from '../types/weather'

interface CalendarDay {
  date: string
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  hasDiary: boolean
  diary?: WeatherDiary
  weather?: WeatherData
}

const currentDate = ref(new Date())
const selectedDate = ref('')
const loading = ref(false)
const monthDiaries = ref<Record<string, WeatherDiary>>({})

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const currentMonthText = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth() + 1
  return `${year}年${month}月`
})

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  
  // 获取当月第一天和最后一天
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  
  // 获取日历开始日期（包含上月末尾几天）
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())
  
  // 获取日历结束日期（包含下月开始几天）
  const endDate = new Date(lastDay)
  endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()))
  
  const days: CalendarDay[] = []
  const today = new Date().toISOString().split('T')[0]
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    const isCurrentMonth = d.getMonth() === month
    const diary = monthDiaries.value[dateStr]
    
    days.push({
      date: dateStr,
      dayNumber: d.getDate(),
      isCurrentMonth,
      isToday: dateStr === today,
      hasDiary: !!diary,
      diary,
      weather: diary?.weather_data
    })
  }
  
  return days
})

// 监听月份变化，加载对应月份的日记
watch(currentDate, async () => {
  await loadMonthDiaries()
}, { immediate: true })

async function loadMonthDiaries() {
  loading.value = true
  try {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth() + 1
    
    // 使用优化的批量查询，一次性加载整个月的数据
    monthDiaries.value = await OptimizedStorageAdapter.getMonthDiaries(year, month)
  } catch (error) {
    console.error('加载月份日记失败:', error)
  } finally {
    loading.value = false
  }
}

function previousMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentDate.value = newDate
}

function nextMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentDate.value = newDate
}

function selectDate(date: string) {
  selectedDate.value = date
  // 触发日期选择事件
  emit('dateSelected', date, monthDiaries.value[date])
}

function getDiaryPreview(diary?: WeatherDiary): string {
  if (!diary?.content) return ''
  return diary.content.length > 10 ? diary.content.substring(0, 10) + '...' : diary.content
}

// 监听日记保存事件，实时更新日历
onMounted(() => {
  window.addEventListener('diary:updated', handleDiarySaved as EventListener)
})

function handleDiarySaved(event: Event) {
  const customEvent = event as CustomEvent
  const { date, diary } = customEvent.detail
  
  // 直接更新本地缓存，避免重新请求整个月的数据
  if (monthDiaries.value) {
    const existingIndex = monthDiaries.value.findIndex(d => d.date === date)
    if (diary) {
      // 更新或添加日记
      if (existingIndex >= 0) {
        monthDiaries.value[existingIndex] = diary
      } else {
        monthDiaries.value.push(diary)
      }
    } else {
      // 删除日记
      if (existingIndex >= 0) {
        monthDiaries.value.splice(existingIndex, 1)
      }
    }
  }
}

interface Emits {
  (e: 'dateSelected', date: string, diary?: WeatherDiary): void
}

const emit = defineEmits<Emits>()
</script>

<style scoped>
.weather-calendar {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.calendar-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.calendar-grid {
  width: 100%;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  padding: 8px;
  font-weight: 600;
  color: #666;
  font-size: 14px;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: #f0f0f0;
}

.calendar-day {
  background: white;
  min-height: 80px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  display: flex;
  flex-direction: column;
}

.calendar-day:hover {
  background: #f8f9fa;
}

.calendar-day.other-month {
  color: #ccc;
  background: #fafafa;
}

.calendar-day.today {
  background: #e6f3ff;
}

.calendar-day.selected {
  background: #0052d9;
  color: white;
}

.calendar-day.has-diary {
  border-left: 3px solid #0052d9;
}

.day-number {
  font-weight: 600;
  margin-bottom: 4px;
}

.diary-indicator {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.diary-preview {
  display: flex;
  align-items: center;
  gap: 4px;
}

.diary-thumb {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border-radius: 2px;
}

.diary-text {
  font-size: 10px;
  color: #666;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.weather-info {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: auto;
}

.weather-icon {
  font-size: 12px;
}

.temperature {
  font-size: 10px;
  color: #666;
}

.calendar-day.selected .diary-text,
.calendar-day.selected .temperature {
  color: rgba(255, 255, 255, 0.8);
}

@media (max-width: 768px) {
  .calendar-day {
    min-height: 60px;
    padding: 4px;
  }
  
  .diary-thumb {
    width: 16px;
    height: 16px;
  }
  
  .diary-text {
    font-size: 9px;
  }
  
  .weather-icon {
    font-size: 10px;
  }
  
  .temperature {
    font-size: 9px;
  }
}
</style>