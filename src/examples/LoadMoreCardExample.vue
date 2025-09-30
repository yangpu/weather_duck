<template>
  <div class="load-more-example">
    <h2>LoadMoreCard 组件示例</h2>
    
    <div class="example-section">
      <h3>基本用法</h3>
      <div class="cards-grid">
        <LoadMoreCard
          :loading-next="loadingNext"
          :loading-previous="loadingPrevious"
          :current-start-date="startDate"
          :current-end-date="endDate"
          :has-loaded-future3-days="hasLoadedFuture3Days"
          @load-next="handleLoadNext"
          @load-previous="handleLoadPrevious"
        />
        
        <!-- 模拟天气卡片 -->
        <div class="mock-weather-card">
          <h4>天气卡片示例</h4>
          <p>2025-09-08</p>
          <p>晴天 25°C</p>
        </div>
        
        <div class="mock-weather-card">
          <h4>天气卡片示例</h4>
          <p>2025-09-07</p>
          <p>多云 23°C</p>
        </div>
      </div>
    </div>

    <div class="example-section">
      <h3>状态控制</h3>
      <div class="controls">
        <t-button @click="toggleNextLoading">
          {{ loadingNext ? '停止加载后7天' : '开始加载后7天' }}
        </t-button>
        <t-button @click="togglePreviousLoading">
          {{ loadingPrevious ? '停止加载前7天' : '开始加载前7天' }}
        </t-button>
        <t-button @click="toggleFuture3Days">
          {{ hasLoadedFuture3Days ? '重置未来3天状态' : '设置已加载未来3天' }}
        </t-button>
      </div>
    </div>

    <div class="example-section">
      <h3>日期范围控制</h3>
      <div class="controls">
        <t-input 
          v-model="startDate" 
          placeholder="开始日期 (YYYY-MM-DD)"
          style="width: 200px;"
        />
        <t-input 
          v-model="endDate" 
          placeholder="结束日期 (YYYY-MM-DD)"
          style="width: 200px;"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LoadMoreCard from '../components/LoadMoreCard.vue'

const loadingNext = ref(false)
const loadingPrevious = ref(false)
const hasLoadedFuture3Days = ref(false)
const startDate = ref('2025-09-01')
const endDate = ref('2025-09-08')

function handleLoadNext(_startDateStr: string, endDateStr: string, _isForecast: boolean) {

  
  // 模拟加载过程
  loadingNext.value = true
  setTimeout(() => {
    loadingNext.value = false
    // 更新结束日期
    endDate.value = endDateStr

  }, 2000)
}

function handleLoadPrevious(startDateStr: string, _endDateStr: string) {

  
  // 模拟加载过程
  loadingPrevious.value = true
  setTimeout(() => {
    loadingPrevious.value = false
    // 更新开始日期
    startDate.value = startDateStr

  }, 2000)
}

function toggleNextLoading() {
  loadingNext.value = !loadingNext.value
}

function togglePreviousLoading() {
  loadingPrevious.value = !loadingPrevious.value
}

function toggleFuture3Days() {
  hasLoadedFuture3Days.value = !hasLoadedFuture3Days.value
}
</script>

<style scoped>
.load-more-example {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.example-section {
  margin-bottom: 40px;
}

.example-section h3 {
  margin-bottom: 16px;
  color: #333;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.mock-weather-card {
  min-height: 200px;
  padding: 16px;
  border: 1px solid #e7e7e7;
  border-radius: 12px;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.mock-weather-card h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.mock-weather-card p {
  margin: 4px 0;
  color: #666;
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
  
  .controls {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>