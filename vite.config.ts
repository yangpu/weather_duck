import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 读取 package.json 获取版本号
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = packageJson.version

export default defineConfig(({ command, mode }) => {
  // 开发环境使用根路径，生产环境使用相对路径
  const base = command === 'serve' ? '/' : './'
  
  return {
    // 注入版本号常量
    define: {
      __APP_VERSION__: JSON.stringify(appVersion)
    },
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
          // 预缓存的资源 - 包含所有静态资源
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,gif,woff,woff2,ico}'],
          // 运行时缓存策略 - 缓存优先，增强离线能力
          runtimeCaching: [
            // ========== Supabase REST API (日记数据) - 缓存优先 ==========
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'supabase-rest-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7天
                },
                cacheableResponse: {
                  statuses: [0, 200]
                },
                // 后台同步更新
                backgroundSync: {
                  name: 'supabase-sync-queue',
                  options: {
                    maxRetentionTime: 60 * 60 * 24 // 24小时
                  }
                }
              }
            },
            // ========== Supabase Storage 视频 - 网络优先，不缓存 ==========
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/diary-videos\/.*/i,
              handler: 'NetworkOnly',
              options: {
                // 视频不缓存，避免 Range 请求导致的缓存问题
              }
            },
            // ========== Supabase Storage (图片) - 缓存优先 ==========
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'supabase-storage-cache',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30天
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // ========== Supabase Auth API - 网络优先 ==========
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-auth-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 // 1小时
                },
                cacheableResponse: {
                  statuses: [0, 200]
                },
                networkTimeoutSeconds: 5
              }
            },
            // ========== Open-Meteo 天气 API - 缓存优先 ==========
            {
              urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'weather-api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 2 // 2小时（天气数据更新频率）
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // ========== 其他天气 API - 缓存优先 ==========
            {
              urlPattern: /^https:\/\/.*weather.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'weather-external-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 2 // 2小时
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // ========== 地理编码 API - 长期缓存 ==========
            {
              urlPattern: /^https:\/\/geocoding-api\.open-meteo\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'geocoding-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30天（地理位置不常变化）
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // ========== 用户上传的图片 - 长期缓存 ==========
            {
              urlPattern: /\.(?:png|jpg|jpeg|gif|webp|heic|heif)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 60 * 60 * 24 * 60 // 60天
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // ========== 用户上传的视频 - 不缓存，每次在线加载 ==========
            {
              urlPattern: /\.(?:mp4|webm|mov|avi|mkv)$/i,
              handler: 'NetworkOnly',
              options: {
                // 视频不缓存，节省存储空间
                // 每次在线加载
              }
            },
            // ========== 字体文件 - 永久缓存 ==========
            {
              urlPattern: /\.(?:woff|woff2|ttf|eot|otf)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'fonts-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1年
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // ========== CDN 资源 - 长期缓存 ==========
            {
              urlPattern: /^https:\/\/cdn\..*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cdn-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30天
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            // ========== Google Fonts - 长期缓存 ==========
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1年
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1年
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ],
          // 离线页面回退
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          // 立即激活新 SW
          skipWaiting: true,
          clientsClaim: true,
          // 清理旧缓存
          cleanupOutdatedCaches: true
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
