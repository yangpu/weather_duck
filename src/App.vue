<template>
  <div class="app">
    <!-- 离线状态指示器 -->
    <OfflineIndicator @online="handleOnline" @offline="handleOffline" />
    
    <!-- PWA安装提示 -->
    <PWAInstall @app-installed="handleAppInstalled" />
    
    <AppHeader 
      title="天气小鸭 · 暑假天气日历"
      :location="headerProvince || headerCity ? `${headerCity}${headerProvince && headerCity ? ' · ' : ''}${headerProvince}` : ''"
      :scroll-threshold="100"
      @refresh="handleFetchAll"
      @settings="showAbout"
      class="no-print"
    >
      <template #header-actions>
        <HeaderActions
          v-model:cityKeyword="cityKeyword"
          v-model:cityOptions="cityOptions"
          v-model:selectedCity="selectedCity"
          v-model:dateRangeValue="dateRangeValue"
          :locating="locating"
          :displayAddress="displayAddress"
          @citySelected="onCitySelected"
          @useMyLocation="useMyLocation"
          @dateRangeChange="onDateRangeChange"
          @fetchAll="handleFetchAll"
          @printPage="printPage"
        />
      </template>
    </AppHeader>

    <div class="app-content">
      <t-alert v-if="errorMessage" theme="error" :message="errorMessage" class="no-print" />
      <t-loading :loading="overlayVisible" text="数据加载中...">

        
        <div class="cards-grid">
          <WeatherCard 
            v-for="item in weatherList" 
            :key="item.date" 
            :weather="item" 
            @click="handleWeatherCardClick"
          />
          <!-- 合并的加载更多卡片 -->
          <LoadMoreCard
            :loading-next="loadingNext"
            :loading-previous="loadingPrevious"
            :current-start-date="startDate"
            :current-end-date="endDate"
            :has-loaded-future3-days="hasLoadedFuture3Days"
            @load-next="handleLoadNext"
            @load-previous="handleLoadPrevious"
          />
        </div>
      </t-loading>
    </div>

    <!-- 天气趋势图表 - 移至最下方 -->
    <div class="chart-section no-print">
      <div class="section-divider"></div>
      <div class="chart-container">
        <h2 class="chart-title">天气趋势图表</h2>
        <WeatherLineChart :data="weatherList" :height="400" @card-click="handleWeatherCardClick" />
      </div>
    </div>

    <div class="app-footer no-print">
      <div class="footer">
        <div class="footer-info">
          数据来源：Open-Meteo 免费API · 时区：Asia/Shanghai · 位置：{{ displayAddress }}（{{ latitude.toFixed(4) }}, {{ longitude.toFixed(4) }}）
          <span v-if="isDefaultLocation" class="location-note">（默认位置）</span>
        </div>
        <div class="footer-author">
          <span class="author-info"  @click="showAbout" title="关于天气小鸭">
            ©️版权所有：杨若即 · 
            <a href="mailto:yangruoji@outlook.com" class="email-link">yangruoji@outlook.com</a>
          </span>
          <a 
            href="https://github.com/yangruoji/weather_duck.git" 
            target="_blank" 
            rel="noopener noreferrer"
            class="github-footer-link"
            title="GitHub项目"
          >
            <svg class="github-footer-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>

    </div>

    <!-- 日记查看对话框 -->
    <WeatherDiaryView
      v-if="selectedWeather"
      v-model:visible="diaryViewVisible"
      :weather="selectedWeather"
      @edit="handleEditDiary"
      @date-change="handleDateChange"
    />

    <!-- 日记编辑对话框 -->
    <WeatherDiaryEdit
      v-if="selectedWeather"
      v-model:visible="diaryEditVisible"
      :weather="selectedWeather"
      @saved="handleDiarySaved"
      @dateChange="handleEditDateChange"
    />

    <!-- About对话框 -->
    <AboutDialog v-model:visible="aboutVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'

// 扩展Window接口以支持markLoaded函数
declare global {
  interface Window {
    markLoaded?: (component: string) => void;
  }
}
import { DateUtils } from './utils/dateUtils'
import WeatherCard from './components/WeatherCard.vue'
import WeatherLineChart from './components/WeatherLineChart.vue'
import WeatherDiaryEdit from './components/WeatherDiaryEdit.vue'
import WeatherDiaryView from './components/WeatherDiaryView.vue'
import LoadMoreCard from './components/LoadMoreCard.vue'
import AboutDialog from './components/AboutDialog.vue'
import OfflineIndicator from './components/OfflineIndicator.vue'
import PWAInstall from './components/PWAInstall.vue'
import AppHeader from './components/AppHeader.vue'
import HeaderActions from './components/HeaderActions.vue'
import { WeatherApiService } from './services/weatherApi'

import { weatherService } from './services/weatherService'
import { diaryService } from './services/diaryService'
import { optimizedUnifiedCacheService } from './services/optimizedUnifiedCacheService'
import { enhancedOfflineCacheService } from './services/enhancedOfflineCacheService'
import { dateRangeManager } from './services/dateRangeManager'
import { globalDataManager } from './services/globalDataManager'
import type { WeatherData } from './types/weather'

import { GeocodingService } from './services/geocoding'
import { initializeSupabase } from './utils/initSupabase'

const loading = ref(false)
const locating = ref(false)
const loadingNext = ref(false)
const loadingPrevious = ref(false)
const hasLoadedFuture3Days = ref(false)
const errorMessage = ref('')
const overlayVisible = ref(true)


const latitude = ref(22.5429)
const longitude = ref(114.0596)
const displayAddress = ref('定位中...')
const isDefaultLocation = ref(true)

const cityKeyword = ref('')
const cityOptions = ref<Array<{ label: string; value: string; lat: number; lon: number }>>([])
const selectedCity = ref<string>()

const defaultRange = DateUtils.getDefaultDateRange()
const startDate = ref(defaultRange.startDate)
const endDate = ref(defaultRange.endDate)
const dateRangeValue = ref<[string, string]>([startDate.value, endDate.value])

const weatherList = ref<WeatherData[]>([])
const ts = () => new Date().toISOString()


// 日记相关状态
const diaryViewVisible = ref(false)
const diaryEditVisible = ref(false)
const selectedWeather = ref<WeatherData | null>(null)

// About对话框状态
const aboutVisible = ref(false)

// 滚动条宽度计算和处理
const scrollbarWidth = ref(0)

// 计算滚动条宽度
function calculateScrollbarWidth() {
  const outer = document.createElement('div')
  outer.style.visibility = 'hidden'
  outer.style.overflow = 'scroll'
  ;(outer.style as any).msOverflowStyle = 'scrollbar'
  document.body.appendChild(outer)

  const inner = document.createElement('div')
  outer.appendChild(inner)

  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth
  outer.parentNode?.removeChild(outer)

  return scrollbarWidth
}

// 设置CSS变量
function setScrollbarWidth() {
  const width = calculateScrollbarWidth()
  scrollbarWidth.value = width
  document.documentElement.style.setProperty('--scrollbar-width', `${width}px`)
}

// 监听对话框状态变化
function handleDialogStateChange() {
  const hasVisibleDialog = diaryViewVisible.value || diaryEditVisible.value || aboutVisible.value
  
  if (hasVisibleDialog) {
    document.body.classList.add('dialog-open')
  } else {
    document.body.classList.remove('dialog-open')
  }
}



// 计算标题中显示的城市和省份
const headerParts = computed(() => {
  const raw = displayAddress.value || ''
  if (!raw || raw === '未知位置') return [] as string[]
  return raw.split(' · ').filter(Boolean)
})
const headerCity = computed(() => headerParts.value[0] || '')
const headerProvince = computed(() => headerParts.value[1] || '')

// 将"当前定位"设置为城市选择的默认值
function setSelectedToCurrentLocation(label?: string) {
  const value = `${latitude.value},${longitude.value}`
  const option = {
    label: label || displayAddress.value || '当前定位',
    value,
    lat: latitude.value,
    lon: longitude.value
  }
  const idx = cityOptions.value.findIndex((o) => o.value === value)
  if (idx >= 0) {
    cityOptions.value.splice(idx, 1, option)
  } else {
    cityOptions.value.unshift(option)
  }
  selectedCity.value = value
}

function onDateRangeChange(val: [Date, Date] | [string, string]) {
  const [start, end] = val as [Date | string, Date | string]
  const s = typeof start === 'string' ? start : start.toISOString().slice(0, 10)
  const e = typeof end === 'string' ? end : end.toISOString().slice(0, 10)
  startDate.value = s
  endDate.value = e
  
  // 更新全局日期范围管理器
  dateRangeManager.setDateRange(s, e)
}

function handleFetchAll(forceRefresh: boolean) {
  fetchAll(forceRefresh)
}



async function onCitySelected(val: string) {
  const target = cityOptions.value.find((o) => o.value === val)
  if (!target) return
  latitude.value = target.lat
  longitude.value = target.lon
  selectedCity.value = val
  displayAddress.value = target.label
  isDefaultLocation.value = false
  // 首屏缓存已渲染，后台同步不阻塞UI
  fetchAll(false) // 初始加载不强制刷新，优先使用缓存
}

async function useMyLocation() {
  locating.value = true
  errorMessage.value = ''
  
  try {
    const loc = await WeatherApiService.getCurrentLocation()
    latitude.value = loc.latitude
    longitude.value = loc.longitude
    isDefaultLocation.value = false
    
    displayAddress.value = await GeocodingService.reverseGeocode(latitude.value, longitude.value)
    setSelectedToCurrentLocation(displayAddress.value)
    
    // 定位成功提示
    MessagePlugin.success('定位成功！')
    
    fetchAll(false) // 定位成功后不强制刷新，优先使用缓存
  } catch (e: any) {
    console.error('定位失败:', e)
    
    // 使用tdesign的MessagePlugin显示错误提示
    const errorMsg = e?.message || '定位失败，请检查浏览器定位权限或网络连接'
    MessagePlugin.error(errorMsg)
    
    // 定位失败时使用默认坐标（广东深圳）
    latitude.value = 22.5429
    longitude.value = 114.0596
    isDefaultLocation.value = true
    displayAddress.value = '深圳市 · 广东省 · 中国'
    setSelectedToCurrentLocation('深圳市 · 广东省 · 中国（默认）')
    
    // 显示使用默认位置的提示
    MessagePlugin.warning('已使用默认位置：深圳市')
    
    await fetchAll(false) // 使用默认位置后不强制刷新，优先使用缓存
  } finally {
    locating.value = false
  }
}

async function fetchAll(forceRefresh: boolean = false) {
  // 防止重复调用
  if (loading.value && !forceRefresh) {

    return
  }
  
  // 更新全局日期范围管理器
  dateRangeManager.setDateRange(startDate.value, endDate.value)
  

  
  errorMessage.value = ''
  if (!DateUtils.isValidDateRange(startDate.value, endDate.value)) {
    errorMessage.value = '日期范围不合法（开始不能晚于结束，且最多30天）。'
    return
  }
  

  
  // 缓存优先策略：先尝试立即显示缓存数据
  if (!forceRefresh) {

    try {
      // 先从缓存获取数据，立即显示
      const cachedResult = await optimizedUnifiedCacheService.getCachedDataImmediate(
        startDate.value,
        endDate.value
      )
      
      if (cachedResult && cachedResult.weatherData.length > 0) {


        
        // 立即更新UI，不显示loading
        weatherList.value = [...cachedResult.weatherData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        
        // 更新日记缓存
        cachedResult.diariesData.forEach(diary => {
          diaryCache.value.set(diary.date, diary)
        })
        ;(window as any).__diaryCache = diaryCache.value
        
        // 标记数据已加载，避免显示loading
        loading.value = false

        overlayVisible.value = false
        
        // 只有在线时才进行后台更新
        if (navigator.onLine) {


          optimizedUnifiedCacheService.initializeDataOptimized(
            startDate.value,
            endDate.value,
            latitude.value,
            longitude.value,
            false // 后台更新不强制刷新
          ).then(backgroundResult => {


            // 静默更新UI数据
            weatherList.value = [...backgroundResult.weatherData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            backgroundResult.diariesData.forEach(diary => {
              diaryCache.value.set(diary.date, diary)
            })
          }).catch(error => {
          })
        } else {

        }
        
        return // 缓存数据已显示，直接返回
      }
    } catch (cacheError) {
    }
  }

  // 如果没有缓存数据或强制刷新，显示loading并正常加载

  loading.value = weatherList.value.length === 0 || forceRefresh

  try {
    // 只有在强制刷新时才清除缓存
    if (forceRefresh) {


      // 清除所有缓存，强制重新获取数据
      optimizedUnifiedCacheService.clearCache()
      
      // 清除全局数据管理器缓存
      const globalManager = (window as any).__globalDataManager
      if (globalManager) {
        globalManager.clearCache()
      }
      
      // 清除本地日记缓存
      diaryCache.value.clear()
      ;(window as any).__diaryCache = diaryCache.value
    }
    

    // 使用统一缓存服务，支持缓存优先策略和请求去重
    const result = await optimizedUnifiedCacheService.initializeDataOptimized(
      startDate.value,
      endDate.value,
      latitude.value,
      longitude.value,
      forceRefresh // 传递forceRefresh参数
    )
    

    
    // 确保数据被正确缓存到离线服务
    try {
      if ((window as any).__offlineDataService) {
        await (window as any).__offlineDataService.cacheWeatherData(result.weatherData)
        await (window as any).__offlineDataService.cacheDiaryData(result.diariesData)

        
        // 验证缓存是否成功
        ;(window as any).__offlineDataService.getCacheStats()

        
        // 额外验证：检查localStorage中的数据
        Object.keys(localStorage).filter(key => key.startsWith('weather_'))
        Object.keys(localStorage).filter(key => key.startsWith('diary_'))

        
      } else {
        // 兜底：直接缓存到localStorage
        result.weatherData.forEach((weather: any) => {
          if (weather && weather.date && !weather.isPlaceholder) {
            const key = `weather_${weather.date}`
            localStorage.setItem(key, JSON.stringify(weather))
          }
        })
        
        result.diariesData.forEach((diary: any) => {
          if (diary && diary.date) {
            const key = `diary_${diary.date}`
            localStorage.setItem(key, JSON.stringify(diary))
          }
        })
        

      }
    } catch (error) {
      console.error('❌ 缓存数据时出错:', error)
      
      // 最后的兜底：直接存储到localStorage
      try {
        result.weatherData.forEach((weather: any) => {
          if (weather && weather.date && !weather.isPlaceholder) {
            const key = `weather_${weather.date}`
            localStorage.setItem(key, JSON.stringify(weather))
          }
        })
        
        result.diariesData.forEach((diary: any) => {
          if (diary && diary.date) {
            const key = `diary_${diary.date}`
            localStorage.setItem(key, JSON.stringify(diary))
          }
        })
        

      } catch (fallbackError) {
        console.error('❌ 兜底缓存也失败:', fallbackError)
      }
    }
    
    // 按日期倒序排列显示
    weatherList.value = [...result.weatherData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // 确保全局数据管理器也被正确初始化
    const globalManager = (window as any).__globalDataManager
    if (globalManager) {
      await globalManager.initialize(
        startDate.value,
        endDate.value,
        latitude.value,
        longitude.value
      )
    }

    // 标记天气数据已加载完成
    if (window.markLoaded) {
      window.markLoaded('weather');
    }

  } catch (e: any) {
    console.error('❌ fetchAll 执行失败:', e)
    errorMessage.value = e?.message || '获取天气失败'
  } finally {
    loading.value = false
  }
}

function printPage() {
  window.print()
}

// 日记缓存，避免重复请求
const diaryCache = ref<Map<string, any>>(new Map())

// 将缓存和天气数据暴露给全局，供WeatherCard和WeatherDiaryView使用
;(window as any).__diaryCache = diaryCache.value

// 监听 weatherList 变化，同步更新全局变量
watch(weatherList, (newWeatherList) => {
  ;(window as any).__weatherList = newWeatherList

}, { immediate: true, deep: true })



// 监听对话框状态变化，处理滚动条宽度
// watch([diaryViewVisible, diaryEditVisible, aboutVisible], () => {
//   handleDialogStateChange()
// }, { immediate: true })

// 批量预加载日记概览（已被全局数据管理器替代，保留以防需要）
/*
async function preloadDiariesOverview(startDate: string, endDate: string) {
  try {
    // 使用新的缓存服务批量获取日记
    const diaries = await diaryService.getDiariesByDateRange(startDate, endDate)
    
    // 将结果存入全局缓存（兼容现有代码）
    diaries.forEach(diary => {
      if (diary.date) {
        diaryCache.value.set(diary.date, diary)
      }
    })

    // 通知所有WeatherCard组件更新
    window.dispatchEvent(new CustomEvent('diaries:loaded', { 
      detail: { startDate, endDate, diaries } 
    }))
  } catch (error) {
    console.warn('预加载日记概览失败:', error)
  }
}
*/

// 处理天气卡片点击 - 优化：使用统一缓存服务
function handleWeatherCardClick(weather: WeatherData) {

  
  // 先设置选中的天气数据
  selectedWeather.value = weather
  
  // 从统一缓存服务获取日记数据
  const diary = optimizedUnifiedCacheService.getDiaryData(weather.date)

  
  // 同时更新本地缓存（兼容性）
  if (diary) {
    diaryCache.value.set(weather.date, diary)
    // 更新全局缓存引用
    ;(window as any).__diaryCache = diaryCache.value
  }
  
  // 根据日记内容决定显示查看还是编辑页面
  const hasContent = diary && !Array.isArray(diary) && (
    diary.content?.trim() || 
    diary.images?.length || 
    diary.videos?.length || 
    diary.mood
  )
  
  if (hasContent) {

    diaryViewVisible.value = true
  } else {

    diaryEditVisible.value = true
  }
}

// 处理编辑日记
function handleEditDiary(weather: WeatherData) {
  selectedWeather.value = weather
  diaryViewVisible.value = false
  diaryEditVisible.value = true
}

// 处理日期变化（上一天/下一天）
function handleDateChange(date: string) {
  const weather = weatherList.value.find(w => w.date === date)
  if (weather) {
    selectedWeather.value = weather
    // 保持当前对话框状态，只更新数据
  }
}

// 处理编辑日期变化（上一天/下一天）
function handleEditDateChange(date: string) {
  const weather = weatherList.value.find(w => w.date === date)
  if (weather) {

    selectedWeather.value = weather
    // 保持编辑对话框打开状态，只更新数据
  }
}

// 处理日记保存
async function handleDiarySaved(date: string, _content: string) {

  
  // 直接从缓存获取数据，避免重新请求
  try {
    // 从全局缓存获取最新的日记数据
    const globalManager = (window as any).__globalDataManager
    let diary = null
    
    if (globalManager) {
      const diariesMap = globalManager.dataCache?.get('diaries') as Map<string, any>
      if (diariesMap) {
        diary = diariesMap.get(date) || null
      }
    }
    
    // 更新本地缓存
    if (diary) {
      diaryCache.value.set(date, diary)
    } else {
      diaryCache.value.delete(date)
    }
    

  } catch (error) {
    console.warn('更新缓存失败:', error)
  }
}

// 显示About对话框
function showAbout() {
  aboutVisible.value = true
}



// 处理加载后7天数据
async function handleLoadNext(startDateStr: string, endDateStr: string, isForecast: boolean) {
  if (loadingNext.value) return

  loadingNext.value = true
  try {
    // console.log(`🔄 开始加载后7天数据: ${startDateStr} 到 ${endDateStr}`)
    
    // 生成请求日期范围内的所有日期，用于缓存管理
    const requestDates = DateUtils.getDatesBetween(startDateStr, endDateStr)
    // console.log(`📅 请求日期范围包含的所有日期:`, requestDates)
    
    // 并行获取天气数据和日记数据
    const [newWeatherData, newDiariesData] = await Promise.all([
      weatherService.getWeatherForDateRange(
        latitude.value,
        longitude.value,
        startDateStr,
        endDateStr
      ),
      // 获取对应日期范围的日记数据，强制刷新以确保发起网络请求
      diaryService.getDiariesByDateRange(startDateStr, endDateStr, true)
    ])
    
    // console.log(`📦 加载到的天气数据:`, newWeatherData?.length || 0, '条')
    // console.log(`📔 加载到的日记数据:`, newDiariesData?.length || 0, '条')
    
    if (newWeatherData && newWeatherData.length > 0) {
      // 按日期索引合并天气数据，避免重复
      const existingWeatherMap = new Map(weatherList.value.map(w => [w.date, w]))
      newWeatherData.forEach(weather => {
        if (weather && weather.date) {
          existingWeatherMap.set(weather.date, weather)
        }
      })
      
      // 按日期倒序排列显示
      weatherList.value = Array.from(existingWeatherMap.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // 按日期索引增量更新日记缓存 - 保留原有缓存数据
      // console.log(`📝 更新前缓存中的日记数量:`, diaryCache.value.size)
      // console.log(`📝 更新前缓存中的所有日记日期:`, Array.from(diaryCache.value.keys()).sort())
      
      // 对于请求范围内的每个日期，都要处理缓存更新
      requestDates.forEach(date => {
        // 查找该日期对应的日记数据
        const diaryForDate = newDiariesData?.find(d => d && d.date === date)
        
        if (diaryForDate) {
          // 找到了该日期的日记数据，更新缓存
          diaryCache.value.set(date, diaryForDate)
          optimizedUnifiedCacheService.setDiaryData(date, diaryForDate)
          // console.log(`📝 更新日记缓存 [${date}]:`, diaryForDate.content ? '有内容' : '空内容')
        } else {
          // 该日期没有返回日记数据，设置为空对象表示"已请求但无内容"
          // 这样可以区分"未请求"和"已请求但无内容"的状态
          const emptyDiary = { 
            date, 
            content: '', 
            images: [], 
            videos: [], 
            mood: undefined,
            weather_data: undefined
          }
          diaryCache.value.set(date, emptyDiary)
          optimizedUnifiedCacheService.setDiaryData(date, emptyDiary)
          // console.log(`📝 设置空日记缓存 [${date}]: 已请求但无内容`)
        }
      })
      
      // 更新全局缓存引用
      ;(window as any).__diaryCache = diaryCache.value
      
      // console.log(`📝 已更新日记缓存，当前缓存中的日记数量:`, diaryCache.value.size)
      // console.log(`📝 缓存中的所有日记日期:`, Array.from(diaryCache.value.keys()).sort())
      
      // 通知 WeatherCard 组件日记数据已更新
      window.dispatchEvent(new CustomEvent('diaries:loaded', { 
        detail: { startDate: startDateStr, endDate: endDateStr, diaries: newDiariesData || [] } 
      }))
      
      // 更新全局数据管理器
      const globalManager = (window as any).__globalDataManager
      if (globalManager) {
        globalManager.dataCache.set('weather', weatherList.value)
        
        // 按日期索引更新全局数据管理器中的日记缓存
        const existingDiaries = globalManager.dataCache.get('diaries') || new Map()
        requestDates.forEach(date => {
          const diaryForDate = diaryCache.value.get(date)
          if (diaryForDate) {
            existingDiaries.set(date, diaryForDate)
          }
        })
        globalManager.dataCache.set('diaries', existingDiaries)
      }
      
      // 更新结束日期
      endDate.value = endDateStr
      dateRangeValue.value = [startDate.value, endDate.value]
      
      // 检查是否已加载未来3天数据
      const today = new Date()
      const maxForecastDate = new Date(today)
      maxForecastDate.setDate(today.getDate() + 3)
      
      if (new Date(endDateStr) >= maxForecastDate && isForecast) {
        hasLoadedFuture3Days.value = true
      }
      
      // 更新全局日期范围（扩展范围）
      dateRangeManager.setDateRange(startDate.value, endDate.value)
      
      // 等待DOM更新完成后再滚动
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100)) // 额外等待确保渲染完成
      
      // 自动滚动到新加载的第一个卡片（日期最大的）
      await scrollToNewCard(endDateStr) // 使用结束日期，因为是最新的数据
    }
  } catch (error) {
    console.error('❌ 加载后7天数据失败:', error)
    errorMessage.value = '加载后7天数据失败，请重试'
  } finally {
    loadingNext.value = false
  }
}

// 处理加载前7天数据
async function handleLoadPrevious(startDateStr: string, endDateStr: string) {
  if (loadingPrevious.value) return

  loadingPrevious.value = true
  try {
    // console.log(`🔄 开始加载前7天数据: ${startDateStr} 到 ${endDateStr}`)
    
    // 生成请求日期范围内的所有日期，用于缓存管理
    const requestDates = DateUtils.getDatesBetween(startDateStr, endDateStr)
    // console.log(`📅 请求日期范围包含的所有日期:`, requestDates)
    
    // 并行获取天气数据和日记数据
    const [newWeatherData, newDiariesData] = await Promise.all([
      weatherService.getWeatherForDateRange(
        latitude.value,
        longitude.value,
        startDateStr,
        endDateStr
      ),
      // 获取对应日期范围的日记数据，强制刷新以确保发起网络请求
      diaryService.getDiariesByDateRange(startDateStr, endDateStr, true)
    ])
    
    // console.log(`📦 加载到的天气数据:`, newWeatherData?.length || 0, '条')
    // console.log(`📔 加载到的日记数据:`, newDiariesData?.length || 0, '条')
    
    if (newWeatherData && newWeatherData.length > 0) {
      // 按日期索引合并天气数据，避免重复
      const existingWeatherMap = new Map(weatherList.value.map(w => [w.date, w]))
      newWeatherData.forEach(weather => {
        if (weather && weather.date) {
          existingWeatherMap.set(weather.date, weather)
        }
      })
      
      // 按日期倒序排列显示
      weatherList.value = Array.from(existingWeatherMap.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // 按日期索引增量更新日记缓存
      // 对于请求范围内的每个日期，都要处理缓存更新
      requestDates.forEach(date => {
        // 查找该日期对应的日记数据
        const diaryForDate = newDiariesData?.find(d => d && d.date === date)
        
        if (diaryForDate) {
          // 找到了该日期的日记数据，更新缓存
          diaryCache.value.set(date, diaryForDate)
          optimizedUnifiedCacheService.setDiaryData(date, diaryForDate)
          // console.log(`📝 更新日记缓存 [${date}]:`, diaryForDate.content ? '有内容' : '空内容')
        } else {
          // 该日期没有返回日记数据，设置为空对象表示"已请求但无内容"
          // 这样可以区分"未请求"和"已请求但无内容"的状态
          const emptyDiary = { 
            date, 
            content: '', 
            images: [], 
            videos: [], 
            mood: undefined,
            weather_data: undefined
          }
          diaryCache.value.set(date, emptyDiary)
          optimizedUnifiedCacheService.setDiaryData(date, emptyDiary)
          // console.log(`📝 设置空日记缓存 [${date}]: 已请求但无内容`)
        }
      })
      
      // 更新全局缓存引用
      ;(window as any).__diaryCache = diaryCache.value
      
      // console.log(`📝 已更新日记缓存，当前缓存中的日记数量:`, diaryCache.value.size)
      // console.log(`📝 缓存中的所有日记日期:`, Array.from(diaryCache.value.keys()).sort())
      
      // 通知 WeatherCard 组件日记数据已更新
      window.dispatchEvent(new CustomEvent('diaries:loaded', { 
        detail: { startDate: startDateStr, endDate: endDateStr, diaries: newDiariesData || [] } 
      }))
      
      // 更新全局数据管理器
      const globalManager = (window as any).__globalDataManager
      if (globalManager) {
        globalManager.dataCache.set('weather', weatherList.value)
        
        // 按日期索引更新全局数据管理器中的日记缓存
        const existingDiaries = globalManager.dataCache.get('diaries') || new Map()
        requestDates.forEach(date => {
          const diaryForDate = diaryCache.value.get(date)
          if (diaryForDate) {
            existingDiaries.set(date, diaryForDate)
          }
        })
        globalManager.dataCache.set('diaries', existingDiaries)
      }
      
      // 更新开始日期
      startDate.value = startDateStr
      dateRangeValue.value = [startDate.value, endDate.value]
      
      // 更新全局日期范围（扩展范围）
      dateRangeManager.setDateRange(startDate.value, endDate.value)
      
      // 等待DOM更新完成后再滚动
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100)) // 额外等待确保渲染完成
      
      // 自动滚动到新加载的第一个卡片（日期最大的新数据）
      await scrollToNewCard(endDateStr)
    }
  } catch (error) {
    console.error('❌ 加载前7天数据失败:', error)
    errorMessage.value = '加载前7天数据失败，请重试'
  } finally {
    loadingPrevious.value = false
  }
}

// 自动滚动到新加载的卡片
async function scrollToNewCard(targetDate: string) {
  // 等待DOM更新
  await nextTick()
  
  try {
    // 查找对应日期的天气卡片
    const weatherCards = document.querySelectorAll('.weather-card')
    let targetCard = null
    
    for (const card of weatherCards) {
      if (card.getAttribute('data-date') === targetDate) {
        targetCard = card
        break
      }
    }
    
    if (targetCard) {
      // 滚动到目标卡片，带有平滑动画，确保卡片完整显示
      targetCard.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })
      

    } else {
      console.warn(`⚠️ 未找到日期为 ${targetDate} 的卡片`)
    }
  } catch (error) {
    console.error('❌ 自动滚动失败:', error)
  }
}

// PWA事件处理
function handleOnline() {
  // 可以在这里重新获取数据或显示提示
}

function handleOffline() {

  // 可以在这里显示离线提示
}

function handleAppInstalled() {

  // 可以在这里显示安装成功提示或进行其他操作
}



onMounted(async () => {
  // 初始化滚动条宽度计算
  setScrollbarWidth()

  // 初始化全局数据管理器和统一缓存服务引用
  ;(window as any).__globalDataManager = globalDataManager
  ;(window as any).__unifiedCacheService = optimizedUnifiedCacheService

  // 初始化日期范围管理器
  dateRangeManager.initialize(startDate.value, endDate.value)

  // 启动显示过渡层（随后缓存渲染会立刻隐藏）
  overlayVisible.value = true


  // 首屏优先使用缓存渲染，不等待任何网络步骤
  ;(window as any).__initialLatitude = latitude.value
  ;(window as any).__initialLongitude = longitude.value

  // 立即用离线缓存填充首屏（包含占位数据），避免长时间loading
  try {

    const initialWeather = await enhancedOfflineCacheService.getWeatherDataCacheFirst(
      startDate.value,
      endDate.value
    )
    const hasPlaceholder = initialWeather.some(w => (w as any).isPlaceholder)

    weatherList.value = [...initialWeather].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    loading.value = false

    overlayVisible.value = false
    if (window.markLoaded) { window.markLoaded('weather') }
  } catch (e) {
    console.warn('首屏离线缓存填充失败:', e)
  }

  fetchAll(false)

  // Supabase 后台初始化（不阻塞首屏）
  initializeSupabase().catch((e) => {
    console.warn('Supabase 初始化失败（后台）:', e)
  })

  // 定位与逆地理在后台执行，成功后静默刷新
  ;(async () => {
    try {
      const loc = await WeatherApiService.getCurrentLocation()
      latitude.value = loc.latitude
      longitude.value = loc.longitude
      isDefaultLocation.value = false
    } catch (e) {
      console.warn('初始定位失败，使用默认坐标:', e)
      latitude.value = 22.5429
      longitude.value = 114.0596
      isDefaultLocation.value = true
    }

    try {
      displayAddress.value = await GeocodingService.reverseGeocode(latitude.value, longitude.value)
    } catch {
      displayAddress.value = isDefaultLocation.value ? '深圳市 · 广东省 · 中国' : '未知位置'
    }

    if (!selectedCity.value) {
      setSelectedToCurrentLocation(displayAddress.value)
    }

    // 若经纬度发生变化，延迟触发一次刷新（避免与首屏的后台刷新重复）
    const prevLat = (window as any).__initialLatitude ?? 22.5429
    const prevLon = (window as any).__initialLongitude ?? 114.0596
    const changed = prevLat !== latitude.value || prevLon !== longitude.value

    if (changed) {
      // 轻量防抖 + 使用既有 fetchAll 流程（内部已含缓存优先与后台更新）
      setTimeout(() => {
        fetchAll(false)
      }, 1200)
    }
  })()

  // 标记日记数据已加载完成（初始化时）
  if (window.markLoaded) {
    window.markLoaded('diary')
  }
})

onUnmounted(() => {
  // 清理工作已移至AppHeader组件
})
</script>

<style>
html {
  scrollbar-gutter: stable;
}

html body {
  width: 100% !important;
}

</style>

<style scoped>

.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    padding: 16px 16px 8px;
  }
.chart-wrapper {
    padding: 16px 16px 0;
  }
  .chart-section {
    padding: 48px 16px 32px;
    background: #ffffff;
    border-top: 2px solid #e8e8e8;
    margin-top: 32px;
  }
  .chart-container {
    max-width: 1200px;
    margin: 0 auto;
  }
  .chart-title {
    font-size: 20px;
    font-weight: 600;
    color: #333;
    margin-bottom: 20px;
    text-align: center;
  }
  .section-divider {
    height: 1px;
    background: linear-gradient(to right, transparent, #ddd, transparent);
    margin: 0 auto 40px;
    width: 80%;
    max-width: 600px;
  }
  .app-footer .footer {
    padding: 12px 16px;
    color: #666;
    font-size: 12px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .footer-info {
    line-height: 1.4;
  }

  .footer-author {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .author-info {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .author-info:hover {
    cursor: pointer;
    color: #0052d9;
  }

  .email-link {
    color: #0052d9;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .email-link:hover {
    color: #003d99;
    text-decoration: underline;
  }

  .github-footer-link {
    display: flex;
    align-items: center;
    color: #666;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .github-footer-link:hover {
    color: #333;
  }

  .github-footer-icon {
    width: 16px;
    height: 16px;
  }
.location-note {
  color: #999;
  font-style: italic;
}
@media (max-width: 768px) {
  .app-header {
    align-items: flex-start;
  }
  .header-left h1 {
    font-size: 16px;
  }
}
@media (max-width: 480px) {
  .footer-author {
    flex-direction: column;
    gap: 6px;
  }
  
  .author-info {
    flex-direction: column;
    gap: 2px;
    text-align: center;
  }
}
/* .no-print 的打印样式在下方 @media print 中定义，这里无需常规样式 */
@media print {
  .no-print { display: none !important; }
  .cards-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 0;
  }
  .chart-section {
    display: none !important;
  }
}
</style>

