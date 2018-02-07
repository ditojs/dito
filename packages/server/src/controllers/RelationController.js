import chalk from 'chalk'
import { ControllerError } from '@/errors'
import { CollectionController } from './CollectionController'
import { setupPropertyInheritance } from '@/utils'

export class RelationController extends CollectionController {
  constructor(parent, relation, definition) {
    super(parent.app, null)
    if (parent.modelClass !== relation.ownerModelClass) {
      throw new ControllerError(parent,
        `Invalid parent controller for relation '${relation.name}'.`)
    }
    this.parent = parent
    this.relation = relation
    this.definition = definition
    this.name = relation.name
    this.modelClass = relation.relatedModelClass
    this.isOneToOne = relation.isOneToOne()
    this.graph = parent.graph
    this.router = parent.router
    this.level = parent.level + 1
    // Inherit eagerScope since it's in its nature to propagate to relations.
    this.eagerScope = parent.eagerScope
    // Initialize:
    this.path = this.app.normalizePath(this.name)
    this.url = `${this.parent.url}/${this.parent.getPath('member', this.path)}`
    this.log(`${chalk.blue(this.name)}${chalk.white(':')}`, this.level)
    // Copy over all fields in definition except relation and member,
    // for settings like scope, eagerScope, etc.
    for (const key in this.definition) {
      if (!['relation', 'member'].includes(key)) {
        this[key] = this.definition[key]
      }
    }
    this.initialize(false)
  }

  // @override
  inheritValues(type) {
    // Since RelationController are mapped to nested `relations` objects in
    // ModelController parents and are never extended directly in the user land
    // code, inheritance works differently here than on the other controllers:
    // ModelController already sets up inheritance for its `relations` object
    // and its entries for each relation from which `definition` is retrieved.
    // But the actions per relation still need to have inheritance set up,
    // using the values in its parent controller and potential super-classes,
    // falling back on the definitions in RelationController and its inherited
    // values from ModelController.
    return this.filterValues(
      setupPropertyInheritance(
        this.definition,
        // On relation definitions, the `collection` actions are stored in a
        // `relation` object, to make sense both for one- and many-relations:
        type === 'collection' ? 'relation' : type,
        // Set up inheritance for RelationController's override of `collection`
        // and `member` objects, and use it as the base for further inheritance.
        super.inheritValues(type)
      )
    )
  }

  // @override
  execute(transaction, ctx, modify) {
    const id = this.parent.getId(ctx)
    return this.parent.execute(transaction, ctx, query => query
      .findById(id)
      .throwIfNotFound()
      .clearScope()
      // Explicitly only select the foreign key ids for more efficiency.
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
