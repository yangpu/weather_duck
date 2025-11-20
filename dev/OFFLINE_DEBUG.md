# 离线功能调试指南

## 问题诊断

**当前问题**：关闭服务后刷新页面显示空白

**根本原因**：
1. **开发环境限制**：`npm run dev` 启动的 Vite 开发服务器离线后无法提供模块文件
2. Vite 使用 ES 模块热更新（HMR），需要实时连接服务器
3. Service Worker 跳过了 Vite 的特殊请求（`/@vite/`, `?t=` 等）
4. 离线时 `/src/main.ts` 等模块无法加载，Vue 应用无法启动

## 解决方案

### ✅ 方案 1：使用生产构建测试（推荐）

离线功能**只能在生产构建中正常工作**，因为生产构建会将所有代码打包成静态文件。

```bash
# 1. 构建生产版本
npm run build

# 2. 使用静态服务器预览
npm run preview

# 或者使用 serve
npx serve -s dist -p 4173
```

**测试步骤**：
1. 访问 `http://localhost:4173`
2. 等待 3-5 秒让 Service Worker 缓存资源
3. 打开开发者工具查看：
   - Console：`[SW] Service Worker registered successfully`
   - Application → Cache Storage → `weather-duck-v1.2.4`
4. **关闭终端**（停止服务器）
5. **刷新页面**
6. ✅ **预期结果**：看到完整的天气应用

### 方案 2：使用 Chrome 离线模拟

如果想在开发环境测试（虽然功能有限）：

1. **不要关闭开发服务器**
2. 打开开发者工具 → Network 标签
3. 勾选 "Offline" 复选框
4. 刷新页面

**注意**：这种方式会看到很多 Vite 模块加载失败的错误，这是正常的。

## 详细测试步骤（生产环境）

### 第 1 步：构建项目

```bash
npm run build
```

输出示例：
```
vite v5.x.x building for production...
✓ built in 3.21s
dist/index.html                   x.xx kB
dist/assets/index-xxxxx.js        xxx kB
...
```

### 第 2 步：启动预览服务器

```bash
npm run preview
```

或使用 serve：
```bash
npx serve -s dist -p 4173
```

### 第 3 步：访问并等待缓存

1. 打开浏览器访问 `http://localhost:4173`
2. 打开开发者工具（F12）→ Console
3. 等待看到以下日志：
```
[SW] Installing Service Worker version: 1.2.4
[SW] Cached: /
[SW] Cached: /index.html
[SW] Installation complete, cached 7 resources
[SW] Service Worker registered successfully
```

### 第 4 步：检查缓存

1. 切换到 Application 标签
2. 展开 Cache Storage
3. 应该看到：
   - `weather-duck-v1.2.4`（主缓存）
   - `weather-duck-runtime-v1.2.4`（运行时缓存）
4. 点击展开，确认有 `/index.html`

### 第 5 步：测试离线

1. **在终端按 `Ctrl+C` 停止服务器**
2. 返回浏览器
3. **刷新页面（F5）**

### 第 6 步：验证结果

✅ **成功标志**：
- 看到完整的天气应用界面
- 页面顶部可能显示红色"离线模式"提示条
- Console 显示：
```
[SW] 🔌 Navigation failed (offline), returning cached app
[SW] ✅ Found in CACHE_NAME: /index.html
```

❌ **失败标志**：
- 空白页面
- Console 显示：`[SW] ❌ No cached content available`

## 调试命令

### 查看所有缓存

在浏览器 Console 中运行：

```javascript
// 查看所有缓存名称
caches.keys().then(keys => console.log('缓存列表:', keys));

// 查看特定缓存的内容
caches.open('weather-duck-v1.2.4').then(cache => {
  cache.keys().then(requests => {
    console.log('缓存内容:', requests.map(r => r.url));
  });
});

// 查看所有缓存的详细内容
caches.keys().then(keys => {
  keys.forEach(key => {
    caches.open(key).then(cache => {
      cache.keys().then(requests => {
        console.log(`\n=== ${key} ===`);
        requests.forEach(r => console.log(r.url));
      });
    });
  });
});
```

### 手动清除缓存

```javascript
// 清除所有缓存
caches.keys().then(keys => {
  Promise.all(keys.map(key => caches.delete(key)))
    .then(() => console.log('所有缓存已清除'));
});

// 注销 Service Worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  console.log('Service Worker 已注销');
});
```

### 强制刷新页面

```javascript
// 清除缓存后强制刷新
location.reload(true);

// 或访问特殊 URL 重置 SW
location.href = location.origin + '?reset-sw';
```

## 常见问题排查

### 1. 构建后还是空白？

**检查清单**：
- [ ] 确认访问的是 `localhost:4173` 而不是 `localhost:5173`
- [ ] 确认已等待 3-5 秒让缓存建立
- [ ] 查看 Cache Storage 是否有缓存内容
- [ ] 检查 Console 是否有 SW 注册成功的日志

**解决方案**：
```bash
# 清除旧构建
rm -rf dist

# 重新构建
npm run build

# 重新预览
npm run preview
```

### 2. Cache Storage 为空？

**原因**：SW 安装失败或资源加载失败

**解决方案**：
1. 查看 Console 错误信息
2. 检查网络连接
3. 清除浏览器所有数据重试

### 3. 看到旧版本的离线页面？

**原因**：旧 SW 版本还在运行

**解决方案**：
```bash
# 在 Application → Service Workers
1. 勾选 "Update on reload"
2. 点击 "Unregister"
3. 强制刷新（Cmd+Shift+R）
```

### 4. 控制台显示 "No cached content available"

**原因**：缓存未建立或已被清除

**解决方案**：
1. 确保在线时访问过页面
2. 等待 SW 安装完成（看到 "Installation complete" 日志）
3. 刷新页面确保缓存生效
4. 然后再测试离线

## 开发环境 vs 生产环境

| 特性 | 开发环境 (npm run dev) | 生产环境 (npm run preview) |
|------|----------------------|--------------------------|
| 离线功能 | ❌ 不支持 | ✅ 完全支持 |
| HMR | ✅ 支持 | ❌ 不支持 |
| 模块加载 | 实时加载 | 打包后加载 |
| SW 缓存 | 部分跳过 | 完全缓存 |
| 测试用途 | 开发调试 | 离线测试 |

## 完整测试流程（一键脚本）

创建测试脚本 `test-offline.sh`：

```bash
#!/bin/bash
echo "🔨 构建生产版本..."
npm run build

echo "🚀 启动预览服务器..."
npm run preview &
SERVER_PID=$!

echo "⏳ 等待服务器启动..."
sleep 3

echo "✅ 服务器已启动: http://localhost:4173"
echo "📝 请在浏览器中："
echo "   1. 访问 http://localhost:4173"
echo "   2. 等待 5 秒让缓存建立"
echo "   3. 检查开发者工具中的缓存"
echo "   4. 按 Ctrl+C 停止此脚本"
echo "   5. 刷新浏览器测试离线功能"

# 等待用户手动停止
wait $SERVER_PID
```

使用方法：
```bash
chmod +x test-offline.sh
./test-offline.sh
```

## 总结

**重要提醒**：
1. 🚨 **离线功能只能在生产构建中测试**
2. 开发环境 (`npm run dev`) 无法完整测试离线功能
3. 使用 `npm run build` + `npm run preview` 进行测试
4. 确保等待 Service Worker 缓存完成后再测试

**预期行为**：
- ✅ 生产环境离线：显示完整应用 + 离线提示
- ❌ 开发环境离线：模块加载失败，空白页面

---

**版本**: Service Worker v1.2.4  
**更新时间**: 2025-11-19
