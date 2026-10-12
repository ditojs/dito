// The color strings that the admin's color type stores, see `DitoTypeColor`:
// `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` for its hex formats, and color
// keywords such as `red` or `transparent` for `format: 'name'`. Keywords are
// only checked for being letters, not against the list of CSS named colors.
const hexColorRegExp = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const colorKeywordRegExp = /^[a-z]+$/i

export const color = {
  validate: value => (
    hexColorRegExp.test(value) || colorKeywordRegExp.test(value)
  ),
  message: 'needs to be a hex color or a color keyword'
}
