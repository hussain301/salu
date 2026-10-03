import type { CollectionConfig } from 'payload'
import { isAdmin } from '../shared'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'User', plural: 'Users' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Administration',
  },
  auth: {
    tokenExpiration: 60 * 60 * 8,
    maxLoginAttempts: 8,
    lockTime: 10 * 60 * 1000,
  },
  access: {
    // First user can always be created (setup); afterwards only admins manage users.
    create: async ({ req }) => {
      if (req.user?.role === 'admin') return true
      const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true })
      return totalDocs === 0
    },
    read: ({ req }) => (req.user?.role === 'admin' ? true : { id: { equals: req.user?.id } }),
    update: ({ req }) => (req.user?.role === 'admin' ? true : { id: { equals: req.user?.id } }),
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Administrator (everything, incl. users & settings)', value: 'admin' },
        { label: 'Editor (content only)', value: 'editor' },
      ],
      access: {
        update: ({ req }) => req.user?.role === 'admin',
      },
      hooks: {
        // The very first account becomes an administrator.
        beforeChange: [
          async ({ req, value, operation }) => {
            if (operation !== 'create') return value
            const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true })
            return totalDocs === 0 ? 'admin' : value
          },
        ],
      },
    },
  ],
}
