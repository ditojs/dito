import { Cascade, defineEntity, p } from '@mikro-orm/core'

// A customer as an admin has it: orders refer to a customer, and the
// foreign key refuses the delete of a customer with orders. Visits refer to
// a customer too, and the database sets theirs to null. A customer owns its
// addresses, and an address owns its lines. Notes go with their customer
// through a cascade of removes. A folder owns its child folders, whose
// foreign key deletes them with their parent.

const CustomerSchema = defineEntity({
  name: 'Customer',
  tableName: 'customer',
  // Customers named 'Hidden' are left out of every query.
  filters: {
    visible: {
      name: 'visible',
      cond: { name: { $ne: 'Hidden' } },
      default: true
    }
  },
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    orders: () => p.oneToMany(Order).mappedBy(order => order.customer),
    visits: () => p.oneToMany(Visit).mappedBy(visit => visit.customer),
    addresses: () =>
      p
        .oneToMany(Address)
        .mappedBy(address => address.customer)
        .orphanRemoval(),
    notes: () =>
      p
        .oneToMany(Note)
        .mappedBy(note => note.customer)
        .cascade(Cascade.ALL)
  }
})
export class Customer extends CustomerSchema.class {}
CustomerSchema.setClass(Customer)

const OrderSchema = defineEntity({
  name: 'Order',
  tableName: 'customer_order',
  properties: {
    id: p.integer().primary(),
    customer: () => p.manyToOne(Customer).nullable().deleteRule('no action')
  }
})
export class Order extends OrderSchema.class {}
OrderSchema.setClass(Order)

const VisitSchema = defineEntity({
  name: 'Visit',
  tableName: 'visit',
  properties: {
    id: p.integer().primary(),
    customer: () => p.manyToOne(Customer).nullable()
  }
})
export class Visit extends VisitSchema.class {}
VisitSchema.setClass(Visit)

const AddressSchema = defineEntity({
  name: 'Address',
  tableName: 'address',
  properties: {
    id: p.integer().primary(),
    city: p.string(),
    customer: () => p.manyToOne(Customer),
    lines: () =>
      p
        .oneToMany(AddressLine)
        .mappedBy(line => line.address)
        .orphanRemoval()
  }
})
export class Address extends AddressSchema.class {}
AddressSchema.setClass(Address)

const AddressLineSchema = defineEntity({
  name: 'AddressLine',
  tableName: 'address_line',
  properties: {
    id: p.integer().primary(),
    text: p.string(),
    address: () => p.manyToOne(Address)
  }
})
export class AddressLine extends AddressLineSchema.class {}
AddressLineSchema.setClass(AddressLine)

const NoteSchema = defineEntity({
  name: 'Note',
  tableName: 'note',
  properties: {
    id: p.integer().primary(),
    customer: () => p.manyToOne(Customer)
  }
})
export class Note extends NoteSchema.class {}
NoteSchema.setClass(Note)

const FolderSchema = defineEntity({
  name: 'Folder',
  tableName: 'folder',
  properties: {
    id: p.integer().primary(),
    parent: () => p.manyToOne(Folder).nullable().deleteRule('cascade'),
    children: () =>
      p
        .oneToMany(Folder)
        .mappedBy(folder => folder.parent)
        .orphanRemoval()
  }
})
export class Folder extends FolderSchema.class {}
FolderSchema.setClass(Folder)

export const customerEntities = [
  Customer,
  Order,
  Visit,
  Address,
  AddressLine,
  Note,
  Folder
]
