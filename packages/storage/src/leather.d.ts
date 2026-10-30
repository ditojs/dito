declare module 'leather' {
  export function readMediaAttributes(input: string | Buffer): {
    width: number
    height: number
    size: number
    mime: string | undefined
  }
}
