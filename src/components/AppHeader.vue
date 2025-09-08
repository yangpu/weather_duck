<template>
  <header class="app-header" :class="{ 'header-scrolled': isScrolled }">
    <div class="header-content">
      <!-- Header Left: Logo + Title -->
      <div class="header-left" @click="$emit('settings')" title="关于天气小鸭">
        <div class="logo-container">
          <img src="/weather_duck_rj_logo.jpeg" alt="天气小鸭" class="logo" />
        </div>
        <div class="title-container">
          <h1 class="app-title">{{ title }}</h1>
          <div class="title-location" v-if="location">
            <span class="location-icon">📍</span>
            <span>{{ location }}</span>
          </div>
        </div>
      </div>

      <!-- Header Right: Actions -->
      <div class="header-right" :class="{ 'header-right-hidden': shouldHideHeaderRight }">
        <slot name="header-actions">
          <!-- 默认操作按钮 -->
          <button class="header-btn" @click="$emit('refresh')">
            <i class="icon">🔄</i>
          </button>
          <button class="header-btn" @click="$emit('settings')">
            <i class="icon">⚙️</i>
          </button>
        </slot>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  title: string
  location?: string
  scrollThreshold?: number
}

const props = withDefaults(defineProps<Props>(), {
  scrollThreshold: 100
})

defineEmits<{
  refresh: []
  settings: []
}>()

const isScrolled = ref(false)
const shouldHideHeaderRight = ref(false)
const scrollTimeout = ref<number | null>(null)
const lastScrollY = ref(0)
const scrollDirection = ref<'up' | 'down'>('up')
const isInTransition = ref(false) // 防止过渡期间的状态变化

// 增强的防抖机制：避免在阈值附近频繁切换
const debounceDelay = 200 // 增加防抖延迟时间
const hysteresis = 30 // 增加滞后阈值，避免在临界点抖动

const handleScroll = () => {
  const currentScrollY = window.scrollY
  const direction = currentScrollY > lastScrollY.value ? 'down' : 'up'
  
  // 更新滚动方向
  scrollDirection.value = direction
  lastScrollY.value = currentScrollY

  // 基础滚动状态
  isScrolled.value = currentScrollY > 10

  // 清除之前的防抖定时器
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }

  // 增强的防抖和滞后机制
  scrollTimeout.value = window.setTimeout(() => {
    // 防止在过渡期间改变状态
    if (isInTransition.value) return
    
    const finalScrollY = window.scrollY
    const threshold = props.scrollThreshold
    const upperThreshold = threshold - hysteresis
    const lowerThreshold = threshold + hysteresis
    
    // 只有在明确超出滞后区间时才改变状态
    if (direction === 'down' && finalScrollY > lowerThreshold && !shouldHideHeaderRight.value) {
      // 向下滚动超过下阈值且当前显示时，隐藏
      isInTransition.value = true
      shouldHideHeaderRight.value = true
      setTimeout(() => { isInTransition.value = false }, 300) // 等待CSS过渡完成
    } else if (direction === 'up' && finalScrollY < upperThreshold && shouldHideHeaderRight.value) {
      // 向上滚动低于上阈值且当前隐藏时，显示
      isInTransition.value = true
      shouldHideHeaderRight.value = false
      setTimeout(() => { isInTransition.value = false }, 300) // 等待CSS过渡完成
    }
    // 在滞后区间内保持当前状态不变
  }, debounceDelay)
}

// 优化的节流处理
let ticking = false
const throttledHandleScroll = () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      handleScroll()
      ticking = false
    })
    ticking = true
  }
}

onMounted(() => {
  window.addEventListener('scroll', throttledHandleScroll, { passive: true })
  // 初始化状态
  handleScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', throttledHandleScroll)
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
})
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-bottom: 1px solid #eee;
  overflow: hidden;
}

.app-header.header-scrolled {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  max-width: none;
  margin: 0;
  min-height: auto;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.header-left:hover {
  opacity: 0.8;
  color: #0052d9;
}

.logo-container {
  flex-shrink: 0;
}

.logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
  vertical-align: middle;
}

.logo:hover {
  transform: scale(1.05);
}

.title-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 40px;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
  line-height: 1.2;
}

.title-location {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 14px;
  color: #666;
  margin-top: 0.125rem;
  font-weight: 400;
}

.location-icon {
  font-size: 0.75rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(0);
  opacity: 1;
}

.header-right-hidden {
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
  display: none;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.header-btn:active {
  transform: translateY(0);
}

.icon {
  font-size: 1.1rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    padding: 0.75rem 1rem;
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .header-left {
    /* justify-content: center; */
    width: 100%;
  }
  
  .header-right {
    width: 100%;
    justify-content: center;
  }
  
  .header-right-hidden {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }
  
  .app-title {
    font-size: 1.1rem;
  }
  
  .title-location {
    font-size: 0.8rem;
  }
  
  .logo {
    width: 36px;
    height: 36px;
  }
  
  .header-btn {
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 480px) {
  .header-content {
    padding: 0.5rem 0.75rem;
    gap: 0.5rem;
  }
  
  .header-left {
    gap: 0.75rem;
  }
  
  .app-title {
    font-size: 1rem;
  }
  
  .title-location {
    font-size: 0.75rem;
  }
}

/* 桌面端保持水平布局 */
@media (min-width: 769px) {
  .header-content {
    flex-direction: row;
    align-items: center;
  }
  
  .header-left {
    flex: 1;
  }
  
  .header-right {
    flex: none;
  }
}

/* 桌面端保持水平布局 */
@media (min-width: 769px) {
  .header-content {
    flex-direction: row;
    align-items: center;
  }
  
  .header-left {
    flex: 1;
  }
  
  .header-right {
    flex: none;
  }
  
  .header-right-hidden {
    transform: translateX(100%);
    opacity: 0;
    pointer-events: none;
  }
}
</style>