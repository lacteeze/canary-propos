# macOS 27 UI Kit → Canary PropOS Migration Plan

**Phase:** 1 — Investigation & Foundation  
**Sketch source:** `Apple macOS 27 UI Kit.sketch` (extracted to `.planning/sketch-extract/`)  
**Status:** Tokens + pilot primitives implemented; full reskin deferred to phased rollout

---

## 1. Sketch Kit Analysis

### Structure

| Asset | Count / Notes |
|-------|---------------|
| **Pages** | 37 artboard pages + `Kit` overview + `Library Preview` |
| **Symbols** | ~4,774 unique symbol masters/instances |
| **Embedded fonts** | 70 font references (SF Compact, SF Compact Text, SF Compact Rounded, SF Hello, SF Pro family via references) |
| **Bitmaps** | 111 image assets (app icons, pointers, materials previews) |
| **Color assets in document** | Empty `colorAssets` array — colors live in layer fills, not shared swatch library |

### Page Catalog (component categories)

| Sketch Page | React mapping target | Extractability |
|-------------|---------------------|----------------|
| Buttons | `MacButton`, `.cy-btn` | High — states/sizes named consistently |
| Menus | `DropdownMenu` + `.cy-menu` | High — already portaled in CanaryApp |
| Popovers | `Popover`, search panel, date picker | Medium — arrow anchors need CSS |
| Text Fields | `.cy-input`, shadcn `Input` | High |
| Search Fields | `.cy-search-*` | High |
| Combo / Pop-up / Pull-down Buttons | shadcn `Select`, native `.cy-select` | Medium |
| Segmented Controls | `.cy-view-toggle`, `.cy-cal-mode-toggle` | Medium |
| Toggles (Checkbox / Radio / Switch) | shadcn patterns + menu items | Medium |
| Sidebars | Future nav refactor | Low in web — adapt patterns |
| Titlebars & Toolbars | `.cy-header`, `.cy-toolbar` | Medium |
| Windows / Dialogs / Alerts | `.cy-glass-modal`, shadcn `Dialog` | Medium |
| Forms | Drawer rows, modals | Medium |
| Scrollbars | `.cnry ::-webkit-scrollbar` | High (CSS only) |
| Progress Indicators | shadcn `Progress` | Medium |
| Sliders / Steppers | Not used in Canary today | Defer |
| Materials | **Token source** — vibrancy, blur, opacity stacks | CSS variables + `backdrop-filter` |
| Colors | **Token source** — system + vibrant palette | Extracted to `tokens.css` |
| Menu Bar and Dock | Out of scope (web app) | N/A |
| App Icons / Pointers | Lucide icons | N/A |

### Symbol naming convention (enables automation)

```
{Component}/{Light|Dark}/{Context}/{Variant}/{Size}/{State}
```

Examples:
- `Buttons/Light/Content Area/Bordered Default/3 Rg/Active, Off, 1 Idle`
- `Menus/Dark/Content Area/1 Mn/...`
- `Toggles - Switches/Dark/Content Area/1 Mn/Active, On, 1 Idle`

**Sizes:** `1 Mn` (mini), `2 Sm`, `3 Rg`, `4 Lg`, `5 XL`  
**States:** `1 Idle`, `3 Clicked`, `4 Disabled` (+ Active/Inactive, On/Off, Checked/Unchecked)

### Design tokens extracted

#### Typography
- **Primary UI:** SF Pro Text / SF Compact Text (Sketch embedded)
- **Web implementation:** `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui` (see Font Decision below)
- **Base size:** 13px (macOS standard; Canary currently 13.5px)
- **Weights:** 400 menu items, 500 buttons, 600 primary actions

#### Colors — Vibrant System (from Colors page)

| Token | Light | Dark |
|-------|-------|------|
| Red | `#ff383c` | `#ff4245` |
| Orange | `#ff8d28` | `#ff9230` |
| Yellow | `#ffcc00` | `#ffd600` |
| Green | `#34c759` | `#30d158` |
| Teal | `#00c8b3` | `#00dac3` |
| Blue | `#0088ff` | `#0091ff` |
| Indigo | `#6155f5` | `#6d7cff` |
| Purple | `#cb30e0` | `#db34f2` |
| Pink | `#ff2d55` | `#ff375f` |
| Accent | `#007aff` | `#0a84ff` |

#### Materials (from Materials page)

| Material | Value | CSS approach |
|----------|-------|--------------|
| Liquid Glass tint | `#ffffff` @ 0.02–0.14 α on dark | `color-mix` + `backdrop-filter` |
| Panel material | `#292929` @ 0.4 α | `--mac-panel` |
| Large UI | `#1a1a1a` @ 0.5 α | Modal/drawer backgrounds |
| Tint Color | `#ffffff` @ 0.96 α | Near-solid popover fill |

#### Radii (inferred from kit + HIG)

| Use | Value |
|-----|-------|
| Controls (button, input) | 6px |
| Menus | 10px |
| Popovers / cards | 12px |
| Window chrome | 12px |

#### Shadows
- Layered soft shadows (not flat Tailwind defaults)
- Menus use deeper `shadow-menu` stack

### What's extractable vs manual

| Extractable automatically | Manual recreation required |
|---------------------------|---------------------------|
| Hex colors from fill swatches | True vibrancy (needs `backdrop-filter` + saturation) |
| Font family names | SF Pro web licensing / hosting |
| Symbol inventory & states | Window traffic lights (decorative only) |
| Size tier naming | Complex sliders, color wheels, native scrollbars on Firefox |
| Light/Dark variants | App icon bitmaps (use Lucide) |
| Border opacities | Pixel-perfect button gradients (approximated) |

---

## 2. Current Canary UI Architecture

### Layer model

```
src/app/layout.tsx          → Geist fonts, globals.css (shadcn tokens, oklch)
src/app/(canary)/layout.tsx → Instrument Sans + IBM Plex Mono for Canary route
src/components/canary/
  CanaryApp.tsx             → 3000+ line shell (nav, tables, timelines, search, drawers)
  canary.css                → 2100+ lines: .cnry design system (CSS variables + components)
  EntityDetailDrawer.tsx    → Side drawer
  PropertyOccupancyCalendar → Large modal
  CanaryAddPropertyModal    → Glass modal
  DatePickerField           → Popover calendar
  layout/                   → DnD dashboard cards
src/components/ui/          → shadcn (Base UI primitives): button, input, dropdown-menu, dialog…
```

### Design token locations today

| System | Location | Scope |
|--------|----------|-------|
| shadcn / Tailwind 4 | `src/app/globals.css` | Manager, tenant, auth, public routes |
| Canary custom | `.cnry { --bg, --accent, … }` in `canary.css` | Canary shell only |
| Theme toggle | `data-theme="light|dark"` on `.cnry.cy-shell` | Canary |

### Key surfaces to reskin (priority order)

1. **Shell** — `.cy-header`, `.cy-topnav`, `.cy-main` background
2. **Dropdowns** — Profile menu, filter menus (recent `.cy-menu` / `.cy-profile-menu` work at `canary.css:527-664`)
3. **Search panel** — `.cy-search-panel` (glass popover)
4. **Tables** — `.cy-table-panel`, sticky headers
5. **Drawers** — `.cy-drawer`, `EntityDetailDrawer`
6. **Modals** — `.cy-property-modal`, `.cy-glass-modal`, occupancy calendar
7. **Forms** — `.cy-input`, `.cy-select`, `DatePickerField`
8. **FAB** — `.cy-fab-*`
9. **Status chips** — `.cy-chip`, timeline badges

### Recent dropdown theming (already in place)

CanaryApp applies portaled menu classes:

```tsx
<DropdownMenuContent
  data-theme={theme}
  className="cnry cy-menu cy-profile-menu min-w-56"
/>
```

`canary.css` targets `[data-slot='dropdown-menu-content']` for solid panel, blur, item hover — **good integration point for macOS menu styling**.

### Font conflict

- **Root layout:** Geist Sans
- **Canary layout:** Instrument Sans (Google Fonts)
- **macOS kit:** SF Pro / SF Compact

Phase 1 keeps Instrument Sans as fallback but applies `--mac-font-ui` system stack when `data-ui="macos27"`.

---

## 3. Migration Strategy

### Architecture decision

**Hybrid bridge approach** — do not fork shadcn; layer macOS tokens over existing Canary CSS variables.

```
┌─────────────────────────────────────────────────────┐
│  .cnry.cy-shell[data-ui="macos27"][data-theme]      │
│    ├── tokens.css    (macOS semantic → --mac-*)     │
│    ├── bridge        (--mac-* overrides --bg, etc.) │
│    └── primitives.css (buttons, menus, shell)       │
├─────────────────────────────────────────────────────┤
│  Existing canary.css classes (.cy-btn, .cy-card…)   │
│  shadcn DropdownMenu (behavior unchanged)           │
└─────────────────────────────────────────────────────┘
```

**Rationale:**
- Preserves all CanaryApp logic and class names
- Visual reskin via CSS variable bridge — lowest regression risk
- shadcn stays for manager/tenant routes until Phase 4+
- New `MacButton` primitive proves component-level path for new UI

### Recommended folder structure

```
src/design-system/macos27/
  tokens.css          ← semantic color, type, radius, blur, shadow
  primitives.css    ← shell + legacy class overrides
  index.css           ← barrel import
  README.md           ← (optional, Phase 2)

src/components/macos27/
  MacButton.tsx       ← pilot primitive
  MacMenu.tsx         ← (Phase 2) thin DropdownMenu wrapper
  MacInput.tsx        ← (Phase 2)
  index.ts            ← (Phase 2) barrel exports
```

### Component mapping

| Sketch symbol | Implementation | Strategy |
|---------------|----------------|----------|
| Buttons / Bordered Default | `MacButton` + `.cy-btn` override | New primitive + CSS bridge |
| Buttons / Borderless Colored | `MacButton variant="primary"` | New primitive |
| Menus | `DropdownMenu` + `.cy-menu` | CSS override (done in Phase 1) |
| Popovers | `.cy-search-panel`, date picker popover | CSS Phase 2 |
| Text Fields | `.cy-input` | CSS Phase 2 |
| Search Fields | `.cy-search-*` | CSS Phase 2 |
| Segmented Controls | `.cy-view-toggle`, cal toggles | CSS Phase 3 |
| Sidebars | `.cy-drawer` | CSS Phase 3 |
| Windows / Dialogs | `.cy-glass-modal` | CSS Phase 3 |
| Tables | `.cy-table-panel` | CSS Phase 3 |
| Alerts | shadcn `Alert` / custom callouts | Phase 4 |
| Progress | shadcn `Progress` | Phase 4 |

### Tailwind 4 integration (Phase 2+)

Extend `globals.css` `@theme inline` with macOS tokens for routes outside Canary:

```css
@theme inline {
  --font-sans: var(--mac-font-ui);
  --radius-lg: var(--mac-radius-control);
  /* map --color-primary to --mac-accent when .macos27 on <html> */
}
```

For Phase 1, Canary uses pure CSS variables in `.cnry[data-ui='macos27']` — no Tailwind theme churn yet.

### Phased rollout

#### Phase 1 — Foundation ✅ (this pass)
- [x] Extract & catalog Sketch kit
- [x] `tokens.css` + bridge to Canary variables
- [x] `primitives.css` — shell, buttons, menus
- [x] `MacButton` pilot component
- [x] Enable `data-ui="macos27"` on CanaryApp shell
- [x] Wire mobile menu button to `MacButton`

#### Phase 2 — Primitives (next)
- [ ] `MacInput`, `MacSelect` wrappers
- [ ] `MacMenu` — standardized DropdownMenuContent className helper
- [ ] Search field reskin
- [ ] Typography switch: system font stack in `(canary)/layout.tsx`
- [ ] Scrollbar styling pass

#### Phase 3 — Shell & surfaces
- [ ] Header / topnav segmented appearance
- [ ] Cards, KPIs, table panels
- [ ] Drawers + property modal chrome
- [ ] Occupancy calendar modal
- [ ] FAB menu

#### Phase 4 — Feature views & other routes
- [ ] Manager shell (`ManagerShell.tsx`) — optional macOS mode
- [ ] Auth / public pages
- [ ] shadcn component variant pass (dialog, tabs, form)

#### Phase 5 — Polish
- [ ] Motion (menu zoom, sheet slide)
- [ ] Focus rings (macOS blue halo)
- [ ] High-contrast / accessibility audit
- [ ] Cross-browser vibrancy fallbacks

### Pilot component recommendation

**Primary:** `DropdownMenu` profile menu — already themed, immediately visible, zero logic change.

**Secondary:** `MacButton` on mobile nav toggle — proves primitive component API.

**Validation checklist:**
1. Open `/app` → profile avatar menu → inspect blur, radius, hover
2. Resize to mobile → hamburger uses `MacButton`
3. Toggle light/dark → menu + shell backgrounds update
4. Confirm tables, drawers, modals still function (no layout break)

---

## 4. Phase 1 Implementation Summary

### Files created

| File | Purpose |
|------|---------|
| `src/design-system/macos27/tokens.css` | macOS 27 semantic tokens + Canary variable bridge |
| `src/design-system/macos27/primitives.css` | Button, menu, shell, card overrides |
| `src/design-system/macos27/index.css` | Import barrel |
| `src/components/macos27/MacButton.tsx` | Pilot button primitive |
| `.planning/macos27-ui-migration.md` | This document |

### Files modified

| File | Change |
|------|--------|
| `src/components/canary/canary.css` | `@import` macos27 design system |
| `src/components/canary/CanaryApp.tsx` | `data-ui="macos27"` on shell; `MacButton` for mobile menu |

### Not committed (per instructions)

Changes are local only. User must request commit.

---

## 5. Decisions Needed from User

### Fonts
- **Option A (recommended):** System font stack — best on macOS/iOS, no licensing, good enough elsewhere
- **Option B:** Host SF Pro files from Sketch embed (2 fonts in kit + 70 references) — **Apple license may prohibit web redistribution**
- **Option C:** Keep Instrument Sans as deliberate brand departure from Apple look

### Color fidelity
- Phase 1 uses extracted vibrant swatches + standard system blue
- Canary brand green (`--accent: #2f6b52`) is **replaced** by system blue in macOS mode — confirm if brand accent should persist

### Dark mode
- Both modes implemented in tokens
- macOS "Auto" (follow system) not wired — currently manual toggle in profile menu

### Scope of macOS mode
- Phase 1 enables macOS skin **only on Canary shell** (`/app`)
- Manager (`/dashboard`, `/properties`) still uses Geist + shadcn neutral theme
- Confirm: macOS everywhere vs Canary-only vs user preference toggle

### Vibrancy fallbacks
- `backdrop-filter` unsupported on some browsers — accept semi-solid fallback or add `@supports` solid fallback rules?

### Business accent
- Property status colors (green lease, amber expiring, etc.) use Canary semantic colors
- macOS system colors mapped but timeline dots may need explicit review

---

## 6. Blockers & Risks

| Risk | Mitigation |
|------|------------|
| SF Pro licensing | Use system font stack; don't bundle OTFs |
| 2100-line `canary.css` specificity wars | Scope all macOS rules under `[data-ui='macos27']` |
| Portaled menus lose parent font | Already solved via `:root { --font-instrument-sans }` — add `--mac-font-ui` to `:root` in Phase 2 |
| Sketch gradients ≠ CSS | Approximate with linear-gradient; refine visually |
| Mobile web ≠ macOS native | Accept "macOS-inspired" on phones; don't replicate menu bar/dock |

---

## 7. Next Steps for Parent Agent

1. **User review** — Open Canary `/app`, validate profile menu + shell appearance
2. **Decide fonts + brand accent** (Section 5)
3. **Execute Phase 2** — `MacInput`, search field, typography in layout
4. **Optional** — Add `data-ui` toggle in settings to A/B old vs macOS skin during rollout
5. **Do not commit** until user approves visual direction

---

*Generated: Phase 1 investigation — macOS 27 UI Kit integration*
