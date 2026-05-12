# Worker 0d — narrow-view-menu-animate

**Model:** Sonnet · **Thinking:** ON · **Effort:** Medium
**Branch:** `feat/mux-magic-revamp/0d-narrow-view-menu-animate`
**Worktree:** `.claude/worktrees/0d_narrow-view-menu-animate/`
**Phase:** 1B web
**Depends on:** 01
**Parallel with:** all other 1B web workers

## Universal Rules (TL;DR)

Worktree-isolated. Random PORT/WEB_PORT. Pre-merge gate: `yarn lint → typecheck → test → e2e → lint`. TDD: failing test first. Yarn only. See [AGENTS.md](../../AGENTS.md).

## Your Mission

When the browser is narrow (mobile / small window), the header collapses into a left-side menu and a right-side menu. Currently, opening these menus has no transition — they pop into existence. **Animate** the open/close transitions.

### Investigation

Find the header at [packages/web/src/components/PageHeader/PageHeader.tsx](../../packages/web/src/components/PageHeader/PageHeader.tsx). Find the narrow-view menu (likely a sibling component, possibly `NarrowMenu.tsx` or similar; grep for `useMediaQuery` or Tailwind responsive classes `md:` `sm:` in PageHeader and its children).

### Animation approach

Options:
- **CSS-only** with `@keyframes` slide-in/out + `transform: translateX`. Cheapest.
- **Framer Motion** or another React animation lib. Adds dependency; only worth it if you need orchestrated animation (e.g., staggered child fade-in).
- **View Transitions API** (`document.startViewTransition`) — already used in this repo for card animations. Check [BuilderSequenceList.tsx](../../packages/web/src/pages/BuilderSequenceList/BuilderSequenceList.tsx) for the existing pattern.

Pick CSS-only if the menu is purely slide-in-from-edge. Pick View Transitions if you want consistency with the rest of the app.

### Spec

- Left menu slides in from left (translate from `-100%` to `0`); 200ms ease-out.
- Right menu slides in from right (translate from `100%` to `0`); 200ms ease-out.
- Reverse on close.
- Underlying click backdrop fades in/out at half speed.

## TDD steps

1. Write a Storybook story showing the menu open + closed states (visual verification, not automated screenshot).
2. Implement the animation.
3. Verify visually in Storybook + responsive dev server (resize browser to <768px).
4. Run e2e — if the existing e2e suite has anything about the narrow menu, ensure timing assertions still pass (animations should not exceed reasonable defaults; if e2e fails due to slow animations, shorten or skip in test mode).

## Files

- [packages/web/src/components/PageHeader/PageHeader.tsx](../../packages/web/src/components/PageHeader/PageHeader.tsx)
- The narrow-menu component (find via grep)
- Possibly Tailwind config or CSS module file for keyframes

## Verification checklist

- [ ] Worktree created
- [ ] Manifest row → `in-progress`
- [ ] Animation visible in narrow viewport
- [ ] Reduced-motion preference respected (`@media (prefers-reduced-motion: reduce)` disables the animation)
- [ ] Standard gate clean
- [ ] PR opened
- [ ] Manifest row → `done`

## Out of scope

- Redesigning the menu's contents or layout
- Adding new menu items
- Animation on the wide-view header
