<template>
  <div class="pwa-install" v-if="showInstallPrompt">
    <div class="install-banner">
      <div class="install-content">
        <div class="install-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
          </svg>
        </div>
        <div class="install-text">
          <h3>安装天气日记</h3>
          <p>添加到主屏幕，获得更好的使用体验</p>
        </div>
        <div class="install-actions">
          <button @click="installApp" class="install-btn">安装</button>
          <button @click="dismissPrompt" class="dismiss-btn">稍后</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { installPWA } from '../utils/pwa'

export default {
  name: 'PWAInstall',
  data() {
    return {
      showInstallPrompt: false,
      deferredPrompt: null
    }
  },
  mounted() {
    this.checkInstallPrompt()
  },
  methods: {
    checkInstallPrompt() {
      // 检查是否已经在PWA模式下运行
      if (window.matchMedia('(display-mode: standalone)').matches) {
        this.showInstallPrompt = false
        return
      }
      
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        this.deferredPrompt = e
        this.showInstallPrompt = true
      })
      
      window.addEventListener('appinstalled', () => {
        this.showInstallPrompt = false
        this.deferredPrompt = null
        this.$emit('app-installed')
      })
    },
    
    async installApp() {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt()
        const choiceResult = await this.deferredPrompt.userChoice
        
        if (choiceResult.outcome === 'accepted') {
          console.log('用户接受了安装')
        } else {
          console.log('用户拒绝了安装')
        }
        
        this.deferredPrompt = null
        this.showInstallPrompt = false
      }
    },
    
    dismissPrompt() {
      this.showInstallPrompt = false
      // 24小时后再次显示
      setTimeout(() => {
        this.showInstallPrompt = true
      }, 24 * 60 * 60 * 1000)
    }
  }
}
</script>

<style scoped>
.pwa-install {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.install-banner {
  background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);
  color: white;
  padding: 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
}

.install-content {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 600px;
  margin: 0 auto;
}

.install-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.install-text {
  flex: 1;
}

.install-text h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.install-text p {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.install-actions {
  display: flex;
  gap: 8px;
}

.install-btn, .dismiss-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.install-btn {
  background: white;
  color: #4A90E2;
}

.install-btn:hover {
  background: #f8f9fa;
  transform: translateY(-1px);
}

.dismiss-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

@media (max-width: 768px) {
  .install-content {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  
  .install-actions {
    justify-content: center;
  }
}
</style>