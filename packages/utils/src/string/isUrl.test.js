import { isUrl } from './isUrl'

describe('isUrl()', () => {
  describe.each([
    'foobar.com',
    'www.foobar.com',
    'foobar.com/',
    'valid.au',
    'http://www.foobar.com/',
    'HTTP://WWW.FOOBAR.COM/',
    'https://www.foobar.com/',
    'HTTPS://WWW.FOOBAR.COM/',
    'http://www.foobar.com:23/',
    'http://www.foobar.com:65535/',
    'http://www.foobar.com:5/',
    'https://www.foobar.com/',
    'http://www.foo_bar.com',
    'ftp://www.foobar.com/',
    'http://www.foobar.com/~foobar',
    'http://user:pass@www.foobar.com/',
    'http://user:@www.foobar.com/',
    'http://127.0.0.1/',
    'http://10.0.0.0/',
    'http://189.123.14.13/',
    'http://duckduckgo.com/?q=%2F',
    'http://foobar.com/t$-_.+!*\'(),',
    'http://foobar.com/?foo=bar#baz=qux',
    'http://foobar.com?foo=bar',
    'http://foobar.com#baz=qux',
    'http://www.xn--froschgrn-x9a.net/',
    'http://xn--froschgrn-x9a.com/',
    'http://foo--bar.com',
    'http://xn--j1aac5a4g.xn--j1amh',
    'http://xn------eddceddeftq7bvv7c4ke4c.xn--p1ai',
    'test.com?ref=http://test2.com'
    // TODO: Support unicode URLs
    // 'http://høyfjellet.no',
    // 'http://кулік.укр',
  ])(
    'isUrl(%o)',
    str => {
      it('returns true', () => {
        expect(isUrl(str)).toBe(true)
      })
    }
  )
  describe.each([
    '',
    'http://localhost:3000/',
    '//foobar.com',
    'xyz://foobar.com',
    'invalid/',
    'invalid.x',
    'invalid.',
    '.com',
    'http://com/',
    'rtmp://foobar.com',
    'http://www.xn--.com/',
    'http://xn--.com/',
    'http://www.-foobar.com/',
    'http://www.foobar-.com/',
    'http://foobar/# lol',
    'http://foobar/? lol',
    'http://foobar/ lol/',
    'http://lol @foobar.com/',
    'http://lol:lol @foobar.com/',
    'http://lol:lol:lol@foobar.com/',
    'http://lol: @foobar.com/',
    'http://www.foobar.com/\t',
    'http://\n@www.foobar.com/',
    'http://*.foo.com',
    '*.foo.com',
    '!.foo.com',
    'http://example.com.',
    'http://localhost:61500this is an invalid url!!!!',
    '////foobar.com',
    'http:////foobar.com',
    'https://example.com/foo/<script>alert(\'XSS\')</script>/'
    // TODO: block this: 'mailto:foo@bar.com'
  ])(
    'isUrl(%o)',
    str => {
      it('returns false', () => {
        expect(isUrl(str)).toBe(false)
      })
    }
  )
})
