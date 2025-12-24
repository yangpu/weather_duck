<template>
  <t-dialog
    :visible="visible"
    :header="`${date} 天气日记`"
    width="600px"
    :footer="false"
    @close="handleClose"
    @update:visible="handleVisibleChange"
  >
    <div class="diary-view-content" v-if="diaryData">
      <!-- 天气概览 -->
      <WeatherSummary v-if="weather" :weather="weather" @dateChange="handleDateChange" />

      <!-- 日记信息 -->
      <div class="diary-info">
        <div class="info-row-combined" v-if="diaryData.city || diaryData.mood">
          <div class="info-item" v-if="diaryData.mood">
            <span class="info-label">心情：</span>
            <span class="info-value">
              {{ getMoodIcon(diaryData.mood) }} {{ diaryData.mood }}
            </span>
          </div>
          <div class="info-item" v-if="diaryData.city">
            <span class="info-label">📍 位置：</span>
            <span class="info-value">{{ diaryData.city }}</span>
          </div>
        </div>
      </div>

      <!-- 日记内容 -->
      <div class="diary-content" v-if="diaryData.content">
        <h3 class="content-title">日记内容</h3>
        <div class="content-text">{{ diaryData.content }}</div>
      </div>

      <!-- 图片展示 -->
      <div class="diary-images" v-if="diaryData.images && diaryData.images.length > 0">
        <h3 class="content-title">图片记录</h3>
        <div class="image-gallery">
          <div 
            v-for="(image, index) in diaryData.images" 
            :key="index"
            class="image-item"
            @click="previewImage(image, index)"
          >
            <img :src="image" :alt="`图片 ${index + 1}`" />
          </div>
        </div>
      </div>

      <!-- 视频展示 -->
      <div class="diary-video" v-if="diaryData.videos && diaryData.videos.length > 0">
        <h3 class="content-title">视频记录</h3>
        <div v-for="(video, index) in diaryData.videos" :key="`video-${videoKey}-${index}`" class="video-item">
          <video 
            controls 
            playsinline
            preload="metadata"
            class="video-player"
            :src="video"
          >
            您的浏览器不支持视频播放
          </video>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="diary-actions">
        <!-- 导航按钮行 -->
        <div class="nav-buttons">
          <t-button variant="outline" @click="handlePreviousDay" :disabled="!hasPreviousDay">
            <template #icon><t-icon name="chevron-left" /></template>
            上一天
          </t-button>
          <t-button variant="outline" @click="refreshCurrentDay" :disabled="isRefreshing">
            <template #icon><t-icon name="refresh" :class="{ 'fa-spin': isRefreshing }" /></template>
            刷新
          </t-button>
          <t-button variant="outline" @click="handleNextDay" :disabled="!hasNextDay">
            下一天
            <template #icon><t-icon name="chevron-right" /></template>
          </t-button>
        </div>
        
        <!-- 主要操作按钮行 -->
        <div class="main-buttons">
          <t-space>
            <t-button variant="outline" @click="handleClose">关闭</t-button>
            <t-button theme="primary" @click="handleEdit">编辑日记</t-button>
          </t-space>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <div class="empty-icon">📝</div>
      <div class="empty-text">暂无日记内容</div>
      <t-button theme="primary" @click="handleEdit">开始记录</t-button>
    </div>

    <!-- 图片预览 -->
    <EnhancedImageViewer
      v-model:visible="imagePreviewVisible"
      :images="diaryData?.images || []"
      v-model:index="previewIndex"
    />
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { WeatherData } from '../types/weather'
import { DateUtils } from '../utils/dateUtils'
import { diaryService } from '../services/diaryService'

import type { WeatherDiary } from '../config/supabase'
import WeatherSummary from './WeatherSummary.vue'
import EnhancedImageViewer from './EnhancedImageViewer.vue'

interface Props {
  visible: boolean
  weather: WeatherData
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'edit', weather: WeatherData): void
  (e: 'dateChange', date: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const diaryData = ref<WeatherDiary | null>(null)
const imagePreviewVisible = ref(false)
const previewIndex = ref(0)
const videoKey = ref(0) // 用于强制刷新视频组件
const isRefreshing = ref(false)

// 立即检查并设置日记数据
function initializeDiaryData() {
  if (!props.weather?.date) {
    return false
  }
  
  const globalCache = (window as any).__diaryCache
  
  if (globalCache && globalCache.has(props.weather.date)) {
    const cachedDiary = globalCache.get(props.weather.date)
    diaryData.value = cachedDiary
    return true
  }
  
  return false
}

const date = computed(() => {
  if (!props.weather || !props.weather.date) return ''
  return DateUtils.formatFullDate(props.weather.date)
})

const globalWeatherList = computed(() => {
  // 优先从全局数据管理器获取
  const globalManager = (window as any).__globalDataManager
  const managerList = globalManager && typeof globalManager.getWeatherList === 'function'
    ? (globalManager.getWeatherList() || [])
    : []
  if (Array.isArray(managerList) && managerList.length) {
    return managerList
  }
  // 兼容性：从全局变量获取
  const globalVarList = (window as any).__weatherList || []
  if (Array.isArray(globalVarList) && globalVarList.length) {
    return globalVarList
  }
  // 统一缓存服务回退
  const unified = (window as any).__unifiedCacheService
  const unifiedList = unified && typeof unified.getWeatherList === 'function'
    ? (unified.getWeatherList() || [])
    : []
  return Array.isArray(unifiedList) ? unifiedList : []
})

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
  if (!props.weather?.date) return -1
  const target = normalizeDate(props.weather.date)
  const list = globalWeatherList.value || []
  const idx = Array.isArray(list)
    ? list.findIndex((w: WeatherData) => normalizeDate(w.date) === target)
    : -1
  if (idx !== -1) return idx
  // 回退到统一缓存列表再尝试查找
  const unified = (window as any).__unifiedCacheService
  const alt = unified && typeof unified.getWeatherList === 'function'
    ? (unified.getWeatherList() || [])
    : []
  return Array.isArray(alt)
    ? alt.findIndex((w: WeatherData) => normalizeDate(w.date) === target)
    : -1
}

// 检查是否有上一天/下一天
const hasPreviousDay = computed(() => {
  const idx = getCurrentIndex()
  return idx > 0
})

const hasNextDay = computed(() => {
  const idx = getCurrentIndex()
  // 有效列表长度（优先 globalWeatherList，再回退统一缓存）
  const primary = globalWeatherList.value || []
  let len = Array.isArray(primary) ? primary.length : 0
  if (len === 0) {
    const unified = (window as any).__unifiedCacheService
    const alt = unified && typeof unified.getWeatherList === 'function'
      ? (unified.getWeatherList() || [])
      : []
    len = Array.isArray(alt) ? alt.length : 0
  }
  return idx >= 0 && idx < len - 1
})

// 停止所有视频播放并释放资源
function stopAllVideos() {
  const videos = document.querySelectorAll('.diary-video video')
  videos.forEach((video) => {
    const v = video as HTMLVideoElement
    v.pause()
    v.currentTime = 0
  })
}

// 清理视频缓存（解决 Service Worker 缓存 Range 请求的问题）
async function clearVideoCacheForUrls(videoUrls: string[]) {
  if (!('caches' in window) || !videoUrls.length) return
  
  try {
    const cacheNames = await caches.keys()
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName)
      for (const url of videoUrls) {
        await cache.delete(url)
      }
    }
  } catch (e) {
    console.warn('清理视频缓存失败:', e)
  }
}

// 监听对话框打开，加载日记
watch(() => props.visible, async (newVisible, oldVisible) => {
  if (newVisible) {
    // 强制刷新视频组件
    videoKey.value++
    
    // 立即尝试初始化数据，如果失败再异步加载
    if (!initializeDiaryData()) {
      await loadDiary()
    }
    
    // 清理可能被错误缓存的视频
    if (diaryData.value?.videos?.length) {
      await clearVideoCacheForUrls(diaryData.value.videos)
    }
  } else if (oldVisible && !newVisible) {
    // 对话框关闭时停止视频
    stopAllVideos()
  }
}, { immediate: true })

// 组件挂载时立即检查数据
onMounted(() => {
  if (props.visible && props.weather?.date) {
    if (!initializeDiaryData()) {
      loadDiary()
    }
  }
})

// 监听天气数据变化，重新加载日记
watch(() => props.weather, async (newWeather) => {
  if (newWeather && props.visible) {
    // 立即尝试初始化数据，如果失败再异步加载
    if (!initializeDiaryData()) {
      await loadDiary()
    }
  }
}, { deep: true })

// 从缓存或数据库加载日记
async function loadDiary(forceRefresh = false) {
  if (!props.weather || !props.weather.date) {
    diaryData.value = null
    return
  }
  
  try {
    let diary = null
    
    // 优先从统一缓存服务获取
    const optimizedUnifiedCacheService = (window as any).__unifiedCacheService
    if (optimizedUnifiedCacheService && !forceRefresh) {
      diary = optimizedUnifiedCacheService.getDiaryData(props.weather.date)
    }
    
    // 如果缓存中没有或需要强制刷新，从数据库获取
    if (!diary || forceRefresh) {
      diary = await diaryService.getDiaryByDate(props.weather.date, forceRefresh)
      
      // 更新统一缓存，强制刷新时通知组件更新
      if (optimizedUnifiedCacheService) {
        optimizedUnifiedCacheService.setDiaryData(props.weather.date, diary, forceRefresh)
      }
    }
    
    diaryData.value = diary
  } catch (e) {
    console.warn('加载日记失败:', e)
    diaryData.value = null
  }
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

function previewImage(_image: string, index: number) {
  previewIndex.value = index
  imagePreviewVisible.value = true
}

function handleEdit() {
  emit('edit', props.weather)
  handleClose()
}

function handlePreviousDay() {
  if (!hasPreviousDay.value) return
  const currentIndex = getCurrentIndex()
  if (currentIndex > 0) {
    // 选择有效列表（优先使用非空的 globalWeatherList，否则回退统一缓存列表）
    const primary = globalWeatherList.value || []
    let list: WeatherData[] = Array.isArray(primary) && primary.length ? primary : []
    if (!list.length) {
      const unified = (window as any).__unifiedCacheService
      const alt = unified && typeof unified.getWeatherList === 'function'
        ? (unified.getWeatherList() || [])
        : []
      list = Array.isArray(alt) ? alt : []
    }
    const previousWeather = list[currentIndex - 1]
    if (previousWeather) {
      emit('dateChange', previousWeather.date)
    }
  }
}

function handleNextDay() {
  if (!hasNextDay.value) return
  const currentIndex = getCurrentIndex()
  // 选择有效列表（优先使用非空的 globalWeatherList，否则回退统一缓存列表）
  const primary = globalWeatherList.value || []
  let list: WeatherData[] = Array.isArray(primary) && primary.length ? primary : []
  if (!list.length) {
    const unified = (window as any).__unifiedCacheService
    const alt = unified && typeof unified.getWeatherList === 'function'
      ? (unified.getWeatherList() || [])
      : []
    list = Array.isArray(alt) ? alt : []
  }
  if (currentIndex >= 0 && currentIndex < list.length - 1) {
    const nextWeather = list[currentIndex + 1]
    if (nextWeather) {
      emit('dateChange', nextWeather.date)
    }
  }
}

async function refreshCurrentDay() {
  if (isRefreshing.value) return
  
  isRefreshing.value = true
  try {
    // 强制刷新会自动通知 WeatherCard 组件更新
    await loadDiary(true)
    
    // 预加载相邻日期的数据
    diaryService.preloadAdjacentDiaries(props.weather.date)
  } catch (error) {
    console.error('刷新数据失败:', error)
  } finally {
    isRefreshing.value = false
  }
}

function handleDateChange(date: string) {
  emit('dateChange', date)
}

function handleClose() {
  stopAllVideos()
  emit('update:visible', false)
}

function handleVisibleChange(value: boolean) {
  if (!value) {
    stopAllVideos()
  }
  emit('update:visible', value)
}
</script>

<style scoped>
.diary-view-content {
  padding: 0;
  overflow: hidden;
}



.diary-info {
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 16px;
}

.info-row-combined {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-label {
  font-weight: 500;
  color: #666;
  margin-right: 8px;
}

.info-value {
  color: #333;
}

.diary-content {
  margin-bottom: 24px;
}

.content-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 8px;
}

.content-text {
  font-size: 16px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #0052d9;
}

.diary-images {
  margin-bottom: 24px;
}

.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.image-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s ease;
}

.image-item:hover {
  transform: scale(1.02);
}

.image-item img {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.diary-video {
  margin-bottom: 24px;
}

.video-player {
  width: 100%;
  max-height: 400px;
  border-radius: 8px;
}

.diary-actions {
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.nav-buttons {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 8px;
}

.nav-buttons .t-button {
  flex: 1;
  max-width: 120px;
}

.fa-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.main-buttons {
  display: flex;
  justify-content: flex-end;
}

/* 桌面模式：所有按钮在一行 */
@media (min-width: 769px) {
  .diary-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
  }
  
  .nav-buttons {
    display: flex;
    gap: 8px;
    margin-bottom: 0;
  }
  
  .main-buttons {
    margin-left: auto;
  }
}

/* 手机模式：导航按钮单独一行 */
@media (max-width: 768px) {
  .nav-buttons {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  
  .main-buttons {
    display: flex;
    justify-content: flex-end;
  }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 18px;
  color: #666;
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .image-gallery {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>