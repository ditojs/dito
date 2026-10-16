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
  const isSliding = ref(false)
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

  // Changes the state, and animates the change: CSS can't transition the space
  // to the width of its content, so animate it between the measured widths.
  // The content slides between the space and the window's edge, and keeps the
  // width that it slides out at, or in at, so its layout doesn't change:
  const transition = async (change: () => void) => {
    const content = region.value!
    const space = content.parentElement!
    // Measure what is shown, also in the middle of a previous transition:
    const wasDocked = state.value === 'docked'
    const from = getWidth(space)
    let width = wasDocked ? getWidth(content) : null
    resetSize()
    setEdge(space, content)
    // Measure the new widths without the transition of the space:
    space.style.transition = 'none'
    change()
    await nextTick()
    setEdge(space, content)
    const to = getWidth(space)
    // Content that slides out keeps its width, and so does content that slides
    // in while its space grows. Otherwise it follows the layout, e.g. when the
    // window keeps growing after the layout switched:
    if (wasDocked || from !== to) {
      width ??= getWidth(content)
      setSize(space, content, { from, width })
      space.style.flexBasis = `${to}px`
      isSliding.value = true
      if (wasDocked && isOverlay.value) {
        // The docked content slides out without the overlay's shadow:
        content.style.boxShadow = 'none'
      }
      // Both the slide and the space end now, but only the slide always runs:
      resizeEvents = domOn(content, {
        transitionend(event: TransitionEvent) {
          if (event.target === content && event.propertyName === 'transform') {
            resetSize()
          }
        }
      })
    } else {
      space.style.transition = ''
    }
  }

  const resetSize = () => {
    resizeEvents?.remove()
    resizeEvents = null
    isSliding.value = false
    const content = region.value!
    setSize(content.parentElement!, content, null)
  }

  const collapse = (collapsed: boolean) =>
    transition(() => {
      isCollapsed.value = collapsed
      setStoredItem(storageKey, collapsed)
    })

  const onMediaChange = () => {
    close()
    transition(() => {
      isOverlay.value = media.matches
    })
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
    isOverlay,
    isSliding,
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

// Exposes the distance from the space to the window's right edge, for the
// content of sidebars on the right to slide out of the window:
function setEdge(space: HTMLElement, content: HTMLElement) {
  const { left } = space.getBoundingClientRect()
  content.style.setProperty('--sidebar-edge', `${window.innerWidth - left}px`)
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
  Object.assign(
    content.style,
    size ? { width: `${size.width}px` } : { width: '', boxShadow: '' }
  )
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
