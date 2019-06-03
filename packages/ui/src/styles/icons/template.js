const renderIcons = icons =>
`$icons: ${icons.map(({ name }) => name).join(' ')}

%icon
  width: 1em
  position: absolute
  top: 0
  left: 0
  right: 0
  bottom: 0
  margin: auto // To align the icon in the center of its container.
  content: ''
  background: currentColor
  mask: none no-repeat left content-box

${icons.map(renderIcon).join('\n\n')}
`

const renderIcon = ({ name, url }) =>
`%icon-${name}
  @extend %icon
  mask-image: ${url}`

module.exports = renderIcons
