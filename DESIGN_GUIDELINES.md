# TameerBook — Design Guidelines

TameerBook is used by **non-technical people on low-end Android phones** —
small builders, contractors, and investors in Pakistan, many with low literacy.
Every screen must be usable by someone who has never used a "finance app" and
who reads slowly. These rules are not suggestions; they are how the app stays
usable. Apply them everywhere.

## The single source of truth

`src/theme/theme.ts` defines **every** color, font size, spacing value, radius,
shadow, and touch metric in the app. Read them through `useTheme()`.

> **Never hardcode a color, font size, spacing value, or radius in a screen or
> component.** If you're typing a hex code or a raw pixel number, stop and add
> it to `theme.ts` instead.

Components read tokens via `useTheme()`; text renders through `<AppText>`. This
is what lets one edit in `theme.ts` re-skin the whole app (including dark mode).

## Hard UX rules

1. **Minimum touch target: 56px.** Every tappable element is at least
   `theme.touch.minTarget` tall. Small touchables get `theme.touch.hitSlop`.
2. **Font size never below 14 (`sm`).** `AppText` defaults to `md` (16). Body
   text on cheap, low-DPI screens must stay large and legible.
3. **Icon + text together, always.** Never an icon alone or text alone for an
   action — low-literacy users rely on the icon, slow readers on the text.
4. **Max 5–6 fields per screen.** If a flow needs more, split it into steps.
5. **Defaults pre-filled.** Date defaults to **today**; the most common option
   is preselected. The user confirms, not configures.
6. **One primary action per screen.** A single full-width primary `AppButton`.
   Secondary actions are visually quieter (`secondary` variant).
7. **No technical or accounting jargon.** Use the user's own words —
   *Kharcha, Aamdani, Material, Dehari, Investor* — never "debit/credit",
   "transaction", "ledger entry", "balance sheet".

## Money & language

- Format money **Pakistani-style**: digit grouping like `25,00,000` with a
  human helper such as "25 Lakh" (`AmountInput`, `formatRupees`).
- **Color = direction.** Money IN uses `colors.success` (green), money OUT uses
  `colors.danger` (red). Never rely on color alone — always pair with a label
  and a `+`/`−` or in/out icon.
- All strings come from `src/i18n` (`en.ts` / `ur.ts`). Default language is
  **Roman Urdu**. The structure is RTL-ready: add an Urdu-script dictionary and
  flip `I18nManager` later — no layout rewrite required.

## Color meaning

| Token       | Meaning                                  |
| ----------- | ---------------------------------------- |
| `primary`   | Brand deep blue — headers, primary CTAs  |
| `accent`    | Orange — the "+" FAB, highlights         |
| `success`   | Green — money in (aamdani)               |
| `danger`    | Red — money out (kharcha)                |
| `gold`      | Investor / profit accents                |

## Building a screen — checklist

- [ ] Uses `AppHeader` at the top.
- [ ] Every value comes from `useTheme()` — zero hardcoded colors/sizes.
- [ ] All text via `AppText`; all strings via `t()` from `src/i18n`.
- [ ] All taps ≥ 56px; small ones use `hitSlop`.
- [ ] Exactly one primary action (full-width `AppButton`).
- [ ] ≤ 6 input fields; sensible defaults pre-filled (date = today).
- [ ] Icons accompany every label and action.
- [ ] Empty data shows a friendly `EmptyState` with a clear next action.
- [ ] Works in both light and dark by construction (tokens only).
