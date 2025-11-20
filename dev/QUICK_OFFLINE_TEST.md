# 🚀 快速离线测试（2分钟）

## ⚠️ 重要说明

**你遇到空白页面的原因**：
- ❌ **开发环境 (`npm run dev`) 无法测试离线功能**
- Vite 开发服务器使用 ES 模块热更新，离线后无法加载模块
- Service Worker 会跳过 Vite 的特殊请求
- **这是正常的，不是 bug！**

**正确测试方法**：
- ✅ **必须使用生产构建** (`npm run build`)
- 生产环境会将所有代码打包成静态文件
- Service Worker 可以完整缓存这些静态文件

---

## 📋 测试步骤（已为你构建好）

### 1️⃣ 启动预览服务器

在终端运行：
```bash
npm run preview
```

应该看到：
```
  ➜  Local:   http://localhost:4173/
  ➜  Network: http://192.168.x.x:4173/
```

### 2️⃣ 访问并等待缓存（重要！）

1. **打开浏览器访问**: `http://localhost:4173`
2. **打开开发者工具**（F12）→ Console 标签
3. **等待 3-5 秒**，查看日志：

应该看到：
```
[SW] Installing Service Worker version: 1.2.4
[SW] Environment: Production
[SW] Cached: /
[SW] Cached: /index.html
[SW] Cached: /manifest.json
...
[SW] Installation complete, cached 7 resources
[SW] Service Worker registered successfully
```

### 3️⃣ 验证缓存已建立

1. 切换到 **Application** 标签
2. 左侧菜单找到 **Cache Storage**
3. 展开应该看到：
   - `weather-duck-v1.2.4`
   - `weather-duck-runtime-v1.2.4`
4. 点击 `weather-duck-v1.2.4`，确认看到 `/index.html`

### 4️⃣ 测试离线功能

1. **返回终端**
2. **按 `Ctrl+C`** 停止预览服务器
3. **返回浏览器**
4. **刷新页面**（F5 或 Cmd+R）

### 5️⃣ 验证结果

✅ **成功 - 应该看到**：
- 完整的天气应用界面
- 页面顶部红色"离线模式"提示条
- Console 显示：
  ```
  [SW] 🔌 Navigation failed (offline), returning cached app
  [SW] ✅ Found in CACHE_NAME: /index.html
  ```

❌ **失败 - 如果还是空白**：
- 查看 Console 错误信息
- 确认 Cache Storage 中有 `/index.html`
- 尝试清除缓存重新测试（见下方）

---

## 🔧 如果失败，重新测试

### 清除缓存和 Service Worker

1. 开发者工具 → Application → Service Workers
2. 点击 **"Unregister"** 注销所有 SW
3. Cache Storage → 右键每个缓存 → **Delete**
4. 关闭浏览器，重新打开
5. 从步骤 1️⃣ 重新开始

### 一键清除脚本

在 Console 中运行：
```javascript
// 清除所有
navigator.serviceWorker.getRegistrations().then(regs => 
  regs.forEach(r => r.unregister())
);
caches.keys().then(keys => 
  Promise.all(keys.map(k => caches.delete(k)))
);
console.log('已清除，请刷新页面');
```

---

## 📊 环境对比

| 环境 | 命令 | 端口 | 离线功能 | 用途 |
|------|------|------|---------|------|
| 开发环境 | `npm run dev` | 5173 | ❌ 不支持 | 日常开发 |
| 生产预览 | `npm run preview` | 4173 | ✅ 完全支持 | 离线测试 |

---

## ✅ 我已经帮你完成

1. ✅ 修复了 Service Worker 缓存逻辑（v1.2.4）
2. ✅ 删除了离线模式页面
3. ✅ 增强了缓存查找机制
4. ✅ 构建了生产版本

**下一步**：
- 在终端运行 `npm run preview`
- 按照上面的步骤测试
- 应该能看到完整的应用了！

---

**需要帮助？** 请分享：
- Console 中的错误日志
- Cache Storage 的截图
- Network 标签的请求状态
