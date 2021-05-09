const { config, presets, plugins } = require('../../babel.shared')

module.exports = {
  ...config,
  presets: presets(),
  plugins: plugins({ resolver: true })
}
