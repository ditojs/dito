import {
  computed,
  nextTick,
  onUnmounted,
  reactive,
  ref,
  watch,
  type Ref
} from 'vue'
import { useRoute } from 'vue-router'
import { useDomEvents } from './useDomEvents.ts'

// Sidebars are docked on wide screens, where the user can collapse them, which
// the browser remembers. Below `breakpoint`, they open as overlays instead,
// which close on navigation. `region` is the content that slides, and its
// parent the space that the docked sidebar takes.
export function useSidebar({
  name,
  breakpoint,
  region,
  button
}: {
  name: string
  breakpoint: number
  region: Ref<HTMLElement | null>
  button: Ref<HTMLElement | null>
}) {
  const { domOn } = useDomEvents()
  const media = window.matchMedia(`(width < ${breakpoint}px)`)
  const storageKey = `dito-${name}-collapsed`
  const isOverlay = ref(media.matches)
  const isOpen = ref(false)
  const isCollapsed = ref(getStoredItem(storageKey) === 'true')
  let overlayEvents: { remove(): void } | null = null
  let resizeEvents: { remove(): void } | null = null

  const open = async () => {
    isOpen.value = true
    overlayEvents = domOn(document, {
      pointerdown(event: PointerEvent) {
        const target = event.target as Node
        if (
          !region.value!.contains(target) &&
          !button.value!.contains(target)
        ) {
          close()
        }
      },

      keydown(event: KeyboardEvent) {
        // Escape keys that others handled, e.g. dialogs, don't close it:
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault()
          close()
        }
      }
    })
    await nextTick()
    region.value!.focus()
  }

  const close = () => {
    if (isOpen.value) {
      isOpen.value = false
      overlayEvents!.remove()
      // Return the focus to the button, unless it already moved elsewhere:
      if (region.value!.contains(document.activeElement)) {
        button.value!.focus()
      }
    }
  }

  // CSS can't transition the space to the width of its content, so animate it
  // between the measured widths, while the content keeps its docked width:
  const collapse = async (collapsed: boolean) => {
    const content = region.value!
    const space = content.parentElement!
    const from = getWidth(space)
    let width = collapsed ? getWidth(content) : null
    resetSize()
    isCollapsed.value = collapsed
    setStoredItem(storageKey, collapsed)
    await nextTick()
    const to = getWidth(space)
    width ??= getWidth(content)
    if (from !== to) {
      setSize(space, content, { from, width })
      space.style.flexBasis = `${to}px`
      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.target === space && event.propertyName === 'flex-basis') {
          resetSize()
        }
      }
      resizeEvents = domOn(space, {
        transitionend: onTransitionEnd,
        transitioncancel: onTransitionEnd
      })
    }
  }

  const resetSize = () => {
    resizeEvents?.remove()
    resizeEvents = null
    const content = region.value!
    setSize(content.parentElement!, content, null)
  }

  const onMediaChange = () => {
    close()
    resetSize()
    isOverlay.value = media.matches
  }
  // NOTE: Not through `domOn()`, as happy-dom ignores the `signal` here:
  media.addEventListener('change', onMediaChange)
  onUnmounted(() => media.removeEventListener('change', onMediaChange))
  const route = useRoute()
  watch(() => route.path, close)

  const state = computed(() =>
    isOverlay.value
      ? isOpen.value
        ? 'open'
        : 'closed'
      : isCollapsed.value
        ? 'collapsed'
        : 'docked'
  )

  return reactive({
    state,
    isExpanded: computed(() => ['open', 'docked'].includes(state.value)),

    toggle() {
      if (isOverlay.value) {
        if (isOpen.value) {
          close()
        } else {
          open()
        }
      } else {
        collapse(!isCollapsed.value)
      }
    }
  })
}

function getWidth(element: HTMLElement) {
  return element.getBoundingClientRect().width
}

// Sets the size of a sidebar's space and content without transitions, or
// resets it with `null`:
function setSize(
  space: HTMLElement,
  content: HTMLElement,
  size: { from: number; width: number } | null
) {
  space.style.transition = 'none'
  Object.assign(
    space.style,
    size
      ? { flex: `0 0 ${size.from}px`, minWidth: '0', maxWidth: 'none' }
      : { flex: '', minWidth: '', maxWidth: '' }
  )
  content.style.width = size ? `${size.width}px` : ''
  // Apply the size before the transitions return:
  getWidth(space)
  space.style.transition = ''
}

// Storage can be unavailable, e.g. in private windows or when it's blocked, and
// then sidebars just aren't remembered:
function getStoredItem(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function setStoredItem(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value))
  } catch {}
}
