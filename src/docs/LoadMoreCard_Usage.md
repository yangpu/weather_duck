# LoadNextCard 和 LoadPreviousCard 组件使用文档

## 概述

原来的 LoadMoreCard 组件已经拆分为两个独立的组件：
- **LoadNextCard**: 加载后7天数据，放在天气卡片列表的**前面**
- **LoadPreviousCard**: 加载前7天数据，放在天气卡片列表的**后面**

两个组件都采用 TDesign Button 设计风格，与项目保持一致。

## 组件特性

### 🎯 LoadNextCard (加载后7天数据)
- **位置**: 放在天气卡片列表前面
- **功能**: 智能判断历史数据或预测数据
- **预测限制**: 最多支持未来3天预测数据
- **按钮主题**: 历史数据使用 `success` 主题，预测数据使用 `warning` 主题
- **图标**: 历史数据使用 `chevron-right`，预测数据使用 `time`

### 🎯 LoadPreviousCard (加载前7天数据)
- **位置**: 放在天气卡片列表后面
- **功能**: 加载历史天气数据和日记
- **按钮主题**: 使用 `primary` 主题
- **图标**: 使用 `chevron-left`

## Props 属性

### LoadNextCard
```typescript
interface Props {
  loading?: boolean        // 加载状态
  currentEndDate?: string  // 当前数据的结束日期 (YYYY-MM-DD)
}
```

### LoadPreviousCard
```typescript
interface Props {
  loading?: boolean          // 加载状态
  currentStartDate?: string  // 当前数据的开始日期 (YYYY-MM-DD)
}
```

## Events 事件

### LoadNextCard
```typescript
interface Emits {
  loadNext: [startDate: string, endDate: string, isForecast: boolean]
}
```

### LoadPreviousCard
```typescript
interface Emits {
  loadPrevious: [startDate: string, endDate: string]
}
```

## 使用示例

### 基础布局
```vue
<template>
  <div class="weather-app">
    <!-- LoadNextCard 放在列表前面 -->
    <LoadNextCard
      :loading="loadingNext"
      :current-end-date="currentEndDate"
      @load-next="handleLoadNext"
    />
    
    <!-- 天气卡片列表 -->
    <div class="weather-cards">
      <WeatherCard 
        v-for="weather in weatherList" 
        :key="weather.date"
        :weather="weather"
      />
    </div>
    
    <!-- LoadPreviousCard 放在列表后面 -->
    <LoadPreviousCard
      :loading="loadingPrevious"
      :current-start-date="currentStartDate"
      @load-previous="handleLoadPrevious"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LoadNextCard from '@/components/LoadNextCard.vue'
import LoadPreviousCard from '@/components/LoadPreviousCard.vue'
import WeatherCard from '@/components/WeatherCard.vue'

const loadingNext = ref(false)
const loadingPrevious = ref(false)
const currentStartDate = ref('2024-01-15')
const currentEndDate = ref('2024-01-21')
const weatherList = ref([])

// 处理加载后7天数据
async function handleLoadNext(startDate: string, endDate: string, isForecast: boolean) {
  loadingNext.value = true
  try {
    if (isForecast) {
      // 使用预测接口
      console.log(`加载预测数据: ${startDate} 至 ${endDate}`)
      // await loadForecastData(startDate, endDate)
    } else {
      // 使用历史接口
      console.log(`加载历史数据: ${startDate} 至 ${endDate}`)
      // await loadHistoricalData(startDate, endDate)
    }
    // 加载对应的天气日记
    // await loadDiaries(startDate, endDate)
    
    // 更新当前结束日期
    currentEndDate.value = endDate
  } catch (error) {
    console.error('加载后7天数据失败:', error)
  } finally {
    loadingNext.value = false
  }
}

// 处理加载前7天数据
async function handleLoadPrevious(startDate: string, endDate: string) {
  loadingPrevious.value = true
  try {
    console.log(`加载前7天数据: ${startDate} 至 ${endDate}`)
    // await loadHistoricalData(startDate, endDate)
    // await loadDiaries(startDate, endDate)
    
    // 更新当前开始日期
    currentStartDate.value = startDate
  } catch (error) {
    console.error('加载前7天数据失败:', error)
  } finally {
    loadingPrevious.value = false
  }
}
</script>
```

### 完整的数据加载实现
```typescript
// 示例：实际的数据加载函数
async function loadHistoricalData(startDate: string, endDate: string) {
  // 使用实际的天气服务
  const weatherApi = await import('@/services/weatherApi')
  const data = await weatherApi.getHistoricalWeather({
    startDate,
    endDate,
    latitude: 39.9042,
    longitude: 116.4074
  })
  
  // 处理数据并添加到列表
  weatherList.value.push(...data)
}

async function loadForecastData(startDate: string, endDate: string) {
  // 使用预测接口
  const weatherApi = await import('@/services/weatherApi')
  const data = await weatherApi.getForecastWeather({
    startDate,
    endDate,
    latitude: 39.9042,
    longitude: 116.4074
  })
  
  // 处理数据并添加到列表
  weatherList.value.push(...data)
}

async function loadDiaries(startDate: string, endDate: string) {
  // 加载天气日记
  const storageAdapter = await import('@/services/optimizedStorageAdapter')
  const diaries = await storageAdapter.getDiariesByDateRange(startDate, endDate)
  
  // 处理日记数据...
  console.log(`加载了 ${diaries.length} 条日记`)
}
```

## 设计规范

### 按钮主题
- **LoadNextCard**: 
  - 历史数据: `theme="success"` (绿色)
  - 预测数据: `theme="warning"` (橙色)
- **LoadPreviousCard**: `theme="primary"` (蓝色)

### 图标使用
- **LoadNextCard**: 
  - 历史数据: `chevron-right`
  - 预测数据: `time`
- **LoadPreviousCard**: `chevron-left`

### 响应式设计
- **桌面端**: 按钮在右侧，信息在左侧
- **移动端**: 按钮全宽显示，垂直布局

## 调试和故障排除

### 点击无响应问题
1. 检查事件监听器是否正确绑定
2. 查看浏览器控制台的调试日志
3. 确认 `loading` 状态没有阻止点击

### 日期计算问题
1. 确保传入的日期格式为 `YYYY-MM-DD`
2. 检查 `currentStartDate` 和 `currentEndDate` 的值
3. 验证日期范围计算逻辑

### API 请求问题
1. 检查网络请求是否发出
2. 验证 API 接口是否正常
3. 确认错误处理逻辑

## 最佳实践

1. **状态管理**: 使用独立的 loading 状态管理每个按钮
2. **错误处理**: 在事件处理函数中添加 try-catch
3. **用户反馈**: 提供清晰的加载状态和错误提示
4. **数据合并**: 正确合并新数据与现有数据
5. **日期更新**: 成功加载后及时更新日期范围

## 更新日志

### v2.1.0
- 拆分为两个独立组件：LoadPreviousCard 和 LoadNextCard
- 采用 TDesign Button 设计风格，与项目保持一致
- 修复点击事件响应问题，添加调试日志
- 优化组件布局：LoadNextCard 放在列表前面，LoadPreviousCard 放在列表后面
- 改进按钮主题：根据数据类型使用不同颜色主题
- 增强响应式设计，移动端按钮全宽显示
- 简化Props接口，每个组件只关注自己的功能