<template>
  <t-dialog
    :visible="visible"
    :header="`${date} 天气日记`"
    width="600px"
    :footer="false"
    @close="handleClose"
    @update:visible="handleVisibleChange"
  >
    <div class="diary-content">
      <div class="weather-summary" v-if="weather">
        <div class="weather-icon">{{ weather.icon || '🌤️' }}</div>
        <div class="weather-info">
          <div class="temp-row">
            <img v-if="imageData" class="diary-thumb" :src="imageData" alt="日记图片" />
            <div class="temperature">{{ weather.temperature?.current || 0 }}°</div>
            <div class="snippet" v-if="savedPreview">{{ savedPreview }}</div>
          </div>
          <div class="description">{{ weather.description || '未知天气' }}</div>
          <div class="details">
            {{ weather.temperature?.min || 0 }}° / {{ weather.temperature?.max || 0 }}° · 
            降雨量: {{ weather.precipitation || 0 }}mm · 
            风力: {{ weather.windSpeed || 0 }}km/h {{ weather.windDirection || '' }}
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-state">
        <t-loading size="medium" text="正在加载日记..." />
      </div>
      
      <!-- 日记内容 -->
      <template v-else>
        <div class="diary-preview" v-if="savedContent">
          已保存日记：{{ savedPreview }}
        </div>
        
        <div class="diary-editor">
          <t-textarea
            v-model="diaryText"
            :placeholder="`记录一下 ${date} 的天气感受吧...`"
            :maxlength="1000"
            :autosize="{ minRows: 8, maxRows: 15 }"
            show-limit-number
            clearable
          />
        </div>
        <div class="image-uploader">
          <t-space align="center">
            <input 
              type="file" 
              multiple 
              :accept="acceptTypes" 
              @change="onFilesChange" 
              :disabled="imageProcessing"
            />
            <t-button v-if="imageList.length > 0" variant="outline" theme="danger" size="small" @click="clearAllImages">清空图片</t-button>
          </t-space>
          
          <!-- 图片处理进度 -->
          <div v-if="imageProcessing" class="processing-status">
            <t-loading size="small" />
            <span class="processing-text">
              正在处理图片 {{ processingProgress.current }}/{{ processingProgress.total }}
              <br>
              <small>{{ processingProgress.fileName }}</small>
            </span>
          </div>
          
          <!-- 图片格式提示 -->
          <div class="format-tip">
            <small>支持格式：{{ deviceConfig.supportedFormats.map(f => f.split('/')[1].toUpperCase()).join('、') }}</small>
            <br>
            <small>单张图片最大{{ deviceConfig.maxFileSize }}MB，自动压缩至{{ deviceConfig.maxWidth }}x{{ deviceConfig.maxHeight }}</small>
            <br>
            <small v-if="deviceConfig.enableHEICConversion">✅ 自动转换iPhone HEIC格式</small>
          </div>
          
          <div class="images-preview" v-if="imageList.length > 0">
            <div class="image-item" v-for="(img, index) in imageList" :key="index">
              <img :src="img" alt="预览" @error="handleImageError(index)" />
              <t-button size="small" theme="danger" variant="text" @click="removeImage(index)">×</t-button>
            </div>
          </div>
        </div>
        
        <div class="diary-actions">
          <t-space>
            <t-button variant="outline" @click="handleClose">取消</t-button>
            <t-button theme="primary" @click="handleSave" :loading="saving">
              保存日记
            </t-button>
          </t-space>
        </div>
      </template>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { WeatherData } from '../types/weather'
import { DateUtils } from '../utils/dateUtils'
import { ImageUtils, HEICConverter } from '../utils/imageUtils'
import { getOptimalImageConfig, getAcceptTypes, getCameraRecommendations } from '../config/mobileImageConfig'

import { diaryService } from '../services/diaryService'

interface Props {
  visible: boolean
  weather: WeatherData
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'saved', date: string, content: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const diaryText = ref('')
const saving = ref(false)
const savedContent = ref('')
const imageData = ref<string>('') // 封面（第一张）
const imageList = ref<string[]>([])
const imageDirty = ref(false)
const isLoading = ref(false)
const imageProcessing = ref(false)
const processingProgress = ref<{ current: number; total: number; fileName: string }>({ current: 0, total: 0, fileName: '' })

// 设备优化配置
const deviceConfig = getOptimalImageConfig()
const acceptTypes = getAcceptTypes()
const cameraRecommendations = getCameraRecommendations()

const savedPreview = computed(() => {
  const text = savedContent.value.trim()
  if (!text) return ''
  const head = text.slice(0, 10)
  return head + (text.length > 10 ? '…' : '')
})

const date = computed(() => {
  if (!props.weather || !props.weather.date) return ''
  return DateUtils.formatFullDate(props.weather.date)
})

// 监听对话框打开，加载已有日记
watch(() => props.visible, async (newVisible, oldVisible) => {
  console.log('🔍 visible 变化:', oldVisible, '->', newVisible, 'weather.date:', props.weather?.date)
  
  if (newVisible && props.weather?.date) {
    console.log('🚀 对话框打开，开始加载日记')
    isLoading.value = true
    await loadDiary()
    isLoading.value = false
  } else if (!newVisible) {
    console.log('对话框关闭，清空数据')
    diaryText.value = ''
    imageData.value = ''
    imageList.value = []
    imageDirty.value = false
    isLoading.value = false
  }
}, { immediate: false }) // 改为 false，避免初始化时重复调用

// 组件挂载时，如果对话框已经可见，立即加载数据
onMounted(async () => {
  console.log('组件挂载，visible:', props.visible, 'weather.date:', props.weather?.date)
  if (props.visible && props.weather?.date) {
    console.log('挂载时立即加载日记')
    isLoading.value = true
    await loadDiary()
    isLoading.value = false
  }
})

// 监听天气数据变化，重新加载日记
watch(() => props.weather?.date, async (newDate, oldDate) => {
  if (newDate && newDate !== oldDate && props.visible) {
    isLoading.value = true
    await loadDiary()
    isLoading.value = false
  }
})

// 从数据库加载日记
async function loadDiary() {
  console.log('🔍 loadDiary 被调用，日期:', props.weather?.date)
  
  if (!props.weather || !props.weather.date) {
    console.log('❌ 没有天气数据或日期，清空状态')
    clearDiaryState()
    return
  }
  
  try {
    // 优先从全局缓存获取，避免重复请求
    const globalCache = (window as any).__diaryCache
    let diary = null
    
    if (globalCache && globalCache.has(props.weather.date)) {
      diary = globalCache.get(props.weather.date)
      console.log('📦 从全局缓存获取日记:', diary)
    } else {
      console.log('🚀 从数据库加载日记，日期:', props.weather.date)
      diary = await diaryService.getDiaryByDate(props.weather.date)
      
      // 更新全局缓存
      if (globalCache) {
        globalCache.set(props.weather.date, diary)
      }
      console.log('📦 从数据库获取日记:', diary)
    }
    
    if (diary) {
      console.log('✅ 找到日记，设置内容')
      savedContent.value = diary.content || ''
      diaryText.value = diary.content || ''
      imageData.value = diary.images?.[0] || ''
      imageList.value = diary.images || []
      imageDirty.value = false
    } else {
      console.log('📝 没有找到日记，设置为空状态')
      clearDiaryState()
    }
  } catch (e) {
    console.error('💥 加载日记失败:', e)
    clearDiaryState()
  }
}

// 清空日记状态的辅助函数
function clearDiaryState() {
  savedContent.value = ''
  diaryText.value = ''
  imageData.value = ''
  imageList.value = []
  imageDirty.value = false
}

// 保存日记到数据库
async function handleSave() {
  if (!props.weather || !props.weather.date) {
    handleClose()
    return
  }
  
  saving.value = true
  try {
    if (!diaryText.value.trim() && !imageList.value.length) {
      // 如果内容为空，删除日记
      const existingDiary = await diaryService.getDiaryByDate(props.weather.date, true)
      if (existingDiary?.id) {
        await diaryService.deleteDiary(existingDiary.id)
      }
      savedContent.value = ''
      emit('saved', props.weather.date, '')
      
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
      
      // 通知全局刷新（卡片实时更新）
      window.dispatchEvent(new CustomEvent('diary:updated', { 
        detail: { 
          date: props.weather.date, 
          diary: null,
          action: 'delete' 
        } 
      }))
    } else {
      // 保存或更新日记
      const savedDiary = await diaryService.createDiary({
        date: props.weather.date,
        content: diaryText.value.trim(),
        weather_data: props.weather,
        images: imageDirty.value ? imageList.value : [],
        mood: '',
        city: '',
        videos: []
      })
      savedContent.value = diaryText.value.trim()
      emit('saved', props.weather.date, diaryText.value.trim())
      
      // 直接更新本地缓存，避免额外的HTTP请求
      const globalManager = (window as any).__globalDataManager
      if (globalManager) {
        const diariesMap = globalManager.dataCache?.get('diaries') as Map<string, any>
        if (diariesMap) {
          diariesMap.set(props.weather.date, savedDiary)
        }
      }
      
      // 更新统一缓存服务
      const { unifiedCacheService } = await import('../services/unifiedCacheService')
      unifiedCacheService.setDiaryData(props.weather.date, savedDiary)
      
      // 更新全局变量缓存（兼容性）
      const diaryCache = (window as any).__diaryCache
      if (diaryCache) {
        diaryCache.set(props.weather.date, savedDiary)
      }
      
      // 通知全局刷新（卡片实时更新）
      window.dispatchEvent(new CustomEvent('diary:updated', { 
        detail: { 
          date: props.weather.date, 
          diary: savedDiary,
          action: 'save' 
        } 
      }))
    }
    handleClose()
  } catch (e) {
    console.error('保存日记失败:', e)
  } finally {
    saving.value = false
  }
}

async function onFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  
  imageProcessing.value = true
  processingProgress.value = { current: 0, total: files.length, fileName: '' }
  
  try {
    const fileArray = Array.from(files)
    const newImages: string[] = []
    
    // 验证和处理每个文件
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      processingProgress.value = { current: i + 1, total: fileArray.length, fileName: file.name }
      
      try {
        // 验证文件
        const validation = ImageUtils.validateImageFile(file)
        if (!validation.valid) {
          console.warn(`跳过文件 ${file.name}: ${validation.error}`)
          continue
        }
        
        // 处理HEIC格式
        let processedFile = file
        if (HEICConverter.isHEICFormat(file)) {
          try {
            processedFile = await HEICConverter.convertToJPEG(file)
            console.log(`HEIC文件 ${file.name} 已转换为JPEG`)
          } catch (error) {
            console.error(`HEIC转换失败 ${file.name}:`, error)
            continue
          }
        }
        
        // 压缩和优化图片
        const result = await ImageUtils.processImage(processedFile, {
          maxWidth: deviceConfig.maxWidth,
          maxHeight: deviceConfig.maxHeight,
          quality: deviceConfig.quality,
          format: 'jpeg',
          maxFileSize: deviceConfig.maxFileSize
        })
        
        newImages.push(result.dataUrl)
        
        // 显示压缩信息
        const compressionRatio = ((result.originalSize - result.compressedSize) / result.originalSize * 100).toFixed(1)
        console.log(`图片 ${file.name} 处理完成:`, {
          原始大小: `${(result.originalSize / 1024 / 1024).toFixed(2)}MB`,
          压缩后大小: `${(result.compressedSize / 1024 / 1024).toFixed(2)}MB`,
          压缩率: `${compressionRatio}%`
        })
        
      } catch (error) {
        console.error(`处理图片 ${file.name} 失败:`, error)
        // 继续处理其他图片
      }
    }
    
    // 更新图片列表
    if (newImages.length > 0) {
      imageList.value = [...imageList.value, ...newImages]
      if (imageList.value.length > 0) {
        imageData.value = imageList.value[0]
      }
      imageDirty.value = true
    }
    
    // 清空input，允许重复选择相同文件
    input.value = ''
    
  } catch (error) {
    console.error('批量处理图片失败:', error)
  } finally {
    imageProcessing.value = false
    processingProgress.value = { current: 0, total: 0, fileName: '' }
  }
}

function removeImage(index: number) {
  imageList.value.splice(index, 1)
  if (index === 0 && imageList.value.length > 0) {
    imageData.value = imageList.value[0]
  } else if (imageList.value.length === 0) {
    imageData.value = ''
  }
  imageDirty.value = true
}

function clearAllImages() {
  imageData.value = ''
  imageList.value = []
  imageDirty.value = true
}

function handleImageError(index: number) {
  console.error(`图片预览失败，索引: ${index}`)
  // 可以选择移除有问题的图片
  // removeImage(index)
}

function handleClose() {
  emit('update:visible', false)
}

function handleVisibleChange(value: boolean) {
  emit('update:visible', value)
}
</script>

<style scoped>
.diary-content {
  padding: 0;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  color: #666;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  color: #666;
}

.weather-summary {
  display: flex;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e6f3ff 100%);
  border-radius: 8px;
  margin-bottom: 20px;
}

.weather-icon {
  font-size: 48px;
  margin-right: 16px;
}

.weather-info {
  flex: 1;
}

.temperature {
  font-size: 32px;
  font-weight: 700;
  color: #0052d9;
  margin-bottom: 4px;
}

.temp-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diary-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}

.snippet {
  margin-left: 8px;
  color: #666;
  font-size: 14px;
  white-space: nowrap;
}

.description {
  font-size: 18px;
  color: #333;
  margin-bottom: 8px;
}

.details {
  font-size: 14px;
  color: #666;
}

.diary-preview {
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}

.diary-editor {
  margin-bottom: 20px;
}

.image-uploader {
  margin-bottom: 12px;
}

.processing-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  padding: 8px 12px;
  background: #f0f7ff;
  border-radius: 4px;
  font-size: 14px;
  color: #0052d9;
}

.processing-text {
  line-height: 1.4;
}

.format-tip {
  margin: 8px 0;
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 4px;
  color: #666;
  font-size: 12px;
  line-height: 1.3;
}

.images-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.image-item {
  position: relative;
  width: 80px;
  height: 80px;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.image-item button {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  padding: 0;
  font-size: 14px;
  line-height: 1;
}

.diary-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid #eee;
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
}
</style>