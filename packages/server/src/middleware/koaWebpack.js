import webpack from 'webpack'
import webpackDevMiddleware from 'webpack-dev-middleware'
import webpackHotMiddleware from 'webpack-hot-middleware'

export function koaWebpack({
  config = {},
  devMiddleware: devConfig = {},
  hotMiddleware: hotConfig = null
} = {}) {
  if (hotConfig) {
    config = {
      ...config,
      plugins: [
        new webpack.HotModuleReplacementPlugin(),
        ...(config.plugins || [])
      ]
    }
  }
  const compiler = webpack(config)
  const devMiddleware = webpackDevMiddleware(compiler, devConfig)
  const hotMiddleware = hotConfig && webpackHotMiddleware(compiler, hotConfig)

  return (ctx, next) => {
    return new Promise(resolve => {
      const res = {
        locals: ctx.state,

        end(body) {
          ctx.body = body
          resolve()
        },

        getHeader(field) {
          return ctx.get(field)
        },

        setHeader(field, value) {
          ctx.set(field, value)
        }
      }

      devMiddleware(ctx.req, res, () => {
        if (hotConfig) {
          hotMiddleware(ctx.req, res, next)
        } else {
          next()
        }
      })
    })
  }
}
