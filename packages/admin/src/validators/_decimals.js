import { isNumber } from '@ditojs/utils'

// Format numbers with all their decimals and without exponent, as
// `String(1e-7)` is `'1e-7'`:
const numberFormat = new Intl.NumberFormat('en', {
  maximumFractionDigits: 100,
  useGrouping: false
})

function hasUnlimitedDecimals(decimals) {
  return decimals == null || decimals === '*'
}

export const decimals = {
  validate: (value, decimals) => {
    // `decimals: 0` allows no decimal point at all, only integers:
    const fraction = hasUnlimitedDecimals(decimals)
      ? '(\\.\\d+)?'
      : decimals > 0
        ? `(\\.\\d{1,${decimals}})?`
        : ''
    // Require at least one digit, before or after the decimal point:
    return new RegExp(`^[-+]?(?=\\.?\\d)\\d*${fraction}$`).test(
      isNumber(value) ? numberFormat.format(value) : value
    )
  },

  message: decimals =>
    hasUnlimitedDecimals(decimals)
      ? 'must be a number'
      : decimals > 1
        ? `must be a number with at most ${decimals} decimal places`
        : decimals === 1
          ? 'must be a number with at most one decimal place'
          : 'must be a whole number'
}
