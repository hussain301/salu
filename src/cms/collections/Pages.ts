import type { CollectionConfig } from 'payload'
import {
  isLoggedIn,
  legacyHtmlField,
  publishedOrLoggedIn,
  revalidateAfterChange,
  revalidateAfterDelete,
  seoFields,
  slugField,
  sourceUrlField,
} from '../shared'

export const SECTIONS = [
  { label: 'About', value: 'about' },
  { label: 'Admissions', value: 'admissions' },
  { label: 'Academics', value: 'academics' },
  { label: 'Institutes & Centres', value: 'institutes' },
  { label: 'Campuses', value: 'campuses' },
  { label: 'Examinations', value: 'examinations' },
  { label: 'Research / ORIC', value: 'research' },
  { label: 'QEC', value: 'qec' },
  { label: 'Students', value: 'students' },
  { label: 'Administration', value: 'administration' },
  { label: 'Other', value: 'other' },
]

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'section', '_status', 'updatedAt'],
    listSearchableFields: ['title', 'slug'],
    group: 'Content',
  },
  versions: { drafts: true, maxPerDoc: 20 },
  access: {
    read: publishedOrLoggedIn,
    create: isLoggedIn,
    update: isLoggedIn,
    delete: isLoggedIn,
  },
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title', { allowSlash: true }),
    {
      name: 'section',
      type: 'select',
      options: SECTIONS,
      defaultValue: 'other',
      admin: { position: 'sidebar' },
    },
    { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'summary', type: 'textarea', admin: { description: 'Short intro shown under the page title.' } },
    { name: 'content', type: 'richText' },
    legacyHtmlField,
    sourceUrlField,
    seoFields,
  ],
}
