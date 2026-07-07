# TameerBook Project Status Report

> A report of what has already been built, so an assistant (ChatGPT) can give
> better guidance on what to do next.

## 1. What the app is

**TameerBook** is an **offline mobile app for Pakistani property/construction
investors and small builders**. It tracks money (kharcha/aamdani), property
deals, construction progress, investors, and profit settlement all in plain
Urdu/English words, designed for non-technical, low-literacy users on cheap
Android phones.

## 2. Tech stack

- **Framework:** React Native via **Expo SDK 54** (TypeScript)
- **Navigation:** React Navigation (bottom material-top-tabs + native stack)
- **State:** Zustand (4 stores)
- **Local database:** **expo-sqlite** (fully offline, no server/cloud)
- **UI:** custom themed design system, Inter font, Lucide icons, linear-gradient,
  SVG, reanimated, gesture-handler
- **Features libs:** expo-image-picker (receipts/photos), expo-image-manipulator,
  expo-print + expo-sharing (PDF reports), expo-notifications (reminders),
  expo-file-system
- **i18n:** bilingual **English + Urdu** (327 strings each)

## 3. Architecture (how it is structured)

```
src/
  db/            SQLite layer  schema, migrations, 20+ repositories
  stores/        Zustand state (entry, ledger, projects, settings)
  screens/       25 screens
  navigation/    Root stack + custom tab bar with center "+" FAB
  components/    Reusable UI design system (AppButton, AppCard, etc.)
  theme/         Single source of truth for colors/spacing/dark mode
  i18n/          English + Urdu translations
  utils/         money formatting, dates, stage rules, PDF export, photos
  notifications/ Local reminder scheduling
```

## 4. Database DONE (this is the strongest part)

A complete, versioned, **append-only ledger** data model with **6 migrations**.
Tables built:

- `projects` investment/construction projects with a stage pipeline
- `properties` + `property_payments` plot details, seller info, token/bayana/
  installment/final payments
- `transactions` append-only money in/out ledger (mistakes corrected by
  reversal, never deleted full audit trail)
- `categories` 20 pre-seeded income/expense categories (Cement, Sariya,
  Bricks, Labor Dehari, etc.) bilingual
- `parties` sellers, buyers, contractors, suppliers, dealers, labor
- `investors` + `project_investors` investor profiles and their stake per project
- `capital_ledger` append-only investor capital (initial, additional,
  withdrawal, transfer, exit, profit payout, loss)
- `milestones` 9-step construction progress template (weighted %)
- `sales` + `sale_receipts` selling the property, buyer receipts
- `documents` attached receipt/document files
- `project_stage_history` audit log of stage changes
- `app_settings` persisted preferences

**Repositories (business logic) already written** for: acquisition, analytics
(P&L, cash-flow, ROI, expense-by-category, top suppliers, investment matrix),
capital, categories, documents, investor exit, investments, investors,
milestones, parties, projects, properties, reports, sales, settlement,
transactions, udhaar (credit/payables).

## 5. Project stage pipeline

`TOKEN_PAID → BAYANA_PAID → TRANSFER → POSSESSION → CONSTRUCTION → FINISHING →
LISTED_FOR_SALE → CLOSED` (with stage-change rules and history tracking).

## 6. Screens built (25)

- **Home** dashboard
- **Projects** + **Project Detail** + **New Project Wizard**
- **Quick Entry** (the "+" FAB), **Entry**, **Material Entry**, **Dehari (labor)
  Entry**, **Investment Entry**
- **Transactions** list, **Udhaar** (credit/payables), **Supplier Ledger**
- **Investors** list + **Investor Profile**
- **Exit Wizard** (investor leaving), **Settlement** (profit split)
- **Reports** + **Report** (individual report view, PDF export)
- **Photo Diary** (construction photos)
- **Settings**, **Dev Tools**, **Coming Soon** placeholder

## 7. Other features done

- **Bilingual UI** (English/Urdu), toggled in settings
- **Dark mode** + full theming through one `theme.ts` file
- **Local notifications / reminders** (e.g. transfer deadlines)
- **PDF report generation + sharing**
- **Receipt/photo capture** with image compression
- **Pakistani money formatting** (e.g. `25,00,000`)
- **Demo/seed data** for testing
- Custom design system enforcing UX rules (56px touch targets, icon+text,
  max 5–6 fields per screen, etc.)

## 8. Summary in one line

> The **data engine and core money/project/investor/settlement tracking is
> built** full offline SQLite database, 20+ repositories, 25 screens,
> bilingual UI, dark mode, PDF reports, photos, and reminders.
