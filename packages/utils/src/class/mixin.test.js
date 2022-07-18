import { mixin } from './mixin.js'

describe('mixin()', () => {
  class SomeClass {
    function() {}
  }

  const SomeMixin1 = mixin(Class => class extends Class {
    function1() {}
  })

  const SomeMixin2 = mixin(Class => class extends Class {
    function2() {}
  })

  it('should apply mixin to class', () => {
    const NewClass = SomeMixin1(SomeClass)
    const instance = new NewClass()
    expect(instance.function).toBeInstanceOf(Function)
    expect(instance.function1).toBeInstanceOf(Function)
  })

  it('should apply multiple mixins to class', () => {
    const NewClass = SomeMixin2(SomeMixin1(SomeClass))
    const instance = new NewClass()
    expect(instance.function).toBeInstanceOf(Function)
    expect(instance.function1).toBeInstanceOf(Function)
    expect(instance.function2).toBeInstanceOf(Function)
  })

  it('should not apply mixin more than once', () => {
    const NewClass1 = SomeMixin1(SomeClass)
    const NewClass2 = SomeMixin1(NewClass1)
    expect(NewClass2).toBe(NewClass1)
  })

  it('should not affect the base class', () => {
    const NewClass1 = SomeMixin1(SomeClass)
    const NewClass2 = SomeMixin2(SomeClass)

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
    const NewClass1 = SomeMixin1(SomeClass)
    class NewClass2 extends NewClass1 {
    }
    const NewClass3 = SomeMixin1(NewClass2)
    expect(NewClass3).toBe(NewClass2)
  })
})
