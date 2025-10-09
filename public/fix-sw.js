// 修复Service Worker缓存问题的脚本
// 这个脚本会清理有问题的缓存并重新注册Service Worker

(function () {
  'use strict';

  console.log('🔧 开始修复Service Worker...');

  // 清理所有缓存
  async function clearAllCaches() {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        console.log('🗑️ 发现缓存:', cacheNames);

        await Promise.all(
          cacheNames.map(cacheName => {
            console.log('🗑️ 删除缓存:', cacheName);
            return caches.delete(cacheName);
          })
        );

        console.log('✅ 所有缓存已清理');
      } catch (error) {
        console.error('❌ 清理缓存失败:', error);
      }
    }
  }

  // 注销所有Service Worker
  async function unregisterAllServiceWorkers() {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('🔧 发现Service Worker注册:', registrations.length);

        await Promise.all(
          registrations.map(registration => {
            console.log('🔧 注销Service Worker:', registration.scope);
            return registration.unregister();
          })
        );

        console.log('✅ 所有Service Worker已注销');
      } catch (error) {
        console.error('❌ 注销Service Worker失败:', error);
      }
    }
  }

  // 重新注册Service Worker
  async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        console.log('🔄 重新注册Service Worker...');

        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none' // 强制更新
        });

        console.log('✅ Service Worker注册成功:', registration.scope);

        // 等待Service Worker激活
        if (registration.installing) {
          console.log('⏳ 等待Service Worker安装...');

          return new Promise((resolve, reject) => {
            const worker = registration.installing;

            worker.addEventListener('statechange', () => {
              console.log('🔄 Service Worker状态:', worker.state);

              if (worker.state === 'activated') {
                console.log('✅ Service Worker已激活');
                resolve(registration);
              } else if (worker.state === 'redundant') {
                reject(new Error('Service Worker变为冗余状态'));
              }
            });

            // 超时处理
            setTimeout(() => {
              reject(new Error('Service Worker安装超时'));
            }, 30000);
          });
        }

        return registration;
      } catch (error) {
        console.error('❌ 重新注册Service Worker失败:', error);
        throw error;
      }
    } else {
      throw new Error('浏览器不支持Service Worker');
    }
  }

  // 主修复流程
  async function fixServiceWorker() {
    try {
      console.log('🚀 开始修复流程...');

      // 步骤1: 清理缓存
      await clearAllCaches();

      // 步骤2: 注销现有Service Worker
      await unregisterAllServiceWorkers();

      // 步骤3: 等待一下确保清理完成
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 步骤4: 重新注册Service Worker
      await registerServiceWorker();

      console.log('🎉 Service Worker修复完成！');

      // 显示成功消息
      showMessage('✅ Service Worker修复成功！页面将在3秒后刷新...', 'success');

      // 3秒后刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (error) {
      console.error('❌ 修复失败:', error);
      showMessage(`❌ 修复失败: ${error.message}`, 'error');
    }
  }

  // 显示消息
  function showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
        `;

    // 根据类型设置颜色
    switch (type) {
      case 'success':
        messageEl.style.background = 'rgba(40, 167, 69, 0.9)';
        break;
      case 'error':
        messageEl.style.background = 'rgba(220, 53, 69, 0.9)';
        break;
      default:
        messageEl.style.background = 'rgba(23, 162, 184, 0.9)';
    }

    messageEl.textContent = message;
    document.body.appendChild(messageEl);

    // 5秒后自动移除
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 5000);
  }

  // 检查是否需要自动修复
  function checkAndAutoFix() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('fix-sw') === 'true') {
      console.log('🔧 检测到自动修复参数，开始修复...');
      fixServiceWorker();
    }
  }

  // 暴露修复函数到全局
  window.fixServiceWorker = fixServiceWorker;
  window.clearAllCaches = clearAllCaches;
  window.unregisterAllServiceWorkers = unregisterAllServiceWorkers;

  // 页面加载完成后检查是否需要自动修复
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndAutoFix);
  } else {
    checkAndAutoFix();
  }

  console.log('🔧 Service Worker修复工具已加载');
  console.log('💡 使用方法:');
  console.log('  - 手动修复: fixServiceWorker()');
  console.log('  - 清理缓存: clearAllCaches()');
  console.log('  - 注销SW: unregisterAllServiceWorkers()');
  console.log('  - 自动修复: 在URL后添加 ?fix-sw=true');
})();