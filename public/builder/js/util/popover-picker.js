/**
 * Generic popover-picker factory.
 *
 * @param {{
 *   popoverId: string,
 *   inputId: string,
 *   listId: string,
 *   triggerSelector: string,
 *   alignSide?: 'left' | 'right',
 *   width: number,
 *   maxHeight: number,
 *   isSameAnchor?: (a: any, b: any) => boolean,
 *   buildItems: (anchor: any) => any[],
 *   findInitialActive?: (items: any[], anchor: any) => number,
 *   matchesQuery: (item: any, query: string) => boolean,
 *   itemClass: (item: any, isActive: boolean) => string,
 *   renderItem: (item: any, isActive: boolean) => string,
 *   emptyHtml?: string,
 *   onSelect: (item: any, anchor: any) => void,
 * }} config
 */
export function createPopoverPicker(config) {
  const pickerState = { current: null }

  function getPopover() {
    return document.getElementById(config.popoverId)
  }
  function getInput() {
    return document.getElementById(config.inputId)
  }
  function getList() {
    return document.getElementById(config.listId)
  }

  function isSameAnchor(firstAnchor, secondAnchor) {
    return config.isSameAnchor
      ? config.isSameAnchor(firstAnchor, secondAnchor)
      : JSON.stringify(firstAnchor) === JSON.stringify(secondAnchor)
  }

  function open(anchor, anchorElement) {
    if (pickerState.current && isSameAnchor(pickerState.current.anchor, anchor)) {
      close()
      return
    }
    const items = config.buildItems(anchor)
    const initialActiveIndex = config.findInitialActive ? config.findInitialActive(items, anchor) : 0
    pickerState.current = { anchor, items, filtered: items, query: '', activeIndex: initialActiveIndex }
    positionPopover(anchorElement)
    getPopover().classList.remove('hidden')
    const input = getInput()
    input.value = ''
    render()
    setTimeout(() => input?.focus(), 0)
  }

  function close() {
    getPopover()?.classList.add('hidden')
    pickerState.current = null
  }

  function positionPopover(anchorElement) {
    const popover = getPopover()
    const triggerRect = anchorElement.getBoundingClientRect()
    const margin = 8
    const initialLeft = config.alignSide === 'right'
      ? triggerRect.right - config.width
      : triggerRect.left
    const clampedLeft = (() => {
      if (initialLeft + config.width > window.innerWidth - margin) {
        return Math.max(margin, window.innerWidth - config.width - margin)
      }
      if (initialLeft < margin) {
        return margin
      }
      return initialLeft
    })()
    const spaceBelow = window.innerHeight - triggerRect.bottom - margin
    const spaceAbove = triggerRect.top - margin
    const isFlippedAbove = spaceBelow < 200 && spaceAbove > spaceBelow
    // Always use `top` (not `bottom`) so the popover is positioned in
    // viewport-relative terms that stay correct regardless of scroll offset.
    // Clamp into the visible viewport so the popover never drifts off-screen.
    popover.style.bottom = ''
    const { top, height } = (() => {
      if (isFlippedAbove) {
        const flippedHeight = Math.min(config.maxHeight, Math.max(0, spaceAbove))
        return { top: triggerRect.top - flippedHeight - 4, height: flippedHeight }
      }
      const droppedHeight = Math.min(config.maxHeight, Math.max(0, spaceBelow))
      return { top: triggerRect.bottom + 4, height: droppedHeight }
    })()
    const clampedTop = Math.max(margin, Math.min(top, window.innerHeight - height - margin))
    popover.style.top = `${clampedTop}px`
    popover.style.left = `${clampedLeft}px`
    popover.style.maxHeight = `${height}px`
  }

  function filter(query) {
    const state = pickerState.current
    if (!state) {
      return
    }
    state.query = query
    state.activeIndex = 0
    render()
  }

  function render() {
    const state = pickerState.current
    if (!state) {
      return
    }
    const list = getList()
    const query = state.query.trim().toLowerCase()
    const filtered = query ? state.items.filter((item) => config.matchesQuery(item, query)) : state.items
    state.filtered = filtered
    if (state.activeIndex >= filtered.length) {
      state.activeIndex = 0
    }
    const emptyHtml = config.emptyHtml ?? '<p class="text-xs text-slate-500 text-center py-4">No matches.</p>'
    list.innerHTML = filtered.length === 0
      ? emptyHtml
      : filtered.map((item, index) => (
          `<button type="button" data-picker-idx="${index}" class="${config.itemClass(item, index === state.activeIndex)}">`
          + config.renderItem(item, index === state.activeIndex)
          + `</button>`
        )).join('')
    const activeElement = list.querySelector(`[data-picker-idx="${state.activeIndex}"]`)
    activeElement?.scrollIntoView({ block: 'nearest' })
  }

  function selectAtIndex(index) {
    const state = pickerState.current
    if (!state) {
      return
    }
    const item = state.filtered[index]
    if (!item) {
      return
    }
    const anchor = state.anchor
    close()
    config.onSelect(item, anchor)
  }

  function keydown(event) {
    const state = pickerState.current
    if (!state) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (!state.filtered?.length) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      state.activeIndex = (state.activeIndex + 1) % state.filtered.length
      render()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      state.activeIndex = (state.activeIndex - 1 + state.filtered.length) % state.filtered.length
      render()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      selectAtIndex(state.activeIndex)
    }
  }

  function attachListDelegation() {
    const list = getList()
    if (!list) {
      return
    }
    list.addEventListener('mousedown', (event) => {
      if (event.target.closest('[data-picker-idx]')) {
        event.preventDefault()
      }
    })
    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-picker-idx]')
      if (!button) {
        return
      }
      selectAtIndex(Number(button.dataset.pickerIdx))
    })
  }
  attachListDelegation()

  document.addEventListener('mousedown', (event) => {
    if (!pickerState.current) {
      return
    }
    if (getPopover().contains(event.target)) {
      return
    }
    if (event.target.closest(config.triggerSelector)) {
      return
    }
    close()
  }, true)

  return { open, close, filter, keydown, render }
}
