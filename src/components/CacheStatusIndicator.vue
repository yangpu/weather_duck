<template>
  <div class="cache-status-indicator" v-if="showIndicator">
    <div class="cache-status-content">
      <div class="status-header">
        <span class="status-icon">📦</span>
        <span class="status-title">缓存状态</span>
        <button @click="toggleExpanded" class="toggle-btn">
          {{ expanded ? '收起' : '展开' }}
        </button>
      </div>
      
      <div v-if="expanded" class="status-details">
        <div class="status-row">
          <span class="label">网络状态:</span>
          <span :class="['value', networkStatus === 'online' ? 'online' : 'offline']">
            {{ networkStatus === 'online' ? '🌐 在线' : '📱 离线' }}
          </span>
        </div>
        
        <div class="status-row">
          <span class="label">缓存模式:</span>
          <span class="value">⚡ 缓存优先</span>
        </div>
        
        <div class="status-row">
          <span class="label">天气缓存:</span>
          <span class="value">{{ cacheStats.weatherDates }}天</span>
        </div>
        
        <div class="status-row">
          <span class="label">日记缓存:</span>
          <span class="value">{{ cacheStats.diaryDates }}天</span>
        </div>
        
        <div class="status-row">
          <span class="label">缓存大小:</span>
          <span class="value">{{ cacheStats.totalSize }}</span>
        </div>
        
        <div class="status-row" v-if="cacheStats.oldestDate">
          <span class="label">缓存范围:</span>
          <span class="value">{{ formatDateRange(cacheStats.oldestDate, cacheStats.newestDate) }}</span>
        </div>
        
        <div class="status-actions">
          <button @click="refreshCache" class="action-btn refresh-btn" :disabled="refreshing">
            {{ refreshing ? '刷新中...' : '🔄 刷新缓存' }}
          </button>
          <button @click="clearCache" class="action-btn clear-btn">
            🗑️ 清空缓存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'

interface CacheStats {
  weatherDates: number
  diaryDates: number
  totalSize: string
  oldestDate: string | null
  newestDate: string | null
}

const showIndicator = ref(false)
const expanded = ref(false)
const networkStatus = ref<'online' | 'offline'>('online')
const refreshing = ref(false)

const cacheStats = ref<CacheStats>({
  weatherDates: 0,
  diaryDates: 0,
  totalSize: '0B',
  oldestDate: null,
  newestDate: null
})

// 更新网络状态
function updateNetworkStatus() {
  networkStatus.value = navigator.onLine ? 'online' : 'offline'
}

// 更新缓存统计
function updateCacheStats() {
  try {
    const enhancedCache = (window as any).__enhancedOfflineCacheService
    if (enhancedCache) {
      const stats = enhancedCache.getCacheStats()
      cacheStats.value = stats
    }
  } catch (error) {
    console.warn('获取缓存统计失败:', error)
  }
}

// 切换展开状态
function toggleExpanded() {
  expanded.value = !expanded.value
  if (expanded.value) {
    updateCacheStats()
  }
}

// 刷新缓存
async function refreshCache() {
  refreshing.value = true
  try {
    const optimizedCache = (window as any).__optimizedUnifiedCacheService
    if (optimizedCache) {
      // 触发强制刷新
      const event = new CustomEvent('cache:force:refresh')
      window.dispatchEvent(event)
      
      MessagePlugin.success('缓存刷新已启动')
      
      // 延迟更新统计
      setTimeout(() => {
        updateCacheStats()
      }, 2000)
    }
  } catch (error) {
    console.error('刷新缓存失败:', error)
    MessagePlugin.error('刷新缓存失败')
  } finally {
    refreshing.value = false
  }
}

// 清空缓存
function clearCache() {
  try {
    const enhancedCache = (window as any).__enhancedOfflineCacheService
    const optimizedCache = (window as any).__optimizedUnifiedCacheService
    
    if (enhancedCache) {
      enhancedCache.clearAllCache()
    }
    
    if (optimizedCache) {
      optimizedCache.clearCache()
    }
    
    updateCacheStats()
    MessagePlugin.success('缓存已清空')
  } catch (error) {
    console.error('清空缓存失败:', error)
    MessagePlugin.error('清空缓存失败')
  }
}

// 格式化日期范围
function formatDateRange(oldest: string | null, newest: string | null): string {
  if (!oldest || !newest) return '无数据'
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  
  return `${formatDate(oldest)} - ${formatDate(newest)}`
}

// 监听缓存更新事件
function handleCacheUpdated() {
  updateCacheStats()
}

// 监听网络状态变化
function handleOnline() {
  updateNetworkStatus()
}

function handleOffline() {
  updateNetworkStatus()
}

onMounted(() => {
  // 检查是否在开发环境或有调试标志
  const isDev = import.meta.env.DEV
  const hasDebugFlag = localStorage.getItem('show_cache_indicator') === 'true'
  
  showIndicator.value = isDev || hasDebugFlag
  
  if (showIndicator.value) {
    updateNetworkStatus()
    updateCacheStats()
    
    // 监听事件
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('cache:weather:updated', handleCacheUpdated)
    window.addEventListener('cache:diary:updated', handleCacheUpdated)
    window.addEventListener('unified:data:ready', handleCacheUpdated)
    
    // 定期更新统计
    const interval = setInterval(updateCacheStats, 10000) // 每10秒更新一次
    
    onUnmounted(() => {
      clearInterval(interval)
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  window.removeEventListener('cache:weather:updated', handleCacheUpdated)
  window.removeEventListener('cache:diary:updated', handleCacheUpdated)
  window.removeEventListener('unified:data:ready', handleCacheUpdated)
})
</script>

<style scoped>
.cache-status-indicator {
  position: fixed;
  top: 80px;
  right: 16px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  font-size: 12px;
  max-width: 280px;
}

.cache-status-content {
  padding: 12px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.status-icon {
  font-size: 16px;
}

.status-title {
  font-weight: 600;
  color: #333;
  flex: 1;
}

.toggle-btn {
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.status-details {
  border-top: 1px solid #f0f0f0;
  padding-top: 8px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.label {
  color: #666;
  font-weight: 500;
}

.value {
  color: #333;
  font-weight: 600;
}

.value.online {
  color: #52c41a;
}

.value.offline {
  color: #ff4d4f;
}

.status-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.action-btn {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #f5f5f5;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.clear-btn:hover {
  border-color: #ff4d4f;
  color: #ff4d4f;
}

@media (max-width: 768px) {
  .cache-status-indicator {
    top: 60px;
    right: 8px;
    max-width: 240px;
  }
  
  .cache-status-content {
    padding: 8px;
  }
  
  .status-actions {
    flex-direction: column;
  }
}

@media print {
  .cache-status-indicator {
    display: none !important;
  }
}
</style>