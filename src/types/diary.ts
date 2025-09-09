export interface DiaryData {
  id?: string
  date: string
  content?: string
  mood?: string
  city?: string
  weather_data: any
  images?: string[]
  videos?: string[]
  created_at?: string
  updated_at?: string
}

export interface DiaryServiceInterface {
  getDiaries(limit?: number, forceRefresh?: boolean): Promise<DiaryData[]>
  getDiariesByDateRange(startDate: string, endDate: string, forceRefresh?: boolean): Promise<DiaryData[]>
  getDiaryByDate(date: string, forceRefresh?: boolean): Promise<DiaryData | null>
  createDiary(diaryData: Omit<DiaryData, 'id' | 'created_at' | 'updated_at'>): Promise<DiaryData>
  updateDiary(id: string, diaryData: Partial<DiaryData>): Promise<DiaryData>
  deleteDiary(id: string): Promise<boolean>
}