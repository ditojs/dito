import { onUnmounted } from 'vue'
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRouter,
  type RouteLocationNormalized
} from 'vue-router'
import { isPathWithin } from '../utils/route.js'
import { confirm } from '../utils/dialogs.js'
import type { AdminContext } from '../utils/AdminContext.ts'
import type { RouteContext } from '../utils/RouteContext.ts'

export function useLeaveGuard(
  routeContext: RouteContext,
  {
    adminContext,
    isMutating
  }: {
    adminContext: AdminContext
    isMutating: () => boolean
  }
) {
  const router = useRouter()
  // The next attempt to leave invalid data can leave:
  let hasPreventedLeavingInvalidData = false
  // Shared by the navigations while its dialog is open, e.g. the back button:
  let discardConfirmation: Promise<boolean> | null = null
  // The latest navigation from the form's route until it settled, as it
  // cancels the earlier ones:
  let pendingNavigation: RouteLocationNormalized | null = null

  const beforeRouteChange = async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ) => {
    pendingNavigation = to
    let ok = true
    const isClosing = (
      // Include the parents of closing nested forms. Tab changes and nested
      // forms that open stay within the path, other items leave it:
      isPathWithin(from.path, routeContext.path) &&
      !isPathWithin(to.path, routeContext.path)
    )
    if (isClosing) {
      if (isMutating()) {
        // Mutating forms validate their data once, also the fields that
        // aren't mounted. Leaving again leaves the invalid data:
        ok = (
          hasPreventedLeavingInvalidData ||
          routeContext.dataContext.validate()
        )
        hasPreventedLeavingInvalidData = !ok
      } else {
        // Data stays dirty while it's submitted, so wait for the submits, also
        // of the form in the route's components:
        const models = [
          routeContext.dataContext.model,
          routeContext.componentForm?.dataContext.model
        ]
        for (const model of models) {
          if (model?.hasPendingSubmits) {
            await model.waitUntilSubmitted()
          }
        }
        if (routeContext.isDirty) {
          discardConfirmation ??= confirm(
            { adminContext },
            'You have unsaved changes. Do you want to discard them?',
            { action: 'Discard' }
          ).finally(() => {
            discardConfirmation = null
          })
          ok = await discardConfirmation
        }
      }
    }
    return ok
  }

  onBeforeRouteLeave(beforeRouteChange)
  onBeforeRouteUpdate(beforeRouteChange)
  onUnmounted(
    router.afterEach(to => {
      if (to === pendingNavigation) {
        pendingNavigation = null
      }
    })
  )

  // Navigate after a submit only while the route is within the form's `path`.
  // If a navigation is pending, e.g. one waiting for the submit, we decide
  // once it settled:
  const navigateWithin = (path: string, navigate: () => unknown) => {
    if (pendingNavigation) {
      const removeHook = router.afterEach(() => {
        removeHook()
        navigateWithin(path, navigate)
      })
    } else if (isPathWithin(router.currentRoute.value.path, path)) {
      navigate() // Not awaited, as leaving the form waits for its submits.
    }
  }

  return { navigateWithin }
}
