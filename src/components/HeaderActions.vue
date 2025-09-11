<template>
  <div class="toolbar">
    <t-input
      class="control control--full"
      v-model="cityKeyword"
      placeholder="搜索城市（中文/英文）"
      @change="onCityInputChange"
      @enter="onCitySearch"
      clearable
    >
      <template #prefix-icon>
        <SearchIcon />
      </template>
    </t-input>
    <t-select
      class="control control--full"
      v-model="selectedCity"
      :options="cityOptions"
      placeholder="选择城市"
      @change="onCitySelected"
      :filterable="false"
    >
      <template #prefix-icon>
        <LocationIcon />
      </template>
    </t-select>
    <t-button 
      class="control" 
      variant="outline" 
      @click="useMyLocation"
      :loading="locating"
    >
      <template #icon>
        <LocationIcon />
      </template>
      {{ locating ? '定位中...' : '使用定位' }}
    </t-button>
    <t-date-range-picker
      class="control control--full"
      v-model:value="dateRangeValue"
      allow-input
      clearable
      :placeholder="['开始日期', '结束日期']"
      @change="onDateRangeChange"
    >
      <template #prefix-icon>
        <CalendarIcon />
      </template>
    </t-date-range-picker>
    <t-button class="control" theme="primary" @click="fetchAll">
      <template #icon>
        <RefreshIcon />
      </template>
      获取天气
    </t-button>
    <t-button class="control" variant="outline" @click="printPage">
      <template #icon>
        <PrintIcon />
      </template>
      打印
    </t-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Subject } from 'rxjs'
import { debounceTime, distinctUntilChanged, filter } from 'rxjs/operators'
import { GeocodingService } from '../services/geocoding'
import { 
  SearchIcon, 
  LocationIcon, 
  CalendarIcon, 
  RefreshIcon, 
  PrintIcon 
} from 'tdesign-icons-vue-next'

// Props
interface Props {
  cityKeyword: string
  cityOptions: Array<{ label: string; value: string; lat: number; lon: number }>
  selectedCity?: string
  locating: boolean
  dateRangeValue: [string, string]
  displayAddress?: string // 添加默认地址显示
}

// Emits
interface Emits {
  (e: 'update:cityKeyword', value: string): void
  (e: 'update:cityOptions', value: Array<{ label: string; value: string; lat: number; lon: number }>): void
  (e: 'update:selectedCity', value: string): void
  (e: 'update:dateRangeValue', value: [string, string]): void
  (e: 'citySelected', value: string): void
  (e: 'useMyLocation'): void
  (e: 'dateRangeChange', value: [Date, Date] | [string, string]): void
  (e: 'fetchAll'): void
  (e: 'printPage'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 本地响应式数据
const cityKeyword = ref(props.cityKeyword)
const cityOptions = ref(props.cityOptions)
const selectedCity = ref(props.selectedCity)
const dateRangeValue = ref(props.dateRangeValue)

// 监听props变化，同步到本地状态
watch(() => props.cityKeyword, (newVal) => {
  cityKeyword.value = newVal
})

watch(() => props.cityOptions, (newVal) => {
  cityOptions.value = newVal
})

watch(() => props.selectedCity, (newVal) => {
  selectedCity.value = newVal
})

watch(() => props.dateRangeValue, (newVal) => {
  dateRangeValue.value = newVal
})

// RxJS Subject for search debouncing
const searchSubject = new Subject<string>()
let searchSubscription: any = null

// 监听搜索输入变化，使用rxjs debounce
onMounted(() => {
  searchSubscription = searchSubject
    .pipe(
      debounceTime(500), // 500ms debounce - 只有停止输入500ms后才触发
      distinctUntilChanged(), // 只有当值真正改变时才触发
      filter(keyword => keyword.trim().length >= 2) // 只处理长度>=2的关键词
    )
    .subscribe(async (keyword: string) => {
      try {
        const results = await GeocodingService.searchCity(keyword.trim())
        
        // 如果有默认地址且不在搜索结果中，添加到列表开头
        let finalResults = [...results]
        if (props.displayAddress && !results.some(r => r.label === props.displayAddress)) {
          // 这里可以添加当前位置作为选项，但需要坐标信息
          // 暂时只显示搜索结果
        }
        
        cityOptions.value = finalResults
        emit('update:cityOptions', finalResults)
        
        // 如果有搜索结果，自动选择第一个
        if (finalResults.length > 0) {
          await nextTick()
          const firstOption = finalResults[0]
          selectedCity.value = firstOption.value
          emit('update:selectedCity', firstOption.value)
          // 同时触发城市选择事件
          emit('citySelected', firstOption.value)
        }
        
      } catch (error) {
        console.error('搜索城市失败:', error)
        const emptyOptions: Array<{ label: string; value: string; lat: number; lon: number }> = []
        cityOptions.value = emptyOptions
        emit('update:cityOptions', emptyOptions)
      }
    })
})

// 监听cityKeyword变化，处理清空情况
watch(cityKeyword, (newKeyword) => {
  if (!newKeyword || newKeyword.trim().length < 2) {
    // 清空搜索结果，但保留默认地址选项
    const defaultOptions: Array<{ label: string; value: string; lat: number; lon: number }> = []
    cityOptions.value = defaultOptions
    emit('update:cityOptions', defaultOptions)
  }
})

onUnmounted(() => {
  if (searchSubscription) {
    searchSubscription.unsubscribe()
  }
})

// 城市搜索输入变化处理
function onCityInputChange() {
  emit('update:cityKeyword', cityKeyword.value)
  // 使用rxjs subject发送搜索请求
  searchSubject.next(cityKeyword.value)
}

// 城市搜索回车处理
async function onCitySearch() {
  // 立即触发搜索，不等待throttle
  if (!cityKeyword.value || cityKeyword.value.trim().length < 2) {
    const newOptions: Array<{ label: string; value: string; lat: number; lon: number }> = []
    cityOptions.value = newOptions
    emit('update:cityOptions', newOptions)
    return
  }
  
  try {
    const results = await GeocodingService.searchCity(cityKeyword.value.trim())
    cityOptions.value = results
    emit('update:cityOptions', results)
  } catch (error) {
    console.error('搜索城市失败:', error)
    const emptyOptions: Array<{ label: string; value: string; lat: number; lon: number }> = []
    cityOptions.value = emptyOptions
    emit('update:cityOptions', emptyOptions)
  }
}

// 城市选择处理
function onCitySelected(val: string) {
  selectedCity.value = val
  emit('update:selectedCity', val)
  emit('citySelected', val)
}

// 使用定位
function useMyLocation() {
  emit('useMyLocation')
}

// 日期范围变化处理
function onDateRangeChange(val: [Date, Date] | [string, string]) {
  dateRangeValue.value = val as [string, string]
  emit('update:dateRangeValue', dateRangeValue.value)
  emit('dateRangeChange', val)
}

// 获取天气
function fetchAll() {
  emit('fetchAll')
}

// 打印页面
function printPage() {
  emit('printPage')
}
</script>

<style scoped>
/* 顶部工具栏自适应 */
.toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, max-content));
  align-items: center;
  gap: 8px 12px;
}

.control {
  min-width: 120px;
}

.control--full {
  min-width: 200px;
}

@media (max-width: 992px) {
  .toolbar {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
  .control--full {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .toolbar {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 480px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
}
</style>