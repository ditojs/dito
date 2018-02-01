import chalk from 'chalk'
import { ControllerError } from '@/errors'
import { CollectionController } from './CollectionController'

export class RelationController extends CollectionController {
  constructor(parent, relation) {
    super(parent.app, null)
    if (parent.modelClass !== relation.ownerModelClass) {
      throw new ControllerError(parent,
        `Invalid parent controller for relation "${relation.name}".`)
    }
    this.parent = parent
    this.relation = relation
    this.name = relation.name
    this.modelClass = relation.relatedModelClass
    this.isOneToOne = relation.isOneToOne()
    this.graph = parent.graph
    this.router = parent.router
    this.level = parent.level + 1
    this.path = this.app.normalizePath(this.name)
    this.url = `${this.parent.url}/${this.parent.getPath('member', this.path)}`
    this.log(`${chalk.blue(this.name)}${chalk.white(':')}`, this.level)
    this.initialize(false)
  }

  // @override
  execute(transaction, ctx, modify) {
    const id = this.parent.getId(ctx)
    return this.parent.execute(transaction, ctx, query => query
      .findById(id)
      .throwIfNotFound()
      .modify(this.clearQuery)
      .select(...this.relation.ownerProp.props)
      .then(
        model => modify(model
          .$relatedQuery(this.relation.name)
          .modify(this.applyScope)
        )
      )
    )
  }

  collection = {
    delete(ctx, modify) {
      // TODO: What's the expected behavior in relations? Currently it deletes
      // the members, but shouldn't it unrelate instead? Answer: It should
      // respect the owner setting in relations, to be introduced.
      return super.delete(ctx, modify)
    }
  }
}
