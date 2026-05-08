// Shared bandwidth / ETA formatters. Loaded as a plain <script src="/format-bandwidth.js">
// so /jobs and /builder can both use these without any bundler.
//
// Exports (attached to global.BandwidthFormat):
//   formatBandwidth(bytesPerSecond)  → "5 Mbps" | "800 kbps" | "1.2 Gbps"
//   formatRemaining(bytesRemaining, bytesPerSecond) → "3m 12s" | "2h 45m" | "45s" | ""
//   formatEta(bytesRemaining, bytesPerSecond) → "in 3m 12s" | "in 45s" | ""
//
// Conventions:
//   - Bandwidth is reported in bits/s (multiply bytes/s × 8), matching
//     industry convention (kbps / Mbps / Gbps).
//   - The leading number is kept < 1000 with at most 1 decimal digit.
//   - Defensive: null/undefined/0 inputs return "".
(function (global) {
  'use strict'

  /**
   * Format a bytes-per-second transfer rate as a human-readable bandwidth
   * string (bits/s convention: ×8). Returns "" for non-positive inputs.
   *
   * Examples:
   *   100_000 bytes/s  → "800 kbps"
   *   625_000 bytes/s  → "5 Mbps"
   *   150_000_000 bytes/s → "1.2 Gbps"
   */
  function formatBandwidth(bytesPerSecond) {
    if (!bytesPerSecond || bytesPerSecond <= 0) return ''
    var bps = bytesPerSecond * 8

    var units = [
      { label: 'Gbps', factor: 1e9 },
      { label: 'Mbps', factor: 1e6 },
      { label: 'kbps', factor: 1e3 },
    ]

    for (var i = 0; i < units.length; i++) {
      var unit = units[i]
      if (bps >= unit.factor) {
        var value = bps / unit.factor
        // Show one decimal only when it adds meaningful precision
        // (i.e. value < 100); avoid "1.0 Mbps" ugliness.
        var formatted = value < 10
          ? value.toFixed(1)
          : value.toFixed(0)
        // Strip trailing ".0" to keep it clean
        if (formatted.slice(-2) === '.0') {
          formatted = formatted.slice(0, -2)
        }
        return formatted + ' ' + unit.label
      }
    }

    // Sub-kbps (very slow, unusual)
    return bps.toFixed(0) + ' bps'
  }

  /**
   * Format remaining transfer time as a human-readable string.
   * Returns "" if either argument is missing, zero, or negative.
   *
   * Examples:
   *   (192_000, 1_000) → "3m 12s"
   *   (9_900_000, 1_000) → "2h 45m"
   *   (45_000, 1_000) → "45s"
   */
  function formatRemaining(bytesRemaining, bytesPerSecond) {
    if (!bytesRemaining || bytesRemaining <= 0) return ''
    if (!bytesPerSecond || bytesPerSecond <= 0) return ''

    var seconds = Math.round(bytesRemaining / bytesPerSecond)
    if (seconds <= 0) return ''

    var h = Math.floor(seconds / 3600)
    var m = Math.floor((seconds % 3600) / 60)
    var s = seconds % 60

    if (h > 0) {
      // For multi-hour durations omit seconds (not meaningful at that scale)
      return h + 'h ' + m + 'm'
    }
    if (m > 0) {
      return m + 'm ' + s + 's'
    }
    return s + 's'
  }

  /**
   * Relative ETA string like "in 3m 12s". Returns "" when data is absent.
   */
  function formatEta(bytesRemaining, bytesPerSecond) {
    var remaining = formatRemaining(bytesRemaining, bytesPerSecond)
    if (!remaining) return ''
    return 'in ' + remaining
  }

  global.BandwidthFormat = {
    formatBandwidth: formatBandwidth,
    formatRemaining: formatRemaining,
    formatEta: formatEta,
  }
}(typeof window !== 'undefined' ? window : globalThis))
