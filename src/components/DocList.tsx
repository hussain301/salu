import { formatDate, getDocuments, mediaUrl } from '@/lib/data'

/** Pages whose URL shows a live list of uploaded documents underneath their content. */
export const DOC_PAGES: Record<string, { category: string; title: string }> = {
  downloads: { category: 'download', title: 'Downloads' },
  tenders: { category: 'tender', title: 'Tenders' },
  tender: { category: 'tender', title: 'Tenders' },
  notifications: { category: 'notification', title: 'Notifications' },
  forms: { category: 'form', title: 'Forms' },
  prospectus: { category: 'prospectus', title: 'Prospectus' },
  jobs: { category: 'job', title: 'Jobs & Careers' },
  careers: { category: 'job', title: 'Jobs & Careers' },
  results: { category: 'result', title: 'Results' },
}

const ext = (name?: string | null) => (name?.split('.').pop() || 'link').toUpperCase().slice(0, 4)

export default async function DocList({ category }: { category: string }) {
  const res = await getDocuments(category)
  if (!res.docs.length) return null
  const now = Date.now()
  return (
    <div className="doc-list block" data-reveal="up" data-stagger>
      {res.docs.map((d) => {
        const file = typeof d.file === 'object' ? d.file : null
        const url = mediaUrl(file as never) || d.externalUrl || '#'
        const open = d.lastDate ? new Date(d.lastDate).getTime() >= now : undefined
        return (
          <a key={d.id} href={url} className="doc" target="_blank" rel="noopener noreferrer">
            <span className="doc-ext">{ext(file?.filename || d.externalUrl)}</span>
            <span className="doc-main">
              <strong>{d.title}</strong>
              <small>
                {formatDate(d.publishedAt)}
                {d.lastDate && <> · Last date: {formatDate(d.lastDate)}</>}
              </small>
              {d.description && <span className="doc-desc">{d.description}</span>}
            </span>
            {open !== undefined && <span className={`doc-status ${open ? 'open' : 'closed'}`}>{open ? 'Open' : 'Closed'}</span>}
            <span className="doc-dl" aria-hidden>
              ↓
            </span>
          </a>
        )
      })}
    </div>
  )
}
