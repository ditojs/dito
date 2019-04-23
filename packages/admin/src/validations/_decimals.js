export const decimals = {
  validate: (value, decimals) => {
    const match = decimals === '*' ? '+' : `{1,${decimals}}`
    return new RegExp(`^[-+]?\\d*(\\.\\d${match})?$`).test(value)
  },

  message: (value, decimals) => (
    `must be numeric and may contain ${
      !decimals || decimals === '*' ? '' : decimals
    } decimal points`
  )
}
