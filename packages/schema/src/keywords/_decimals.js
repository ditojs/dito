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
    return new RegExp(`^[-+]?\\d*${fraction}$`).test(value)
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
