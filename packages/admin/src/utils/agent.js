// This user-agent parser was lifted from Paper.js:
// https://github.com/paperjs/paper.js/blob/cc15696750035ab00e00c64c7c95daa2c85efe01/src/core/PaperScope.js#L75-L107

export function parseUserAgent(userAgent = '') {
  const agent = {}
  // Use replace() to get all matches, and deal with Chrome/Webkit overlap:
  const ua = userAgent.toLowerCase()
  const [os] =
    /(iphone|ipad|linux; android|darwin|win|mac|linux|freebsd|sunos)/.exec(
      ua
    ) || []
  const platform = (
    {
      'darwin': 'mac',
      'iphone': 'ios',
      'ipad': 'ios',
      'linux; android': 'android'
    }[os] ||
    os
  )
  if (platform) {
    agent.platform = platform
    agent[platform] = true
  }
  ua.replace(
    /(opera|chrome|safari|webkit|firefox|msie|trident)\/?\s*([.\d]+)(?:.*version\/([.\d]+))?(?:.*rv:v?([.\d]+))?/g,
    (match, browser, v1, v2, rv) => {
      // Do not set additional browsers once chrome is detected.
      if (!agent.chrome) {
        const version = rv || v2 || v1
        if (!agent.version || browser !== 'safari') {
          // Use the version we get for webkit for Safari, which is actually
          // The Safari version, e.g. 16.0
          agent.version = version
          agent.versionNumber = parseFloat(version)
        }
        agent.browser = browser
        agent[browser] = true
      }
    }
  )
  if (agent.chrome) {
    // Can't have it both ways, Chrome.
    delete agent.webkit
  }
  return agent
}
