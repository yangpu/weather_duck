// 请求去重服务 - 防止重复API请求
export class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();
  private requestCounts = new Map<string, number>();
  private lastRequestTime = new Map<string, number>();
  
  // 最小请求间隔（毫秒）
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1秒内不允许重复请求
  
  /**
   * 执行去重请求
   * @param key 请求的唯一标识
   * @param requestFn 实际的请求函数
   * @param options 配置选项
   */
  async executeRequest<T>(
    key: string, 
    requestFn: () => Promise<T>,
    options: {
      forceRefresh?: boolean;
      timeout?: number;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const { forceRefresh = false, timeout = 30000, maxRetries = 3 } = options;
    
    // 生成完整的请求键
    const fullKey = this.generateRequestKey(key, forceRefresh);
    

    
    // 检查是否有类似的日记请求正在进行（防止不同日期范围的重复请求）
    if (key.startsWith('diaries_') && !forceRefresh) {
      const existingSimilarKey = Array.from(this.pendingRequests.keys()).find(existingKey => 
        existingKey.startsWith('diaries_') && existingKey !== fullKey
      );
      
      if (existingSimilarKey) {

        // 等待现有的日记请求完成
        try {
          const existingResult = await this.pendingRequests.get(existingSimilarKey)!;

          return existingResult;
        } catch (error) {
          console.warn(`⚠️ 现有日记请求失败，继续执行新请求: ${fullKey}`);
        }
      }
    }
    
    // 检查是否在最小间隔内重复请求
    if (!forceRefresh && this.isRecentRequest(fullKey)) {

      // 如果有正在进行的请求，等待它完成
      if (this.pendingRequests.has(fullKey)) {
        return await this.pendingRequests.get(fullKey)!;
      }
      // 否则抛出错误
      throw new Error('请求过于频繁，请稍后重试');
    }
    
    // 如果强制刷新，清除现有的请求
    if (forceRefresh) {
      this.pendingRequests.delete(fullKey);

    }
    
    // 检查是否已有相同请求正在进行
    if (this.pendingRequests.has(fullKey)) {

      const count = this.requestCounts.get(fullKey) || 0;
      this.requestCounts.set(fullKey, count + 1);
      return await this.pendingRequests.get(fullKey)!;
    }
    
    // 创建新的请求

    this.requestCounts.set(fullKey, 1);
    this.lastRequestTime.set(fullKey, Date.now());
    
    const requestPromise = this.executeWithTimeout(requestFn, timeout, maxRetries);
    this.pendingRequests.set(fullKey, requestPromise);
    
    try {
      const result = await requestPromise;

      return result;
    } catch (error) {
      console.error(`❌ 请求失败: ${fullKey}`, error);
      throw error;
    } finally {
      // 清理完成的请求
      this.pendingRequests.delete(fullKey);
      this.requestCounts.delete(fullKey);
    }
  }
  
  /**
   * 带超时和重试的请求执行
   */
  private async executeWithTimeout<T>(
    requestFn: () => Promise<T>,
    timeout: number,
    maxRetries: number
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 创建超时Promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('请求超时')), timeout);
        });
        
        // 执行请求，带超时控制
        const result = await Promise.race([
          requestFn(),
          timeoutPromise
        ]);
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // 指数退避，最大5秒
          console.warn(`请求失败，${delay}ms后重试 (${attempt + 1}/${maxRetries})`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * 生成请求键
   */
  private generateRequestKey(key: string, forceRefresh: boolean): string {
    return forceRefresh ? `${key}_force_${Date.now()}` : key;
  }
  
  /**
   * 检查是否是最近的重复请求
   */
  private isRecentRequest(key: string): boolean {
    const lastTime = this.lastRequestTime.get(key);
    if (!lastTime) return false;
    
    const now = Date.now();
    return (now - lastTime) < this.MIN_REQUEST_INTERVAL;
  }
  
  /**
   * 清理过期的请求记录
   */
  cleanup(): void {
    const now = Date.now();
    const expireTime = 5 * 60 * 1000; // 5分钟过期
    
    for (const [key, time] of this.lastRequestTime.entries()) {
      if (now - time > expireTime) {
        this.lastRequestTime.delete(key);
        this.requestCounts.delete(key);
      }
    }
  }
  
  /**
   * 获取当前状态统计
   */
  getStats(): {
    pendingRequests: number;
    totalRequests: number;
    recentRequests: Array<{ key: string; count: number; lastTime: number }>;
  } {
    const recentRequests = Array.from(this.requestCounts.entries()).map(([key, count]) => ({
      key,
      count,
      lastTime: this.lastRequestTime.get(key) || 0
    }));
    
    return {
      pendingRequests: this.pendingRequests.size,
      totalRequests: this.requestCounts.size,
      recentRequests
    };
  }
  
  /**
   * 强制清除所有请求
   */
  clearAll(): void {
    this.pendingRequests.clear();
    this.requestCounts.clear();
    this.lastRequestTime.clear();

  }
}

// 创建全局单例
export const requestDeduplicator = new RequestDeduplicator();

// 定期清理过期记录
setInterval(() => {
  requestDeduplicator.cleanup();
}, 60000); // 每分钟清理一次