// The hex colors that the admin's color type stores, see `DitoColorType`:
// `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`.
const hexColorRegExp = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export const color = {
  validate: value => hexColorRegExp.test(value),
  message: 'needs to be a hex color'
}
