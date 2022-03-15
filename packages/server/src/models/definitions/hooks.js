import { mergeAsReversedArrays } from '../../utils'

export default function hooks(values) {
  // Use `mergeAsReversedArrays()` so that for each event there is an array
  // of hooks in sequence from base class to sub class, so that the hooks
  // from the base class are run first by `_emitStaticHook()`.
  return mergeAsReversedArrays(values)
}
