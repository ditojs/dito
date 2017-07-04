export default function renderLabel(desc) {
  // Handle hyphenated, underscored and camel-cased property names and expand
  // them to title cased labels if no label was provided:
  return desc.label || desc.name.replace(
    /([-_]|^)(\w)|([a-z])([A-Z])/g,
    function(all, hyphen, hyphenated, camelLeft, camelRight) {
      return hyphenated
        ? `${hyphen ? ' ' : ''}${hyphenated.toUpperCase()}`
        : `${camelLeft} ${camelRight}`
    }
  )
}

// console.log(renderLabel({ name: 'some-hyphenated-label' }))
// console.log(renderLabel({ name: 'one_underscored_label' }))
// console.log(renderLabel({ name: 'MyCamelcasedLabel' }))
