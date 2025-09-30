<template>
  <t-card class="weather-card" :class="{ 'today': isToday }" :data-date="weather.date" @click="handleCardClick">
    <div class="weather-header">
      <div class="date-info">
        <div class="date">{{ formatDate(weather.date) }}</div>
        <div class="weekday">{{ getWeekday(weather.date) }}</div>
      </div>
      <div class="weather-icon" :title="weather.description">
        {{ weather.icon }}
      </div>
    </div>
    
    <div class="weather-main">
      <div class="temperature">
        <span class="current">{{ weather.temperature.current }}°</span>
        <div class="range">
          <span class="min">{{ weather.temperature.min }}°</span>
          <span class="separator">/</span>
          <span class="max">{{ weather.temperature.max }}°</span>
        </div>
      </div>
      <div class="description">{{ weather.description }}</div>
    </div>
    
    <div class="weather-details">
      <div class="detail-item">
        <span class="label">降雨:</span>
        <span class="value">{{ weather.precipitation }}mm</span>
      </div>
      <div class="detail-item">
        <span class="label">云量:</span>
        <span class="value">{{ weather.cloudCover }}%</span>
      </div>
      <div class="detail-item">
        <span class="label">风向:</span>
        <span class="value">{{ weather.windDirection }}</span>
      </div>
      <div class="detail-item">
        <span class="label">风力:</span>
        <span class="value">{{ weather.windSpeed }}km/h</span>
      </div>
    </div>

    <!-- 日记预览区域 -->
    <div class="diary-section">
      <div class="diary-preview" v-if="diaryData && (diaryData.mood || getFirstImage(diaryData) || diaryData.content)">
        <!-- 心情优先显示 -->
        <!-- 1. 心情优先显示 -->
        <!-- 心情和城市信息在一行 -->
        <div class="diary-info-row" v-if="diaryData.mood || diaryData.city">
          <div class="diary-mood" v-if="diaryData.mood">
            <span class="mood-icon">{{ getMoodIcon(diaryData.mood) }}</span>
            <span class="mood-text">{{ diaryData.mood }}</span>
          </div>
          <div class="diary-city" v-if="diaryData.city">
            <span class="city-icon">📍</span>
            <span class="city-text">{{ diaryData.city }}</span>
          </div>
        </div>
        <!-- 2. 图片第二显示 -->
        <div class="diary-image" v-if="getFirstImage(diaryData)">
          <img :src="getFirstImage(diaryData)" alt="日记图片" />
        </div>
        <!-- 3. 文本最后显示 -->
        <div class="diary-content" v-if="diaryData.content">
          <div class="diary-text">{{ getDiaryPreview(diaryData.content) }}</div>
        </div>
      </div>
      
      <!-- 无日记时显示编辑提示 -->
      <div class="diary-empty" v-else>
        <t-icon name="edit-1" size="20" class="edit-icon" />
        <span class="edit-hint">点击记录今日心情</span>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { WeatherData } from '../types/weather'
import { DateUtils } from '../utils/dateUtils'
import { optimizedUnifiedCacheService } from '../services/optimizedUnifiedCacheService'
import type { WeatherDiary } from '../config/supabase'
import { truncateText } from '../utils/textUtils'

interface Props {
  weather: WeatherData
}

interface Emits {
  (e: 'click', weather: WeatherData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formatDate = DateUtils.formatDate
const getWeekday = DateUtils.getWeekday

const isToday = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return props.weather.date === today
})

const hasDiary = ref(false)
const diaryData = ref<WeatherDiary | null>(null)

function loadDiary() {
  try {
    // 优化：优先从统一缓存服务获取数据
    const diary = optimizedUnifiedCacheService.getDiaryData(props.weather.date)
    hasDiary.value = !!diary
    diaryData.value = Array.isArray(diary) ? diary[0] : diary
    
    // if (diary) {
    //   console.log(`✅ WeatherCard: 找到日记 ${props.weather.date}:`, diary)
    // } else {
    //   console.log(`❌ WeatherCard: 日记不存在 ${props.weather.date}`)
    //   console.log(`📦 WeatherCard: 缓存中的所有日记:`, Array.from((window as any).__diaryCache?.keys() || []))
    // }
    
    return
  } catch (error) {
    console.warn(`获取日记失败 (${props.weather.date}):`, error)
    hasDiary.value = false
    diaryData.value = null
  }
}

function onDiariesLoaded(_ev: Event) {
  // 批量日记加载完成，更新显示
  loadDiary()
}

function onDiaryUpdated(ev: Event) {
  // 单个日记更新，直接使用事件中的数据，避免重新请求
  const ce = ev as CustomEvent
  const d = ce?.detail?.date
  if (d === props.weather.date) {
    const updatedDiary = ce?.detail?.diary
    if (updatedDiary) {
      // 直接使用事件中的日记数据
      diaryData.value = updatedDiary
      hasDiary.value = true
    } else {
      // 如果是删除操作，清空日记
      diaryData.value = null
      hasDiary.value = false
    }
  }
}

onMounted(() => {
  loadDiary()
  // 只监听一次 diary:updated 事件，避免重复处理
  window.addEventListener('diary:updated', onDiaryUpdated)
  window.addEventListener('diaries:loaded', onDiariesLoaded)
  
  // 监听统一缓存服务的数据就绪事件
  window.addEventListener('diaries:data:ready', onDiariesLoaded)
  window.addEventListener('unified:data:ready', onDiariesLoaded)
})

onUnmounted(() => {
  window.removeEventListener('diary:updated', onDiaryUpdated)
  window.removeEventListener('diaries:loaded', onDiariesLoaded)
  window.removeEventListener('diaries:data:ready', onDiariesLoaded)
  window.removeEventListener('unified:data:ready', onDiariesLoaded)
})

function getDiaryPreview(content: string): string {
  return truncateText(content, 10)
}

function getFirstImage(diary: WeatherDiary): string {
  if (diary.images && diary.images.length > 0) {
    return diary.images[0]
  }
  return ''
}

function getMoodIcon(mood: string): string {
  const moodIcons: Record<string, string> = {
    '开心': '😊',
    '愉快': '😄',
    '平静': '😌',
    '忧郁': '😔',
    '烦躁': '😤',
    '兴奋': '🤩',
    '放松': '😎',
    '疲惫': '😴'
  }
  return moodIcons[mood] || '😊'
}

function handleCardClick() {
  emit('click', props.weather)
}
</script>

<style scoped>
.weather-card {
  min-height: 200px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 12px;
  cursor: pointer;
  position: relative;
  border: 1px solid #e7e7e7;
  background: #ffffff;
  overflow: hidden;
}

.weather-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 82, 217, 0.05) 0%, rgba(0, 82, 217, 0.02) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.weather-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 82, 217, 0.15);
  border-color: #0052d9;
}

.weather-card:hover::before {
  opacity: 1;
}

.weather-card:active {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 82, 217, 0.2);
}

.weather-card.today {
  border: 2px solid #0052d9;
  background: linear-gradient(135deg, #f0f7ff 0%, #e6f3ff 100%);
  box-shadow: 0 4px 20px rgba(0, 82, 217, 0.1);
}

.weather-card.today:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 45px rgba(0, 82, 217, 0.25);
  border-color: #003ba3;
}

.weather-card.today::before {
  background: linear-gradient(135deg, rgba(0, 82, 217, 0.08) 0%, rgba(0, 82, 217, 0.04) 100%);
  opacity: 1;
}

.weather-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.date-info {
  text-align: left;
}

.date {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.weekday {
  font-size: 14px;
  color: #666;
}

.weather-icon {
  font-size: 32px;
  line-height: 1;
}

.weather-main {
  text-align: center;
  margin-bottom: 20px;
}

.temperature {
  margin-bottom: 8px;
}

.current {
  font-size: 32px;
  font-weight: 700;
  color: #0052d9;
}

.range {
  font-size: 16px;
  color: #666;
}

.min {
  color: #0052d9;
}

.max {
  color: #d54941;
}

.separator {
  margin: 0 4px;
  color: #999;
}

.description {
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

.weather-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.label {
  color: #666;
  font-size: small;
}

.value {
  color: #333;
  font-weight: 500;
}

.diary-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.diary-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diary-text {
  font-size: 14px;
  color: #666;
  line-height: 1.4;
}

.diary-image img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
}

.diary-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.diary-city {
  display: flex;
  align-items: center;
  gap: 4px;
}

.city-icon {
  font-size: 12px;
  color: #1890ff;
}

.city-text {
  font-size: 11px;
  color: #1890ff;
  font-weight: 500;
}

.diary-mood {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.mood-icon {
  font-size: 16px;
}

.mood-text {
  color: #666;
  font-weight: 500;
}

.diary-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 1px dashed #d0d0d0;
  border-radius: 8px;
  color: #999;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.diary-empty::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 82, 217, 0.05) 0%, rgba(0, 82, 217, 0.02) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.diary-empty:hover {
  border-color: #0052d9;
  color: #0052d9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 82, 217, 0.1);
}

.diary-empty:hover::before {
  opacity: 1;
}

.diary-empty:hover .edit-icon {
  opacity: 1;
  transform: scale(1.1);
}

.edit-icon {
  opacity: 0.6;
}

.edit-hint {
  font-size: 14px;
}

@media (max-width: 768px) {
  .weather-card {
    min-height: 180px;
  }
  
  .weather-details {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .current {
    font-size: 28px;
  }
  
  .weather-icon {
    font-size: 28px;
  }
}
</style>