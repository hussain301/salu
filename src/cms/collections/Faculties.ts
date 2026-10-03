import type { CollectionConfig } from 'payload'
import { anyone, isLoggedIn, legacyHtmlField, revalidateAfterChange, revalidateAfterDelete, seoFields, slugField } from '../shared'

export const Faculties: CollectionConfig = {
  slug: 'faculties',
  labels: { singular: 'Faculty', plural: 'Faculties' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'order'], group: 'Academics' },
  defaultSort: 'order',
  access: { read: anyone, create: isLoggedIn, update: isLoggedIn, delete: isLoggedIn },
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'order', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    {
      name: 'accent',
      type: 'text',
      defaultValue: '#0b6e4f',
      admin: { position: 'sidebar', description: 'Accent colour (hex), used on cards.' },
    },
    { name: 'icon', type: 'text', admin: { position: 'sidebar', description: 'Emoji or short symbol, e.g. 🔬' } },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'intro', type: 'textarea' },
    {
      name: 'dean',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'designation', type: 'text', defaultValue: 'Dean' },
        { name: 'photo', type: 'upload', relationTo: 'media' },
        { name: 'message', type: 'textarea' },
      ],
    },
    { name: 'content', type: 'richText' },
    legacyHtmlField,
    seoFields,
  ],
}
