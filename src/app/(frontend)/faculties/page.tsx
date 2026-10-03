import type { Metadata } from 'next'
import Link from 'next/link'
import PageHero from '@/components/PageHero'
import { getDepartments, getFaculties } from '@/lib/data'

export const revalidate = 600
export const metadata: Metadata = { title: 'Faculties & Departments' }

export default async function FacultiesIndex() {
  const [faculties, deps] = await Promise.all([getFaculties(), getDepartments()])
  const facId = (d: (typeof deps)[number]) => (typeof d.faculty === 'object' ? d.faculty?.id : d.faculty)

  return (
    <>
      <PageHero
        title="Faculties & Departments"
        eyebrow="Academics"
        summary={`${faculties.length} faculties and ${deps.length} teaching departments offering undergraduate, graduate and doctoral programs.`}
        crumbs={[{ label: 'Faculties' }]}
      />
      <section className="section">
        <div className="container fac-index">
          {faculties.map((f, i) => {
            const list = deps.filter((d) => facId(d) === f.id)
            return (
              <div key={f.id} className="fac-row" style={{ ['--accent' as string]: f.accent || '#0b6e4f' }} data-reveal="up">
                <div className="fac-row-head">
                  <span className="faculty-num">{String(i + 1).padStart(2, '0')}</span>
                  <h2>
                    <Link href={`/${f.slug}`}>
                      {f.icon} {f.name}
                    </Link>
                  </h2>
                </div>
                <ul className="fac-row-list" data-reveal="fade" data-stagger>
                  {list.map((d) => (
                    <li key={d.id}>
                      <Link href={`/${d.slug}`}>
                        {d.name} <span aria-hidden>→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {(() => {
            const orphan = deps.filter((d) => !facId(d))
            return orphan.length ? (
              <div className="fac-row" data-reveal="up">
                <div className="fac-row-head">
                  <h2>Other departments</h2>
                </div>
                <ul className="fac-row-list">
                  {orphan.map((d) => (
                    <li key={d.id}>
                      <Link href={`/${d.slug}`}>{d.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          })()}
        </div>
      </section>
    </>
  )
}
