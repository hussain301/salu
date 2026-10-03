import type { CollectionConfig } from 'payload'
import { anyone, isLoggedIn, revalidateAfterChange, revalidateAfterDelete } from '../shared'

export const DOC_CATEGORIES = [
  { label: 'Download', value: 'download' },
  { label: 'Tender', value: 'tender' },
  { label: 'Notification', value: 'notification' },
  { label: 'Form', value: 'form' },
  { label: 'Prospectus', value: 'prospectus' },
  { label: 'Job / Career', value: 'job' },
  { label: 'Result', value: 'result' },
]

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Document', plural: 'Downloads & Tenders' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'category', 'publishedAt', 'lastDate'], group: 'Content' },
  defaultSort: '-publishedAt',
  access: { read: anyone, create: isLoggedIn, update: isLoggedIn, delete: isLoggedIn },
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'category',
      type: 'select',
      options: DOC_CATEGORIES,
      defaultValue: 'download',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      admin: { position: 'sidebar' },
    },
    { name: 'lastDate', type: 'date', label: 'Last date / deadline', admin: { position: 'sidebar' } },
    { name: 'file', type: 'upload', relationTo: 'media' },
    { name: 'externalUrl', type: 'text', label: 'Or external link' },
    { name: 'description', type: 'textarea' },
  ],
}
