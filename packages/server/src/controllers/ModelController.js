import pluralize from 'pluralize'
import { isObject, camelize } from '@ditojs/utils'
import { CollectionController } from './CollectionController.js'
import { RelationController } from './RelationController.js'
import { ControllerError } from '../errors/index.js'
import { setupPropertyInheritance } from '../utils/object.js'

export class ModelController extends CollectionController {
  // @override
  configure() {
    super.configure()
    // Resolve the model class after `super.configure()`, which sets `name`.
    this.modelClass ||= this.resolveModelClass()
    if (!this.modelClass) {
      throw new ControllerError(
        this,
        'Unable to resolve the model class, provide `modelClass` or ' +
        'override `resolveModelClass()`.'
      )
    }
  }

  // Resolves the model class by the singularized controller name, as a
  // fallback when no `modelClass` is provided.
  // @overridable
  resolveModelClass() {
    return this.app.getModel(camelize(pluralize.singular(this.name), true))
  }

  setup() {
    super.setup()
    this.setProperty('relations', this.setupRelations())
  }

  setupRelations() {
    // Inherit `relations` from the controller and / or its sub-classes,
    // then build inheritance chains for each relation object through
    // `setupPropertyInheritance()`, before creating the relation controllers,
    // which then carry on with setting up inheritance for their actions.
    const relations = this.inheritValues('relations')
    for (const name in relations) {
      const relation = setupPropertyInheritance(relations, name)
      if (isObject(relation)) {
        relations[name] = this.setupRelation(relation, name)
      } else {
        throw new ControllerError(this, `Invalid relation '${name}'.`)
      }
    }
    return relations
  }

  setupRelation(object, name) {
    const relationInstance = this.modelClass.getRelations()[name]
    const relationDefinition = this.modelClass.definition.relations[name]
    if (!relationInstance || !relationDefinition) {
      throw new ControllerError(this, `Relation '${name}' not found.`)
    }
    const relation = new RelationController(
      this,
      object,
      relationInstance,
      relationDefinition
    )
    // RelationController instances are not registered with the app, but are
    // managed by their parent controller instead.
    relation.configure()
    relation.setup()
    return relation
  }

  // @override
  async execute(ctx, execute) {
    const trx = ctx.transaction
    const query = this.modelClass.query(trx)
    this.setupQuery(query)
    return execute(query, trx)
  }
}
