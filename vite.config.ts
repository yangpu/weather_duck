import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command, mode }) => {
  // 开发环境使用根路径，生产环境使用相对路径
  const base = command === 'serve' ? '/' : './'
  
  return {
    plugins: [vue()],
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
