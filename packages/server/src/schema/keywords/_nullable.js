// This keyword is there for meta-information and migration generation only.
// It doesn't do any actual validation.
export const nullable = {
  // TODO: Can we check that this isn't set along with `required` through
  // metaSchema or any other way? I think we should be able to.
  metaSchema: {
    type: 'boolean'
  }
}
