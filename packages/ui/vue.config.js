const { getVueConfig } = require('@ditojs/build')

module.exports = getVueConfig({
  configureWebpack: {
    performance: false
  }
})
