// Colors are only validated as strings in 3.x, as before 3.3.0: the admin's
// color type stores hex strings and color keywords, but also objects for its
// `rgb`, `hsl` and `hsv` formats, and apps may store any CSS color string.
// TODO: Validate colors in 4.0, together with the values the admin stores.
export const color = {
  type: 'string'
}
