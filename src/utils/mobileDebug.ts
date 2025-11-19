// 移动端调试工具
export class MobileDebugger {
  private logs: string[] = []
  private maxLogs = 100
  
  constructor() {
    this.init()
  }

  private init() {
    // 拦截console.log, console.error等
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    console.log = (...args) => {
      this.addLog('LOG', args.join(' '))
      originalLog.apply(console, args)
    }

    console.error = (...args) => {
      this.addLog('ERROR', args.join(' '))
      originalError.apply(console, args)
    }

    console.warn = (...args) => {
      this.addLog('WARN', args.join(' '))
      originalWarn.apply(console, args)
    }

    // 监听未捕获的错误
    window.addEventListener('error', (event) => {
      this.addLog('UNCAUGHT_ERROR', `${event.message} at ${event.filename}:${event.lineno}`)
    })

    // 监听Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      this.addLog('UNHANDLED_REJECTION', event.reason?.toString() || 'Unknown rejection')
    })

    // 监听网络状态变化
    window.addEventListener('online', () => {
      this.addLog('NETWORK', 'Online')
    })

    window.addEventListener('offline', () => {
      this.addLog('NETWORK', 'Offline')
    })
  }

  private addLog(type: string, message: string) {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${type}: ${message}`
    
    this.logs.push(logEntry)
    
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // 在移动端显示关键错误
    if (type === 'ERROR' || type === 'UNCAUGHT_ERROR') {
      this.showMobileAlert(logEntry)
    }
  }

  private showMobileAlert(message: string) {
    // 在移动端创建一个浮动的错误提示
    if (this.isMobile()) {
      const alertDiv = document.createElement('div')
      alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        right: 20px;
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-size: 12px;
        z-index: 10000;
        word-break: break-all;
        max-height: 100px;
        overflow-y: auto;
      `
      alertDiv.textContent = message
      
      document.body.appendChild(alertDiv)
      
      // 5秒后自动移除
      setTimeout(() => {
        if (alertDiv.parentNode) {
          alertDiv.parentNode.removeChild(alertDiv)
        }
      }, 5000)
    }
  }

  public getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight
      },
      connection: this.getConnectionInfo(),
      storage: this.getStorageInfo(),
      features: this.getFeatureSupport()
    }
  }

  private getConnectionInfo() {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      }
    }
    return null
  }

  private getStorageInfo() {
    return {
      localStorage: typeof localStorage !== 'undefined',
      sessionStorage: typeof sessionStorage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      webSQL: typeof (window as any).openDatabase !== 'undefined'
    }
  }

  private getFeatureSupport() {
    return {
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      notification: 'Notification' in window,
      geolocation: 'geolocation' in navigator,
      deviceMotion: 'DeviceMotionEvent' in window,
      deviceOrientation: 'DeviceOrientationEvent' in window,
      touchEvents: 'ontouchstart' in window,
      webGL: this.hasWebGL(),
      webRTC: this.hasWebRTC()
    }
  }

  private hasWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas')
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    } catch (e) {
      return false
    }
  }

  private hasWebRTC(): boolean {
    return !!(window as any).RTCPeerConnection || !!(window as any).mozRTCPeerConnection || !!(window as any).webkitRTCPeerConnection
  }

  public isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }

  public isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
  }

  public isSafari(): boolean {
    return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
  }

  public getLogs(): string[] {
    return [...this.logs]
  }

  public exportLogs(): string {
    const deviceInfo = this.getDeviceInfo()
    const logs = this.getLogs()
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      deviceInfo,
      logs
    }, null, 2)
  }

  public createDebugPanel(): HTMLElement {
    const panel = document.createElement('div')
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      max-height: 400px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      font-family: monospace;
      font-size: 10px;
      padding: 10px;
      border-radius: 5px;
      z-index: 9999;
      overflow-y: auto;
      display: none;
    `

    const toggleButton = document.createElement('button')
    toggleButton.textContent = '🐛'
    toggleButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #007bff;
      color: white;
      border: none;
      font-size: 16px;
      z-index: 10000;
      cursor: pointer;
    `

    toggleButton.onclick = () => {
      const isVisible = panel.style.display !== 'none'
      panel.style.display = isVisible ? 'none' : 'block'
      
      if (!isVisible) {
        this.updateDebugPanel(panel)
      }
    }

    document.body.appendChild(toggleButton)
    document.body.appendChild(panel)

    return panel
  }

  private updateDebugPanel(panel: HTMLElement) {
    const deviceInfo = this.getDeviceInfo()
    const logs = this.getLogs().slice(-20) // 只显示最近20条日志

    panel.innerHTML = `
      <div style="margin-bottom: 10px;">
        <strong>设备信息:</strong><br>
        ${deviceInfo.userAgent}<br>
        屏幕: ${deviceInfo.screen.width}x${deviceInfo.screen.height}<br>
        窗口: ${deviceInfo.window.innerWidth}x${deviceInfo.window.innerHeight}<br>
        网络: ${deviceInfo.onLine ? '在线' : '离线'}<br>
        连接: ${deviceInfo.connection?.effectiveType || '未知'}<br>
      </div>
      <div style="margin-bottom: 10px;">
        <strong>功能支持:</strong><br>
        SW: ${deviceInfo.features.serviceWorker ? '✓' : '✗'}<br>
        IDB: ${deviceInfo.storage.indexedDB ? '✓' : '✗'}<br>
        Touch: ${deviceInfo.features.touchEvents ? '✓' : '✗'}<br>
      </div>
      <div>
        <strong>最近日志:</strong><br>
        ${logs.map(log => `<div style="margin: 2px 0; word-break: break-all;">${log}</div>`).join('')}
      </div>
    `
  }
}

// 创建全局调试器实例
export const mobileDebugger = new MobileDebugger()

// 在移动端自动显示调试面板
if (mobileDebugger.isMobile()) {
  window.addEventListener('load', () => {
    mobileDebugger.createDebugPanel()
  })
}