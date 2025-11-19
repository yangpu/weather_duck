// 增强的缓存服务，集成IndexedDB和Service Worker
import { cacheService } from './cacheService'
import type { WeatherData } from '../types/weather'
import type { DiaryData } from '../types/diary'

interface CacheData {
  weather: WeatherData[]
  diary: DiaryData[]
  timestamp: number
}

class EnhancedCacheService {
  private dbName = 'WeatherDuckDB'
  private version = 1
  private db: IDBDatabase | null = null
  private useLocalStorage = false

  async init(): Promise<void> {
    try {
      this.db = await this.openDB()

    } catch (error) {
      console.error('IndexedDB 初始化失败，降级到localStorage:', error)
      this.useLocalStorage = true
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // 创建天气数据存储
        if (!db.objectStoreNames.contains('weather')) {
          const weatherStore = db.createObjectStore('weather', { keyPath: 'id' })
          weatherStore.createIndex('date', 'date', { unique: false })
        }
        
        // 创建日记数据存储
        if (!db.objectStoreNames.contains('diary')) {
          const diaryStore = db.createObjectStore('diary', { keyPath: 'id' })
          diaryStore.createIndex('date', 'date', { unique: true })
        }

        // 创建缓存数据存储
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' })
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  // 缓存天气数据
  async cacheWeatherData(date: string, data: WeatherData[]): Promise<void> {
    // 同时使用内存缓存和持久化缓存
    const key = cacheService.generateKey('weather', { date })
    cacheService.set(key, data, 3600000) // 1小时内存缓存

    if (this.useLocalStorage) {
      localStorage.setItem(`weather_${date}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
      return
    }

    try {
      if (!this.db) await this.init()
      const transaction = this.db!.transaction(['weather'], 'readwrite')
      const store = transaction.objectStore('weather')
      
      for (const weatherItem of data) {
        await this.putData(store, {
          id: `weather_${date}_${weatherItem.date}`,
          date: weatherItem.date,
          data: weatherItem,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.error('缓存天气数据失败:', error)
    }
  }

  // 获取缓存的天气数据
  async getCachedWeatherData(date: string): Promise<WeatherData[] | null> {
    // 先尝试内存缓存
    const key = cacheService.generateKey('weather', { date })
    const memoryData = cacheService.get<WeatherData[]>(key)
    if (memoryData) {
      return memoryData
    }

    if (this.useLocalStorage) {
      const data = localStorage.getItem(`weather_${date}`)
      if (data) {
        const parsed = JSON.parse(data)
        // 检查是否过期（24小时）
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data
        }
      }
      return null
    }

    try {
      if (!this.db) await this.init()
      const transaction = this.db!.transaction(['weather'], 'readonly')
      const store = transaction.objectStore('weather')
      const index = store.index('date')
      const results = await this.getAllFromIndex(index, date)
      
      if (results.length > 0) {
        // 检查是否过期（24小时）
        const latestTimestamp = Math.max(...results.map(r => r.timestamp))
        if (Date.now() - latestTimestamp < 24 * 60 * 60 * 1000) {
          return results.map(r => r.data)
        }
      }
      return null
    } catch (error) {
      console.error('获取缓存天气数据失败:', error)
      return null
    }
  }

  // 缓存日记数据
  async cacheDiaryData(date: string, data: DiaryData): Promise<void> {
    const key = cacheService.generateKey('diary', { date })
    cacheService.set(key, data, 3600000) // 1小时内存缓存

    if (this.useLocalStorage) {
      localStorage.setItem(`diary_${date}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
      return
    }

    try {
      if (!this.db) await this.init()
      const transaction = this.db!.transaction(['diary'], 'readwrite')
      const store = transaction.objectStore('diary')
      
      await this.putData(store, {
        id: `diary_${date}`,
        date,
        data,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('缓存日记数据失败:', error)
    }
  }

  // 获取缓存的日记数据
  async getCachedDiaryData(date: string): Promise<DiaryData | null> {
    // 先尝试内存缓存
    const key = cacheService.generateKey('diary', { date })
    const memoryData = cacheService.get<DiaryData>(key)
    if (memoryData) {
      return memoryData
    }

    if (this.useLocalStorage) {
      const data = localStorage.getItem(`diary_${date}`)
      if (data) {
        const parsed = JSON.parse(data)
        return parsed.data
      }
      return null
    }

    try {
      if (!this.db) await this.init()
      const transaction = this.db!.transaction(['diary'], 'readonly')
      const store = transaction.objectStore('diary')
      const result = await this.getData(store, `diary_${date}`)
      
      return result ? result.data : null
    } catch (error) {
      console.error('获取缓存日记数据失败:', error)
      return null
    }
  }

  // 缓存完整的日期范围数据
  async cacheRangeData(startDate: string, endDate: string, weatherData: WeatherData[], diaryData: DiaryData[]): Promise<void> {
    const cacheKey = `range_${startDate}_${endDate}`
    const cacheData: CacheData = {
      weather: weatherData,
      diary: diaryData,
      timestamp: Date.now()
    }

    // 内存缓存
    cacheService.set(cacheKey, cacheData, 1800000) // 30分钟

    if (this.useLocalStorage) {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      return
    }

    try {
      if (!this.db) await this.init()
      const transaction = this.db!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      
      await this.putData(store, {
        key: cacheKey,
        ...cacheData
      })
    } catch (error) {
      console.error('缓存范围数据失败:', error)
    }
  }

  // 获取缓存的日期范围数据
  async getCachedRangeData(startDate: string, endDate: string): Promise<CacheData | null> {
    const cacheKey = `range_${startDate}_${endDate}`
    
    // 先尝试内存缓存
    const memoryData = cacheService.get<CacheData>(cacheKey)
    if (memoryData) {
      return memoryData
    }

    if (this.useLocalStorage) {
      const data = localStorage.getItem(cacheKey)
      if (data) {
        const parsed = JSON.parse(data)
        // 检查是否过期（30分钟）
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          return parsed
        }
      }
      return null
    }

    try {
      if (!this.db) await this.init()
      const transaction = this.db!.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const result = await this.getData(store, cacheKey)
      
      if (result) {
        // 检查是否过期（30分钟）
        if (Date.now() - result.timestamp < 30 * 60 * 1000) {
          return {
            weather: result.weather,
            diary: result.diary,
            timestamp: result.timestamp
          }
        }
      }
      return null
    } catch (error) {
      console.error('获取缓存范围数据失败:', error)
      return null
    }
  }

  // 清理过期缓存
  async cleanupExpiredCache(): Promise<void> {
    const now = Date.now()
    const expireTime = 24 * 60 * 60 * 1000 // 24小时

    if (this.useLocalStorage) {
      const keys = Object.keys(localStorage)
      for (const key of keys) {
        if (key.startsWith('weather_') || key.startsWith('diary_') || key.startsWith('range_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}')
            if (data.timestamp && now - data.timestamp > expireTime) {
              localStorage.removeItem(key)
            }
          } catch (error) {
            // 删除无效数据
            localStorage.removeItem(key)
          }
        }
      }
      return
    }

    try {
      if (!this.db) await this.init()
      
      // 清理天气缓存
      const weatherTransaction = this.db!.transaction(['weather'], 'readwrite')
      const weatherStore = weatherTransaction.objectStore('weather')
      const weatherCursor = await this.openCursor(weatherStore)
      
      if (weatherCursor) {
        do {
          const record = weatherCursor.value
          if (now - record.timestamp > expireTime) {
            await this.deleteData(weatherStore, record.id)
          }
        } while (weatherCursor.continue() !== undefined)
      }

      // 清理缓存数据
      const cacheTransaction = this.db!.transaction(['cache'], 'readwrite')
      const cacheStore = cacheTransaction.objectStore('cache')
      const cacheCursor = await this.openCursor(cacheStore)
      
      if (cacheCursor) {
        do {
          const record = cacheCursor.value
          if (now - record.timestamp > expireTime) {
            await this.deleteData(cacheStore, record.key)
          }
        } while (cacheCursor.continue() !== undefined)
      }
    } catch (error) {
      console.error('清理过期缓存失败:', error)
    }
  }

  // 辅助方法
  private putData(store: IDBObjectStore, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.put(data)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private getData(store: IDBObjectStore, key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private deleteData(store: IDBObjectStore, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  private getAllFromIndex(index: IDBIndex, key: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const request = index.getAll(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private openCursor(store: IDBObjectStore): Promise<IDBCursorWithValue | null> {
    return new Promise((resolve, reject) => {
      const request = store.openCursor()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}

export const enhancedCacheService = new EnhancedCacheService()
export default enhancedCacheService