<template>
  <t-dialog
    :visible="visible"
    :header="`编辑 ${date} 天气日记`"
    width="700px"
    :footer="false"
    @close="handleClose"
    @update:visible="handleVisibleChange"
  >
    <div class="diary-edit-content">
      <!-- 天气概览 -->
      <WeatherSummary v-if="weather" :weather="weather" @dateChange="handleDateChange" />

      <!-- 城市信息 -->
      <div class="form-section">
        <label class="form-label">具体位置</label>
        <t-input
          v-model="cityLocation"
          placeholder="记录当时所在的具体地点"
          clearable
        />
      </div>

      <!-- 心情选择 -->
      <div class="form-section">
        <label class="form-label">今日心情</label>
        <div class="mood-selector">
          <div 
            v-for="mood in moodOptions" 
            :key="mood.value"
            class="mood-option"
            :class="{ active: selectedMood === mood.value }"
            @click="selectedMood = mood.value"
          >
            <span class="mood-emoji">{{ mood.emoji }}</span>
            <span class="mood-label">{{ mood.label }}</span>
          </div>
        </div>
      </div>

      <!-- 日记内容 -->
      <div class="form-section">
        <label class="form-label">日记内容</label>
        <t-textarea
          v-model="diaryText"
          :placeholder="`记录一下 ${date} 的天气感受吧...`"
          :maxlength="2000"
          :autosize="{ minRows: 6, maxRows: 12 }"
          show-limit-number
          clearable
        />
      </div>

      <!-- 图片上传 -->
      <div class="form-section">
        <label class="form-label">上传图片</label>
        <div class="upload-section">
          <input
            ref="imageInput"
            type="file"
            accept="image/*,image/heic,image/heif,.jpg,.jpeg,.png,.gif,.bmp,.webp,.heic,.heif"
            multiple
            style="display: none"
            @change="handleImageSelect"
          />
          <t-button
            variant="outline"
            @click="($refs.imageInput as HTMLInputElement)?.click()"
            :disabled="selectedImages.length >= 9"
          >
            <template #icon><t-icon name="add" /></template>
            选择图片 ({{ selectedImages.length }}/9)
          </t-button>
          
          <!-- 图片预览 -->
          <div v-if="selectedImages.length > 0" class="image-preview-grid">
            <div
              v-for="(image, index) in selectedImages"
              :key="index"
              class="image-preview-item"
            >
              <img :src="image.preview" :alt="`图片 ${index + 1}`" />
              <div class="image-overlay">
                <t-button
                  size="small"
                  theme="danger"
                  variant="text"
                  @click="removeImage(index)"
                >
                  <template #icon><t-icon name="delete" /></template>
                </t-button>
              </div>
              <!-- 上传进度 -->
              <div v-if="image.uploading" class="upload-progress">
                <t-progress
                  :percentage="image.progress"
                  size="small"
                  :show-info="false"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 视频上传 -->
      <div class="form-section">
        <label class="form-label">上传视频</label>
        <div class="upload-section">
          <input
            ref="videoInput"
            type="file"
            accept="video/*"
            multiple
            style="display: none"
            @change="handleVideoSelect"
          />
          <t-button
            variant="outline"
            @click="($refs.videoInput as HTMLInputElement)?.click()"
            :disabled="selectedVideos.length >= 5"
          >
            <template #icon><t-icon name="add" /></template>
            选择视频 ({{ selectedVideos.length }}/5)
          </t-button>
          
          <!-- 视频预览 -->
          <div v-if="selectedVideos.length > 0" class="video-preview-list">
            <div
              v-for="(video, index) in selectedVideos"
              :key="index"
              class="video-preview-item"
            >
              <video
                v-if="video.preview"
                :src="video.preview"
                controls
                preload="metadata"
                class="video-player"
              >
                您的浏览器不支持视频播放
              </video>
              <div class="video-info">
                <span class="video-name">{{ video.file.name }}</span>
                <t-button
                  size="small"
                  theme="danger"
                  variant="text"
                  @click="removeVideo(index)"
                >
                  <template #icon><t-icon name="delete" /></template>
                </t-button>
              </div>
              <!-- 上传进度 -->
              <div v-if="video.uploading" class="upload-progress">
                <t-progress
                  :percentage="video.progress"
                  size="small"
                  :show-info="true"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 总体保存进度 -->
      <div v-if="saving" class="save-progress">
        <div class="progress-info">
          <span>{{ saveProgressText }}</span>
          <span>{{ totalProgress.toFixed(1) }}%</span>
        </div>
        <t-progress
          :percentage="totalProgress"
          :show-info="false"
        />
      </div>
      
      <!-- 操作按钮 -->
      <div class="diary-actions">
        <!-- 导航按钮行 -->
        <div class="nav-buttons">
          <t-button variant="outline" @click="handlePreviousDay" :disabled="!hasPreviousDay || saving">
            <template #icon><t-icon name="chevron-left" /></template>
            上一天
          </t-button>
          <t-button variant="outline" @click="refreshCurrentDay" :disabled="isRefreshing || saving">
            <template #icon><t-icon name="refresh" :class="{ 'fa-spin': isRefreshing }" /></template>
            刷新
          </t-button>
          <t-button variant="outline" @click="handleNextDay" :disabled="!hasNextDay || saving">
            下一天
            <template #icon><t-icon name="chevron-right" /></template>
          </t-button>
        </div>
        
        <!-- 主要操作按钮行 -->
        <div class="main-buttons">
          <t-space>
            <t-button variant="outline" @click="handleClose" :disabled="saving">取消</t-button>
            <t-button theme="danger" variant="outline" @click="handleDelete" v-if="hasExistingDiary" :disabled="saving">
              删除日记
            </t-button>
            <t-button theme="primary" @click="handleSave" :loading="saving">
              保存日记
            </t-button>
          </t-space>
        </div>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { WeatherData } from '../types/weather'
import { DateUtils } from '../utils/dateUtils'
import { SupabaseStorageService } from '../services/supabaseStorage'
import { diaryService } from '../services/diaryService'

import WeatherSummary from './WeatherSummary.vue'
// import type { WeatherDiary } from '../config/supabase'

interface Props {
  visible: boolean
  weather: WeatherData
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'saved', date: string, content: string): void
  (e: 'dateChange', date: string): void
}

interface ImageFile {
  file: File
  preview: string
  uploading: boolean
  progress: number
  url?: string
}

interface VideoFile {
  file: File
  preview: string
  uploading: boolean
  progress: number
  url?: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 表单数据
const cityLocation = ref('')
const selectedMood = ref('')
const diaryText = ref('')
const selectedImages = ref<ImageFile[]>([])
const selectedVideos = ref<VideoFile[]>([])
const saving = ref(false)
const hasExistingDiary = ref(false)
const isRefreshing = ref(false)

// 进度跟踪
const saveProgressText = ref('')
const totalProgress = ref(0)

// 心情选项
const moodOptions = [
  { value: '开心', label: '开心', emoji: '😊' },
  { value: '愉快', label: '愉快', emoji: '😄' },
  { value: '平静', label: '平静', emoji: '😌' },
  { value: '兴奋', label: '兴奋', emoji: '🤩' },
  { value: '放松', label: '放松', emoji: '😎' },
  { value: '忧郁', label: '忧郁', emoji: '😔' },
  { value: '烦躁', label: '烦躁', emoji: '😤' },
  { value: '疲惫', label: '疲惫', emoji: '😴' }
]

const date = computed(() => {
  if (!props.weather || !props.weather.date) return ''
  return DateUtils.formatFullDate(props.weather.date)
})

// 获取全局天气数据列表用于导航
const globalWeatherList = computed(() => {
  // 优先从全局数据管理器获取
  const globalManager = (window as any).__globalDataManager
  if (globalManager) {
    return globalManager.getWeatherList() || []
  }
  // 兼容性：从全局变量获取
  return (window as any).__weatherList || []
})

// 检查是否有上一天/下一天
const hasPreviousDay = computed(() => {
  if (!props.weather?.date || !globalWeatherList.value.length) return false
  const currentIndex = globalWeatherList.value.findIndex((w: WeatherData) => w.date === props.weather.date)
  return currentIndex > 0
})

const hasNextDay = computed(() => {
  if (!props.weather?.date || !globalWeatherList.value.length) return false
  const currentIndex = globalWeatherList.value.findIndex((w: WeatherData) => w.date === props.weather.date)
  return currentIndex >= 0 && currentIndex < globalWeatherList.value.length - 1
})

// 上传配置
// const uploadAction = 'data:' // 使用data URL，不实际上传到服务器

// 监听对话框打开，加载已有日记
watch(() => props.visible, async (newVisible, oldVisible) => {
  // 只有当 visible 真正变为 true 时才加载日记
  if (newVisible === true && oldVisible !== true) {
    // 强制等待一个微任务，确保组件完全渲染
    await new Promise(resolve => setTimeout(resolve, 10))
    
    if (props.weather?.date) {
      await loadDiary()
    }
  } else if (newVisible === false) {
    resetForm()
  }
})

// 添加一个专门监听 weather 变化的 watcher
watch(() => props.weather, async (newWeather, oldWeather) => {
  // 如果对话框已经打开且 weather 数据发生变化，重新加载
  // 但是如果正在保存，则跳过重新加载
  if (props.visible && !saving.value && newWeather?.date && newWeather.date !== oldWeather?.date) {
    // 强制重新加载日记数据
    await loadDiary()
  }
}, { deep: true })

// 专门监听日期变化的 watcher
watch(() => props.weather?.date, async (newDate, oldDate) => {
  // 如果正在保存，则跳过重新加载
  if (props.visible && !saving.value && newDate && newDate !== oldDate) {
    await loadDiary()
  }
})

// 重置表单
function resetForm() {
  cityLocation.value = ''
  selectedMood.value = ''
  diaryText.value = ''
  selectedImages.value = []
  selectedVideos.value = []
  hasExistingDiary.value = false
  totalProgress.value = 0
  saveProgressText.value = ''
}

// 从缓存或数据库加载日记
async function loadDiary(forceRefresh = false) {
  if (!props.weather || !props.weather.date) {
    resetForm()
    return
  }
  
  try {
    const diary = await diaryService.getDiaryByDate(props.weather.date, forceRefresh)
    
    if (diary) {
      hasExistingDiary.value = true
      cityLocation.value = diary.city || ''
      selectedMood.value = diary.mood || ''
      diaryText.value = diary.content || ''
      
      // 加载已有的图片
      if (diary.images && diary.images.length > 0) {
        selectedImages.value = diary.images.map((url: string, index: number) => ({
          file: new File([], `image-${index}.jpg`),
          preview: url,
          uploading: false,
          progress: 100,
          url: url
        }))
      }
      
      // 加载已有的视频
      if (diary.videos && diary.videos.length > 0) {
        selectedVideos.value = diary.videos.map((url: string, index: number) => ({
          file: new File([], `video-${index}.mp4`),
          preview: url,
          uploading: false,
          progress: 100,
          url: url
        }))
      }
    } else {
      resetForm()
    }
  } catch (e) {
    resetForm()
  }
}

// 图片选择处理
function handleImageSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files) return

  for (let i = 0; i < files.length && selectedImages.value.length < 9; i++) {
    const file = files[i]
    
    // 移除所有格式和大小限制，统一上调为100M
    if (file.size > 100 * 1024 * 1024) {
      console.warn(`图片 ${file.name} 超过100MB，已跳过`)
      continue
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      selectedImages.value.push({
        file,
        preview: e.target?.result as string,
        uploading: false,
        progress: 0
      })
    }
    reader.readAsDataURL(file)
  }

  // 清空input
  target.value = ''
}

// 视频选择处理
function handleVideoSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files) return

  for (let i = 0; i < files.length && selectedVideos.value.length < 5; i++) {
    const file = files[i]
    
    // 移除格式限制，统一上调大小限制为100M
    if (file.size > 100 * 1024 * 1024) {
      console.warn(`视频 ${file.name} 超过100MB，已跳过`)
      continue
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      selectedVideos.value.push({
        file,
        preview: e.target?.result as string,
        uploading: false,
        progress: 0
      })
    }
    reader.readAsDataURL(file)
  }

  // 清空input
  target.value = ''
}

// 移除图片
function removeImage(index: number) {
  selectedImages.value.splice(index, 1)
}

// 移除视频
function removeVideo(index: number) {
  selectedVideos.value.splice(index, 1)
}

// 保存日记 - 优化版本：只发起一次HTTP请求
async function handleSave() {
  if (!props.weather || !props.weather.date) {
    handleClose()
    return
  }
  
  saving.value = true
  totalProgress.value = 0
  
  try {
    // 计算总任务数
    const newImages = selectedImages.value.filter(img => !img.url)
    const newVideos = selectedVideos.value.filter(vid => !vid.url)
    const totalTasks = newImages.length + newVideos.length + 1 // +1 for saving diary
    let completedTasks = 0

    // 上传新图片
    const imageUrls: string[] = []
    
    // 添加已有图片URL
    selectedImages.value.forEach(img => {
      if (img.url) {
        imageUrls.push(img.url)
      }
    })

    if (newImages.length > 0) {
      saveProgressText.value = '正在上传图片...'
      
      for (let i = 0; i < newImages.length; i++) {
        const image = newImages[i]
        image.uploading = true
        
        try {
          const url = await SupabaseStorageService.uploadImage(
            image.file, 
            undefined, // fileName
            undefined, // userId
            (progress: number) => {
              image.progress = progress
            }
          )
          
          image.url = url
          imageUrls.push(url)
          image.uploading = false
          
          completedTasks++
          totalProgress.value = (completedTasks / totalTasks) * 100
        } catch (error) {
          console.error('图片上传失败:', error)
          image.uploading = false
        }
      }
    }

    // 上传新视频
    const videoUrls: string[] = []
    
    // 添加已有视频URL
    selectedVideos.value.forEach(vid => {
      if (vid.url) {
        videoUrls.push(vid.url)
      }
    })

    if (newVideos.length > 0) {
      saveProgressText.value = '正在上传视频...'
      
      for (let i = 0; i < newVideos.length; i++) {
        const video = newVideos[i]
        video.uploading = true
        
        try {
          const url = await SupabaseStorageService.uploadVideo(
            video.file, 
            undefined, // fileName
            undefined, // userId
            (progress: number) => {
              video.progress = progress
            }
          )
          
          video.url = url
          videoUrls.push(url)
          video.uploading = false
          
          completedTasks++
          totalProgress.value = (completedTasks / totalTasks) * 100
        } catch (error) {
          console.error('视频上传失败:', error)
          video.uploading = false
        }
      }
    }

    // 保存日记到数据库 - 只发起一次HTTP请求
    saveProgressText.value = '正在保存日记...'
    
    // 准备日记数据
    const diaryData = {
      date: props.weather.date,
      content: diaryText.value.trim(),
      weather_data: props.weather,
      images: imageUrls,
      videos: videoUrls,
      mood: selectedMood.value,
      city: cityLocation.value.trim()
    }
    
    let savedDiary: any = null
    
    // 如果内容为空，删除日记（通过传递空内容给upsert让数据库处理）
    if (!diaryData.content && !diaryData.images.length && !diaryData.videos.length && !diaryData.mood && !diaryData.city) {
      // 直接调用删除服务，避免额外查询
      try {
        await diaryService.deleteDiaryByDate(props.weather.date)
        saveProgressText.value = '日记已删除'
        savedDiary = null
      } catch (error) {
        // 如果删除失败（可能是因为日记不存在），忽略错误
        console.log('删除日记时未找到记录，可能已被删除')
        savedDiary = null
      }
    } else {
      // 保存或更新日记 - 这里只发起一次HTTP请求
      savedDiary = await diaryService.createDiary(diaryData)
      saveProgressText.value = '保存完成！'
    }
    
    completedTasks++
    totalProgress.value = 100
    saveProgressText.value = '保存完成！'
    
    // 直接更新本地缓存，避免额外的HTTP请求
    const globalManager = (window as any).__globalDataManager
    if (globalManager) {
      const diariesMap = globalManager.dataCache?.get('diaries') as Map<string, any>
      if (diariesMap) {
        if (savedDiary) {
          diariesMap.set(props.weather.date, savedDiary)
        } else {
          diariesMap.delete(props.weather.date)
        }
      }
    }
    
    // 更新统一缓存服务
    const { unifiedCacheService } = await import('../services/unifiedCacheService')
    unifiedCacheService.setDiaryData(props.weather.date, savedDiary)
    
    // 更新全局变量缓存（兼容性）
    const diaryCache = (window as any).__diaryCache
    if (diaryCache) {
      if (savedDiary) {
        diaryCache.set(props.weather.date, savedDiary)
      } else {
        diaryCache.delete(props.weather.date)
      }
    }
    
    // 通知所有组件数据已更新，无需重新请求
    window.dispatchEvent(new CustomEvent('diary:updated', { 
      detail: { 
        date: props.weather.date, 
        diary: savedDiary,
        action: savedDiary ? 'save' : 'delete'
      } 
    }))
    
    emit('saved', props.weather.date, diaryText.value.trim())
    
    setTimeout(() => {
      handleClose()
    }, 500)
    
  } catch (e) {
    console.error('保存日记失败:', e)
    saveProgressText.value = '保存失败，请重试'
  } finally {
    saving.value = false
  }
}

// 删除日记 - 优化版本：只发起一次HTTP请求
async function handleDelete() {
  if (!props.weather || !props.weather.date) return
  
  // 显示确认对话框
  const { DialogPlugin } = await import('tdesign-vue-next')
  
  const confirmDialog = DialogPlugin.confirm({
    header: '确认删除',
    body: `确定要删除 ${date.value} 的天气日记吗？删除后无法恢复。`,
    theme: 'warning',
    confirmBtn: {
      content: '确认删除',
      theme: 'danger'
    },
    cancelBtn: '取消',
    onConfirm: async () => {
      try {
        // 直接按日期删除，避免先查询的额外请求
        await diaryService.deleteDiaryByDate(props.weather.date)
        
        // 直接更新本地缓存，避免额外的HTTP请求
        const globalManager = (window as any).__globalDataManager
        if (globalManager) {
          const diariesMap = globalManager.dataCache?.get('diaries') as Map<string, any>
          if (diariesMap) {
            diariesMap.delete(props.weather.date)
          }
        }
        
        // 更新统一缓存服务
        const { unifiedCacheService } = await import('../services/unifiedCacheService')
        unifiedCacheService.setDiaryData(props.weather.date, null)
        
        // 更新全局变量缓存（兼容性）
        const diaryCache = (window as any).__diaryCache
        if (diaryCache) {
          diaryCache.delete(props.weather.date)
        }
        
        // 通知所有组件数据已更新，无需重新请求
        window.dispatchEvent(new CustomEvent('diary:updated', { 
          detail: { 
            date: props.weather.date, 
            diary: null,
            action: 'delete' 
          } 
        }))
        
        emit('saved', props.weather.date, '')
        handleClose()
        confirmDialog.destroy()
      } catch (e) {
        console.error('删除日记失败:', e)
        confirmDialog.destroy()
      }
    },
    onCancel: () => {
      confirmDialog.destroy()
    }
  })
}

function handlePreviousDay() {
  if (!hasPreviousDay.value) return
  
  const currentIndex = globalWeatherList.value.findIndex((w: WeatherData) => w.date === props.weather.date)
  if (currentIndex > 0) {
    const previousWeather = globalWeatherList.value[currentIndex - 1]
    emit('dateChange', previousWeather.date)
  }
}

function handleNextDay() {
  if (!hasNextDay.value) return
  
  const currentIndex = globalWeatherList.value.findIndex((w: WeatherData) => w.date === props.weather.date)
  if (currentIndex >= 0 && currentIndex < globalWeatherList.value.length - 1) {
    const nextWeather = globalWeatherList.value[currentIndex + 1]
    emit('dateChange', nextWeather.date)
  }
}

async function refreshCurrentDay() {
  if (isRefreshing.value || saving.value) return
  
  isRefreshing.value = true
  try {
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
  emit('update:visible', false)
}

function handleVisibleChange(value: boolean) {
  emit('update:visible', value)
}
</script>

<style scoped>
.diary-edit-content {
  padding: 0;
}

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
}

.weather-icon-section {
  display: flex;
  /* flex-direction: column; */
  align-items: center;
  text-align: center;
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
  /* gap: 20px; */
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

.form-section {
  margin-bottom: 24px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.mood-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.mood-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mood-option:hover {
  border-color: #0052d9;
  background: rgba(0, 82, 217, 0.05);
}

.mood-option.active {
  border-color: #0052d9;
  background: rgba(0, 82, 217, 0.1);
}

.mood-emoji {
  font-size: 24px;
  margin-bottom: 4px;
}

.mood-label {
  font-size: 12px;
  color: #666;
}

.mood-option.active .mood-label {
  color: #0052d9;
  font-weight: 500;
}

.upload-section {
  margin-top: 8px;
}

.image-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.image-preview-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
}

.image-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-preview-item:hover .image-overlay {
  opacity: 1;
}

.video-preview-list {
  margin-top: 16px;
}

.video-preview-item {
  position: relative;
  margin-bottom: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.video-player {
  width: 100%;
  max-height: 300px;
}

.video-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
}

.video-name {
  font-size: 14px;
  color: #333;
  flex: 1;
  margin-right: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px;
}

.save-progress {
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
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
    justify-content: space-between;
    align-items: center;
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

@media (max-width: 768px) {
  .weather-summary {
    flex-direction: column;
    text-align: center;
  }
  
  .weather-icon {
    margin-right: 0;
    margin-bottom: 12px;
  }
  
  .mood-selector {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .image-preview-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>