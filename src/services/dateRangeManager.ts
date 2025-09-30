// 全局日期范围管理器 - 确保所有组件使用相同的日期范围
export class DateRangeManager {
  private static instance: DateRangeManager;
  private currentStartDate: string = '';
  private currentEndDate: string = '';
  private listeners: Array<(startDate: string, endDate: string) => void> = [];

  private constructor() {}

  static getInstance(): DateRangeManager {
    if (!DateRangeManager.instance) {
      DateRangeManager.instance = new DateRangeManager();
    }
    return DateRangeManager.instance;
  }

  // 初始化日期范围
  initialize(startDate: string, endDate: string): void {
    this.currentStartDate = startDate;
    this.currentEndDate = endDate;

  }

  // 设置日期范围
  setDateRange(startDate: string, endDate: string): void {
    const changed = this.currentStartDate !== startDate || this.currentEndDate !== endDate;
    
    if (changed) {

      
      this.currentStartDate = startDate;
      this.currentEndDate = endDate;
      
      // 通知所有监听器
      this.listeners.forEach(listener => {
        try {
          listener(startDate, endDate);
        } catch (error) {
          console.error('日期范围监听器执行失败:', error);
        }
      });
    }
  }

  // 获取当前日期范围
  getDateRange(): { startDate: string; endDate: string } {
    return {
      startDate: this.currentStartDate,
      endDate: this.currentEndDate
    };
  }

  // 检查日期范围是否已设置
  isDateRangeSet(): boolean {
    return this.currentStartDate !== '' && this.currentEndDate !== '';
  }

  // 添加日期范围变化监听器
  addListener(listener: (startDate: string, endDate: string) => void): void {
    this.listeners.push(listener);
  }

  // 移除监听器
  removeListener(listener: (startDate: string, endDate: string) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // 清理所有监听器
  clearListeners(): void {
    this.listeners = [];
  }

  // 生成日期范围的唯一键
  getDateRangeKey(): string {
    return `${this.currentStartDate}_${this.currentEndDate}`;
  }

  // 检查给定的日期范围是否与当前范围匹配
  isCurrentRange(startDate: string, endDate: string): boolean {
    return this.currentStartDate === startDate && this.currentEndDate === endDate;
  }
}

// 导出单例实例
export const dateRangeManager = DateRangeManager.getInstance();

// 暴露到全局供调试使用
if (typeof window !== 'undefined') {
  (window as any).__dateRangeManager = dateRangeManager;
}