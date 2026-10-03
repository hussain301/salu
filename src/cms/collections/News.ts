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

export const NEWS_CATEGORIES = [
  { label: 'News', value: 'news' },
  { label: 'Events', value: 'events' },
  { label: 'Announcement', value: 'announcement' },
  { label: 'Notification', value: 'notification' },
  { label: 'Examinations', value: 'exam' },
  { label: 'ORIC / Research', value: 'oric' },
  { label: 'Postgraduate Studies', value: 'pgs' },
]

export const News: CollectionConfig = {
  slug: 'news',
  labels: { singular: 'News / Event', plural: 'News & Events' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'publishedAt', 'categories', '_status'],
    listSearchableFields: ['title', 'slug'],
    group: 'Content',
  },
  defaultSort: '-publishedAt',
  versions: { drafts: true, maxPerDoc: 10 },
  access: {
    read: publishedOrLoggedIn,
    create: isLoggedIn,
    update: isLoggedIn,
    delete: isLoggedIn,
  },
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField('title'),
    {
      name: 'publishedAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'categories',
      type: 'select',
      hasMany: true,
      options: NEWS_CATEGORIES,
      defaultValue: ['news'],
      admin: { position: 'sidebar' },
    },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' },
    { name: 'excerpt', type: 'textarea' },
    { name: 'content', type: 'richText' },
    legacyHtmlField,
    {
      name: 'gallery',
      type: 'array',
      labels: { singular: 'Photo', plural: 'Photo gallery' },
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
    },
    sourceUrlField,
    seoFields,
  ],
}
