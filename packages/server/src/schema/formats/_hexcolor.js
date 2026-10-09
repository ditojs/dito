export const hexcolor = {
  // `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, as stored by the admin's color
  // type, see `DitoTypeColor`:
  validate: /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  message: 'needs to be a hex color'
}
