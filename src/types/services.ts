export interface GlobalDataManagerInterface {
  isInitialized: boolean
  currentDateRange: { startDate: string; endDate: string } | null
  initialize(startDate: string, endDate: string, latitude: number, longitude: number): Promise<void>
  getDiary(date: string): any
  getWeatherList(): any[]
  refreshDate(date: string): Promise<any>
  clearCache(): void
}

export interface UnifiedCacheStats {
  weatherCacheSize: number
  diaryCacheSize: number
  isInitialized: boolean
  currentDateRange: string | null
  pendingRequests: number
}

export interface InitializeDataResult {
  weatherData: any[]
  diariesData: any[]
}