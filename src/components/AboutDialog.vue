<template>
  <t-dialog
    :visible="visible"
    header="关于天气小鸭"
    width="500px"
    :footer="false"
    @close="handleClose"
    @update:visible="handleVisibleChange"
  >
    <div class="about-content">
      <!-- 天气小鸭图片 -->
      <div class="duck-image-section">
        <img src="/weather_duck.jpg" alt="天气小鸭" class="duck-image" />
        <h2 class="app-title">天气小鸭 · 暑假天气日历</h2>
      </div>

      <!-- PWA 安装区域 -->
      <div class="pwa-install-section">
        <div class="install-header">
          <svg class="install-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          <h3 class="section-title">添加到桌面</h3>
        </div>
        
        <!-- 已安装状态 -->
        <div v-if="browserInfo.isStandalone" class="install-status installed">
          <svg class="status-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span>应用已安装到您的设备</span>
        </div>
        
        <!-- 可自动安装 -->
        <div v-else-if="canInstall" class="install-auto">
          <p class="install-desc">将天气小鸭添加到桌面，随时随地记录天气与心情</p>
          <t-button 
            theme="primary" 
            size="large" 
            block 
            :loading="installing"
            @click="handleInstall"
          >
            <template #icon>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </template>
            安装应用
          </t-button>
        </div>
        
        <!-- 手动安装指南 -->
        <div v-else class="install-guide">
          <div class="browser-info">
            <span class="browser-badge">{{ browserInfo.name }}</span>
            <span v-if="browserInfo.isIOS" class="os-badge">iOS</span>
            <span v-else-if="browserInfo.isAndroid" class="os-badge">Android</span>
            <span v-else class="os-badge">桌面版</span>
          </div>
          
          <div class="guide-title">{{ installGuide.title }}</div>
          <ol class="guide-steps">
            <li v-for="(step, index) in installGuide.steps" :key="index">{{ step }}</li>
          </ol>
        </div>
      </div>

      <!-- 二维码区域 -->
      <div class="qr-section">
        <h3 class="section-title">手机扫码访问</h3>
        <div class="qr-container">
          <canvas ref="qrCanvas" class="qr-code"></canvas>
        </div>
      </div>

      <!-- 开发信息 -->
      <div class="dev-info">
        <div class="info-item">
          <strong>开发者：</strong>杨若即
        </div>
        <div class="info-item">
          <strong>邮箱：</strong>yangruoji@outlook.com
        </div>
        <div class="info-item">
          <strong>班级：</strong>深高北三（10）班
        </div>
        <div class="info-item">
          <strong>项目：</strong>暑期作业
        </div>
        <div class="info-item powered-by">
          <strong>Powered by</strong> CodeBuddy
        </div>
      </div>

      <!-- GitHub项目链接 -->
      <div class="github-section">
        <a 
          href="https://github.com/yangruoji/weather_duck.git" 
          target="_blank" 
          rel="noopener noreferrer"
          class="github-link"
        >
          <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <div class="github-text">
            <div class="github-title">GitHub 项目：天气小鸭源码</div>
            <div class="github-url">https://github.com/yangruoji/weather_duck</div>
          </div>
        </a>
      </div>

      <!-- 关闭按钮 -->
      <div class="dialog-actions">
        <t-button theme="primary" @click="handleClose">关闭</t-button>
      </div>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import QRCode from 'qrcode'
import { 
  detectBrowser, 
  getInstallGuide, 
  installPWA, 
  canInstallPWA,
  type BrowserInfo 
} from '../utils/pwa'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const qrCanvas = ref<HTMLCanvasElement>()
const browserInfo = ref<BrowserInfo>(detectBrowser())
const canInstall = ref(canInstallPWA())
const installing = ref(false)

// 计算安装指南
const installGuide = computed(() => getInstallGuide(browserInfo.value))

// 监听 PWA 安装可用事件
function handleInstallAvailable() {
  canInstall.value = true
  browserInfo.value = detectBrowser()
}

// 监听 PWA 已安装事件
function handleInstalled() {
  canInstall.value = false
  browserInfo.value = detectBrowser()
}

onMounted(() => {
  window.addEventListener('pwa-install-available', handleInstallAvailable)
  window.addEventListener('pwa-installed', handleInstalled)
})

onUnmounted(() => {
  window.removeEventListener('pwa-install-available', handleInstallAvailable)
  window.removeEventListener('pwa-installed', handleInstalled)
})

// 监听对话框打开，生成二维码
watch(() => props.visible, async (newVisible) => {
  if (newVisible) {
    await nextTick()
    await generateQRCode()
    // 刷新浏览器信息
    browserInfo.value = detectBrowser()
    canInstall.value = canInstallPWA()
  }
})

// 生成当前页面URL的二维码
async function generateQRCode() {
  if (!qrCanvas.value) return
  
  try {
    const currentUrl = window.location.href
    await QRCode.toCanvas(qrCanvas.value, currentUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
  } catch (error) {
    console.error('生成二维码失败:', error)
  }
}

// 处理安装
async function handleInstall() {
  installing.value = true
  try {
    const result = await installPWA()
    if (result === 'accepted') {
      // 安装成功
      browserInfo.value = detectBrowser()
    }
  } finally {
    installing.value = false
  }
}

function handleClose() {
  emit('update:visible', false)
}

function handleVisibleChange(value: boolean) {
  emit('update:visible', value)
}
</script>

<style scoped>
.about-content {
  padding: 0;
  text-align: center;
}

.duck-image-section {
  margin-bottom: 24px;
}

.duck-image {
  width: 100%;
  height: 300px;
  object-fit: contain;
  margin-bottom: 16px;
  border-radius: 12px;
  background: #f8f9fa;
}

.app-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

/* PWA 安装区域样式 */
.pwa-install-section {
  margin-bottom: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #e8f4fd 0%, #f0e6f6 100%);
  border-radius: 12px;
  text-align: left;
}

.install-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.install-icon {
  width: 24px;
  height: 24px;
  color: #4A90E2;
}

.install-header .section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.install-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #e8f5e9;
  border-radius: 8px;
  color: #2e7d32;
  font-weight: 500;
}

.install-status.installed .status-icon {
  width: 20px;
  height: 20px;
  color: #2e7d32;
}

.install-auto {
  text-align: center;
}

.install-desc {
  margin: 0 0 16px 0;
  color: #666;
  font-size: 14px;
}

.install-guide {
  text-align: left;
}

.browser-info {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.browser-badge,
.os-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.browser-badge {
  background: #4A90E2;
  color: white;
}

.os-badge {
  background: #7c4dff;
  color: white;
}

.guide-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.guide-steps {
  margin: 0;
  padding-left: 20px;
  color: #555;
  font-size: 14px;
  line-height: 1.8;
}

.guide-steps li {
  margin-bottom: 4px;
}

/* 二维码区域 */
.qr-section {
  margin-bottom: 24px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
}

.section-title {
  font-size: 18px;
  font-weight: 500;
  color: #333;
  margin: 0 0 16px 0;
}

.qr-container {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.qr-code {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 开发信息 */
.dev-info {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.info-item {
  font-size: 16px;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.powered-by {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  font-size: 14px;
  color: #666;
}

/* GitHub 链接 */
.github-section {
  margin-bottom: 24px;
}

.github-link {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #24292e 0%, #1a1e22 100%);
  color: white;
  text-decoration: none;
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(36, 41, 46, 0.2);
}

.github-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(36, 41, 46, 0.3);
  color: white;
  text-decoration: none;
}

.github-icon {
  width: 32px;
  height: 32px;
  margin-right: 16px;
  flex-shrink: 0;
}

.github-text {
  flex: 1;
  text-align: left;
}

.github-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.github-url {
  font-size: 14px;
  opacity: 0.8;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.dialog-actions {
  display: flex;
  justify-content: center;
}

@media (max-width: 480px) {
  .duck-image {
    height: 200px;
  }
  
  .app-title {
    font-size: 20px;
  }
  
  .section-title {
    font-size: 16px;
  }
  
  .info-item {
    font-size: 14px;
  }
  
  .github-link {
    padding: 12px 16px;
  }
  
  .github-icon {
    width: 28px;
    height: 28px;
    margin-right: 12px;
  }
  
  .github-title {
    font-size: 14px;
  }
  
  .github-url {
    font-size: 12px;
  }
  
  .pwa-install-section {
    padding: 16px;
  }
  
  .guide-steps {
    font-size: 13px;
  }
}
</style>
