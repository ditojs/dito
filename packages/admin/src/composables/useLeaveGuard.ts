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
  route: RouteContext,
  {
    admin,
    isMutating,
    getCancelVerb
  }: {
    admin: AdminContext
    isMutating: () => boolean
    getCancelVerb: () => string
  }
) {
  const router = useRouter()
  // The next attempt to leave invalid data can leave:
  let hasPreventedLeavingInvalidData = false
  // Shared by the navigations while its dialog is open, e.g. the back button:
  let discardConfirmation: Promise<boolean> | null = null
  let isWaitingToLeave = false

  const beforeRouteChange = async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ) => {
    let ok = true
    const isClosing = (
      // Include the parents of closing nested forms. Tab changes and nested
      // forms that open stay within the path, other items leave it:
      isPathWithin(from.path, route.path) &&
      !isPathWithin(to.path, route.path)
    )
    if (isClosing) {
      const { model } = route.container
      if (isMutating()) {
        // Mutating forms validate their data once, also the fields that
        // aren't mounted. Leaving again leaves the invalid data:
        ok = hasPreventedLeavingInvalidData || route.container.validate()
        hasPreventedLeavingInvalidData = !ok
      } else {
        // Data stays dirty while it's submitted, so wait for the submits:
        if (model.hasPendingSubmits) {
          isWaitingToLeave = true
          await model.waitUntilSubmitted()
          isWaitingToLeave = false
        }
        if (route.isDirty) {
          discardConfirmation ??= confirm(
            { admin },
            {
              message: (
                'You have unsaved changes. ' +
                `Do you really want to ${getCancelVerb()}?`
              ),
              verb: 'discard'
            }
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

  // Navigate after a submit only while the route is within the form's `path`.
  // If a navigation away waits for the submit, we decide once it settled:
  const navigateWithin = (path: string, navigate: () => unknown) => {
    if (isWaitingToLeave) {
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
