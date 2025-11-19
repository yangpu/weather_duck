import dayjs from 'dayjs'

export class DateUtils {
  // 格式化日期为中文显示
  static formatDate(date: string | Date): string {
    const d = dayjs(date)
    return d.format('MM月DD日')
  }

  // 格式化日期为完整显示
  static formatFullDate(date: string | Date): string {
    const d = dayjs(date)
    return d.format('YYYY年MM月DD日')
  }

  // 获取星期几
  static getWeekday(date: string | Date): string {
    const d = dayjs(date)
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return weekdays[d.day()]
  }

  // 获取默认日期范围（今天到过去15天）
  static getDefaultDateRange(): { startDate: string; endDate: string } {
    const endDate = dayjs()
    const startDate = endDate.subtract(14, 'day')
    
    return {
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD')
    }
  }

  // 验证日期范围是否有效
  static isValidDateRange(startDate: string, endDate: string): boolean {
    const start = dayjs(startDate)
    const end = dayjs(endDate)
    
    if (!start.isValid() || !end.isValid()) {
      return false
    }
    
    if (start.isAfter(end)) {
      return false
    }
    
    // 限制最大范围为30天
    if (end.diff(start, 'day') > 30) {
      return false
    }
    
    return true
  }

  // 生成日期范围内的所有日期
  static generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = []
    let current = dayjs(startDate)
    const end = dayjs(endDate)
    
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      dates.push(current.format('YYYY-MM-DD'))
      current = current.add(1, 'day')
    }
    
    return dates
  }

  // 获取两个日期之间的所有日期（包含起始和结束日期）
  static getDatesBetween(startDate: string, endDate: string): string[] {
    return DateUtils.generateDateRange(startDate, endDate)
  }
}
