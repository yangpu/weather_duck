import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, mode }) => {
  // 开发环境使用根路径，生产环境使用相对路径
  const base = command === 'serve' ? '/' : './'
  
  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: 'prompt', // 提示用户更新
        includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'weather_duck.jpg'],
        manifest: {
          name: '天气小鸭日记',
          short_name: '天气小鸭',
          description: '记录天气和心情的日记应用',
          theme_color: '#4A90E2',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: './',
          scope: './',
          icons: [
            {
              src: 'icons/icon-72x72.png',
              sizes: '72x72',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/icon-96x96.png',
              sizes: '96x96',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/icon-128x128.png',
              sizes: '128x128',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/icon-144x144.png',
              sizes: '144x144',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/icon-152x152.png',
              sizes: '152x152',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/icon-384x384.png',
              sizes: '384x384',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          // 预缓存的资源
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,gif,woff,woff2}'],
          // 运行时缓存策略
          runtimeCaching: [
            {
              // 缓存 Supabase API 请求
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24小时
                },
                cacheableResponse: {
                  statuses: [0, 200]
                },
                networkTimeoutSeconds: 10
              }
            },
            {
              // 缓存天气 API
              urlPattern: /^https:\/\/api\..*weather.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'weather-api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 30 // 30分钟
                },
                cacheableResponse: {
                  statuses: [0, 200]
                },
                networkTimeoutSeconds: 10
              }
            },
            {
              // 缓存图片资源
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30天
                }
              }
            },
            {
              // 缓存字体
              urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1年
                }
              }
            }
          ],
          // 离线页面回退
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          // 跳过等待，立即激活
          skipWaiting: false,
          clientsClaim: true
        },
        devOptions: {
          enabled: true, // 开发环境也启用 PWA
          type: 'module'
        }
      })
    ],
    base,
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'tdesign-vue-next'],
            supabase: ['@supabase/supabase-js'],
            charts: ['echarts']
          }
        }
      }
    },
    server: {
      port: 3000,
      open: true,
      host: true
    }
  }
})
