// TODO: There's a contradiction between isUrl() and isAbsoluteUrl(), where
// isUrl() returns `true` for 'google.com', and isAbsoluteUrl() returns `false`!

const isUrlRegExp = new RegExp(
  '^((https?|ftps?|mailto|rtsp|mms)?://)?' +
  '(([0-9a-z_!~*\'().&=+$%-]+:)?[0-9a-z_!~*\'().&=+$%-]*@)?' + // user:pass@
  '(' +
    '(\\d{1,3}\\.){3}\\d{1,3}' + // ip
    '|' +
    '([0-9a-z_-]+\\.)*' + // sub-domain: www.
    '[0-9a-z][0-9a-z_-]{0,61}[0-9a-z]\\.' + // domain-name
    // tld - https://tools.ietf.org/id/draft-liman-tld-names-00.html#rfc.section.2
    '([a-z]{2,61}|xn--[0-9a-z][0-9a-z-]{0,61}[0-9a-z])' +
  ')' + // top level domain.
  '(:[0-9]{1,5})?' + // port
  '((/?)|' + // allow ending in a slash
  '([/?#][0-9a-z_!~*\'().;:@&=+$,%/?#-]+)+/?)$', // path
  'i'
)

export function isUrl(str) {
  return !!(str && isUrlRegExp.test(str))
}
