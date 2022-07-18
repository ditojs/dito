const renderIcons = icons =>
`$icons: ${icons.map(({ name }) => name).join(' ')}

%icon
  width: 1em
  position: absolute
  inset: 0
  margin: auto // To align the icon in the center of its container.
  content: ''
  background: currentColor
  mask: none no-repeat center content-box

${icons.map(renderIcon).join('\n\n')}
`

const renderIcon = ({ name, url }) =>
`%icon-${name}
  @extend %icon
  mask-image: ${url}`

export default renderIcons
