export default function FullPageLoader({ label = 'Loading FreshMart…' }) {
  return (
    <div className="fm-loader" role="status" aria-live="polite">
      <span className="fm-loader-spin" />
      <p>{label}</p>
    </div>
  )
}
