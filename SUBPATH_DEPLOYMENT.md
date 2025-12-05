# 子路径部署配置说明

本项目已优化为支持**根路径**和**子路径**部署，适用于多站点nginx配置。

## ✅ 已完成的配置

### 1. Vite配置 (`vite.config.ts`)
```typescript
export default defineConfig(({ command, mode }) => {
  // 开发环境使用根路径，生产环境使用相对路径
  const base = command === 'serve' ? '/' : './'
  return {
    plugins: [vue()],
    base,  // 关键配置
    // ...
  }
})
```

**工作原理**:
- 开发环境 (`npm run dev`): base = `/` (根路径)
- 生产环境 (`npm run build`): base = `./` (相对路径)

### 2. Service Worker (`public/sw.js`)
- ✅ 动态检测base路径（根路径 `/` 或子路径 `/weather_duck/`）
- ✅ 自动适配缓存路径
- ✅ 通知图标路径动态适配

```javascript
// 动态获取base路径
const getBasePath = () => {
  const path = self.location.pathname
  // 从sw.js路径中提取base路径
  // 例如: /weather_duck/sw.js -> /weather_duck/
  const match = path.match(/^(\/[^\/]+\/)/)
  return match ? match[1] : '/'
}

const BASE_PATH = getBasePath()  // 自动适配
```

### 3. HTML (`index.html`)
- ✅ Service Worker注册逻辑动态检测路径
- ✅ 开发环境和生产环境自动适配

```javascript
// 动态获取base路径
const getBasePath = () => {
  const path = window.location.pathname
  const match = path.match(/^(\/[^\/]+\/)/)
  return match ? match[1] : '/'
}

const basePath = getBasePath()
const swPath = basePath === '/' ? '/sw.js' : basePath + 'sw.js'

navigator.serviceWorker.register(swPath, { 
  scope: basePath,
  updateViaCache: 'none'
});
```

### 4. Nginx配置 (`nginx.conf`)
支持多站点子路径部署：

```nginx
server {
    listen 443 ssl;
    server_name yangruoji.com;
    
    # 默认跳转到weather_duck
    location = / {
        return 301 /weather_duck/;
    }

    # spellingbee应用
    location /spellingbee/ {
        alias /usr/share/nginx/html/spellingbee/;
        index index.html;
        
        location ~ /spellingbee/sw\.js$ {
            add_header Service-Worker-Allowed "/spellingbee/";
            # ...
        }
        try_files $uri $uri/ /spellingbee/index.html;
    }

    # weather_duck应用
    location /weather_duck/ {
        alias /usr/share/nginx/html/weather_duck/;
        index index.html;
        
        # Service Worker - 绝对不缓存
        location ~ /weather_duck/sw\.js$ {
            alias /usr/share/nginx/html/weather_duck/sw.js;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Service-Worker-Allowed "/weather_duck/";
        }
        
        # 静态资源 - 长期缓存
        location ~ /weather_duck/assets/.*\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # SPA路由处理
        try_files $uri $uri/ /weather_duck/index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

## 🚀 部署流程

### 本地开发
```bash
npm run dev
# 访问 http://localhost:3000
# ✅ 使用根路径 /
```

### 构建
```bash
npm run build
# ✅ 输出到 dist/ 目录
# ✅ 所有路径自动转为相对路径 ./
# ✅ 验证: cat dist/index.html | grep "assets"
```

### 部署到生产环境

#### 方式1：使用npm脚本（推荐）
```bash
# 构建并部署到服务器
npm run deploy

# 仅模拟部署（查看将要传输的文件，不实际上传）
npm run deploy:dry
```

#### 方式2：使用增强部署脚本
```bash
./deploy.sh
```

**部署脚本功能**:
- 🏗️ 自动构建项目
- 💾 备份服务器旧文件（带时间戳）
- 📤 使用rsync增量上传
- ⚙️ 可选更新nginx配置
- 🔍 自动测试nginx配置语法
- 🔄 可选重载nginx
- 🐳 可选重启Docker nginx容器
- ✅ 显示完整测试清单

## 🧪 测试

### 本地测试
```bash
# 1. 开发环境测试（根路径）
npm run dev
# ✅ 访问: http://localhost:3000
# ✅ Service Worker scope: /

# 2. 生产构建预览
npm run build
npm run preview
# ✅ 访问: http://localhost:4173
# ✅ 验证相对路径
```

### 生产环境测试
```bash
# 1. 正常访问
https://yangruoji.com/weather_duck/
# ✅ 页面加载正常
# ✅ Service Worker scope: /weather_duck/

# 2. 清除Service Worker缓存测试
https://yangruoji.com/weather_duck/?reset-sw
# ✅ 强制注销并重新注册SW

# 3. 测试SPA路由
https://yangruoji.com/weather_duck/
https://yangruoji.com/weather_duck/any-route
# ✅ 刷新页面不会404

# 4. 测试其他站点不受影响
https://yangruoji.com/spellingbee/
# ✅ 独立工作，互不干扰
```

### ✅ 验证清单
- ✅ 首页加载正常，无404错误
- ✅ 静态资源（JS/CSS/图片）加载正常
- ✅ favicon和PWA图标显示正常
- ✅ Service Worker注册成功
- ✅ 浏览器控制台无错误
- ✅ 离线模式工作正常（开启飞行模式测试）
- ✅ PWA manifest正常
- ✅ SPA路由刷新正常（不会404）
- ✅ 多站点不互相干扰
- ✅ 移动端加载正常（不会无限加载）

## 🔍 故障排查

### 问题1: 资源404错误
**症状**: 控制台显示 `/assets/xxx.js` 404错误

**原因**: 
- Vite base配置错误
- 构建后路径不是相对路径
- nginx配置错误

**解决步骤**:
```bash
# 1. 检查dist/index.html中的资源路径
cat dist/index.html | grep "assets"
# ✅ 应该显示: ./assets/xxx.js (相对路径)
# ❌ 不应该是: /assets/xxx.js (绝对路径)

# 2. 确认vite.config.ts中的base配置
grep -A 5 "base:" vite.config.ts
# ✅ 应该看到: const base = command === 'serve' ? '/' : './'

# 3. 重新构建
npm run build
```

### 问题2: Service Worker注册失败
**症状**: 
- Service Worker没有注册
- Scope错误
- 离线模式不工作

**原因**: 
- sw.js路径错误
- scope配置错误
- nginx未正确配置Service-Worker-Allowed header

**解决步骤**:
```javascript
// 1. 在浏览器控制台检查SW状态
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registered SW:', regs.map(r => ({
    scope: r.scope,
    active: r.active?.scriptURL
  })))
})
// ✅ 正确: scope: "https://yangruoji.com/weather_duck/"
// ❌ 错误: scope: "https://yangruoji.com/"

// 2. 检查sw.js是否可访问
fetch('/weather_duck/sw.js').then(r => console.log('SW status:', r.status))
// ✅ 应该返回: 200

// 3. 清除旧的Service Worker
// 访问: https://yangruoji.com/weather_duck/?reset-sw
// 或在开发者工具中手动注销
```

```bash
# 4. 检查nginx配置
grep -A 3 "sw\.js" nginx.conf
# ✅ 应该有: Service-Worker-Allowed "/weather_duck/"
```

### 问题3: 开发环境和生产环境路径不一致
**症状**: 本地开发正常，部署后404

**原因**: 开发和生产base路径配置不同

**解决**: 已在vite.config.ts中自动处理
```typescript
const base = command === 'serve' ? '/' : './'
// 开发环境(serve): '/' (根路径) - localhost:3000/
// 生产环境(build): './' (相对路径) - 可部署到任意子路径
```

### 问题4: 多站点互相干扰
**症状**: 
- 访问/weather_duck/时加载了spellingbee的资源
- Service Worker缓存混乱

**原因**: 
- nginx location配置重叠
- Service Worker scope配置错误

**解决**:
```nginx
# 确保每个location都有独立的scope
location /weather_duck/ {
    # 必须以 / 结尾
}

location /spellingbee/ {
    # 必须以 / 结尾
}

# 每个sw.js都要设置正确的scope
add_header Service-Worker-Allowed "/weather_duck/";
```

## 📊 配置对比表

| 环境 | Base路径 | SW路径 | SW Scope | 访问URL | HTML中的资源路径 |
|------|----------|--------|----------|---------|-----------------|
| 本地开发 | `/` | `/sw.js` | `/` | `http://localhost:3000` | `/assets/...` |
| 生产(根路径) | `./` | `/sw.js` | `/` | `https://domain.com/` | `./assets/...` |
| 生产(子路径) | `./` | `/weather_duck/sw.js` | `/weather_duck/` | `https://domain.com/weather_duck/` | `./assets/...` |

## 🎯 关键配置总结

### 必须配置的5个地方

1. **vite.config.ts**: 
   ```typescript
   base: command === 'serve' ? '/' : './'
   ```

2. **index.html**: 
   ```javascript
   // Service Worker注册逻辑（已实现）
   const basePath = getBasePath()
   const swPath = basePath === '/' ? '/sw.js' : basePath + 'sw.js'
   navigator.serviceWorker.register(swPath, { scope: basePath })
   ```

3. **public/sw.js**: 
   ```javascript
   // 动态路径检测（已实现）
   const BASE_PATH = getBasePath()
   const STATIC_CACHE_URLS = [
     `${BASE_PATH}`,
     `${BASE_PATH}index.html`,
     // ...
   ]
   ```

4. **nginx.conf**: 
   ```nginx
   location /weather_duck/ {
       alias /usr/share/nginx/html/weather_duck/;
       location ~ /weather_duck/sw\.js$ {
           add_header Service-Worker-Allowed "/weather_duck/";
       }
       try_files $uri $uri/ /weather_duck/index.html;
   }
   ```

5. **package.json**:
   ```json
   "deploy": "npm run build && rsync -avz --delete dist/ root@yangruoji.com:/usr/share/nginx/html/weather_duck/"
   ```

## 📝 维护注意事项

### ⚠️ 不要做的事情
1. ❌ 不要在Vue组件中硬编码绝对路径（如 `/assets/image.png`）
2. ❌ 不要修改vite.config.ts的base配置为固定值
3. ❌ 不要在sw.js中使用硬编码路径
4. ❌ 不要忘记在nginx中配置Service-Worker-Allowed header
5. ❌ 不要在生产环境直接使用 `npm run dev` 构建

### ✅ 应该做的事情
1. ✅ 添加新静态资源时，使用相对路径引用
2. ✅ 修改nginx配置后，先测试 `nginx -t`
3. ✅ 更新Service Worker后，更新 CACHE_VERSION
4. ✅ 部署前先运行 `npm run build` 检查构建结果
5. ✅ 测试时清除浏览器缓存和Service Worker

### 🔄 更新Service Worker的步骤
```javascript
// 1. 修改 public/sw.js
const CACHE_VERSION = '1.2.6';  // 递增版本号

// 2. 构建并部署
npm run deploy

// 3. 用户访问时会自动检测更新
// 4. 可选：提示用户刷新
if (confirm('发现新版本，是否立即更新？')) {
  window.location.reload()
}
```

## 🔗 相关文件清单

- `vite.config.ts` - Vite构建配置
- `index.html` - HTML入口和SW注册逻辑
- `public/sw.js` - Service Worker实现
- `public/manifest.json` - PWA manifest
- `nginx.conf` - 生产环境nginx配置
- `deploy.sh` - 自动化部署脚本
- `package.json` - 构建和部署命令

## 🐛 调试技巧

### 浏览器开发者工具
```javascript
// 1. 检查Service Worker状态
// Chrome: DevTools > Application > Service Workers
// 查看: Status, Scope, Source

// 2. 查看缓存
// Chrome: DevTools > Application > Cache Storage
// 应该看到: weather-duck-v1.2.5

// 3. 清除所有数据
// Chrome: DevTools > Application > Clear storage > Clear site data

// 4. 控制台调试
navigator.serviceWorker.getRegistrations()
caches.keys()
```

### 服务器端调试
```bash
# 1. 检查文件是否存在
ssh root@yangruoji.com "ls -la /usr/share/nginx/html/weather_duck/"

# 2. 检查nginx配置
ssh root@yangruoji.com "nginx -t"

# 3. 查看nginx日志
ssh root@yangruoji.com "tail -f /var/log/nginx/access.log"
ssh root@yangruoji.com "tail -f /var/log/nginx/error.log"

# 4. 测试文件访问
curl -I https://yangruoji.com/weather_duck/
curl -I https://yangruoji.com/weather_duck/sw.js
```

---

**项目**: Weather Duck (天气小鸭日记)  
**最后更新**: 2025-12-04  
**配置状态**: ✅ 已测试并验证  
**部署环境**: 
- 开发: `http://localhost:3000`
- 生产: `https://yangruoji.com/weather_duck/`
