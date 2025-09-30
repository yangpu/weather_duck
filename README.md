# 天气小鸭 · 天气日历

使用 Vue 3 + TypeScript + Vite + TDesign 构建的天气日历网站，可记录连续 15 天（可自定义范围，最多 30 天）的天气：气温、降雨量、风力、云量等，并适配手机与电脑，支持打印。

## 功能
- 自定义日期范围，默认今天起向前 15 天
- 自动定位（浏览器定位失败则回退北京）
- 历史天气：Open-Meteo Archive API
- 实时天气补充今天信息：Open-Meteo Forecast API
- 自适应网格 + 打印优化

## 环境准备（Windows）
1) 安装 Node.js LTS（推荐 18 或 20 版本）：
   - 方式 A（官网）：前往 `https://nodejs.org/zh-cn` 下载并安装 LTS 版本
   - 方式 B（PowerShell 使用 winget）：
     ```powershell
     winget install OpenJS.NodeJS.LTS -s winget -e --accept-source-agreements --accept-package-agreements
     ```
   安装完成后重新打开 PowerShell，执行：
   ```powershell
   node -v
   npm -v
   ```
   能看到版本号即成功。

2) 安装依赖并启动：
   ```powershell
   npm i --legacy-peer-deps
   npm run dev
   ```
   浏览器将打开 `http://localhost:3000`。

## 使用说明
- 顶部可选择日期范围（最多 30 天），点击“获取天气”刷新。
- 点击“打印”进入打印视图（自动隐藏非必要控件）。

## 目录结构
- `src/App.vue` 页面主体（日期选择、打印、网格布局）
- `src/components/WeatherCard.vue` 单日天气卡片
- `src/services/weatherApi.ts` 天气 API 封装（Open-Meteo）
- `src/utils/dateUtils.ts` 日期工具

## API 说明
- 历史：`https://archive-api.open-meteo.com/v1/archive`
- 实时：`https://api.open-meteo.com/v1/forecast`
- 免费，无需密钥。

## 构建
```bash
npm run build
npm run preview
```


## 上传腾讯云服务器
```bash
scp -r dist root@yangruoji.com:/root
```