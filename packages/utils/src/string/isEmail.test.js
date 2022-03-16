import { isEmail } from './isEmail.js'

describe('isEmail()', () => {
  describe.each([
    'foo@bar.com',
    'x@x.au',
    'foo@bar.com.au',
    'foo+bar@bar.com',
    'hans.m端ller@test.com',
    'hans@m端ller.com',
    'test|123@m端ller.com',
    'test+ext@gmail.com',
    'some.name.midd.leNa.me.+extension@GoogleMail.com'
  ])(
    'isEmail(%o)',
    str => {
      it('returns true', () => {
        expect(isEmail(str)).toBe(true)
      })
    }
  )
  describe.each([
    'invalidemail@',
    'invalid.com',
    '@invalid.com',
    'foo@bar.com.',
    'foo@bar.co.uk.',
    'Name foo@bar.co.uk'
  ])(
    'isEmail(%o)',
    str => {
      it('returns false', () => {
        expect(isEmail(str)).toBe(false)
      })
    }
  )
})
