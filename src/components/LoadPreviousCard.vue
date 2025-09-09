<template>
  <t-card 
    class="load-previous-card"
    :bordered="false"
    :hover="!loading"
  >
    <div class="load-card-content">
      <div class="load-card-info">
        <div class="load-card-title">加载前7天数据</div>
        <div class="load-card-subtitle">{{ subtitleText }}</div>
      </div>
      <div class="load-card-action">
        <t-button
          :loading="loading"
          :disabled="loading"
          variant="outline"
          theme="primary"
          size="medium"
          @click="handleLoadPrevious"
        >
          <template #icon>
            <t-icon name="chevron-right" />
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
  currentStartDate?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  currentStartDate: ''
})

const emit = defineEmits<{
  loadPrevious: [startDate: string, endDate: string]
}>()

// 获取今天的日期
const today = new Date()

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

// 副标题文本
const subtitleText = computed(() => {
  const startText = DateUtils.formatDate(previousDateRange.value.startDate)
  const endText = DateUtils.formatDate(previousDateRange.value.endDate)
  return `${startText} 至 ${endText}`
})

function handleLoadPrevious() {
  if (!props.loading) {
    console.log('LoadPreviousCard: 发出loadPrevious事件', previousDateRange.value)
    emit('loadPrevious', previousDateRange.value.startDate, previousDateRange.value.endDate)
  }
}
</script>

<style scoped>
.load-previous-card {
  border: 1px solid #e7e7e7;
  border-radius: 9px;
  background: #ffffff;
  transition: all 0.3s ease;
}

.load-previous-card:hover {
  border-color: #0052d9;
  box-shadow: 0 2px 8px rgba(0, 82, 217, 0.1);
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
</style>