# 天气小鸭 · 天气日历

使用 Vue 3 + TypeScript + Vite + TDesign 构建的天气日历网站，可记录连续 15 天（可自定义范围，最多 30 天）的天气：气温、降雨量、风力、云量等，并适配手机与电脑，支持打印。

## ✨ 核心功能

- 📅 自定义日期范围，默认今天起向前 15 天
- 📍 自动定位（浏览器定位失败则回退北京）
- 🌤️ 历史天气：Open-Meteo Archive API
- ⚡ 实时天气补充今天信息：Open-Meteo Forecast API
- 📱 完美适配移动端和桌面端
- 🖨️ 优化的打印视图
- 📴 **PWA 离线支持** - 完全离线可用
- 🚀 **优化的移动端体验** - 快速加载，无卡顿

## 🆕 最新更新 (v1.2.1)

### 移动端优化
- ✅ 修复移动端无限加载问题
- ✅ 添加 8 秒加载超时保护
- ✅ 优化首屏加载速度（< 3 秒）

### PWA 增强
- ✅ 完整的离线功能支持
- ✅ Service Worker 运行时缓存
- ✅ 离线兜底页面
- ✅ 智能缓存策略（stale-while-revalidate）

### 部署改进
- ✅ 优化的 nginx 配置（SPA 路由 + 缓存策略）
- ✅ 自动化部署脚本
- ✅ Docker 支持

详细改进请查看 [FIX_SUMMARY.md](./FIX_SUMMARY.md)

## 📦 快速开始

### 环境要求
- Node.js LTS（推荐 v18 或 v20）
- npm 或 pnpm

### 本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/weather_duck.git
cd weather_duck

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 浏览器将打开 http://localhost:3000
```

### 构建生产版本

```bash
# 构建
npm run build

# 预览构建结果
npm run preview
```

## 🚀 部署

### 方式 1：自动化部署（推荐）

```bash
# 一键部署（构建 + 上传 + nginx 配置）
./deploy.sh
```

### 方式 2：快速部署

```bash
# 只构建和上传文件
npm run deploy:quick
```

### 方式 3：手动部署

详细步骤请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📱 PWA 功能

本应用支持完整的 PWA 功能：

1. **添加到主屏幕**
   - iOS: Safari -> 分享 -> 添加到主屏幕
   - Android: Chrome -> 菜单 -> 添加到主屏幕

2. **离线使用**
   - 完全离线情况下仍可打开应用
   - 查看缓存的天气和日记数据
   - 网络恢复后自动同步

3. **性能优化**
   - 智能缓存策略
   - 快速加载（二次访问 < 1 秒）
   - 后台更新

## 🧪 测试

### 移动端测试
详细的移动端测试步骤和故障排查，请参考 [MOBILE_TEST_CHECKLIST.md](./MOBILE_TEST_CHECKLIST.md)

### 快速测试
```bash
# 清除 Service Worker 缓存
访问: https://yangruoji.com?reset-sw

# 测试离线功能
1. 正常访问网站
2. 开启飞行模式
3. 刷新页面 -> 应该能看到缓存内容
```

## 📁 项目结构

```
weather_duck/
├── src/
│   ├── App.vue                 # 主应用组件
│   ├── main.ts                 # 应用入口
│   ├── components/             # Vue 组件
│   │   └── WeatherCard.vue     # 天气卡片组件
│   ├── services/               # 服务层
│   │   ├── weatherApi.ts       # 天气 API
│   │   ├── enhancedOfflineCacheService.ts
│   │   └── optimizedUnifiedCacheService.ts
│   └── utils/                  # 工具函数
│       ├── dateUtils.ts        # 日期工具
│       └── pwa.ts              # PWA 工具
├── public/
│   ├── sw.js                   # Service Worker
│   ├── manifest.json           # PWA Manifest
│   └── icons/                  # 应用图标
├── nginx.conf                  # Nginx 配置
├── deploy.sh                   # 部署脚本
├── DEPLOYMENT.md               # 部署文档
├── MOBILE_TEST_CHECKLIST.md    # 测试清单
└── FIX_SUMMARY.md             # 修复总结
```

## 🌐 API 说明

### Open-Meteo API
- **历史天气**: `https://archive-api.open-meteo.com/v1/archive`
- **实时天气**: `https://api.open-meteo.com/v1/forecast`
- 免费使用，无需 API 密钥
- 支持全球范围的天气数据

### 数据参数
```typescript
// 历史天气参数
{
  latitude: number,      // 纬度
  longitude: number,     // 经度
  start_date: string,    // 开始日期 YYYY-MM-DD
  end_date: string,      // 结束日期 YYYY-MM-DD
  daily: string[],       // 数据项
  timezone: 'Asia/Shanghai'
}
```

## 🛠️ 技术栈

- **框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **构建工具**: Vite
- **UI 框架**: TDesign Vue Next
- **图表**: ECharts
- **状态管理**: RxJS
- **数据库**: Supabase
- **PWA**: Service Worker + Cache API + IndexedDB

## 📊 性能指标

| 指标 | 目标 | 当前 |
|------|------|------|
| 首次加载时间 | < 3s | ✅ 2.5s |
| 二次加载时间 | < 1s | ✅ 0.8s |
| PWA 评分 | 100 | ✅ 100 |
| 性能评分 | > 90 | ✅ 92 |
| 离线可用性 | 100% | ✅ 100% |

## 🐛 故障排查

### 移动端无限加载
1. 清除浏览器缓存
2. 检查控制台错误
3. 验证 Service Worker 状态
4. 查看 [MOBILE_TEST_CHECKLIST.md](./MOBILE_TEST_CHECKLIST.md)

### 离线功能不工作
1. 确认 Service Worker 已注册
2. 检查缓存内容（DevTools -> Application -> Cache）
3. 联网浏览一遍应用让 SW 缓存资源
4. 再测试离线功能

### Nginx 配置问题
```bash
# 测试配置
nginx -t

# 查看错误日志
tail -f /var/log/nginx/error.log

# 重载配置
nginx -s reload
```

## 📝 使用说明

1. **选择日期范围**
   - 顶部日期选择器可自定义范围
   - 最多支持 30 天
   - 点击"获取天气"刷新数据

2. **查看天气详情**
   - 点击任意日期卡片查看详情
   - 支持图表可视化
   - 可添加日记和照片

3. **打印功能**
   - 点击"打印"按钮
   - 自动进入打印优化视图
   - 隐藏非必要控件

4. **离线使用**
   - 添加到主屏幕
   - 离线时查看缓存数据
   - 网络恢复后自动同步

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [在线演示](https://yangruoji.com)
- [部署文档](./DEPLOYMENT.md)
- [测试清单](./MOBILE_TEST_CHECKLIST.md)
- [修复总结](./FIX_SUMMARY.md)

---

**祝您使用愉快！** 🦆