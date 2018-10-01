export default modelName => class SessionStore {
  constructor(ctx) {
    this.ctx = ctx
    this.modelClass = ctx.app.models[modelName]
    if (!this.modelClass) {
      throw new Error(`Unable to find model class: '${modelName}'`)
    }
  }

  query() {
    return this.modelClass.query(this.ctx.transaction)
  }

  async get(id) {
    const session = await this.query().findById(id)
    return session?.value || {}
  }

  async set(id, value) {
    await this.query()
      .findById(id)
      .upsert({
        ...this.modelClass.getReference(id),
        value
      })
  }

  async destroy(key) {
    return this.query().deleteById(key)
  }
}
