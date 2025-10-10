<template>
  <div class="weather-line-chart" :style="{ height: containerHeight }" ref="chartContainer"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import * as echarts from 'echarts'
import type { ECharts as TECharts, EChartsOption, LineSeriesOption, BarSeriesOption } from 'echarts'
import type { WeatherData } from '../types/weather'
import { optimizedUnifiedCacheService } from '../services/optimizedUnifiedCacheService'
import { truncateText } from '../utils/textUtils'

interface Props {
  data: WeatherData[]
  height?: number | string
  showCurrent?: boolean
}

interface Emits {
  (e: 'cardClick', weather: WeatherData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()



const chartContainer = ref<HTMLDivElement | null>(null)
let chart: TECharts | null = null



// 日记数据
const diaryMoods = ref<Record<string, string>>({})
const diaryData = ref<Record<string, any>>({})

// 获取日记数据 - 优化：使用统一缓存服务，避免重复请求
function loadDiaryMoods() {
  try {
    // 优先从统一缓存服务获取数据
    const diaries = optimizedUnifiedCacheService.getDiaryData()
    const moodMap: Record<string, string> = {}
    const dataMap: Record<string, any> = {}
    
    const diariesArray = Array.isArray(diaries) ? diaries : diaries ? [diaries] : []
    diariesArray.forEach((diary: any) => {
      if (diary.mood) {
        moodMap[diary.date] = diary.mood
      }
      dataMap[diary.date] = diary
    })
    
    diaryMoods.value = moodMap
    diaryData.value = dataMap
    

    //   moodsCount: Object.keys(moodMap).length
    // })

  } catch (error) {
    console.error('加载日记数据失败:', error)
  }
}

const containerHeight = computed(() => {
  const h = props.height ?? 340
  return typeof h === 'number' ? `${h}px` : h
})

function getOption(list: WeatherData[]): EChartsOption {
  // 确保数据按日期顺序排列（时间轴从左到右递增）
  const sortedList = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  const dates = sortedList.map((d) => d.date)
  const maxArr = sortedList.map((d) => d.temperature.max)
  const minArr = sortedList.map((d) => d.temperature.min)
  const curArr = sortedList.map((d) => d.temperature.current)
  const precipArr = sortedList.map((d) => d.precipitation)
  const icons = sortedList.map((d) => d.icon)
  
  // 计算温度和降雨量的最大值，用于确定图标位置
  const allTemps = [...maxArr, ...minArr, ...curArr].filter(t => t !== undefined && t !== null)
  const maxTemp = Math.max(...allTemps)
  const maxPrecip = Math.max(...precipArr)
  
  // 图标位置：设置在所有数据序列上方，保持合适间距
  const dataMax = Math.max(maxTemp, maxPrecip)
  const iconSpacing = Math.max(dataMax * 0.15, 5) // 至少5度的间距
  const weatherIconY = dataMax + iconSpacing // 天气图标位置
  const moodIconY = dataMax + iconSpacing * 2 // 心情图标位置（更高）
  
  // 为图标序列准备数据 - 基于温度范围计算y值
  const weatherIconData = sortedList.map((weather, index) => ({
    value: [index, weatherIconY],
    symbol: 'circle',
    symbolSize: 30,
    weather: weather,
    itemStyle: {
      color: 'transparent',
      borderColor: 'transparent'
    },
    label: {
      show: true,
      formatter: weather.icon,
      fontSize: 24,
      color: '#333',
      fontWeight: 'bold',
      position: 'inside'
    }
  }))
  
  // 心情图标数据 - 只有存在心情数据的日期
  const moodIconData = sortedList.map((weather, index) => {
    const mood = diaryMoods.value[weather.date]
    if (!mood) return null
    
    const moodEmoji = getMoodEmoji(mood)
    if (!moodEmoji) return null
    
    return {
      value: [index, moodIconY],
      symbol: 'circle',
      symbolSize: 26,
      weather: weather,
      mood: mood,
      itemStyle: {
        color: 'transparent',
        borderColor: 'transparent'
      },
      label: {
        show: true,
        formatter: moodEmoji,
        fontSize: 20,
        color: '#666',
        position: 'inside'
      }
    }
  }).filter(item => item !== null)

  return {
    grid: {
      left: 60,
      right: 60, 
      top: 60, // 减少顶部空白
      bottom: 60, // 减少底部空白
      backgroundColor: 'rgba(248, 249, 250, 0.3)',
      borderColor: '#e9ecef',
      borderWidth: 1
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e9ecef',
      borderWidth: 1,
      borderRadius: 8,
      textStyle: {
        color: '#495057',
        fontSize: 13
      },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); backdrop-filter: blur(8px);',
      formatter: function(params: any) {
        if (!Array.isArray(params)) return ''
        const dataIndex = params[0].dataIndex
        const weather = sortedList[dataIndex]
        const date = dates[dataIndex]
        const mood = diaryMoods.value[date]
        
        let result = `<div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${params[0].axisValue}</div>`
        
        // 天气信息
        result += `<div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">`
        result += `<span style="font-size: 18px;">${icons[dataIndex]}</span>`
        result += `<span style="font-weight: 500;">${weather.description}</span>`
        if (mood) {
          result += `<span style="font-size: 16px; margin-left: 8px;">${getMoodEmoji(mood)}</span>`
        }
        result += `</div>`
        
        result += `<div style="margin-top: 8px; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 6px;">`

        // 温度和降雨量数据，过滤掉图标序列
        params.forEach((param: any) => {
          if (param.seriesName === '降雨量') {
            const value = typeof param.value === 'number' ? 
              Number(param.value).toFixed(param.value % 1 === 0 ? 0 : 1) : param.value
            result += `${param.marker} ${param.seriesName}: ${value} mm<br/>`
          } else if (param.seriesName === '天气状态') {
            //result += `${param.marker} ${param.seriesName}: ${weather.icon} ${weather.description}<br/>`
          } else if (param.seriesName === '心情状态') {
            // if (mood) {
            //   result += `${param.marker} ${param.seriesName}: ${getMoodEmoji(mood)} ${mood}<br/>`
            // }
          } else if (param.seriesName.includes('温度')) {
            const value = typeof param.value === 'number' ? 
              Number(param.value).toFixed(param.value % 1 === 0 ? 0 : 1) : param.value
            result += `${param.marker} ${param.seriesName}: ${value} °C<br/>`
          }
        })
        result += `</div>`

        // 详细天气信息
        result += `<div style="margin-top: 8px; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 6px;">`
        result += `风力: ${weather.windSpeed}km/h ${weather.windDirection}<br/>`
        result += `云量: ${weather.cloudCover}% · 湿度: ${weather.humidity || 0}%<br/>`

        // 日记详细信息
        const diary = diaryData.value[date]
        if (diary) {
          result += `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #eee;">`
          
          if (diary.city) {
            result += `<div style="margin: 2px 0; font-size: 12px;">📍 ${diary.city}</div>`
          }
          
          if (diary.mood) {
            result += `<div style="margin: 2px 0; font-size: 12px;">${getMoodEmoji(diary.mood)} ${diary.mood}</div>`
          }
          
          if (diary.content) {
            const preview = truncateText(diary.content, 8)
            result += `<div style="margin: 2px 0; font-size: 14px; color: #006;">${preview}</div>`
          }
          
          if (diary.images && diary.images.length > 0) {
            const firstImage = diary.images[0]
            result += `<div style="margin: 6px 0;">
              <img src="${firstImage}" style="width: 100px; height: 60px; object-fit: cover; border-radius: 6px; display: block; border: 1px solid #eee;" />
            </div>`
          }
          
          if (diary.videos && diary.videos.length > 0) {
            result += `<div style="margin: 2px 0; font-size: 12px; color: #999;">🎥 视频</div>`
          }
          
          result += `</div>`
        }
        
         result += `</div>`
        
        return result
      }
    },
    legend: {
      data: props.showCurrent === false 
        ? ['最高温度', '最低温度', '降雨量', '天气状态', '心情状态'] 
        : ['最高温度', '最低温度', '当前温度', '降雨量', '天气状态', '心情状态'],
      bottom: 10,
      left: 'center',
      textStyle: {
        fontSize: 12,
        color: '#495057',
        fontWeight: 500
      },
      itemGap: 20,
      itemWidth: 16,
      itemHeight: 10,
      icon: 'roundRect',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderColor: '#e9ecef',
      borderWidth: 1,
      borderRadius: 6,
      padding: [6, 12]
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: true, // 在首尾预留间距
      axisLabel: { 
        color: '#495057',
        fontSize: 12,
        fontWeight: 500,
        formatter: function(value: string) {
          return value.slice(5) // 显示MM-DD格式
        }
      },
      axisLine: { 
        lineStyle: { 
          color: '#dee2e6',
          width: 2
        } 
      },
      axisTick: {
        lineStyle: {
          color: '#adb5bd'
        }
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '温度 (°C)',
        position: 'left',
        min: 0, // 设置坐标原点为0
        max: moodIconY + iconSpacing, // 为图标留出足够空间
        nameTextStyle: {
          color: '#495057',
          fontSize: 12,
          fontWeight: 600
        },
        axisLabel: {
          formatter: function(value: number) {
            return Number(value).toFixed(value % 1 === 0 ? 0 : 1) + '°'
          },
          color: '#6c757d',
          fontSize: 11
        },
        splitLine: { 
          lineStyle: { 
            color: '#f8f9fa',
            type: 'dashed',
            opacity: 0.8
          } 
        },
        axisLine: { 
          lineStyle: { 
            color: '#dee2e6',
            width: 2
          } 
        }
      },
      {
        type: 'value',
        name: '降雨量 (mm)',
        position: 'right',
        nameTextStyle: {
          color: '#495057',
          fontSize: 12,
          fontWeight: 600
        },
        axisLabel: {
          formatter: function(value: number) {
            return Number(value).toFixed(value % 1 === 0 ? 0 : 1) + 'mm'
          },
          color: '#6c757d',
          fontSize: 11
        },
        splitLine: { show: false },
        axisLine: { 
          lineStyle: { 
            color: '#dee2e6',
            width: 2
          } 
        }
      },

    ],
    series: [
      {
        name: '最高温度',
        type: 'line',
        data: maxArr,
        smooth: true,
        symbol: 'circle',
        showSymbol: true,
        symbolSize: 8,
        itemStyle: {
          color: '#ff6b6b',
          borderColor: '#ffffff',
          borderWidth: 2,
          shadowBlur: 4,
          shadowColor: 'rgba(255, 107, 107, 0.3)'
        },
        lineStyle: { 
          width: 3, 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#ff9a9e' },
              { offset: 1, color: '#ff6b6b' }
            ]
          },
          shadowBlur: 3,
          shadowColor: 'rgba(255, 107, 107, 0.2)'
        },
        yAxisIndex: 0,
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: '#ff4757',
            borderColor: '#ffffff',
            borderWidth: 3,
            shadowBlur: 12,
            shadowColor: 'rgba(255, 71, 87, 0.4)'
          },
          symbolSize: 14
        }
      },
      {
        name: '最低温度',
        type: 'line',
        data: minArr,
        smooth: true,
        symbol: 'circle',
        showSymbol: true,
        symbolSize: 8,
        itemStyle: {
          color: '#4ecdc4',
          borderColor: '#ffffff',
          borderWidth: 2,
          shadowBlur: 4,
          shadowColor: 'rgba(78, 205, 196, 0.3)'
        },
        lineStyle: { 
          width: 3, 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#74b9ff' },
              { offset: 1, color: '#4ecdc4' }
            ]
          },
          shadowBlur: 3,
          shadowColor: 'rgba(78, 205, 196, 0.2)'
        },
        yAxisIndex: 0,
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: '#00b894',
            borderColor: '#ffffff',
            borderWidth: 3,
            shadowBlur: 12,
            shadowColor: 'rgba(0, 184, 148, 0.4)'
          },
          symbolSize: 14
        }
      },
      ...(props.showCurrent !== false ? [{
        name: '当前温度',
        type: 'line',
        data: curArr,
        smooth: true,
        symbol: 'diamond',
        showSymbol: true,
        symbolSize: 10,
        itemStyle: {
          color: '#ffeaa7',
          borderColor: '#fdcb6e',
          borderWidth: 2,
          shadowBlur: 6,
          shadowColor: 'rgba(253, 203, 110, 0.4)'
        },
        lineStyle: { 
          width: 3, 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#ffeaa7' },
              { offset: 0.5, color: '#fdcb6e' },
              { offset: 1, color: '#e17055' }
            ]
          },
          type: 'dashed',
          dashArray: [8, 4],
          shadowBlur: 4,
          shadowColor: 'rgba(253, 203, 110, 0.3)'
        },
        yAxisIndex: 0,
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: '#e17055',
            borderColor: '#ffffff',
            borderWidth: 3,
            shadowBlur: 15,
            shadowColor: 'rgba(225, 112, 85, 0.5)'
          },
          symbolSize: 16
        }
      }] : []),
      {
        name: '降雨量',
        type: 'bar',
        data: precipArr,
        barWidth: '35%',
        itemStyle: { 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(116, 185, 255, 0.8)' },
              { offset: 1, color: 'rgba(78, 205, 196, 0.6)' }
            ]
          },
          borderColor: '#74b9ff',
          borderWidth: 1,
          borderRadius: [4, 4, 0, 0],
          shadowBlur: 3,
          shadowColor: 'rgba(116, 185, 255, 0.3)'
        },
        emphasis: {
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(116, 185, 255, 0.9)' },
                { offset: 1, color: 'rgba(78, 205, 196, 0.8)' }
              ]
            },
            shadowBlur: 8,
            shadowColor: 'rgba(116, 185, 255, 0.4)'
          }
        },
        yAxisIndex: 1
      },
      // 天气图标序列 - 第一行
      {
        name: '天气状态',
        type: 'scatter',
        data: weatherIconData,
        yAxisIndex: 0,
        label: {
          show: true,
          position: 'inside'
        },
        emphasis: {
          scale: true,
          scaleSize: 1.2,
          label: {
            fontSize: 28
          }
        },
        tooltip: {
          formatter: function(params: any) {
            const weather = params.data.weather
            return `${weather.icon} ${weather.description}<br/>💡 点击打开 ${weather.date} 天气日记`
          }
        }
      },
      // 心情图标序列 - 第二行
      {
        name: '心情状态',
        type: 'scatter',
        data: moodIconData,
        yAxisIndex: 0,
        label: {
          show: true,
          position: 'inside'
        },
        emphasis: {
          scale: true,
          scaleSize: 1.2,
          label: {
            fontSize: 24
          }
        },
        tooltip: {
          formatter: function(params: any) {
            const weather = params.data.weather
            const mood = params.data.mood
            const diary = diaryData.value[weather.date]
            let result = `${getMoodEmoji(mood)} ${mood}`
            if (diary && diary.content) {
              const preview = truncateText(diary.content, 10)
              result += `<br/>"${preview}"`
            }
            result += `<br/>💡 点击打开 ${weather.date} 天气日记`
            return result
          }
        }
      }
    ] as (LineSeriesOption | BarSeriesOption)[],

  }
}

async function renderChart() {
  if (!chartContainer.value) return
  
  // 确保容器有尺寸
  const rect = chartContainer.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    // 如果尺寸为0，延迟重试
    setTimeout(renderChart, 200)
    return
  }
  
  // 每次渲染前都重新加载日记心情数据（优化：同步加载，避免异步等待）
  loadDiaryMoods()
  
  if (!chart) {
    chart = echarts.init(chartContainer.value)
    window.addEventListener('resize', handleResize)
    
    // 添加点击事件监听
    chart.on('click', (params: any) => {
      // 只处理天气状态和心情状态系列的点击
      if (params.seriesName === '天气状态' || params.seriesName === '心情状态') {
        const weather = params.data.weather
        if (weather) {
          emit('cardClick', weather)
        }
      }
    })
  }
  
  // 使用 setOption 的 notMerge: true 确保完全重新渲染
  const option = getOption(props.data || [])
  chart.setOption(option, { notMerge: true })
}

function handleResize() {
  chart?.resize()
}

// 处理日记更新事件 - 优化：同步处理，提高响应速度
function handleDiaryUpdate(_event: any) {
  // 重新加载日记数据并更新图表（优化：同步加载）
  loadDiaryMoods()
  if (chart) {
    const option = getOption(props.data || [])
    chart.setOption(option)
  }
}



// 获取心情emoji（用于图表显示）
function getMoodEmoji(mood: string): string {
  const moodMap: Record<string, string> = {
    '开心': '😊',
    '愉快': '😄',
    '平静': '😌',
    '兴奋': '🤩',
    '放松': '😎',
    '忧郁': '😔',
    '烦躁': '😤',
    '疲惫': '😴'
  }
  return moodMap[mood] || '😊'
}

onMounted(() => {
  // 确保DOM已经渲染完成
  setTimeout(() => {
    renderChart()
  }, 100)
  
  // 监听日记更新事件
  window.addEventListener('diary:updated', handleDiaryUpdate)
  
  // 监听统一缓存服务的数据就绪事件
  window.addEventListener('diaries:data:ready', handleDiaryUpdate)
  window.addEventListener('unified:data:ready', handleDiaryUpdate)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('diary:updated', handleDiaryUpdate)
  window.removeEventListener('diaries:data:ready', handleDiaryUpdate)
  window.removeEventListener('unified:data:ready', handleDiaryUpdate)
  chart?.dispose()
  chart = null
  

})

watch(
  () => [props.data, props.showCurrent, props.height],
  () => {
    renderChart()
  },
  { deep: true, immediate: false }
)

// 单独监听 props.data 的变化，确保日期范围改变时能及时更新
watch(
  () => props.data,
  (newData, oldData) => {
    if (newData && oldData && newData.length !== oldData.length) {
      // 数据点数量变化时，强制重新渲染
      renderChart()
    } else if (newData && oldData) {
      // 检查日期是否有变化
      const newDates = newData.map(d => d.date).sort()
      const oldDates = oldData.map(d => d.date).sort()
      const datesChanged = newDates.length !== oldDates.length || 
                          newDates.some((date, index) => date !== oldDates[index])
      
      if (datesChanged) {
        renderChart()
      }
    }
  },
  { deep: true }
)
</script>

<style scoped>
.weather-line-chart {
  width: 100%;
  min-height: 200px;
}
</style>