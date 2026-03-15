export type Entry = {
  id: number
  title: string
}

export type Parent = {
  id: number
  title: string
  entries: Entry[]
}

export type ParentWithMarkers = Parent & {
  viewButton: never
  spacer: never
}

export type Address = {
  street: string
  city: string
}

export type ParentWithAddress = Parent & {
  address: Address
}
