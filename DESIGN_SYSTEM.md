# AI Sentinels — Design System Reference
> Load this file at the start of any frontend session: `@DESIGN_SYSTEM.md`
> Purpose: Give Claude Code full design context so it never guesses aesthetics.

---

## Aesthetic Direction

**Tone:** Luxury/refined dark SaaS — think Linear, Vercel, or Resend.
**NOT:** Generic purple gradients, Inter everywhere, flat white dashboards.
**One thing users remember:** Dark precision. Every element has a reason. The lime accent hits like a signal.

---

## Typography

| Role | Font | Weight | Usage |
|---|---|---|---|
| Display / Headings | **Syne** | 600–800 | Page titles, sentinel names, section headers |
| Body / UI | **DM Sans** | 400–500 | Paragraphs, labels, table cells, inputs |
| Monospace | **JetBrains Mono** | 400 | Doc IDs, code, clause refs like `[ISO 9001:4.1]` |

**Scale:**
- Hero: `text-4xl` / `text-5xl`, Syne 700
- Page title: `text-2xl`, Syne 600
- Section label: `text-xs` uppercase tracking-widest, DM Sans 500, opacity-50
- Body: `text-sm` / `text-base`, DM Sans 400
- Caption / meta: `text-xs`, DM Sans 400, opacity-60

**Rules:**
- NEVER use Inter, Roboto, Arial, or system-ui
- Load Syne + DM Sans from Google Fonts
- Syne for anything the user reads as identity; DM Sans for everything functional

---

## Color Palette

```css
/* CSS Variables — add to globals.css */
:root {
  --bg-base:       #0a0f1a;   /* page background */
  --bg-surface:    #0f1729;   /* cards, panels */
  --bg-elevated:   #151f35;   /* hover states, modals */
  --border:        #1e2d4a;   /* all borders */
  --border-subtle: #162034;   /* table dividers */

  --text-primary:  #f0f4ff;   /* headings */
  --text-secondary:#8899bb;   /* labels, meta */
  --text-muted:    #4a5a78;   /* placeholders */

  --accent:        #c2fa69;   /* PRIMARY ACCENT — lime */
  --accent-dim:    #9bc84e;   /* hover state of accent */
  --accent-bg:     rgba(194,250,105,0.08); /* subtle accent fill */

  /* Sentinel Colors */
  --qualy:   #3B82F6;  /* ISO 9001 — blue */
  --envi:    #22C55E;  /* ISO 14001 — green */
  --saffy:   #F59E0B;  /* ISO 45001 — amber */
  --doki:    #6366F1;  /* Document Studio — indigo */
  --audie:   #F43F5E;  /* Audit Room — rose */
  --nexus:   #8B5CF6;  /* CAPA Engine — purple */
}
```

**Accent usage rules:**
- `#c2fa69` is the ONLY accent color — never add teal, blue, or orange CTAs
- Primary buttons: `bg-[#c2fa69] text-[#0a0f1a]` — always dark text on lime
- Active nav items: left border `border-l-2 border-[#c2fa69]`
- Focus rings: `ring-[#c2fa69]/40`
- Sentinel colors appear ONLY as pills, badges, shield icons — never as backgrounds

---

## Component Patterns

### Sidebar Navigation
```
Width: 220px, fixed left
Background: var(--bg-surface)
Border-right: 1px solid var(--border)

Section headers: text-xs uppercase tracking-widest text-muted, px-4 py-2
Nav items: flex items-center gap-3, px-4 py-2.5, rounded-md mx-2
  Default: text-secondary hover:text-primary hover:bg-elevated
  Active: text-primary bg-accent-bg border-l-2 border-[#c2fa69]
  Locked: opacity-40, cursor-not-allowed, lock icon right

Sentinel dot: 6px circle, sentinel color, absolute right-3
```

### SentinelPageHero (top of every module page)
```
Height: ~80px, border-bottom: 1px solid var(--border)
Left: Sentinel SVG shield (32px) + page title (Syne 600 text-2xl) + subtitle (DM Sans text-sm text-secondary)
Right: Status pill ("● Online" in sentinel color) + AI Credits remaining
Background: subtle gradient from sentinel color at 4% opacity
```

### Cards / Panels
```
bg: var(--bg-surface)
border: 1px solid var(--border)
border-radius: 8px
padding: 24px
No box shadows on dark — use border only
Hover: border-color transitions to var(--border) + 20% lighter
```

### Tables
```
Header row: bg-elevated, text-xs uppercase tracking-wide text-muted
Body rows: border-b border-subtle, hover:bg-elevated/50
Cell padding: px-4 py-3
No zebra stripes
```

### Badges / Pills
```
Status:
  draft:             bg-slate-800 text-slate-400
  pending_approval:  bg-amber-900/40 text-amber-400 border border-amber-800
  approved:          bg-[#c2fa69]/10 text-[#c2fa69] border border-[#c2fa69]/30

Standard pills:
  ISO 9001:  bg-blue-900/30 text-blue-400   border border-blue-800
  ISO 14001: bg-green-900/30 text-green-400 border border-green-800
  ISO 45001: bg-amber-900/30 text-amber-400 border border-amber-800

Size: text-xs px-2 py-0.5 rounded-full font-medium
```

### Buttons
```
Primary:   bg-[#c2fa69] text-[#0a0f1a] font-semibold px-4 py-2 rounded-md hover:bg-[#9bc84e]
Secondary: border border-[var(--border)] text-secondary hover:text-primary hover:border-[var(--border-subtle)+20%] px-4 py-2 rounded-md
Ghost:     text-secondary hover:text-primary hover:bg-elevated px-3 py-1.5 rounded
Danger:    border border-red-800 text-red-400 hover:bg-red-900/20
```

### Section Labels (Sadewa pattern)
```
/ SECTION NAME
text-xs uppercase tracking-[0.15em] text-muted DM Sans 500
Left: "/" character in accent color
Used above every content section as a divider
```

---

## Sentinel Shield Icons

**Rule: SVG shields only. No character images, no emoji, no avatars.**

Each sentinel = colored SVG shield with letter initial, 32px default size.

```tsx
// ShieldIcon component pattern
<svg viewBox="0 0 32 32" width={size} height={size}>
  <path d="M16 2 L28 7 L28 18 C28 24 22 29 16 31 C10 29 4 24 4 18 L4 7 Z"
    fill={color}
    fillOpacity={0.15}
    stroke={color}
    strokeWidth={1.5}
  />
  <text x="16" y="21" textAnchor="middle"
    fill={color} fontSize="13" fontFamily="Syne" fontWeight="700">
    {initial}
  </text>
</svg>
```

Sentinels: Q(#3B82F6) E(#22C55E) S(#F59E0B) D(#6366F1) A(#F43F5E) N(#8B5CF6)

---

## Document Studio — Specific Layout

### Library Page
```
Full page: bg-base
Hero: Doki shield + "Document Studio" + subtitle + Online status
Toolbar: search | type filter | standard filter | [+ New Document] (primary btn)
Table: standard dark table pattern (see above)
Empty state: centered, Doki shield large, text, CTA button
```

### Editor Page (two-column)
```
Left panel (30%, min-w-[280px]):
  bg-surface, border-right: 1px solid var(--border)
  Header: Doki shield + "Doki AI" + active standard indicator (colored dot)
  Chat area: flex-1, overflow-y-auto, px-4 py-3
  Input: fixed bottom, textarea + [Ask Doki] button (#c2fa69)
  AI responses: bg-elevated rounded-lg px-3 py-2 text-sm
  "Insert at cursor": text-xs text-[#c2fa69] underline cursor-pointer

Right panel (70%):
  bg-base, overflow-y-auto
  Document header (sticky top): editable title | type selector | standard toggles | status badge
  Ribbon toolbar: bg-surface border-b border-[var(--border)], icon buttons grouped with dividers
  A4 Canvas: bg-white text-gray-900, mx-auto, width 794px, min-h-[1123px], p-16, shadow-2xl my-8
    Font inside canvas: DM Sans body, Syne headings — these are LIGHT mode inside the white A4
  Status bar: fixed bottom, bg-surface border-t border-[var(--border)], text-xs text-muted
    Left: word count | Right: "Saved ✓" or "Saving..."

Right gutter (collapsible, 200px):
  "CLAUSE REFERENCES" section label
  Standard pills: clickable, insert [ISO 9001:X.X] at cursor
  Timeline: Created / Updated dates
```

---

## Animation Rules

- Page transitions: `opacity-0 → opacity-100`, duration 150ms
- Panel slide-in (Co-Pilot, sidebars): `translateX(-100%) → translateX(0)`, 200ms ease-out
- Toast notifications: slide up from bottom-right, auto-dismiss 3s
- Skeleton loaders: use `animate-pulse` with bg-elevated
- NO bouncing, NO spinning loaders beyond initial page load
- Hover transitions: `transition-colors duration-150` on all interactive elements

---

## What NOT to Do

- ❌ White page backgrounds anywhere in the app
- ❌ Inter, Roboto, Arial, system-ui
- ❌ Purple gradients or blue CTAs
- ❌ Solid color fills on sentinel cards (tints only, 10–15% opacity)
- ❌ Character mascots or avatar images for sentinels
- ❌ Box shadows on dark surfaces (use borders)
- ❌ More than one accent color (#c2fa69 is the only one)
- ❌ `localStorage` for any data
- ❌ Hardcoded mock data
- ❌ ISO 27001 or ISO 50001 anywhere in UI copy

---

## File Structure Convention

```
apps/web/src/
  components/
    ui/                    ← shared primitives (buttons, badges, inputs)
      sentinel-page-hero.tsx
      shield-icon.tsx
      status-badge.tsx
      standard-pill.tsx
    document-studio/       ← Doki-specific components
    audit-room/            ← Audie-specific components
    capa/                  ← Nexus-specific components
  app/(app)/
    document-studio/
      page.tsx             ← Library
      new/page.tsx         ← Redirect to create + navigate to [id]
      [id]/page.tsx        ← Editor
```

---

*Version: March 2026 | Place in repo root or reference with @DESIGN_SYSTEM.md*
