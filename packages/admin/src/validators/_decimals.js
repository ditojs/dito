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

  message: (value, decimals) =>
    hasUnlimitedDecimals(decimals)
      ? 'must be numeric and may contain decimal points'
      : decimals > 0
        ? `must be numeric and may contain ${decimals} decimal points`
        : 'must be numeric and may not contain decimal points'
}
