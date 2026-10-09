import { parseUserAgent } from './agent.js'

describe('parseUserAgent()', () => {
  it('detects Chrome on macOS, without also reporting WebKit', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/120.0.6099.71 Safari/537.36'
      )
    ).toEqual({
      platform: 'mac',
      mac: true,
      browser: 'chrome',
      chrome: true,
      version: '120.0.6099.71',
      versionNumber: 120
    })
  })

  it('detects Safari on iOS with the Safari version, not the WebKit one', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
        'Version/17.1 Mobile/15E148 Safari/604.1'
      )
    ).toEqual({
      platform: 'ios',
      ios: true,
      browser: 'safari',
      webkit: true,
      safari: true,
      version: '17.1',
      versionNumber: 17.1
    })
  })

  it('detects iPads as iOS', () => {
    expect(
      parseUserAgent('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')
    ).toEqual({ platform: 'ios', ios: true })
  })

  it('detects Firefox on Windows', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) ' +
        'Gecko/20100101 Firefox/121.0'
      )
    ).toMatchObject({
      platform: 'win',
      win: true,
      browser: 'firefox',
      firefox: true,
      version: '121.0',
      versionNumber: 121
    })
  })

  it('detects Chrome on Android', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      )
    ).toMatchObject({
      platform: 'android',
      android: true,
      browser: 'chrome',
      versionNumber: 120
    })
  })

  it('detects Internet Explorer 11 through its `rv:` version', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko'
      )
    ).toMatchObject({
      platform: 'win',
      browser: 'trident',
      trident: true,
      version: '11.0',
      versionNumber: 11
    })
  })

  it('returns an empty object for unknown or missing user agents', () => {
    expect(parseUserAgent('')).toEqual({})
    expect(parseUserAgent()).toEqual({})
    expect(parseUserAgent('curl/8.4.0')).toEqual({})
  })
})
