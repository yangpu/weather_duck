# LoadMoreCard 合并组件文档

## 概述

LoadMoreCard 是一个合并了前后数据加载功能的组件，将原来的 LoadNextCard 和 LoadPreviousCard 合并到一个卡片中，上下摆放，节省页面空间。

## 设计理念

### 🎯 空间优化
- **合并布局**: 将两个加载按钮合并到一个天气卡片大小的空间中
- **上下摆放**: 后7天数据按钮在上方，前7天数据按钮在下方
- **高度对齐**: 与WeatherCard保持相同的高度（桌面端200px，移动端180px）

### 🎨 视觉设计
- **分隔线**: 使用渐变分隔线区分两个功能区域
- **统一风格**: 保持与WeatherCard一致的圆角、阴影和悬停效果
- **响应式**: 移动端和桌面端都有相应的尺寸调整

## Props

```typescript
interface Props {
  loadingNext?: boolean          // 后7天数据加载状态
  loadingPrevious?: boolean      // 前7天数据加载状态
  currentStartDate?: string      // 当前数据的开始日期
  currentEndDate?: string        // 当前数据的结束日期
  hasLoadedFuture3Days?: boolean // 是否已加载未来3天数据
}
```

## Events

```typescript
interface Emits {
  loadNext: [startDate: string, endDate: string, isForecast: boolean]
  loadPrevious: [startDate: string, endDate: string]
}
```

## 功能特性

### ✅ 智能显示控制
- **自动隐藏**: 当已加载未来3天数据时，自动隐藏后7天按钮
- **预测数据限制**: 自动处理forecast接口的3天限制
- **按钮状态**: 根据加载状态和数据范围智能禁用按钮

### ✅ 日期范围计算
- **前7天数据**: 基于当前开始日期计算前7天范围
- **后7天数据**: 基于当前结束日期计算后7天范围，支持预测数据
- **边界处理**: 自动处理日期边界和预测数据限制

### ✅ 用户体验优化
- **加载状态**: 独立的前后按钮加载状态显示
- **视觉反馈**: 清晰的按钮主题区分（成功/警告/主要）
- **响应式设计**: 移动端优化的尺寸和间距

## 使用示例

### 基本用法

```vue
<template>
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
    
    <WeatherCard 
      v-for="item in weatherList" 
      :key="item.date" 
      :weather="item" 
    />
  </div>
</template>

<script setup>
import LoadMoreCard from './components/LoadMoreCard.vue'

const loadingNext = ref(false)
const loadingPrevious = ref(false)
const hasLoadedFuture3Days = ref(false)
const startDate = ref('2025-09-01')
const endDate = ref('2025-09-08')

async function handleLoadNext(startDateStr, endDateStr, isForecast) {
  loadingNext.value = true
  try {
    // 加载天气数据
    const weatherData = await weatherService.getWeatherForDateRange(
      latitude.value, longitude.value, startDateStr, endDateStr
    )
    
    // 加载日记数据
    const diaries = await diaryService.getDiariesByDateRange(startDateStr, endDateStr)
    
    // 更新状态
    endDate.value = endDateStr
    if (isForecast && isMaxForecastReached(endDateStr)) {
      hasLoadedFuture3Days.value = true
    }
  } finally {
    loadingNext.value = false
  }
}

async function handleLoadPrevious(startDateStr, endDateStr) {
  loadingPrevious.value = true
  try {
    // 加载历史数据
    const weatherData = await weatherService.getWeatherForDateRange(
      latitude.value, longitude.value, startDateStr, endDateStr
    )
    
    // 加载日记数据
    const diaries = await diaryService.getDiariesByDateRange(startDateStr, endDateStr)
    
    // 更新状态
    startDate.value = startDateStr
  } finally {
    loadingPrevious.value = false
  }
}
</script>
```

## 样式特性

### 🎨 布局结构
```css
.load-more-card {
  min-height: 200px;           /* 与WeatherCard对齐 */
  border-radius: 12px;         /* 统一圆角 */
  transition: all 0.3s ease;   /* 平滑过渡 */
}

.load-more-content {
  display: flex;
  flex-direction: column;      /* 上下布局 */
  min-height: 200px;
}

.load-section {
  flex: 1;                     /* 平均分配空间 */
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

### 📱 响应式适配
- **桌面端**: 200px高度，16px内边距
- **移动端**: 180px高度，12px内边距，更小的按钮和字体

## 优势对比

### 🆚 与分离组件对比

| 特性 | 分离组件 | 合并组件 |
|------|----------|----------|
| 占用空间 | 2个卡片位置 | 1个卡片位置 |
| 页面布局 | 可能不规整 | 整齐对齐 |
| 功能完整性 | ✅ 完整 | ✅ 完整 |
| 维护复杂度 | 较高 | 较低 |
| 用户体验 | 分散 | 集中 |

### ✅ 主要优势
1. **空间节省**: 减少50%的卡片占用空间
2. **布局整齐**: 与天气卡片完美对齐
3. **功能集中**: 所有加载功能集中在一个位置
4. **维护简单**: 单一组件，逻辑集中

## 注意事项

1. **日期格式**: 确保传入的日期格式为 `YYYY-MM-DD`
2. **状态管理**: 正确管理 `hasLoadedFuture3Days` 状态
3. **错误处理**: 在事件处理函数中添加适当的错误处理
4. **性能优化**: 避免频繁的日期计算，使用计算属性缓存结果

## 迁移指南

### 从分离组件迁移

1. **移除旧组件**:
   ```vue
   // 删除这些
   <LoadNextCard ... />
   <LoadPreviousCard ... />
   ```

2. **添加新组件**:
   ```vue
   // 替换为
   <LoadMoreCard
     :loading-next="loadingNext"
     :loading-previous="loadingPrevious"
     :current-start-date="startDate"
     :current-end-date="endDate"
     :has-loaded-future3-days="hasLoadedFuture3Days"
     @load-next="handleLoadNext"
     @load-previous="handleLoadPrevious"
   />
   ```

3. **更新导入**:
   ```javascript
   // 替换导入
   import LoadMoreCard from './components/LoadMoreCard.vue'
   ```

4. **事件处理**: 保持原有的事件处理逻辑不变

通过这种合并设计，我们成功将两个加载功能整合到一个卡片中，既节省了页面空间，又保持了完整的功能性和良好的用户体验。