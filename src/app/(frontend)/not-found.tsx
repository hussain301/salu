import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="notfound">
      <div className="container">
        <span className="nf-code" aria-hidden>
          404
        </span>
        <h1>Page not found</h1>
        <p>The page you’re looking for may have moved during our website upgrade.</p>
        <div className="hero-ctas center">
          <Link href="/" className="btn btn-primary">
            Go home
          </Link>
          <Link href="/faculties" className="btn btn-ghost">
            Browse departments
          </Link>
        </div>
      </div>
    </section>
  )
}
