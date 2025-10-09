<template>
  <div class="weather-summary" v-if="weather">
    <div class="weather-main">
      <!-- 左箭头 -->
      <div class="nav-arrow nav-arrow-left">
        <t-tooltip content="上一天" placement="top">
          <t-button
            variant="text"
            size="small"
            @click="handlePreviousDay"
            :disabled="!hasPreviousDay"
            class="arrow-btn"
          >
            <template #icon>
              <t-icon name="chevron-left" />
            </template>
          </t-button>
        </t-tooltip>
      </div>

      <div class="weather-icon-section">
        <div class="weather-icon">{{ weather.icon || '🌤️' }}</div>
        <div class="weather-description">{{ weather.description || '未知天气' }}</div>
      </div>
      <div class="temperature-section">
        <div class="temperature">{{ weather.temperature?.current || 0 }}°</div>
        <div class="temp-range">
          {{ weather.temperature?.min || 0 }}° / {{ weather.temperature?.max || 0 }}°
        </div>
      </div>

      <!-- 右箭头 -->
      <div class="nav-arrow nav-arrow-right">
        <t-tooltip content="下一天" placement="top">
          <t-button
            variant="text"
            size="small"
            @click="handleNextDay"
            :disabled="!hasNextDay"
            class="arrow-btn"
          >
            <template #icon>
              <t-icon name="chevron-right" />
            </template>
          </t-button>
        </t-tooltip>
      </div>
    </div>
    <div class="weather-details">
      <div class="detail-item">
        <span class="detail-icon">🌧️</span>
        <span class="detail-text">降雨量: {{ weather.precipitation || 0 }}mm</span>
      </div>
      <div class="detail-item">
        <span class="detail-icon">☁️</span>
        <span class="detail-text">云量: {{ weather.cloudCover || 0 }}%</span>
      </div>
      <div class="detail-item">
        <span class="detail-icon">💨</span>
        <span class="detail-text">风力: {{ weather.windSpeed || 0 }}km/h {{ weather.windDirection || '' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { WeatherData } from '../types/weather'

interface Props {
  weather: WeatherData
}

interface Emits {
  (e: 'dateChange', date: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const weatherListRef = ref<WeatherData[]>([])

// 初始化获取天气列表（带多重回退）
function hydrateWeatherList() {
  const globalManager = (window as any).__globalDataManager
  if (globalManager && typeof globalManager.getWeatherList === 'function') {
    const list = globalManager.getWeatherList() || []
    if (Array.isArray(list) && list.length) {
      weatherListRef.value = list
      return
    }
  }
  // 兼容性：全局变量
  const globalList = (window as any).__weatherList
  if (Array.isArray(globalList) && globalList.length) {
    weatherListRef.value = globalList
    return
  }
  // 统一缓存服务回退
  const unified = (window as any).__unifiedCacheService
  if (unified && typeof unified.getWeatherList === 'function') {
    const list = unified.getWeatherList() || []
    if (Array.isArray(list) && list.length) {
      weatherListRef.value = list
    }
  }
}

function normalizeDate(d: string | undefined | null): string {
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch {
    const s = String(d).trim().replace(/\//g, '-')
    return s.includes('T') ? s.split('T')[0] : s
  }
}

function getCurrentIndex(): number {
  if (!props.weather?.date || !weatherListRef.value.length) return -1
  const target = normalizeDate(props.weather.date)
  return weatherListRef.value.findIndex((w: WeatherData) => normalizeDate(w.date) === target)
}

// 检查是否有上一天/下一天
const hasPreviousDay = computed(() => {
  const idx = getCurrentIndex()
  return idx > 0
})

const hasNextDay = computed(() => {
  const idx = getCurrentIndex()
  return idx >= 0 && idx < weatherListRef.value.length - 1
})

function handlePreviousDay() {
  if (!hasPreviousDay.value) return
  const currentIndex = getCurrentIndex()
  if (currentIndex > 0) {
    const previousWeather = weatherListRef.value[currentIndex - 1]
    emit('dateChange', previousWeather.date)
  }
}

function handleNextDay() {
  if (!hasNextDay.value) return
  const currentIndex = getCurrentIndex()
  if (currentIndex >= 0 && currentIndex < weatherListRef.value.length - 1) {
    const nextWeather = weatherListRef.value[currentIndex + 1]
    emit('dateChange', nextWeather.date)
  }
}

// 监听与灌入天气列表，避免缓存导致的初始空列表
onMounted(() => {
  // 初始灌入一次列表
  hydrateWeatherList()

  // 统一的事件处理器，兼容多种事件结构
  const onWeatherReady = (e: any) => {
    const detail = e?.detail || {}
    const list = detail.weatherData || detail.weatherList || detail.list
    if (Array.isArray(list) && list.length) {
      weatherListRef.value = list
    } else {
      hydrateWeatherList()
    }
  }

  window.addEventListener('weather:data-ready', onWeatherReady as EventListener)
  window.addEventListener('weather:list-updated', onWeatherReady as EventListener)
  window.addEventListener('globalData:weatherReady', onWeatherReady as EventListener)

  // 当日期变化时，若列表仍为空则再尝试灌入
  watch(() => props.weather?.date, () => {
    if (!weatherListRef.value.length) {
      hydrateWeatherList()
    }
  })
})

onBeforeUnmount(() => {
  // 尝试移除监听（此处为兼容，具体实现可能由宿主管理）
  window.removeEventListener('weather:data-ready', (null as any))
  window.removeEventListener('weather:list-updated', (null as any))
  window.removeEventListener('globalData:weatherReady', (null as any))
})
</script>

<style scoped>
.weather-summary {
  padding: 20px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e6f3ff 100%);
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 82, 217, 0.1);
}

.weather-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  position: relative;
}

.nav-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-arrow-left {
  margin-right: 16px;
}

.nav-arrow-right {
  margin-left: 16px;
}

.arrow-btn {
  border-radius: 50%;
  width: 40px;
  height: 40px;
  transition: all 0.2s ease;
  color: #0052d9 !important;
}

.arrow-btn :deep(.t-icon) {
  font-size: 20px;
}

.arrow-btn:hover:not(:disabled) {
  background-color: rgba(0, 82, 217, 0.1) !important;
  transform: scale(1.1);
}

.arrow-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.weather-icon-section {
  display: flex;
  align-items: center;
  text-align: center;
  flex: 1;
}

.weather-icon {
  font-size: 56px;
  margin-bottom: 16px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.weather-description {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
}

.temperature-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.temperature {
  font-size: 42px;
  font-weight: 700;
  color: #0052d9;
  line-height: 1;
  margin-bottom: 4px;
}

.temp-range {
  font-size: 16px;
  color: #666;
  font-weight: 500;
}

.weather-details {
  display: flex;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 82, 217, 0.1);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.detail-icon {
  font-size: 16px;
}

.detail-text {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

@media (max-width: 768px) {
  .weather-summary {
    padding: 16px;
  }
  
  .weather-main {
    /* 保持相同的布局结构 */
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .nav-arrow {
    /* 保持箭头按钮大小不变 */
    flex-shrink: 0;
  }
  
  .arrow-btn {
    /* 移动端保持相同大小 */
    width: 40px;
    height: 40px;
  }
  
  .weather-icon-section {
    flex: 1;
    text-align: center;
  }
  
  .weather-icon {
    font-size: 48px;
  }
  
  .temperature-section {
    align-items: flex-end;
    text-align: right;
  }
  
  .temperature {
    font-size: 36px;
  }
  
  .detail-item {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .weather-summary {
    padding: 12px;
  }
  
  .weather-main {
    /* 小屏幕仍保持水平布局 */
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .arrow-btn {
    /* 小屏幕稍微缩小按钮 */
    width: 36px;
    height: 36px;
  }
  
  .arrow-btn :deep(.t-icon) {
    font-size: 18px;
  }
  
  .weather-icon {
    font-size: 40px;
  }
  
  .temperature {
    font-size: 32px;
  }
  
  .weather-description {
    font-size: 14px;
  }
  
  .temp-range {
    font-size: 14px;
  }
  
  .detail-text {
    font-size: 13px;
  }
}
</style>