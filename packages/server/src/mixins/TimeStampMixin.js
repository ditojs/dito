export const TimeStampMixin = modelClass => class extends modelClass {
  static properties = {
    createdAt: {
      type: 'timestamp',
      default: 'now()'
    },
    updatedAt: {
      type: 'timestamp',
      default: 'now()'
    }
  }

  $beforeInsert(ctx) {
    this.createdAt = this.updatedAt = new Date()
    return super.$beforeInsert(ctx)
  }

  $beforeUpdate(opt, ctx) {
    this.updatedAt = new Date()
    return super.$beforeUpdate(opt, ctx)
  }
}
