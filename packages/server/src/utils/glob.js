import { escapeRegexp } from '@ditojs/utils'

export function matchGlobPattern(str, pattern) {
  const exp = escapeRegexp(pattern).replace(
    /\\([*?])/,
    (_, chr) => chr === '*' ? '.*' : chr
  )
  return new RegExp(`^${exp}$`).test(str)
}
