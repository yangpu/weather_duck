<template>
  <!-- 移动端使用 TDesign Mobile ImageViewer -->
  <template v-if="isMobile">
    <t-mobile-image-viewer v-model:visible="internalVisible" :images="mobileImages" :index="internalIndex"
      :image-scale="imageScaleConfig" @index-change="onMobileIndexChange" @close="handleClose" />
  </template>

  <!-- 桌面端使用 TDesign Desktop ImageViewer -->
  <template v-else>
    <t-image-viewer v-model:visible="internalVisible" :images="images" v-model:index="internalIndex"
      :image-scale="imageScaleConfig" @close="handleClose" />
  </template>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { ImageViewer as TMobileImageViewer } from 'tdesign-mobile-vue'
import 'tdesign-mobile-vue/es/image-viewer/style/index.css'

interface Props {
  visible: boolean
  images: string[]
  index?: number
  minScale?: number
  maxScale?: number
  defaultScale?: number
  scaleStep?: number
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'update:index', value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  index: 0,
  minScale: 0.5,
  maxScale: 10,
  defaultScale: 1,
  scaleStep: 0.25
})

const emit = defineEmits<Emits>()

// 检测是否为移动端
const isMobile = ref(false)

function checkMobile(): boolean {
  // 检测触摸设备
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  // 检测屏幕宽度
  const isSmallScreen = window.innerWidth <= 768
  // 检测 User Agent
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  return hasTouchScreen && (isSmallScreen || mobileUA)
}

onMounted(() => {
  isMobile.value = checkMobile()

  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    isMobile.value = checkMobile()
  })
})

const internalVisible = ref(props.visible)
const internalIndex = ref(props.index)

// 桌面端图片缩放配置
const imageScaleConfig = {
  min: props.minScale,
  max: props.maxScale,
  step: props.scaleStep,
  defaultScale: props.defaultScale
}

// 移动端图片格式（TDesign Mobile 直接使用字符串数组）
const mobileImages = computed(() => props.images)

// 同步 props
watch(() => props.visible, (val) => {
  internalVisible.value = val
})

watch(() => props.index, (val) => {
  internalIndex.value = val
})

watch(internalVisible, (val) => {
  emit('update:visible', val)
})

watch(internalIndex, (val) => {
  emit('update:index', val)
})

// 移动端索引变化处理
function onMobileIndexChange(index: number) {
  internalIndex.value = index
}

function handleClose() {
  internalVisible.value = false
}
</script>
<style scoped>
/*移动端图片预览居中修复 */
/* .t-image-viewer .t-image-viewer__content {
  transform: translate(-50%, -50%) !important;
} */
</style>