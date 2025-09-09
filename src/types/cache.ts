export interface CacheItem<T = any> {
  data: T
  timestamp: number
}

export interface CacheStats {
  size: number
  keys: string[]
  memoryUsage?: number
}

export interface CacheServiceInterface {
  generateKey(type: string, params: Record<string, any>): string
  set<T>(key: string, data: T, ttl?: number): void
  get<T>(key: string): T | null
  delete(key: string): void
  clear(): void
  has(key: string): boolean
  keys(): string[]
  invalidateByType(type: string): void
}