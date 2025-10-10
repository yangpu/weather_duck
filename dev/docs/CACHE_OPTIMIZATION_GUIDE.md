# 缓存优化指南

## 概述

本项目实现了全新的**缓存优先策略**，解决了离线模式下的空白页面问题，并优化了数据加载性能。

## 核心特性

### 1. 缓存优先策略 ⚡
- **离线/在线模式统一**：无论网络状态如何，都优先从缓存加载数据
- **即时响应**：页面打开后立即显示缓存数据，确保用户体验
- **后台更新**：在线时后台获取最新数据，静默更新缓存

### 2. 按日期索引缓存 📅
- **智能合并**：支持日期范围合并，如第一次请求1-14号，第二次请求18-30号，缓存自动包含1-30号数据
- **重复覆盖**：相同日期的数据以最新获取的为准
- **容量管理**：最大缓存90天数据，超出时自动删除最远的日期数据

### 3. 多层缓存架构 🏗️
```
用户界面
    ↓
优化统一缓存服务 (optimizedUnifiedCacheService)
    ↓
增强离线缓存服务 (enhancedOfflineCacheService)
    ↓
持久化存储 (localStorage + IndexedDB)
```

## 使用方法

### 开启缓存状态指示器

在浏览器控制台中执行：
```javascript
localStorage.setItem('show_cache_indicator', 'true')
```
然后刷新页面，右上角会显示缓存状态指示器。

### 测试缓存优先策略

1. **正常加载数据**
   - 打开应用，选择日期范围，点击"获取天气"
   - 观察缓存状态指示器，查看缓存数据量

2. **测试离线模式**
   - 在浏览器开发者工具中切换到"Network"标签
   - 勾选"Offline"模拟离线状态
   - 刷新页面或切换日期范围
   - 应该立即显示缓存数据，而不是空白页面

3. **测试缓存合并**
   - 先请求1月1日到1月15日的数据
   - 再请求1月20日到1月31日的数据
   - 缓存应该包含1月1日到1月31日的完整数据

4. **测试后台更新**
   - 在有缓存数据的情况下，重新获取数据（不强制刷新）
   - 页面应该立即显示缓存数据
   - 后台会静默更新数据，更新完成后缓存指示器会显示新的统计信息

## 配置选项

### 缓存配置
```typescript
interface CacheConfig {
  maxDateCount: number // 最大缓存日期数量，默认90天
  weatherTTL: number   // 天气数据TTL，默认24小时
  diaryTTL: number     // 日记数据TTL，默认7天
}
```

### 修改配置
```javascript
// 在浏览器控制台中执行
window.__enhancedOfflineCacheService.updateConfig({
  maxDateCount: 120,  // 增加到120天
  weatherTTL: 12 * 60 * 60 * 1000  // 减少到12小时
})
```

## API 说明

### 优化统一缓存服务 (OptimizedUnifiedCacheService)

#### 主要方法

```typescript
// 初始化数据（缓存优先）
async initializeDataOptimized(
  startDate: string, 
  endDate: string, 
  latitude: number, 
  longitude: number, 
  forceRefresh?: boolean
): Promise<InitializeDataResult>

// 手动刷新数据
async refreshData(
  startDate: string, 
  endDate: string, 
  latitude: number, 
  longitude: number
): Promise<InitializeDataResult>

// 获取缓存统计
getCacheStats(): OptimizedCacheStats

// 清理缓存
clearCache(): void
```

### 增强离线缓存服务 (EnhancedOfflineCacheService)

#### 主要方法

```typescript
// 缓存优先获取天气数据
async getWeatherDataCacheFirst(
  startDate: string, 
  endDate: string, 
  onlineLoader?: () => Promise<WeatherData[]>
): Promise<WeatherData[]>

// 批量缓存数据
batchCacheWeatherData(weatherList: WeatherData[]): void
batchCacheDiaryData(diaryList: DiaryData[]): void

// 获取缓存统计
getCacheStats(): CacheStats

// 清空所有缓存
clearAllCache(): void
```

## 事件系统

### 缓存更新事件

```typescript
// 天气缓存更新
window.addEventListener('cache:weather:updated', (event) => {
  console.log('天气缓存已更新:', event.detail)
})

// 日记缓存更新
window.addEventListener('cache:diary:updated', (event) => {
  console.log('日记缓存已更新:', event.detail)
})

// 后台更新完成
window.addEventListener('unified:background:updated', (event) => {
  console.log('后台更新完成:', event.detail)
})
```

## 性能优化

### 1. 请求去重
- 相同参数的并发请求会被自动去重
- 避免重复的网络请求

### 2. 并行加载
- 天气数据和日记数据并行获取
- 减少总体加载时间

### 3. 智能预加载
- 后台预加载相邻日期的数据
- 提升用户浏览体验

### 4. 内存优化
- 自动清理过期缓存
- 限制缓存大小，防止内存泄漏

## 故障排除

### 常见问题

1. **缓存指示器不显示**
   - 确保已设置 `localStorage.setItem('show_cache_indicator', 'true')`
   - 刷新页面

2. **离线模式仍显示空白页面**
   - 检查是否有缓存数据：`window.__enhancedOfflineCacheService.getCacheStats()`
   - 确保之前已成功加载过数据

3. **缓存数据不更新**
   - 使用强制刷新：点击刷新按钮时按住Shift键
   - 或在缓存指示器中点击"刷新缓存"

4. **缓存占用空间过大**
   - 调整 `maxDateCount` 配置
   - 或点击"清空缓存"按钮

### 调试命令

```javascript
// 查看缓存统计
console.log(window.__enhancedOfflineCacheService.getCacheStats())

// 查看优化缓存统计
console.log(window.__optimizedUnifiedCacheService.getCacheStats())

// 清空所有缓存
window.__enhancedOfflineCacheService.clearAllCache()
window.__optimizedUnifiedCacheService.clearCache()

// 模拟离线状态
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: false
})
```

## 最佳实践

1. **首次使用**：建议在网络良好时先加载一次数据，建立缓存基础
2. **定期清理**：如果长期使用，建议定期清理缓存以释放存储空间
3. **离线使用**：在网络不稳定的环境下，应用会自动切换到缓存优先模式
4. **数据同步**：网络恢复后，应用会自动在后台同步最新数据

## 技术细节

### 缓存键策略
- 天气数据：`weather_${date}`
- 日记数据：`diary_${date}`
- 请求去重：`${type}_${params_hash}`

### 存储机制
1. **内存缓存**：Map结构，快速访问
2. **localStorage**：持久化存储，浏览器重启后保持
3. **IndexedDB**：大容量存储（备用）

### 过期策略
- 天气数据：24小时TTL
- 日记数据：7天TTL
- 自动清理：每小时检查一次过期数据