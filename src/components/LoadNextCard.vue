<template>
  <t-card 
    v-if="shouldShowCard"
    class="load-next-card"
    :bordered="false"
    :hover="!loading"
  >
    <div class="load-card-content">
      <div class="load-card-info">
        <div class="load-card-title">{{ buttonTitle }}</div>
        <div class="load-card-subtitle">{{ subtitleText }}</div>
      </div>
      <div class="load-card-action">
        <t-button
          :loading="loading"
          :disabled="loading || shouldDisableButton"
          variant="outline"
          :theme="nextDateRange.isForecast ? 'warning' : 'success'"
          size="medium"
          @click="handleLoadNext"
        >
          <template #icon>
            <t-icon name="chevron-left" />
          </template>
          {{ loading ? '加载中...' : '加载' }}
        </t-button>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DateUtils } from '../utils/dateUtils'

interface Props {
  loading?: boolean
  currentEndDate?: string
  hasLoadedFuture3Days?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  currentEndDate: '',
  hasLoadedFuture3Days: false
})

const emit = defineEmits<{
  loadNext: [startDate: string, endDate: string, isForecast: boolean]
}>()

// 获取今天的日期
const today = new Date()

// 判断是否应该显示卡片
const shouldShowCard = computed(() => {
  // 如果已经加载过未来3天数据，则隐藏卡片
  if (props.hasLoadedFuture3Days) {
    return false
  }
  
  // 如果当前结束日期已经是今天+3天或更晚，则隐藏卡片
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

// 判断是否应该禁用按钮
const shouldDisableButton = computed(() => {
  // 如果已经加载过未来3天数据，则禁用按钮
  if (props.hasLoadedFuture3Days) {
    return true
  }
  
  // 如果当前结束日期已经是今天+3天或更晚，则禁用按钮
  if (props.currentEndDate) {
    const currentEnd = new Date(props.currentEndDate)
    const maxForecastDate = new Date(today)
    maxForecastDate.setDate(today.getDate() + 3)
    
    if (currentEnd >= maxForecastDate) {
      return true
    }
  }
  
  return false
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

// 按钮标题
const buttonTitle = computed(() => {
  if (nextDateRange.value.isForecast) {
    if (nextDateRange.value.isLimited) {
      return '预测未来3天数据'
    }
    return '加载后7天数据'
  }
  
  return '加载后7天数据'
})

// 副标题文本
const subtitleText = computed(() => {
  const startText = DateUtils.formatDate(nextDateRange.value.startDate)
  const endText = DateUtils.formatDate(nextDateRange.value.endDate)
  
  if (nextDateRange.value.isForecast) {
    return `预测 ${startText} 至 ${endText}`
  }
  
  return `${startText} 至 ${endText}`
})

function handleLoadNext() {
  if (!props.loading) {
    console.log('LoadNextCard: 发出loadNext事件', nextDateRange.value)
    emit('loadNext', nextDateRange.value.startDate, nextDateRange.value.endDate, nextDateRange.value.isForecast)
  }
}
</script>

<style scoped>
.load-next-card {
  border: 1px solid #e7e7e7;
  border-radius: 9px;
  background: #ffffff;
  transition: all 0.3s ease;
}

.load-next-card:hover {
  border-color: #00a870;
  box-shadow: 0 2px 8px rgba(0, 168, 112, 0.1);
}

.load-card-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px;
  gap: 12px;
}

.load-card-info {
  width: 100%;
}

.load-card-title {
  font-size: 15px;
  font-weight: 500;
  color: #000000;
  margin-bottom: 4px;
  line-height: 1.4;
}

.load-card-subtitle {
  font-size: 13px;
  color: #666666;
  line-height: 1.4;
}

.load-card-action {
  width: 100%;
}

.load-card-action :deep(.t-button) {
  width: 100%;
  justify-content: center;
}

/* 预测数据特殊样式 */
.load-next-card:has(.t-button--theme-warning):hover {
  border-color: #ed7b2f;
  box-shadow: 0 2px 8px rgba(237, 123, 47, 0.1);
}
</style>