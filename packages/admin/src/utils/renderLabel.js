export default function renderLabel(desc, name) {
  // Handle hyphenated, underscored and camel-cased property names and expand
  // them to title cased labels if no label was provided:
  return desc && desc.label || name.replace(
    /([-_]|^)(\w)|([a-z])([A-Z])/g,
    function(all, hyphen, hyphenated, camelLeft, camelRight) {
      return hyphenated
          ? `${hyphen ? ' ' : ''}${hyphenated.toUpperCase()}`
          : `${camelLeft} ${camelRight}`
    }
  )
}

// console.log(renderLabel(null, 'some-hyphenated-label'))
// console.log(renderLabel(null, 'one_underscored_label'))
// console.log(renderLabel(null, 'MyCamelcasedLabel'))
