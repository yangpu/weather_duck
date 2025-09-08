<template>
  <t-card 
    :class="['load-more-card', { loading }]"
    :bordered="false"
    :hover="!loading"
    @click="handleLoadMore"
  >
    <div class="load-more-content">
      <div class="load-more-icon">
        <t-icon :name="loading ? 'loading' : 'add'" :size="loading ? '24px' : '32px'" />
      </div>
      <div class="load-more-text">
        <div class="title">{{ loading ? '正在加载...' : '加载更多天气日记' }}</div>
        <div class="subtitle">{{ subtitleText }}</div>
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
  loadMore: []
}>()

// 计算要加载的日期范围
const dateRangeText = computed(() => {
  if (!props.currentStartDate) {
    return '前7天数据'
  }
  
  const currentStart = new Date(props.currentStartDate)
  const newEnd = new Date(currentStart)
  newEnd.setDate(currentStart.getDate() - 1) // 新的结束日期是当前开始日期的前一天
  
  const newStart = new Date(newEnd)
  newStart.setDate(newEnd.getDate() - 6) // 往前7天
  
  const startText = DateUtils.formatDate(newStart.toISOString().slice(0, 10))
  const endText = DateUtils.formatDate(newEnd.toISOString().slice(0, 10))
  
  return `${startText} 至 ${endText}`
})

const subtitleText = computed(() => {
  if (props.loading) {
    return `正在加载 ${dateRangeText.value}`
  }
  return `点击加载 ${dateRangeText.value}`
})

function handleLoadMore() {
  if (!props.loading) {
    emit('loadMore')
  }
}
</script>

<style scoped>
.load-more-card {
  height: 200px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px dashed #e0e0e0;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  /* 确保完美的水平和垂直居中 */
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.load-more-card:hover:not(.loading) {
  border-color: #1976d2;
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);
}

.load-more-card.loading {
  cursor: not-allowed;
  border-color: #ccc;
  background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%);
}

.load-more-content {
  /* 使用绝对定位确保完美居中 */
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  
  /* 确保内容不会超出卡片边界 */
  max-width: calc(100% - 40px);
  text-align: center;
}

.load-more-icon {
  color: #666;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 确保图标本身也居中 */
  width: 40px;
  height: 40px;
}

.load-more-card:hover:not(.loading) .load-more-icon {
  color: #1976d2;
  transform: scale(1.1);
}

.load-more-card.loading .load-more-icon {
  color: #999;
  animation: spin 1s linear infinite;
}

.load-more-text {
  text-align: center;
  line-height: 1.4;
  /* 确保文本块也完美居中 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin: 0 0 6px 0;
  transition: color 0.3s ease;
  /* 确保标题文本居中 */
  text-align: center;
  width: 100%;
}

.subtitle {
  font-size: 13px;
  color: #666;
  transition: color 0.3s ease;
  margin: 0;
  /* 确保副标题文本居中 */
  text-align: center;
  width: 100%;
  /* 防止文本换行影响居中 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.load-more-card:hover:not(.loading) .title {
  color: #1976d2;
}

.load-more-card:hover:not(.loading) .subtitle {
  color: #1565c0;
}

.load-more-card.loading .title {
  color: #999;
}

.load-more-card.loading .subtitle {
  color: #aaa;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .load-more-card {
    height: 160px;
  }
  
  .load-more-content {
    gap: 12px;
    max-width: calc(100% - 32px);
  }
  
  .load-more-icon {
    width: 32px;
    height: 32px;
  }
  
  .title {
    font-size: 14px;
  }
  
  .subtitle {
    font-size: 12px;
    /* 在小屏幕上允许换行 */
    white-space: normal;
    word-break: break-all;
    overflow: visible;
    text-overflow: unset;
  }
}

/* 确保在极小屏幕上也能正常显示 */
@media (max-width: 320px) {
  .load-more-card {
    height: 140px;
  }
  
  .load-more-content {
    gap: 8px;
    max-width: calc(100% - 24px);
  }
  
  .title {
    font-size: 13px;
  }
  
  .subtitle {
    font-size: 11px;
  }
}
</style>