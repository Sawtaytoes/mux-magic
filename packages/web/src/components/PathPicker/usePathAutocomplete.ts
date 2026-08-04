// The path autocomplete's brains, extracted from the old PathPicker
// singleton. Owns the directory fetch (debounced, stale-guarded), the
// derived options, the open/loading/error state and the drill-down path
// computation — but NOT the input or the value writeback, which stay with
// the consumer (PathField mints path variables; PathValueInput lifts state).
//
// Pairs with charcuterie's Combobox in attached-input mode: the consumer's
// own <input> is the value AND the query, and selecting a folder drills in
// without closing (the popup stays open because we never flip `isOpen`).

import type { ListboxItem } from "@charcuterie/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import { parentPathFromInput } from "./parentPathFromInput"
import {
  computeMatches,
  computeNewValue,
  fetchDirEntries,
  isAbsolutePathLike,
} from "./pathAutocomplete.helpers"
import type { DirEntry } from "./types"

const DEBOUNCE_MS = 250

export type UsePathAutocomplete = {
  isOpen: boolean
  /** Wire to the input's `onChange`: writes the value and opens on a path. */
  onInputChange: (rawValue: string) => void
  /** Wire to Combobox `onSelect`: drills into the folder, stays open. */
  onSelectFolder: (folderName: string) => void
  close: () => void
  options: ListboxItem[]
  isLoading: boolean
  error: string | null
}

export const usePathAutocomplete = ({
  value,
  onWriteValue,
}: {
  value: string
  onWriteValue: (nextValue: string) => void
}): UsePathAutocomplete => {
  const [isOpen, setIsOpen] = useState(false)
  const [entries, setEntries] = useState<DirEntry[] | null>(
    null,
  )
  const [separator, setSeparator] = useState("/")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const requestTokenRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  const { parentPath, query: tail } =
    parentPathFromInput(value)

  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    },
    [],
  )

  // Fetch the current directory when open, debounced and stale-guarded.
  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const requestToken = requestTokenRef.current + 1
    requestTokenRef.current = requestToken

    setIsLoading(true)

    let isCancelled = false

    debounceTimerRef.current = setTimeout(() => {
      fetchDirEntries(parentPath)
        .then((data) => {
          if (
            isCancelled ||
            requestTokenRef.current !== requestToken
          ) {
            return
          }

          if (data.error) {
            setEntries([])
            setError(data.error)
          } else {
            setEntries(data.entries ?? [])
            setSeparator(data.separator ?? "/")
            setError(null)
          }

          setIsLoading(false)
        })
        .catch((caught: unknown) => {
          if (
            isCancelled ||
            requestTokenRef.current !== requestToken
          ) {
            return
          }

          setEntries([])
          setError(
            caught instanceof Error
              ? caught.message
              : String(caught),
          )
          setIsLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      isCancelled = true
    }
  }, [isOpen, parentPath])

  const options: ListboxItem[] = useMemo(
    () =>
      computeMatches(entries, tail).map((entry) => ({
        label: `📁 ${entry.name}`,
        textValue: entry.name,
        value: entry.name,
      })),
    [entries, tail],
  )

  return {
    isOpen,
    onInputChange: (rawValue) => {
      onWriteValue(rawValue)

      setIsOpen(isAbsolutePathLike(rawValue))
    },
    onSelectFolder: (folderName) => {
      onWriteValue(
        computeNewValue(folderName, parentPath, separator),
      )

      // Stay open and let the value change re-root the fetch — drill-down.
      setIsOpen(true)
    },
    close: () => {
      setIsOpen(false)
    },
    options,
    isLoading,
    error,
  }
}
