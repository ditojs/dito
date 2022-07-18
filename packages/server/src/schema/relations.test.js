import {
  BelongsToOneRelation,
  HasOneRelation,
  HasOneThroughRelation,
  HasManyRelation,
  ManyToManyRelation
} from 'objection'
import { Model } from '../models/index.js'
import {
  getRelationClass, convertRelation, addRelationSchemas
} from './relations.js'

describe('getRelationClass()', () => {
  it('returns the corresponding relation classes', () => {
    expect(getRelationClass('belongs-to')).toBe(BelongsToOneRelation)
    expect(getRelationClass('has-one')).toBe(HasOneRelation)
    expect(getRelationClass('has-one-through')).toBe(HasOneThroughRelation)
    expect(getRelationClass('has-many')).toBe(HasManyRelation)
    expect(getRelationClass('many-to-many')).toBe(ManyToManyRelation)

    expect(getRelationClass('belongsTo')).toBe(BelongsToOneRelation)
    expect(getRelationClass('hasOne')).toBe(HasOneRelation)
    expect(getRelationClass('hasOneThrough')).toBe(HasOneThroughRelation)
    expect(getRelationClass('hasMany')).toBe(HasManyRelation)
    expect(getRelationClass('manyToMany')).toBe(ManyToManyRelation)

    expect(getRelationClass('BelongsToOneRelation')).toBe(BelongsToOneRelation)
    expect(getRelationClass('HasOneRelation')).toBe(HasOneRelation)
    expect(getRelationClass('HasOneThroughRelation'))
      .toBe(HasOneThroughRelation)
    expect(getRelationClass('HasManyRelation')).toBe(HasManyRelation)
    expect(getRelationClass('ManyToManyRelation')).toBe(ManyToManyRelation)
  })
})

describe('convertRelation()', () => {
  class ModelOne extends Model {}
  class ModelTwo extends Model {}

  const models = { ModelOne, ModelTwo }

  it('converts a belongs-to relation to Objection.js format', () => {
    expect(convertRelation({
      relation: 'belongs-to',
      from: 'ModelOne.modelTwoId',
      to: 'ModelTwo.id',
      modify: 'myScope'
    }, models)).toEqual({
      relation: BelongsToOneRelation,
      modelClass: ModelTwo,
      join: {
        from: 'ModelOne.modelTwoId',
        to: 'ModelTwo.id'
      },
      modify: 'myScope'
    })
  })

  it('converts a many-to-many relation to Objection.js format', () => {
    expect(convertRelation({
      relation: 'many-to-many',
      from: 'ModelOne.id',
      to: 'ModelTwo.id',
      inverse: false
    }, models)).toEqual({
      relation: ManyToManyRelation,
      modelClass: ModelTwo,
      join: {
        from: 'ModelOne.id',
        through: {
          from: 'ModelOneModelTwo.modelOneId',
          to: 'ModelOneModelTwo.modelTwoId'
        },
        to: 'ModelTwo.id'
      }
    })
  })

  it('converts an inverse many-to-many relation to Objection.js format', () => {
    expect(convertRelation({
      relation: 'many-to-many',
      from: 'ModelTwo.id',
      to: 'ModelOne.id',
      inverse: true
    }, models)).toEqual({
      relation: ManyToManyRelation,
      modelClass: ModelOne,
      join: {
        from: 'ModelTwo.id',
        through: {
          from: 'ModelOneModelTwo.modelTwoId',
          to: 'ModelOneModelTwo.modelOneId'
        },
        to: 'ModelOne.id'
      }
    })
  })

  it('preserves Objection.js relation format', () => {
    const relation = {
      relation: BelongsToOneRelation,
      modelClass: ModelTwo,
      join: {
        from: 'ModelOne.modelTwoId',
        to: 'ModelTwo.id'
      },
      modify: 'myScope'
    }
    expect(convertRelation(relation, models)).toEqual(relation)
  })
})

describe('addRelationSchemas()', () => {
  class ModelOne extends Model {
    static relations = {
      modelTwo: {
        relation: 'belongs-to',
        from: 'ModelOne.modelTwoId',
        to: 'ModelTwo.id'
      }
    }
  }

  class ModelTwo extends Model {
    static relations = {
      modelOnes: {
        relation: 'has-many',
        from: 'ModelTwo.id',
        to: 'ModelOne.modelTwoId',
        owner: true
      }
    }
  }

  // Add a mock app to both, to expose models:
  ModelOne.app = ModelTwo.app = {
    models: { ModelOne, ModelTwo }
  }

  it('adds correct property schema for a belongs-to relation', () => {
    expect(addRelationSchemas(ModelOne, {})).toEqual({
      modelTwo: {
        anyOf: [
          { type: 'null' },
          { relate: 'ModelTwo' },
          { $ref: 'ModelTwo' }
        ]
      }
    })
  })

  it('adds correct property schema for a has-many owner relation', () => {
    expect(addRelationSchemas(ModelTwo, {})).toEqual({
      modelOnes: {
        type: 'array',
        items: { $ref: 'ModelOne' }
      }
    })
  })
})
