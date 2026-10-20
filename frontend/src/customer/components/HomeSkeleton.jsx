// Skeleton loader (design C): home page-oda shape-a grey shimmer boxes-a kaattum,
// products backend la irundhu load aagura varaikkum. Styles: customer.css -> "SKELETON".
const range = (n) => Array.from({ length: n }, (_, i) => i)

export default function HomeSkeleton() {
  return (
    <div className="hsk" role="status" aria-live="polite" aria-label="Loading fresh products">
      <div className="hsk-nav">
        <div className="hsk-brand">
          <span className="hsk-logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14l-1.5 12h-11z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
          </span>
          <b>FreshMart</b>
        </div>
        <div className="sk hsk-search" />
        <div className="sk hsk-circle" />
        <div className="sk hsk-square" />
      </div>

      <div className="hsk-cats">
        {range(9).map((i) => (
          <div className="hsk-cat" key={i}><div className="sk hsk-cat-ic" /><div className="sk hsk-cat-lbl" /></div>
        ))}
      </div>

      <div className="hsk-body">
        <div className="hsk-banners">
          {range(3).map((i) => <div className="sk hsk-banner" key={i} />)}
        </div>
        <div className="sk hsk-title" />
        <div className="hsk-grid">
          {range(6).map((i) => (
            <div className="hsk-card" key={i}>
              <div className="sk hsk-img" />
              <div className="sk hsk-line" />
              <div className="sk hsk-line short" />
            </div>
          ))}
        </div>
      </div>
      <span className="hsk-sr">Loading fresh products…</span>
    </div>
  )
}
