/**
 * PWA 工具函数 - 使用 Workbox
 */

// PWA 安装事件
let deferredPrompt: BeforeInstallPromptEvent | null = null

// 定义 BeforeInstallPromptEvent 类型
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

// 浏览器类型检测
export interface BrowserInfo {
  name: string
  isChrome: boolean
  isSafari: boolean
  isFirefox: boolean
  isEdge: boolean
  isSamsung: boolean
  isOpera: boolean
  isIOS: boolean
  isAndroid: boolean
  isDesktop: boolean
  isPWASupported: boolean
  isStandalone: boolean
  canInstall: boolean
}

/**
 * 检测浏览器类型和 PWA 支持情况
 */
export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isAndroid = /Android/.test(ua)
  const isDesktop = !isIOS && !isAndroid
  
  // 检测具体浏览器
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg|OPR|Opera|Samsung/.test(ua)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua)
  const isFirefox = /Firefox|FxiOS/.test(ua)
  const isEdge = /Edge|Edg/.test(ua)
  const isSamsung = /SamsungBrowser/.test(ua)
  const isOpera = /OPR|Opera/.test(ua)
  
  // 检测是否已在 PWA 模式运行
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  
  // 检测 PWA 支持
  const isPWASupported = 'serviceWorker' in navigator && 
    (isChrome || isEdge || isSamsung || isOpera || (isSafari && isIOS))
  
  // 检测是否可以安装（有延迟的安装提示）
  const canInstall = deferredPrompt !== null
  
  let name = 'Unknown'
  if (isChrome) name = 'Chrome'
  else if (isSafari) name = 'Safari'
  else if (isFirefox) name = 'Firefox'
  else if (isEdge) name = 'Edge'
  else if (isSamsung) name = 'Samsung Internet'
  else if (isOpera) name = 'Opera'
  
  return {
    name,
    isChrome,
    isSafari,
    isFirefox,
    isEdge,
    isSamsung,
    isOpera,
    isIOS,
    isAndroid,
    isDesktop,
    isPWASupported,
    isStandalone,
    canInstall
  }
}

/**
 * 获取安装指南
 */
export function getInstallGuide(browser: BrowserInfo): {
  title: string
  steps: string[]
  canAutoInstall: boolean
} {
  if (browser.isStandalone) {
    return {
      title: '已安装',
      steps: ['应用已经安装到您的设备上了！'],
      canAutoInstall: false
    }
  }
  
  // iOS Safari
  if (browser.isIOS && browser.isSafari) {
    return {
      title: 'iOS Safari 安装指南',
      steps: [
        '1. 点击底部的 "分享" 按钮 (方框+箭头图标)',
        '2. 向下滚动并点击 "添加到主屏幕"',
        '3. 点击右上角的 "添加"',
        '4. 应用图标将出现在主屏幕上'
      ],
      canAutoInstall: false
    }
  }
  
  // iOS Chrome
  if (browser.isIOS && browser.isChrome) {
    return {
      title: 'iOS Chrome 安装指南',
      steps: [
        '1. 点击右上角的 "..." 菜单',
        '2. 选择 "添加到主屏幕"',
        '3. 点击 "添加"',
        '注意：建议使用 Safari 浏览器获得更好的 PWA 体验'
      ],
      canAutoInstall: false
    }
  }
  
  // Android Chrome
  if (browser.isAndroid && browser.isChrome) {
    return {
      title: 'Android Chrome 安装指南',
      steps: browser.canInstall 
        ? ['点击下方的 "安装应用" 按钮即可自动安装']
        : [
            '1. 点击右上角的 "⋮" 菜单',
            '2. 选择 "安装应用" 或 "添加到主屏幕"',
            '3. 点击 "安装"',
            '4. 应用图标将出现在主屏幕上'
          ],
      canAutoInstall: browser.canInstall
    }
  }
  
  // Android Samsung
  if (browser.isAndroid && browser.isSamsung) {
    return {
      title: 'Samsung 浏览器安装指南',
      steps: browser.canInstall
        ? ['点击下方的 "安装应用" 按钮即可自动安装']
        : [
            '1. 点击底部的 "≡" 菜单',
            '2. 选择 "添加页面到"',
            '3. 选择 "主屏幕"',
            '4. 点击 "添加"'
          ],
      canAutoInstall: browser.canInstall
    }
  }
  
  // Desktop Chrome/Edge
  if (browser.isDesktop && (browser.isChrome || browser.isEdge)) {
    return {
      title: `${browser.name} 桌面版安装指南`,
      steps: browser.canInstall
        ? ['点击下方的 "安装应用" 按钮即可自动安装']
        : [
            '1. 点击地址栏右侧的安装图标 (⊕)',
            '2. 或点击右上角 "⋮" 菜单',
            '3. 选择 "安装 天气小鸭日记..."',
            '4. 点击 "安装"'
          ],
      canAutoInstall: browser.canInstall
    }
  }
  
  // Firefox (不完全支持 PWA)
  if (browser.isFirefox) {
    return {
      title: 'Firefox 安装说明',
      steps: [
        'Firefox 目前不完全支持 PWA 安装',
        '建议使用 Chrome、Edge 或 Safari 浏览器',
        '以获得完整的离线和安装体验'
      ],
      canAutoInstall: false
    }
  }
  
  // 默认指南
  return {
    title: '安装指南',
    steps: [
      '1. 在浏览器菜单中查找 "添加到主屏幕" 或 "安装应用"',
      '2. 按照提示完成安装',
      '3. 应用图标将出现在您的设备上'
    ],
    canAutoInstall: browser.canInstall
  }
}

/**
 * 初始化 PWA 安装监听
 */
export function initPWAInstall(): void {
  // 监听 beforeinstallprompt 事件
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    console.log('[PWA] Install prompt captured')
    
    // 触发自定义事件通知组件
    window.dispatchEvent(new CustomEvent('pwa-install-available'))
  })
  
  // 监听安装完成事件
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    console.log('[PWA] App installed successfully')
    
    // 触发自定义事件通知组件
    window.dispatchEvent(new CustomEvent('pwa-installed'))
  })
}

/**
 * 触发 PWA 安装
 */
export async function installPWA(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available')
    return 'unavailable'
  }
  
  try {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log('[PWA] User choice:', outcome)
    
    deferredPrompt = null
    return outcome
  } catch (error) {
    console.error('[PWA] Install error:', error)
    return 'unavailable'
  }
}

/**
 * 检查是否可以安装
 */
export function canInstallPWA(): boolean {
  return deferredPrompt !== null
}

/**
 * 检查是否已在 PWA 模式运行
 */
export function isRunningAsPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
}

/**
 * 注册 Service Worker 更新回调
 */
export function onServiceWorkerUpdate(callback: (registration: ServiceWorkerRegistration) => void): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              callback(registration)
            }
          })
        }
      })
    })
  }
}

/**
 * 跳过等待并刷新页面
 */
export function skipWaitingAndReload(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    })
    
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }
}
