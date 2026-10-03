import type { GlobalConfig } from 'payload'
import { anyone, isLoggedIn, linkFields, revalidateGlobal } from '../shared'

const base: Pick<GlobalConfig, 'access' | 'hooks' | 'admin'> = {
  access: { read: anyone, update: isLoggedIn },
  hooks: { afterChange: [revalidateGlobal] },
  admin: { group: 'Site' },
}

export const Settings: GlobalConfig = {
  ...base,
  slug: 'settings',
  label: 'Site settings',
  fields: [
    { name: 'siteName', type: 'text', defaultValue: 'Shah Abdul Latif University' },
    { name: 'shortName', type: 'text', defaultValue: 'SALU' },
    { name: 'tagline', type: 'text', defaultValue: 'Khairpur Mir’s, Sindh — Pakistan' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'address', type: 'textarea', defaultValue: 'Shah Abdul Latif University, Khairpur Mir’s, Sindh, Pakistan' },
        { name: 'phone', type: 'text', defaultValue: '+92-243-9280001' },
        { name: 'email', type: 'text', defaultValue: 'info@salu.edu.pk' },
        { name: 'mapEmbedUrl', type: 'text' },
      ],
    },
    {
      name: 'social',
      type: 'array',
      fields: [
        {
          name: 'platform',
          type: 'select',
          options: ['facebook', 'twitter', 'youtube', 'instagram', 'linkedin'],
          required: true,
        },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'ctas',
      type: 'group',
      label: 'Header buttons',
      fields: [
        { name: 'applyLabel', type: 'text', defaultValue: 'Apply Online' },
        { name: 'applyUrl', type: 'text', defaultValue: '/admissions' },
        { name: 'portalLabel', type: 'text', defaultValue: 'Student Portal' },
        { name: 'portalUrl', type: 'text' },
      ],
    },
  ],
}

export const Navigation: GlobalConfig = {
  ...base,
  slug: 'navigation',
  label: 'Main menu',
  fields: [
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Menu item', plural: 'Menu items' },
      admin: { initCollapsed: true },
      fields: [
        ...linkFields,
        {
          name: 'columns',
          type: 'array',
          labels: { singular: 'Dropdown column', plural: 'Dropdown columns' },
          admin: { initCollapsed: true },
          fields: [
            { name: 'heading', type: 'text' },
            { name: 'url', type: 'text' },
            {
              name: 'links',
              type: 'array',
              admin: { initCollapsed: true },
              fields: linkFields,
            },
          ],
        },
      ],
    },
  ],
}

export const Footer: GlobalConfig = {
  ...base,
  slug: 'footer',
  label: 'Footer',
  fields: [
    { name: 'about', type: 'textarea' },
    {
      name: 'columns',
      type: 'array',
      admin: { initCollapsed: true },
      fields: [
        { name: 'heading', type: 'text', required: true },
        { name: 'links', type: 'array', fields: linkFields },
      ],
    },
    { name: 'bottomText', type: 'text', defaultValue: '© Shah Abdul Latif University, Khairpur. All rights reserved.' },
  ],
}

export const Homepage: GlobalConfig = {
  ...base,
  slug: 'homepage',
  label: 'Homepage',
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Hero',
          fields: [
            {
              name: 'slides',
              type: 'array',
              admin: { initCollapsed: true },
              fields: [
                { name: 'eyebrow', type: 'text' },
                { name: 'heading', type: 'text', required: true },
                { name: 'text', type: 'textarea' },
                { name: 'image', type: 'upload', relationTo: 'media' },
                { name: 'ctaLabel', type: 'text' },
                { name: 'ctaUrl', type: 'text' },
              ],
            },
            {
              name: 'ticker',
              type: 'array',
              label: 'Announcement ticker',
              fields: [{ name: 'text', type: 'text', required: true }, { name: 'url', type: 'text' }],
            },
          ],
        },
        {
          label: 'Stats',
          fields: [
            {
              name: 'stats',
              type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'value', type: 'number', required: true },
                    { name: 'suffix', type: 'text' },
                    { name: 'label', type: 'text', required: true },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'VC message',
          fields: [
            {
              name: 'vc',
              type: 'group',
              fields: [
                { name: 'name', type: 'text' },
                { name: 'designation', type: 'text', defaultValue: 'Vice Chancellor' },
                { name: 'photo', type: 'upload', relationTo: 'media' },
                { name: 'message', type: 'textarea' },
                { name: 'url', type: 'text', defaultValue: '/vice-chancellor' },
              ],
            },
          ],
        },
        {
          label: 'Highlights',
          fields: [
            {
              name: 'highlights',
              type: 'array',
              fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'text', type: 'textarea' },
                { name: 'image', type: 'upload', relationTo: 'media' },
                { name: 'url', type: 'text' },
              ],
            },
            {
              name: 'campuses',
              type: 'array',
              fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'text', type: 'textarea' },
                { name: 'image', type: 'upload', relationTo: 'media' },
                { name: 'url', type: 'text' },
              ],
            },
            { name: 'quickLinks', type: 'array', fields: linkFields },
          ],
        },
      ],
    },
  ],
}
