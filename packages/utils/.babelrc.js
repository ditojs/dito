const { config, presets, plugins, env } = require('../../babel.shared')

module.exports = {
  ...config,
  presets: presets(),
  plugins: plugins({ resolver: true }),
  env: env({ test: true })
}
