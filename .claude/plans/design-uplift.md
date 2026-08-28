# Design uplift — from "AI-built" to "designer-built"

Audit of the current visual system (theme.ts, src/components/ui, src/modules/*/styled)
and the concrete plan to fix it. Written 2026-07-29.

---

## 1. Why the app reads as AI-built

It is **not** because it uses cards. It's because **everything has the same visual
weight**. The current system applies one treatment — white `card` fill + `radius.card`
(22) + `shadows.card` + `spacing.lg` padding + a pastel `*Soft` icon circle — to every
single thing on screen, regardless of importance.

- `backgroundColor: theme.colors.card` appears **74 times**
- `theme.shadows.*` appears **44 times**
- the `*Soft` pastel tints appear **124 times**

A human designer decides what is loud and what is silent, and makes *almost everything*
silent so one or two things can carry the screen. An LLM decorates every element
equally, because each element was generated in isolation without a budget for attention.

Second tell: the code is **component-first** ("here is an AppCard, put content in it")
rather than **content-first** ("this is a rupee total, it must dominate; this is a
field label, it should nearly disappear"). On `HomeScreen` the section headers
(`size="lg" weight="bold"` — 18px ExtraBold, full-contrast) are visually *louder* than
several of the money values they introduce. That inversion is the giveaway.

Third tell: the missing 20% — press feedback is 14 different ad-hoc opacity values,
there are zero haptics, one skeleton in the whole app, no layout animation on
insert/remove, and icons appear at 15 different sizes. Polish is what "designed" means.

---

## 2. Specific findings

### 2.1 Card soup — no surface hierarchy
`HomeScreen` stacks **8 floating white slabs** on the cream canvas: the hero, the
accounts rail cards, the `sectionsCard` tile row, udhaar card, labor card, plots card,
each project card, the activity card. All share the same radius, fill, and shadow, so
the eye has no entry point and the cream canvas is reduced to gutters.

`CashScreen` repeats it: hero + udhaar card + N account cards + 2 preview cards +
activity card.

### 2.2 The soft shadow does not exist on the target device
`shadows.card` is `shadowRadius: 20, shadowOpacity: 0.07, elevation: 3`.
On Android, React Native honours only `shadowColor` and `elevation` for View shadows —
`shadowOffset`, `shadowOpacity`, and `shadowRadius` are iOS-only. So on the actual
target hardware (low-end Android, per DESIGN_GUIDELINES.md) the intended "ultra-soft
diffuse 20px blur at 7%" renders as a tight hard grey edge under 40+ surfaces. The
"Soft Modern" language is, on the device that matters, not soft.

### 2.3 Contrast failures — the highest-severity finding
Target audience: low-literacy users, cheap low-DPI screens, often outdoors. Measured
WCAG contrast ratios in **light mode** (the default):

| Foreground | Background | Ratio | AA (4.5) |
|---|---|---|---|
| `textSecondary` #9A958B | `card` #FFFFFF | **2.96:1** | fail |
| `textSecondary` #9A958B | `background` #FDFCF9 | **2.89:1** | fail |
| `accent` #1FA15D | white | **3.30:1** | fail |
| `danger` #D64C3C | white | **4.21:1** | fail |
| `gold` #BE9B4A | white | **2.65:1** | fail |
| `gold` on `goldSoft` #F2EBD8 | (StageBadge) | **2.23:1** | fail badly |
| `success` on `successSoft` #E4F1E8 | (StageBadge) | **2.84:1** | fail |
| `danger` on `dangerSoft` #FBE9E6 | (StageBadge) | **3.59:1** | fail |

So: **every `StageBadge` in the app is below AA**, and so is every secondary label,
every "See all", and every gold investor figure. Dark mode is fine
(`textSecondary` on `card` = 5.99:1) — the problem is light mode only.

This is ~15 lines in `theme.ts` and it is the single highest-value change in this doc.

### 2.4 Semantic collision: `accent` === `success`
`accent: '#1FA15D'` and `success: '#1FA15D'` are the **same hex**. So is
`accentSoft === successSoft === '#E4F1E8'`. (Same in dark: both `#2BB06E`.)

Consequence: green means both "money came in" and "this is tappable". A green number
is ambiguous, and the FAB — the app's primary action — is the same colour as income.
The palette has no colour left for "interactive".

### 2.5 Typography: 8 sizes, no real hierarchy
- There is **no regular weight**. `weights.regular` maps to Medium 500, semibold→700,
  bold→800. Everything is at least semi-bold, so weight carries no information.
- 8 size tokens, and the same rupee value renders at `display`/`xl`/`lg`/`md`/`sm`
  depending on which screen you're on. No consistent money ramp.
- Section headers use the second-largest size at the heaviest weight, competing with
  the data.
- `overline` (11px) is used for **tab bar labels**, violating the project's own
  "never below 14" rule — and at the `small` text-scale setting it becomes 10px.

### 2.6 The pastel icon chip is the loudest AI signature
44×44 or 48×48 rounded square/circle, filled with a 10% tint, containing a lucide icon
in the matching hue. `PlotCard`, `AccountCard`, `AppListRow`, `StatCard`, `SectionTile`,
`EntryScreen` category tiles, `QuickEntryScreen` tiles — 124 `*Soft` usages. It is the
default output of every LLM asked for a "modern dashboard card", and it's the thing a
designer would delete first.

### 2.7 Placement inconsistency
- The quick-entry FAB is **centre of the tab bar at 48px** (`TabBar.tsx`) and
  **bottom-right at 56px** (`CashScreen.tsx`). Same action, two homes, two sizes.
- `HomeScreen` has a hand-rolled header (avatar + greeting + gear); every stack screen
  uses `AppHeader`. Different heights, different alignment grid, no shared baseline.
- Icon sizes in use: 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 34, 40, 48.
- Press feedback opacity values in use: 0.35, 0.38, 0.4, 0.5, 0.55, 0.6, 0.7, 0.85, 0.9.

### 2.8 Uniform rhythm = no grouping
`content: { gap: theme.spacing.lg }` puts an identical 16px between *everything* —
between a section header and its own card, and between two unrelated sections. Grouping
is communicated by proximity; with one gap value, nothing is grouped.

### 2.9 Home tries to answer eight questions
Hero, accounts rail, 3-tile shortcut row, udhaar, labor, plots, projects, activity —
several toggleable in Settings. A screen that can be configured into a wall has no
designed default. One screen should answer one question.

### 2.10 DESIGN_GUIDELINES.md has drifted
Its colour table still says `primary` = "deep blue" and `accent` = "orange". The theme
is charcoal + emerald. The doc that is supposed to prevent drift *is* the drift.

---

## 3. The plan

### Phase 0 — `theme.ts` only. Half a day. Whole app changes, zero screen edits.

**0a. Split interactive from semantic, and add text-safe hues.**

Keep the bright values for *fills and icons*; add darker cuts for *text on light*.

```ts
// light
accent:      '#0F7A46',  // interactive: darker emerald, 4.8:1 on white
success:     '#1FA15D',  // fills / icons only
successText: '#127A45',  // 5.0:1 on white, 4.6:1 on successSoft
danger:      '#D64C3C',  // fills / icons only
dangerText:  '#B23325',  // 5.4:1 on white
gold:        '#BE9B4A',  // fills / icons only
goldText:    '#7A5F1E',  // 6.2:1 on white, 5.6:1 on goldSoft
textSecondary: '#6E6960', // 4.9:1 on white — was 2.96:1
```
Then a lint-style sweep: any `color="success"|"danger"|"gold"|"accent"` on an
`<AppText>` becomes the `*Text` variant. Icons and backgrounds keep the bright hue.

**0b. Add a real regular weight.** Add Inter/MPLUS 400 to `assets/fonts` and map
`weights.regular → 400`, `medium → 500`, `semibold → 600/700`, `bold → 800`. Now weight
is a hierarchy axis instead of a constant.

**0c. Collapse the type scale to five roles.**
```
display  34/40 bold tabular   — the one money hero per screen
title    18/24 bold           — screen + card titles
body     16/22 regular        — content
label    13/18 medium 2ndary  — field labels, section headers (uppercase+tracked)
micro    11/14 medium         — tab bar only
```
Money renders at exactly two sizes: `display` (hero) and `body` tabular (rows).

**0d. Add the missing token groups.**
```ts
icon:  { sizes: { sm: 16, md: 20, lg: 24, xl: 32 }, strokeWidth: 1.8 }
press: { opacity: 0.7, scale: 0.98 }
elevation policy: shadows.card is DELETED from the token set.
                  Only shadows.raised (sheets, tab bar) and shadows.fab survive.
surface: { flat: { backgroundColor: card, borderWidth: hairline, borderColor: border } }
```
On Android additionally set `boxShadow` (RN 0.76+ supports it on Android) for the two
remaining elevated things so they actually blur.

**0e. Rewrite DESIGN_GUIDELINES.md** to match reality plus the rules below.

### Phase 1 — the mechanical sweep (1–2 days)

1. **`Surface` replaces most `AppCard`s.** New primitive: flat fill + hairline border,
   no shadow. `AppCard` (elevated) becomes rare — allowed only for the single hero on a
   screen. Target: **≤2 elevated surfaces per screen**, currently 8 on Home.
2. **Delete the pastel icon chips.** Icon at `icon.sizes.md` in `textSecondary`, no
   container. Keep tint for *status only*, and there prefer a 6px dot + text label over
   a filled pill (which also removes the badge contrast failures).
3. **One press treatment.** A `Pressable` wrapper reading `theme.press`; remove all 14
   ad-hoc opacities.
4. **One icon scale.** Replace all 15 sizes with the 4 tokens.
5. **Two-tier rhythm.** `gap: spacing.sm` inside a group, `spacing.xxl` between groups.
   A section header sits `spacing.sm` above its content and `spacing.xxl` below the
   previous group.

### Phase 2 — rebuild two reference screens, then propagate (2–3 days)

**Home** — answers one question: *how much money do I have, and what happened?*
```
[transparent AppHeader: company ▾            gear]
  TOTAL BALANCE (label)
  Rs 25,00,000            (display)          <- the ONE elevated hero
  cash · plots · receivable  (label, one line)

  ACCOUNTS (label)                    see all
  ── edge-to-edge rail, bordered tiles, no shadow ──

  ── one flat grouped list, hairline dividers ──
  › Cash            Rs 4,20,000
  › Labor           Rs 85,000 owed
  › Material        3 open POs
  › Plots           4 held
  ──────────────────────────────────────────────

  TODAY (label)
  ruled ledger rows directly on the canvas — no card
```
Everything currently toggleable moves *behind* those destination rows. The grouped list
replaces both the 3-cell `sectionsCard` tile grid and the udhaar/labor/plots preview
cards — same information, one surface instead of five, and it scales without redesign.

**PlotDetailScreen** — same treatment: `PlotHeroCard` stays elevated (it's the hero);
`PlotSellerCard`, `PlotSaleCard`, `PlotCategoryBreakdown`, `PlotInvestorsSection`,
the ledger and the docs grid all become flat sections separated by rhythm, with
`label`-style headers.

Then propagate the pattern to Cash, Projects, Investors, Labor, Bookings.

### Phase 3 — the feel layer (1 day, disproportionate payoff)

- `expo-haptics` (not currently a dependency): `Light` on tab/FAB press,
  `Success` on save, `Error` on failure.
- `scale: 0.98` spring on card press (reanimated is already installed).
- Skeletons for every list — only `PlotCardSkeleton` exists today; everything else
  flashes blank then pops.
- `LinearTransition` on ledger/list insert & delete.
- Count-up on the hero balance when it changes.
- Fix the FAB: **one** home for quick entry (centre of the tab bar), one size. Remove
  the bottom-right duplicate in `CashScreen`.
- Give Home a real (transparent-variant) `AppHeader` so every screen shares a grid.
- Tab labels to 13px, or icon-only with the active label — either way, off 11px.

---

## 4. The four rules that keep it from drifting back

1. **≤2 elevated surfaces per screen.** Elevation means "floats above the plane":
   sheets, the tab bar, the FAB, one hero. Everything else is flat + hairline.
2. **Section headers recede, data dominates.** Headers are `label` (13 uppercase
   tracked secondary), never `title`.
3. **No decorative container.** An icon does not get a tinted box unless the box
   carries meaning. Tint is reserved for status.
4. **Colour on text always uses a `*Text` hue.** Bright hues are for fills and icons.

---

## 5. Order of work

| # | Change | Effort | Impact |
|---|---|---|---|
| 1 | Phase 0 — theme.ts contrast + accent split + type roles + tokens | 0.5 d | very high |
| 2 | Phase 1.1–1.2 — Surface primitive, delete pastel chips | 1 d | very high |
| 3 | Phase 2 — Home + PlotDetail as reference screens | 1.5 d | high |
| 4 | Phase 1.3–1.5 — press/icon/rhythm sweep | 0.5 d | medium |
| 5 | Phase 3 — haptics, skeletons, motion, FAB fix | 1 d | high (perceived) |
| 6 | Propagate to remaining screens | 2 d | medium |

Start with #1: it is confined to one file, it fixes a genuine accessibility defect for
users reading in sunlight on cheap screens, and it re-skins every screen at once.
