export const formatBandwidth = (
  bytesPerSecond: number | undefined,
): string => {
  if (!bytesPerSecond || bytesPerSecond <= 0) return ""
  const bps = bytesPerSecond * 8

  const units = [
    { label: "Gbps", factor: 1e9 },
    { label: "Mbps", factor: 1e6 },
    { label: "kbps", factor: 1e3 },
  ]

  for (const unit of units) {
    if (bps >= unit.factor) {
      const value = bps / unit.factor
      let formatted =
        value < 10 ? value.toFixed(1) : value.toFixed(0)
      if (formatted.slice(-2) === ".0")
        formatted = formatted.slice(0, -2)
      return `${formatted} ${unit.label}`
    }
  }

  return `${bps.toFixed(0)} bps`
}

export const formatRemaining = (
  bytesRemaining: number | undefined,
  bytesPerSecond: number | undefined,
): string => {
  if (!bytesRemaining || bytesRemaining <= 0) return ""
  if (!bytesPerSecond || bytesPerSecond <= 0) return ""

  const seconds = Math.round(
    bytesRemaining / bytesPerSecond,
  )
  if (seconds <= 0) return ""

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

export const formatEta = (
  bytesRemaining: number | undefined,
  bytesPerSecond: number | undefined,
): string => {
  const remaining = formatRemaining(
    bytesRemaining,
    bytesPerSecond,
  )
  if (!remaining) return ""
  return `in ${remaining}`
}
