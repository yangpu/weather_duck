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
      @refresh="fetchAll"
      @settings="showAbout"
      class="no-print"
    >
      <template #header-actions>
        <div class="toolbar">
          <t-input
            class="control control--full"
            v-model="cityKeyword"
            placeholder="搜索城市（中文/英文）"
            @change="onCityInputChange"
            @enter="onCitySearch"
            clearable
          />
          <t-select
            class="control control--full"
            v-model="selectedCity"
            :options="cityOptions"
            placeholder="选择城市"
            @change="onCitySelected"
            :filterable="false"
          />
          <t-button 
            class="control" 
            variant="outline" 
            @click="useMyLocation"
            :loading="locating"
          >
            {{ locating ? '定位中...' : '使用定位' }}
          </t-button>
          <t-date-range-picker
            class="control control--full"
            v-model:value="dateRangeValue"
            allow-input
            clearable
            :placeholder="['开始日期', '结束日期']"
            @change="onDateRangeChange"
          />
          <t-button class="control" theme="primary" @click="fetchAll">获取天气</t-button>
          <t-button class="control" variant="outline" @click="printPage">打印</t-button>
        </div>
      </template>
    </AppHeader>

    <div class="app-content">
      <t-alert v-if="errorMessage" theme="error" :message="errorMessage" class="no-print" />
      <t-loading :loading="loading" text="数据加载中...">

        
        <div class="cards-grid">
          <WeatherCard 
            v-for="item in weatherList" 
            :key="item.date" 
            :weather="item" 
            @click="handleWeatherCardClick"
          />
          <!-- LoadNextCard 放在列表前面 -->
          <LoadNextCard
            :loading="loadingNext"
            :current-end-date="endDate"
            @load-next="handleLoadNext"
          />
          
          <!-- LoadPreviousCard 放在列表后面 -->
          <LoadPreviousCard
            :loading="loadingPrevious"
            :current-start-date="startDate"
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

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
import LoadNextCard from './components/LoadNextCard.vue'
import LoadPreviousCard from './components/LoadPreviousCard.vue'
import AboutDialog from './components/AboutDialog.vue'
import OfflineIndicator from './components/OfflineIndicator.vue'
import PWAInstall from './components/PWAInstall.vue'
import AppHeader from './components/AppHeader.vue'
import { WeatherApiService } from './services/weatherApi'

import { weatherService } from './services/weatherService.js'
import { diaryService } from './services/diaryService.js'
import { unifiedCacheService } from './services/unifiedCacheService.js'
import type { WeatherData } from './types/weather'
import { GeocodingService } from './services/geocoding'
import { initializeSupabase } from './utils/initSupabase'

const loading = ref(false)
const locating = ref(false)
const loadingNext = ref(false)
const loadingPrevious = ref(false)
const hasLoadedFuture3Days = ref(false)
const errorMessage = ref('')

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

// 日记相关状态
const diaryViewVisible = ref(false)
const diaryEditVisible = ref(false)
const selectedWeather = ref<WeatherData | null>(null)

// About对话框状态
const aboutVisible = ref(false)



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
}

async function onCityInputChange() {
  if (!cityKeyword.value || cityKeyword.value.trim().length < 2) {
    cityOptions.value = []
    return
  }
  cityOptions.value = await GeocodingService.searchCity(cityKeyword.value.trim())
}

async function onCitySearch() {
  await onCityInputChange()
}

async function onCitySelected(val: string) {
  const target = cityOptions.value.find((o) => o.value === val)
  if (!target) return
  latitude.value = target.lat
  longitude.value = target.lon
  selectedCity.value = val
  displayAddress.value = target.label
  isDefaultLocation.value = false
  await fetchAll()
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
    
    await fetchAll()
  } catch (e: any) {
    console.error('定位失败:', e)
    errorMessage.value = e?.message || '定位失败，请检查浏览器定位权限或网络连接'
    
    // 定位失败时使用默认坐标（广东深圳）
    latitude.value = 22.5429
    longitude.value = 114.0596
    isDefaultLocation.value = true
    displayAddress.value = '深圳市 · 广东省 · 中国'
    setSelectedToCurrentLocation('深圳市 · 广东省 · 中国（默认）')
    
    await fetchAll()
  } finally {
    locating.value = false
  }
}

async function fetchAll() {
  errorMessage.value = ''
  if (!DateUtils.isValidDateRange(startDate.value, endDate.value)) {
    errorMessage.value = '日期范围不合法（开始不能晚于结束，且最多30天）。'
    return
  }
  loading.value = true
  try {
    // 使用统一缓存服务，优化天气和日记数据请求
    const { weatherData } = await unifiedCacheService.initializeData(
      startDate.value,
      endDate.value,
      latitude.value,
      longitude.value
    )
    
    // 按日期倒序排列显示
    weatherList.value = [...weatherData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // 标记天气数据已加载完成
    if (window.markLoaded) {
      window.markLoaded('weather');
    }

    console.log('✅ App: 数据加载完成', {
      weatherCount: weatherData.length,
      dateRange: `${startDate.value} ~ ${endDate.value}`
    })

  } catch (e: any) {
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
;(window as any).__weatherList = weatherList.value

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
  console.log('🎯 卡片点击:', weather.date)
  
  // 先设置选中的天气数据
  selectedWeather.value = weather
  
  // 从统一缓存服务获取日记数据
  const diary = unifiedCacheService.getDiaryData(weather.date)
  console.log('📦 从统一缓存获取日记:', diary)
  
  // 同时更新本地缓存（兼容性）
  if (diary) {
    diaryCache.value.set(weather.date, diary)
  }
  
  // 根据日记内容决定显示查看还是编辑页面
  const hasContent = diary && (
    diary.content?.trim() || 
    diary.images?.length || 
    diary.video || 
    diary.mood
  )
  
  if (hasContent) {
    console.log('✅ 有日记内容，显示查看页面')
    diaryViewVisible.value = true
  } else {
    console.log('📝 无日记内容，显示编辑页面')
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
    console.log('🔄 编辑组件日期变化:', date)
    selectedWeather.value = weather
    // 保持编辑对话框打开状态，只更新数据
  }
}

// 处理日记保存
async function handleDiarySaved(date: string, content: string) {
  console.log(`日记已保存: ${date}`, content ? '有内容' : '已删除')
  
  // 使用统一缓存服务刷新该日期的数据
  try {
    await unifiedCacheService.refreshDiaryData(date)
    
    // 同时更新本地缓存（兼容性）
    const diary = await diaryService.refreshDiaryByDate(date)
    if (diary) {
      diaryCache.value.set(date, diary)
    } else {
      diaryCache.value.delete(date)
    }
    
    console.log(`✅ 日记缓存已更新: ${date}`)
  } catch (error) {
    console.warn('更新缓存失败:', error)
  }
}

// 显示About对话框
function showAbout() {
  aboutVisible.value = true
}

// 处理加载更多天气数据
async function handleLoadMore() {
  if (loading.value) return
  
  loading.value = true
  try {
    // 计算新的日期范围（从当前开始日期往前推7天）
    const currentStartDate = new Date(startDate.value)
    const newEndDate = new Date(currentStartDate)
    newEndDate.setDate(currentStartDate.getDate() - 1) // 新的结束日期是当前开始日期的前一天
    
    const newStartDate = new Date(newEndDate)
    newStartDate.setDate(newEndDate.getDate() - 6) // 往前7天
    
    const newStartDateStr = newStartDate.toISOString().slice(0, 10)
    const newEndDateStr = newEndDate.toISOString().slice(0, 10)
    
    // 获取新的天气数据
    const newWeatherData = await weatherService.getWeatherForDateRange(
      latitude.value,
      longitude.value,
      newStartDateStr,
      newEndDateStr
    )
    
    if (newWeatherData && newWeatherData.length > 0) {
      // 将新数据添加到现有数据中，并按日期倒序排列
      const allWeatherData = [...weatherList.value, ...newWeatherData]
      weatherList.value = allWeatherData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // 更新日期范围
      startDate.value = newStartDateStr
      dateRangeValue.value = [startDate.value, endDate.value]
    }
  } catch (error) {
    errorMessage.value = '加载更多数据失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 处理加载后7天数据
async function handleLoadNext(startDateStr, endDateStr, isForecast) {
  if (loadingNext.value) return

  loadingNext.value = true
  try {
    console.log(`🔄 开始加载后7天数据: ${startDateStr} 至 ${endDateStr} (预测: ${isForecast})`)
    
    // 获取新的天气数据
    const newWeatherData = await weatherService.getWeatherForDateRange(
      latitude.value,
      longitude.value,
      startDateStr,
      endDateStr
    )
    
    if (newWeatherData && newWeatherData.length > 0) {
      // 将新数据添加到现有数据中，并按日期倒序排列
      const allData = [...weatherList.value, ...newWeatherData]
      weatherList.value = allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
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
      
      const dataType = isForecast ? '预测' : '历史'
      console.log(`✅ 成功加载后7天${dataType}数据: ${newWeatherData.length} 条`)
      
      // 加载对应时间段的日记数据
      try {
        console.log(`🔄 开始加载日记数据: ${startDateStr} 至 ${endDateStr}`)
        const newDiaries = await diaryService.getDiariesByDateRange(startDateStr, endDateStr)
        
        // 将新加载的日记数据更新到统一缓存服务中
        if (newDiaries && newDiaries.length > 0) {
          console.log(`📝 准备缓存日记数据:`, newDiaries.map(d => ({ date: d.date, hasContent: !!d.content, hasMood: !!d.mood })))
          newDiaries.forEach(diary => {
            if (diary.date) {
              unifiedCacheService.setDiaryData(diary.date, diary)
              console.log(`📝 已缓存日记: ${diary.date}`)
            }
          })
          console.log(`✅ 成功加载并缓存日记数据: ${newDiaries.length} 条`)
          
          // 验证缓存是否成功
          const cachedDiaries = unifiedCacheService.getDiaryData()
          console.log(`📝 缓存验证 - 总日记数:`, cachedDiaries.length, '日期列表:', cachedDiaries.map(d => d.date))
          
          // 触发事件通知WeatherCard组件更新
          window.dispatchEvent(new CustomEvent('diaries:data:ready', {
            detail: { startDate: startDateStr, endDate: endDateStr, diaries: newDiaries }
          }))
          console.log(`📡 已触发 diaries:data:ready 事件`)
        } else {
          console.log(`✅ 日记数据加载完成，但该时间段无日记数据`)
        }
      } catch (diaryError) {
        console.warn('⚠️ 加载日记数据失败:', diaryError)
        // 日记加载失败不影响天气数据显示
      }
      
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
    console.log(`🔄 开始加载前7天数据: ${startDateStr} 至 ${endDateStr}`)
    
    // 获取新的天气数据
    const newWeatherData = await weatherService.getWeatherForDateRange(
      latitude.value,
      longitude.value,
      startDateStr,
      endDateStr
    )
    
    if (newWeatherData && newWeatherData.length > 0) {
      // 将新数据添加到现有数据中，并按日期倒序排列
      const allData = [...weatherList.value, ...newWeatherData]
      weatherList.value = allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // 更新开始日期
      startDate.value = startDateStr
      dateRangeValue.value = [startDate.value, endDate.value]
      
      console.log(`✅ 成功加载前7天历史数据: ${newWeatherData.length} 条`)
      
      // 加载对应时间段的日记数据
      try {
        console.log(`🔄 开始加载日记数据: ${startDateStr} 至 ${endDateStr}`)
        const newDiaries = await diaryService.getDiariesByDateRange(startDateStr, endDateStr)
        
        // 将新加载的日记数据更新到统一缓存服务中
        if (newDiaries && newDiaries.length > 0) {
          console.log(`📝 准备缓存日记数据:`, newDiaries.map(d => ({ date: d.date, hasContent: !!d.content, hasMood: !!d.mood })))
          newDiaries.forEach(diary => {
            if (diary.date) {
              unifiedCacheService.setDiaryData(diary.date, diary)
              console.log(`📝 已缓存日记: ${diary.date}`)
            }
          })
          console.log(`✅ 成功加载并缓存日记数据: ${newDiaries.length} 条`)
          
          // 验证缓存是否成功
          const cachedDiaries = unifiedCacheService.getDiaryData()
          console.log(`📝 缓存验证 - 总日记数:`, cachedDiaries.length, '日期列表:', cachedDiaries.map(d => d.date))
          
          // 触发事件通知WeatherCard组件更新
          window.dispatchEvent(new CustomEvent('diaries:data:ready', {
            detail: { startDate: startDateStr, endDate: endDateStr, diaries: newDiaries }
          }))
          console.log(`📡 已触发 diaries:data:ready 事件`)
        } else {
          console.log(`✅ 日记数据加载完成，但该时间段无日记数据`)
        }
      } catch (diaryError) {
        console.warn('⚠️ 加载日记数据失败:', diaryError)
        // 日记加载失败不影响天气数据显示
      }
      
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
      const dateElement = card.querySelector('[data-date]')
      if (dateElement && dateElement.getAttribute('data-date') === targetDate) {
        targetCard = card
        break
      }
    }
    
    if (targetCard) {
      // 滚动到目标卡片，带有平滑动画
      targetCard.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      })
      
      console.log(`📍 自动滚动到日期: ${targetDate}`)
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
  console.log('网络已断开')
  // 可以在这里显示离线提示
}

function handleAppInstalled() {
  console.log('PWA应用已安装')
  // 可以在这里显示安装成功提示或进行其他操作
}



onMounted(async () => {
  // 初始化Supabase
  await initializeSupabase()
  
  try {
    const loc = await WeatherApiService.getCurrentLocation()
    latitude.value = loc.latitude
    longitude.value = loc.longitude
    isDefaultLocation.value = false
  } catch (e) {
    console.warn('初始定位失败，使用默认坐标:', e)
    // 使用默认坐标（广东深圳）
    latitude.value = 22.5429
    longitude.value = 114.0596
    isDefaultLocation.value = true
  }
  
  try {
    displayAddress.value = await GeocodingService.reverseGeocode(latitude.value, longitude.value)
  } catch {
    displayAddress.value = isDefaultLocation.value ? '深圳市 · 广东省 · 中国' : '未知位置'
  }
  
  // 若未选择城市，则默认使用当前定位
  if (!selectedCity.value) {
    setSelectedToCurrentLocation(displayAddress.value)
  }
  

  
  await fetchAll()
  
  // 标记日记数据已加载完成（初始化时）
  if (window.markLoaded) {
    window.markLoaded('diary');
  }
})

onUnmounted(() => {
  // 清理工作已移至AppHeader组件
})
</script>

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
/* 顶部工具栏自适应 */
.toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, max-content));
  align-items: center;
  gap: 8px 12px;
}
.control {
  min-width: 120px;
}
.control--full {
  min-width: 200px;
}
@media (max-width: 992px) {
  .toolbar {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
  .control--full {
    width: 100%;
  }
}
@media (max-width: 768px) {
  .app-header {
    align-items: flex-start;
  }
  .header-left h1 {
    font-size: 16px;
  }
  .toolbar {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 480px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
  
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

