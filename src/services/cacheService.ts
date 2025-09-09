// 简化的缓存服务
import type { CacheItem, CacheServiceInterface } from '../types/cache'

class CacheService implements CacheServiceInterface {
  private cache: Map<string, CacheItem>
  private ttlMap: Map<string, number>
  private maxSize: number
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    this.cache = new Map()
    this.ttlMap = new Map()
    this.maxSize = 1000
    
    // 定期清理过期缓存
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000) // 每分钟清理一次
  }

  generateKey(type: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key]
        return result
      }, {} as Record<string, any>)
    return `${type}:${JSON.stringify(sortedParams)}`
  }

  set<T>(key: string, data: T, ttl: number = 300000): void { // 默认5分钟TTL
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
    
    if (ttl > 0) {
      this.ttlMap.set(key, Date.now() + ttl)
    }
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    const ttl = this.ttlMap.get(key)
    if (ttl && Date.now() > ttl) {
      this.delete(key)
      return null
    }

    return item.data as T
  }

  delete(key: string): void {
    this.cache.delete(key)
    this.ttlMap.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.ttlMap.clear()
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, expiry] of this.ttlMap.entries()) {
      if (now > expiry) {
        this.delete(key)
      }
    }
  }

  has(key: string): boolean {
    return this.cache.has(key) && this.get(key) !== null
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  invalidateByType(type: string): void {
    const keysToDelete = this.keys().filter(key => key.startsWith(`${type}:`))
    keysToDelete.forEach(key => this.delete(key))
  }

  private evictOldest(): void {
    const oldestKey = this.cache.keys().next().value
    if (oldestKey) {
      this.delete(oldestKey)
    }
  }

  // 清理定时器
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.clear()
  }
}

export const cacheService = new CacheService()
export default cacheService