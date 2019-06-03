import fs from 'fs'
import mime from 'mime'
import svgToDataUri from 'mini-svg-data-uri'

export function getDataUri(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const type = mime.getType(filePath)
  return type === 'image/svg+xml'
    ? svgToDataUri(content.toString('utf8'))
    : `data:${type};base64,${content.toString('base64')}`
}
