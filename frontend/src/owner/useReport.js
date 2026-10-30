import { useEffect, useState } from 'react'
import { api } from '../shared/api/client.js'

export const RANGES = [[1, 'Today'], [7, '7 days'], [30, '30 days'], [90, '90 days']]

// Commission / payouts / reports for the last `days` days (null while loading)
export function useReport(days) {
  const [state, setState] = useState({ days: null, data: null, error: '' })
  useEffect(() => {
    let live = true
    api.get(`/api/owner/report?days=${days}`)
      .then((data) => live && setState({ days, data, error: '' }))
      .catch((e) => live && setState({ days, data: null, error: e.message }))
    return () => { live = false }
  }, [days])
  return [state.days === days ? state.data : null, state.error]
}
