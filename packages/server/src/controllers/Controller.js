import compose from 'koa-compose'
import Router from 'koa-router'
import chalk from 'chalk'

export class Controller {
  constructor(app, namespace) {
    this.app = app
    this.namespace = this.namespace || namespace
    this.name = this.name ||
      this.constructor.name.match(/^(.*?)(?:Controller|)$/)[1]
    this.path = this.path || app?.normalizePath(this.name)
    this.logging = app?.config.log.routes
    this.router = new Router()
  }

  initialize() {
    const { path, namespace } = this
    this.url = namespace ? `/${namespace}/${path}` : `/${path}`
    this.log(`${namespace && chalk.green(`${namespace}/`)}${
      chalk.cyan(this.name)}${chalk.white(':')}`)
  }

  compose() {
    return compose([
      this.router.routes(),
      this.router.allowedMethods()
    ])
  }

  log(str, indent = 0) {
    if (this.logging) {
      console.log(`${'  '.repeat(indent)}${str}`)
    }
  }
}
