import type { CollectionConfig } from 'payload'
import {
  anyone,
  isLoggedIn,
  legacyHtmlField,
  revalidateAfterChange,
  revalidateAfterDelete,
  seoFields,
  slugField,
  sourceUrlField,
} from '../shared'

export const Departments: CollectionConfig = {
  slug: 'departments',
  labels: { singular: 'Department', plural: 'Departments' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'faculty', 'slug'], group: 'Academics' },
  defaultSort: 'name',
  access: { read: anyone, create: isLoggedIn, update: isLoggedIn, delete: isLoggedIn },
  hooks: { afterChange: [revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  fields: [
    { name: 'name', type: 'text', required: true },
    slugField('name'),
    { name: 'faculty', type: 'relationship', relationTo: 'faculties', admin: { position: 'sidebar' } },
    { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { position: 'sidebar' } },
    { name: 'intro', type: 'textarea' },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [{ name: 'content', type: 'richText' }, legacyHtmlField],
        },
        {
          label: 'Faculty members',
          fields: [
            {
              name: 'chairperson',
              type: 'group',
              fields: [
                { name: 'name', type: 'text' },
                { name: 'designation', type: 'text', defaultValue: 'Chairperson' },
                { name: 'photo', type: 'upload', relationTo: 'media' },
                { name: 'message', type: 'textarea' },
              ],
            },
            {
              name: 'members',
              type: 'array',
              labels: { singular: 'Member', plural: 'Members' },
              admin: { initCollapsed: true },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'designation', type: 'text' },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'qualification', type: 'text' },
                    { name: 'email', type: 'email' },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'photo', type: 'upload', relationTo: 'media' },
                    { name: 'cv', type: 'upload', relationTo: 'media', label: 'CV (PDF)' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Programs',
          fields: [
            {
              name: 'programs',
              type: 'array',
              admin: { initCollapsed: true },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'name', type: 'text', required: true },
                    {
                      name: 'level',
                      type: 'select',
                      options: ['BS', 'BS (5th semester)', 'MA/MSc', 'MPhil/MS', 'PhD', 'Diploma', 'Other'],
                    },
                    { name: 'duration', type: 'text' },
                  ],
                },
                { name: 'description', type: 'textarea' },
              ],
            },
          ],
        },
        {
          label: 'Contact',
          fields: [
            {
              name: 'contact',
              type: 'group',
              fields: [
                { name: 'email', type: 'email' },
                { name: 'phone', type: 'text' },
                { name: 'location', type: 'text' },
              ],
            },
          ],
        },
      ],
    },
    sourceUrlField,
    seoFields,
  ],
}
