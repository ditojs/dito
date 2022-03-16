import pico from 'picocolors'
import { asArray } from '@ditojs/utils'
import { CollectionController } from './CollectionController.js'
import { ControllerError } from '../errors/index.js'
import { setupPropertyInheritance, getScope } from '../utils/index.js'

export class RelationController extends CollectionController {
  constructor(parent, object, relationInstance, relationDefinition) {
    super(parent.app, null)
    if (parent.modelClass !== relationInstance.ownerModelClass) {
      throw new ControllerError(parent,
        `Invalid parent controller for relation '${relationInstance.name}'.`)
    }
    this.parent = parent
    this.object = object
    this.relationInstance = relationInstance
    this.relationDefinition = relationDefinition
    this.name = relationInstance.name
    this.modelClass = relationInstance.relatedModelClass
    this.isOneToOne = relationInstance.isOneToOne()
    this.relate = !relationDefinition.owner
    this.unrelate = !relationDefinition.owner
    // Inherit parent values:
    this.graph = parent.graph
    this.transacted = parent.transacted
    this.level = parent.level + 1
    if (parent.scope) {
      // Inherit only the graph scopes since it's in its nature to propagate to
      // relations:
      this.scope = asArray(parent.scope).filter(scope => getScope(scope).graph)
    }
    // Initialize:
    this.path = this.app.normalizePath(this.name)
    this.url = `${this.parent.url}/${this.parent.getPath('member', this.path)}`
    this.log(`${pico.blue(this.path)}${pico.white(':')}`, this.level)
    // Copy over all fields in the relation object except the ones that are
    // going to be inherited in `setup()` (relation, member, allow), for
    // settings like scope, etc.
    for (const key in this.object) {
      if (!['relation', 'member', 'allow'].includes(key)) {
        this[key] = this.object[key]
      }
    }
    this.setup(false)
  }

  // @override
  inheritValues(type) {
    // Since RelationController are mapped to nested `relations` objects in
    // ModelController parents and are never extended directly in the user land
    // code, inheritance works differently here than on the other controllers:
    // ModelController already sets up inheritance for its `relations` object
    // and its entries for each relation from which `object` is retrieved.
    // But the actions per relation still need to have inheritance set up,
    // using the values in its parent controller and potential super-classes,
    // falling back on the definitions in RelationController and its inherited
    // values from ModelController.
    const values = setupPropertyInheritance(
      this.object,
      // On the relation objects, the `collection` actions are stored in a
      // `relation` object, to make sense both for one- and many-relations:
      type === 'collection' ? 'relation' : type,
      // Set up inheritance for RelationController's override of `collection`
      // and `member` objects, and use it as the base for further inheritance.
      // NOTE: Currently they're empty, but they could allow local overrides.
      super.inheritValues(type)
    )
    return values
  }

  // @override
  async execute(ctx, execute) {
    const id = this.parent.getMemberId(ctx)
    return this.parent.execute(ctx,
      async (parentQuery, trx) => {
        const model = await parentQuery
          .ignoreScope()
          .findById(id)
          .throwIfNotFound()
          // Explicitly only select the foreign key ids for more efficiency.
          .select(...this.relationInstance.ownerProp.props)
        // This is the same as `ModelController.execute()`, except for the use
        // of `model.$relatedQuery()` instead of `modelClass.query()`:
        const query = model.$relatedQuery(this.relationInstance.name, trx)
        this.setupQuery(query)
        return execute(query, trx)
      }
    )
  }

  collection = this.toCoreActions({
  })

  member = this.toCoreActions({
  })
}
