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
    // Inheritance for the `relations` object and its entries for each relation
    // is already set up correctly. But the actions per relation still need to
    // have inheritance set up correctly, falling back on the definitions in
    // RelationController and its inherited values from ModelController.

    // On relations, the `collection` actions are stored in an object called
    // `relation` so it makes sense both for one- and many-relations.
    const name = type === 'collection' ? 'relation' : type
    // At first, set up inheritance for RelationController's own override of
    // `collection` and `member` objects, see below.
    const base = super.inheritValues(type)
    // Now set up property inheritance for this relation's definition in its
    // parent class and its potential super-classes. This works because
    // ModelController already sets up inheritance for its own `relations`
    // object from which `this.definition` is retrieved.
    const values = setupPropertyInheritance(this.definition, name, base)
    // Finally apply filtering to the resulting values.
    return this.filterValues(values)
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
