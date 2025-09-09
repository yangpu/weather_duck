<template>
  <t-card 
    class="load-more-card"
    :bordered="false"
  >
    <div class="load-more-content">
      <!-- 加载后7天数据按钮 -->
      <div 
        v-if="shouldShowNextButton"
        class="load-section load-next-section"
        :class="{ 'disabled': shouldDisableNextButton }"
      >
        <div class="load-info">
          <div class="load-title">{{ nextButtonTitle }}</div>
          <div class="load-subtitle">{{ nextSubtitleText }}</div>
        </div>
        <t-button
          :loading="loadingNext"
          :disabled="loadingNext || shouldDisableNextButton"
          variant="outline"
          :theme="nextDateRange.isForecast ? 'warning' : 'success'"
          size="small"
          @click="handleLoadNext"
        >
          <template #icon>
            <t-icon name="chevron-left" />
          </template>
          {{ loadingNext ? '加载中' : '加载' }}
        </t-button>
      </div>

      <!-- 分隔线 -->
      <div v-if="shouldShowNextButton" class="divider"></div>

      <!-- 加载前7天数据按钮 -->
      <div class="load-section load-previous-section">
        <div class="load-info">
          <div class="load-title">加载前7天数据</div>
          <div class="load-subtitle">{{ previousSubtitleText }}</div>
        </div>
        <t-button
          :loading="loadingPrevious"
          :disabled="loadingPrevious"
          variant="outline"
          theme="primary"
          size="small"
          @click="handleLoadPrevious"
        >
          <template #icon>
            <t-icon name="chevron-right" />
          </template>
          {{ loadingPrevious ? '加载中' : '加载' }}
        </t-button>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DateUtils } from '../utils/dateUtils'

interface Props {
  loadingNext?: boolean
  loadingPrevious?: boolean
  currentStartDate?: string
  currentEndDate?: string
  hasLoadedFuture3Days?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loadingNext: false,
  loadingPrevious: false,
  currentStartDate: '',
  currentEndDate: '',
  hasLoadedFuture3Days: false
})

const emit = defineEmits<{
  loadNext: [startDate: string, endDate: string, isForecast: boolean]
  loadPrevious: [startDate: string, endDate: string]
}>()

// 获取今天的日期
const today = new Date()

// 判断是否应该显示后7天按钮
const shouldShowNextButton = computed(() => {
  // 如果已经加载过未来3天数据，则隐藏按钮
  if (props.hasLoadedFuture3Days) {
    return false
  }
  
  // 如果当前结束日期已经是今天+3天或更晚，则隐藏按钮
  if (props.currentEndDate) {
    const currentEnd = new Date(props.currentEndDate)
    const maxForecastDate = new Date(today)
    maxForecastDate.setDate(today.getDate() + 3)
    
    if (currentEnd >= maxForecastDate) {
      return false
    }
  }
  
  return true
})

// 判断是否应该禁用后7天按钮
const shouldDisableNextButton = computed(() => {
  return props.hasLoadedFuture3Days
})

// 计算后7天的日期范围和是否为预测数据
const nextDateRange = computed(() => {
  if (!props.currentEndDate) {
    const startDate = new Date(today)
    startDate.setDate(today.getDate() + 1) // 明天
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6) // 往后7天
    
    // 检查是否超过今天+3天（预测数据限制）
    const maxForecastDate = new Date(today)
    maxForecastDate.setDate(today.getDate() + 3)
    
    const actualEndDate = endDate > maxForecastDate ? maxForecastDate : endDate
    const isForecast = startDate > today
    
    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: actualEndDate.toISOString().slice(0, 10),
      isForecast,
      isLimited: endDate > maxForecastDate
    }
  }
  
  const currentEnd = new Date(props.currentEndDate)
  const newStartDate = new Date(currentEnd)
  newStartDate.setDate(currentEnd.getDate() + 1) // 新的开始日期是当前结束日期的后一天
  
  const newEndDate = new Date(newStartDate)
  newEndDate.setDate(newStartDate.getDate() + 6) // 往后7天
  
  // 检查是否为预测数据
  const isForecast = newStartDate > today
  
  // 如果是预测数据，限制最多3天
  if (isForecast) {
    const maxForecastDate = new Date(today)
    maxForecastDate.setDate(today.getDate() + 3)
    
    const actualEndDate = newEndDate > maxForecastDate ? maxForecastDate : newEndDate
    
    return {
      startDate: newStartDate.toISOString().slice(0, 10),
      endDate: actualEndDate.toISOString().slice(0, 10),
      isForecast: true,
      isLimited: newEndDate > maxForecastDate
    }
  }
  
  return {
    startDate: newStartDate.toISOString().slice(0, 10),
    endDate: newEndDate.toISOString().slice(0, 10),
    isForecast: false,
    isLimited: false
  }
})

// 计算前7天的日期范围
const previousDateRange = computed(() => {
  if (!props.currentStartDate) {
    const endDate = new Date(today)
    endDate.setDate(today.getDate() - 1) // 昨天
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - 6) // 往前7天
    
    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10)
    }
  }
  
  const currentStart = new Date(props.currentStartDate)
  const newEndDate = new Date(currentStart)
  newEndDate.setDate(currentStart.getDate() - 1) // 新的结束日期是当前开始日期的前一天
  
  const newStartDate = new Date(newEndDate)
  newStartDate.setDate(newEndDate.getDate() - 6) // 往前7天
  
  return {
    startDate: newStartDate.toISOString().slice(0, 10),
    endDate: newEndDate.toISOString().slice(0, 10)
  }
})

// 后7天按钮标题
const nextButtonTitle = computed(() => {
  if (nextDateRange.value.isForecast) {
    if (nextDateRange.value.isLimited) {
      return '预测未来3天数据'
    }
    return '加载后7天数据'
  }
  
  return '加载后7天数据'
})

// 后7天副标题文本
const nextSubtitleText = computed(() => {
  const startText = DateUtils.formatDate(nextDateRange.value.startDate)
  const endText = DateUtils.formatDate(nextDateRange.value.endDate)
  
  if (nextDateRange.value.isForecast) {
    return `预测 ${startText} 至 ${endText}`
  }
  
  return `${startText} 至 ${endText}`
})

// 前7天副标题文本
const previousSubtitleText = computed(() => {
  const startText = DateUtils.formatDate(previousDateRange.value.startDate)
  const endText = DateUtils.formatDate(previousDateRange.value.endDate)
  return `${startText} 至 ${endText}`
})

function handleLoadNext() {
  if (!props.loadingNext) {
    console.log('LoadMoreCard: 发出loadNext事件', nextDateRange.value)
    emit('loadNext', nextDateRange.value.startDate, nextDateRange.value.endDate, nextDateRange.value.isForecast)
  }
}

function handleLoadPrevious() {
  if (!props.loadingPrevious) {
    console.log('LoadMoreCard: 发出loadPrevious事件', previousDateRange.value)
    emit('loadPrevious', previousDateRange.value.startDate, previousDateRange.value.endDate)
  }
}
</script>

<style scoped>
.load-more-card {
  min-height: 200px;
  border: 1px solid #e7e7e7;
  border-radius: 12px;
  background: #ffffff;
  transition: all 0.3s ease;
}

.load-more-card:hover {
  border-color: #0052d9;
  box-shadow: 0 8px 25px rgba(0, 82, 217, 0.1);
  transform: translateY(-2px);
}

.load-more-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  padding: 16px;
}

.load-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  flex: 1;
}

.load-section.disabled {
  opacity: 0.6;
}

.load-next-section {
  border-bottom: none;
}

.load-previous-section {
  border-top: none;
}

.divider {
  height: 1px;
  background: linear-gradient(to right, transparent, #e7e7e7, transparent);
  margin: 8px 0;
}

.load-info {
  flex: 1;
  text-align: left;
  margin-right: 12px;
}

.load-title {
  font-size: 14px;
  font-weight: 600;
  color: #000000;
  margin-bottom: 2px;
  line-height: 1.3;
}

.load-subtitle {
  font-size: 12px;
  color: #666666;
  line-height: 1.3;
}

.load-section :deep(.t-button) {
  min-width: 80px;
  height: 32px;
  font-size: 12px;
  flex-shrink: 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .load-more-card {
    min-height: 180px;
  }
  
  .load-more-content {
    min-height: 180px;
    padding: 12px;
  }
  
  .load-section {
    padding: 6px 0;
  }
  
  .load-info {
    margin-right: 8px;
  }
  
  .load-title {
    font-size: 13px;
  }
  
  .load-subtitle {
    font-size: 11px;
  }
  
  .load-section :deep(.t-button) {
    min-width: 70px;
    height: 28px;
    font-size: 11px;
  }
}
</style>