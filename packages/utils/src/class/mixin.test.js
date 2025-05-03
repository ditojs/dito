import { mixin } from './mixin.js'

describe('mixin()', () => {
  class SomeClass {
    function() {}
  }

  const Something1Mixin = mixin(
    Class =>
      class extends Class {
        function1() {}
      }
  )

  const Something2Mixin = mixin(
    Class =>
      class extends Class {
        function2() {}
      }
  )

  it('should apply mixin to class', () => {
    const NewClass = Something1Mixin(SomeClass)
    const instance = new NewClass()
    expect(instance.function).toBeInstanceOf(Function)
    expect(instance.function1).toBeInstanceOf(Function)
  })

  it('should apply multiple mixins to class', () => {
    const NewClass = Something2Mixin(Something1Mixin(SomeClass))
    const instance = new NewClass()
    expect(instance.function).toBeInstanceOf(Function)
    expect(instance.function1).toBeInstanceOf(Function)
    expect(instance.function2).toBeInstanceOf(Function)
  })

  it('should not apply mixin more than once', () => {
    const NewClass1 = Something1Mixin(SomeClass)
    const NewClass2 = Something1Mixin(NewClass1)
    expect(NewClass2).toBe(NewClass1)
  })

  it('should not affect the base class', () => {
    const NewClass1 = Something1Mixin(SomeClass)
    const NewClass2 = Something2Mixin(SomeClass)

    const instance = new SomeClass()
    const instance1 = new NewClass1()
    const instance2 = new NewClass2()

    expect(instance.function).toBeInstanceOf(Function)
    expect(instance.function1).toBeUndefined()
    expect(instance.function2).toBeUndefined()

    expect(instance1.function).toBeInstanceOf(Function)
    expect(instance1.function1).toBeInstanceOf(Function)
    expect(instance1.function2).toBeUndefined()

    expect(instance2.function).toBeInstanceOf(Function)
    expect(instance2.function1).toBeUndefined()
    expect(instance2.function2).toBeInstanceOf(Function)
  })

  it(`should not apply mixin more than once, even if it was applied higher up`, () => {
    const NewClass1 = Something1Mixin(SomeClass)
    class NewClass2 extends NewClass1 {}
    const NewClass3 = Something1Mixin(NewClass2)
    expect(NewClass3).toBe(NewClass2)
  })
})
