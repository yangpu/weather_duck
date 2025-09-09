<template>
  <div class="weather-line-chart" :style="{ height: containerHeight }" ref="chartContainer"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import * as echarts from 'echarts'
import type { ECharts as TECharts, EChartsOption, LineSeriesOption, BarSeriesOption } from 'echarts'
import type { WeatherData } from '../types/weather'
import { unifiedCacheService } from '../services/unifiedCacheService.js'
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

// 自定义tooltip元素
let customTooltip: HTMLDivElement | null = null

// 日记数据
const diaryMoods = ref<Record<string, string>>({})
const diaryData = ref<Record<string, any>>({})

// 获取日记数据 - 优化：使用统一缓存服务，避免重复请求
function loadDiaryMoods() {
  try {
    // 优先从统一缓存服务获取数据
    const diaries = unifiedCacheService.getDiaryData()
    const moodMap: Record<string, string> = {}
    const dataMap: Record<string, any> = {}
    
    diaries.forEach((diary: any) => {
      if (diary.mood) {
        moodMap[diary.date] = diary.mood
      }
      dataMap[diary.date] = diary
    })
    
    diaryMoods.value = moodMap
    diaryData.value = dataMap
    
    // console.log('📊 WeatherLineChart: 从统一缓存加载日记数据', {
    //   diariesCount: diaries.length,
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

  return {
    grid: {
      left: 60,
      right: 60, 
      top: 100,
      bottom: 80,
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

        // 温度数据
        params.forEach((param: any) => {
          if (param.seriesName === '降雨量') {
            result += `${param.marker} ${param.seriesName}: ${param.value} mm<br/>`
          } else {
            result += `${param.marker} ${param.seriesName}: ${param.value} °C<br/>`
          }
        })
        result += `</div>`

        // 详细天气信息
        result += `<div style="margin-top: 8px; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 6px;">`
        result += `风力: ${weather.windSpeed}km/h ${weather.windDirection}<br/>`
        result += `云量: ${weather.cloudCover}% · 湿度: ${weather.humidity || 0}%<br/>`
        // result += `<div style="margin-top: 6px; padding: 4px 8px; background: #f0f9ff; border-radius: 4px; color: #0369a1; font-size: 11px; text-align: center;">💡 点击图表打开 ${date} 日记</div>`

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
      data: props.showCurrent === false ? ['最高温度', '最低温度', '降雨量'] : ['最高温度', '最低温度', '当前温度', '降雨量'],
      bottom: 15,
      left: 'center',
      textStyle: {
        fontSize: 13,
        color: '#495057',
        fontWeight: 500
      },
      itemGap: 25,
      itemWidth: 18,
      itemHeight: 12,
      icon: 'roundRect',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderColor: '#e9ecef',
      borderWidth: 1,
      borderRadius: 6,
      padding: [8, 16]
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
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
        nameTextStyle: {
          color: '#495057',
          fontSize: 12,
          fontWeight: 600
        },
        axisLabel: {
          formatter: '{value}°',
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
          formatter: '{value}mm',
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
      }
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
      }
    ] as (LineSeriesOption | BarSeriesOption)[],
    // 天气图标和心情图标 - 精确对齐到曲线数据点
    graphic: [
      // 天气图标 - 与每个数据点精确对齐
      ...sortedList.map((weather, index) => {
        // 计算图表区域内的精确位置
        const totalPoints = sortedList.length
        const gridLeft = 60 // 与grid.left保持一致
        const gridRight = 60 // 与grid.right保持一致
        const chartWidth = 100 - ((gridLeft + gridRight) / 10) // 转换为百分比
        
        let leftPercent: number
        if (totalPoints === 1) {
          leftPercent = 50 // 单个数据点居中
        } else {
          // 多个数据点时，均匀分布在图表区域内
          const pointSpacing = chartWidth / (totalPoints - 1)
          leftPercent = (gridLeft / 10) + (index * pointSpacing)
        }
        
        return {
          type: 'text',
          left: `${leftPercent}%`,
          top: '12%', // 在曲线上方适当位置
          style: {
            text: weather.icon,
            fontSize: 22,
            fill: '#333',
            textAlign: 'center',
            textVerticalAlign: 'middle',
            textShadowColor: 'rgba(255,255,255,0.9)',
            textShadowBlur: 3,
            fontWeight: 'bold'
          },
          onclick: () => {
            emit('cardClick', weather)
          },
          cursor: 'pointer',
          onmouseover: (e: any) => {
            if (chart) {
              chart.getZr().setCursorStyle('pointer')
              showCustomTooltip(e, `${weather.icon} ${weather.description}\n💡 点击打开 ${weather.date} 天气日记`, 'weather')
            }
          },
          onmouseout: () => {
            if (chart) {
              chart.getZr().setCursorStyle('default')
              hideCustomTooltip()
            }
          }
        }
      }),
      // 心情图标 - 仅在有心情数据时显示，与对应的天气数据点对齐
      ...sortedList.map((weather, index) => {
        const mood = diaryMoods.value[weather.date]
        if (!mood) {
          return null
        }
        
        const moodEmoji = getMoodEmoji(mood)
        if (!moodEmoji) {
          return null
        }
        
        // 使用与天气图标相同的位置计算逻辑
        const totalPoints = sortedList.length
        const gridLeft = 60
        const gridRight = 60
        const chartWidth = 100 - ((gridLeft + gridRight) / 10)
        
        let leftPercent: number
        if (totalPoints === 1) {
          leftPercent = 50
        } else {
          const pointSpacing = chartWidth / (totalPoints - 1)
          leftPercent = (gridLeft / 10) + (index * pointSpacing)
        }
        
        return {
          type: 'text',
          left: `${leftPercent}%`,
          top: '6%', // 在天气图标上方
          style: {
            text: moodEmoji,
            fontSize: 18,
            fill: '#666',
            textAlign: 'center',
            textVerticalAlign: 'middle',
            textShadowColor: 'rgba(255,255,255,0.9)',
            textShadowBlur: 2
          },
          onclick: () => {
            emit('cardClick', weather)
          },
          cursor: 'pointer',
          onmouseover: (e: any) => {
            if (chart) {
              chart.getZr().setCursorStyle('pointer')
              const diary = diaryData.value[weather.date]
              if (diary && diary.mood) {
                let tooltipText = `${moodEmoji} ${diary.mood}`
                if (diary.content) {
                  const preview = truncateText(diary.content, 10)
                  tooltipText += `\n"${preview}"`
                }
                tooltipText += `\n💡 点击打开 ${weather.date} 天气日记`
                showCustomTooltip(e, tooltipText, 'mood')
              }
            }
          },
          onmouseout: () => {
            if (chart) {
              chart.getZr().setCursorStyle('default')
              hideCustomTooltip()
            }
          }
        }
      }).filter((item): item is NonNullable<typeof item> => item !== null)
    ]
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

// 显示自定义tooltip
function showCustomTooltip(event: any, text: string, _type: 'weather' | 'mood') {
  if (!chartContainer.value) return
  
  // 创建tooltip元素
  if (!customTooltip) {
    customTooltip = document.createElement('div')
    customTooltip.style.cssText = `
      position: fixed;
      background: rgba(255, 255, 255, 0.95);
      color: #495057;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 13px;
      line-height: 1.4;
      white-space: pre-line;
      pointer-events: none;
      z-index: 9999;
      max-width: 200px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(8px);
      transition: opacity 0.2s ease;
    `
    document.body.appendChild(customTooltip)
  }
  
  // 设置内容和样式
  customTooltip.textContent = text
  customTooltip.style.display = 'block'
  customTooltip.style.opacity = '1'
  
  // 获取图表容器的位置信息
  const containerRect = chartContainer.value.getBoundingClientRect()
  
  // 计算鼠标在页面中的绝对位置
  let mouseX = 0
  let mouseY = 0
  
  // 尝试从不同的事件对象中获取鼠标位置
  if (event.event && typeof event.event.clientX === 'number') {
    // ECharts事件对象中的原生事件
    mouseX = event.event.clientX
    mouseY = event.event.clientY
  } else if (typeof event.clientX === 'number') {
    // 原生鼠标事件
    mouseX = event.clientX
    mouseY = event.clientY
  } else if (typeof event.offsetX === 'number' && typeof event.offsetY === 'number') {
    // 使用偏移位置计算绝对位置
    mouseX = containerRect.left + event.offsetX
    mouseY = containerRect.top + event.offsetY
  } else {
    // 默认使用容器中心位置
    mouseX = containerRect.left + containerRect.width / 2
    mouseY = containerRect.top + containerRect.height / 2
  }
  
  // 先获取tooltip的尺寸
  const tooltipRect = customTooltip.getBoundingClientRect()
  
  // 计算tooltip的最终位置
  let finalX = mouseX + 15 // 图标右侧15px
  let finalY = mouseY - tooltipRect.height - 10 // 图标上方10px
  
  // 边界检查和调整
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // 水平位置调整 - 如果右侧空间不够，显示在左侧
  if (finalX + tooltipRect.width > viewportWidth - 10) {
    finalX = mouseX - tooltipRect.width - 15 // 图标左侧
  }
  
  // 确保不超出左边界
  if (finalX < 10) {
    finalX = 10
  }
  
  // 垂直位置调整 - 如果上方空间不够，显示在下方
  if (finalY < 10) {
    finalY = mouseY + 20 // 图标下方
  }
  
  // 确保不超出下边界
  if (finalY + tooltipRect.height > viewportHeight - 10) {
    finalY = viewportHeight - tooltipRect.height - 10
  }
  
  customTooltip.style.left = `${finalX}px`
  customTooltip.style.top = `${finalY}px`
}

// 隐藏自定义tooltip
function hideCustomTooltip() {
  if (customTooltip) {
    customTooltip.style.opacity = '0'
    setTimeout(() => {
      if (customTooltip) {
        customTooltip.style.display = 'none'
      }
    }, 200)
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
  
  // 清理自定义tooltip
  if (customTooltip) {
    document.body.removeChild(customTooltip)
    customTooltip = null
  }
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