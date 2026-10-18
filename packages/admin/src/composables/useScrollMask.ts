import { onMounted, onUnmounted, ref, type Ref } from 'vue'

// Elements that scroll sideways fade out on the sides that they hide, see the
// `scroll-mask` mixin. Call `update()` on their scroll events:
export function useScrollMask(element: Readonly<Ref<HTMLElement | null>>) {
  const isMaskedStart = ref(false)
  const isMaskedEnd = ref(false)
  const update = () => {
    const { scrollLeft, clientWidth, scrollWidth } = element.value!
    isMaskedStart.value = scrollLeft > 0
    isMaskedEnd.value = scrollLeft + clientWidth < scrollWidth - 1
  }
  let observer: ResizeObserver | null = null
  onMounted(() => {
    observer = new ResizeObserver(update)
    observer.observe(element.value!)
  })
  onUnmounted(() => observer!.disconnect())
  return { isMaskedStart, isMaskedEnd, update }
}
