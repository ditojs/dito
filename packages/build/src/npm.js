export function getNpmArgs() {
  const { original } = JSON.parse(process.env.npm_config_argv || '{}')
  return original || {}
}
