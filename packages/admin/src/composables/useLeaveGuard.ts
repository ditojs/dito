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

// Guard the route of a view or form against leaving it with changes that get
// lost, and let it navigate after submits without overriding the user.
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
  // Whether leaving was prevented because the data is invalid, so that the
  // next attempt can leave:
  let hasPreventedLeavingInvalidData = false
  // The pending confirmation to discard the changes, shared by the navigations
  // that happen while its dialog is open, e.g. through the back button:
  let discardConfirmation: Promise<boolean> | null = null
  // Whether a navigation away from the route waits for its pending submits:
  let isWaitingToLeave = false

  const beforeRouteChange = async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized
  ) => {
    let ok = true
    const isClosing = (
      // Only handle this route change if the form is actually mapped to the
      // `from` route, but include parent forms of closing nested forms as
      // well, by matching the from/to paths against `route.path`. Hash changes
      // only (= tab changes) and nested forms that open stay within it, while
      // other items, e.g. `/items/12` for `/items/1`, are outside of it.
      isPathWithin(from.path, route.path) &&
      !isPathWithin(to.path, route.path)
    )
    if (isClosing) {
      const { model } = route.container
      // Write the edits that are held back, e.g. debounced markup edits:
      model.writePendingValues()
      if (isMutating()) {
        // Directly mutating (nested) forms validate their data once, which
        // includes the fields that aren't mounted, e.g. in collapsed schemas.
        // If the user then still wants to leave them, they can click close /
        // navigate away again.
        ok = hasPreventedLeavingInvalidData || route.container.validate()
        hasPreventedLeavingInvalidData = !ok
      } else {
        // The form or view doesn't directly mutate data. Its data stays dirty
        // while it's being submitted, so wait for the submits first, and leave
        // without asking once they succeeded:
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

  // Navigate after a submit only while the route is within `path`, the path of
  // the form when it started. If a navigation away waits for the submit, we
  // decide once it settled, as navigating now would cancel it:
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
