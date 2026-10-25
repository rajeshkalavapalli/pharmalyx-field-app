# Pharmalyx: web vs mobile feature audit (updated)

Updated: 24 Oct 2026, after the full build. Compared the web menu (`pharmalyx-ui/src/screen/naviagation/Navigation.js`)
with the field app (`pharmalyx-field-app/src/menu.js` + `src/screens/registry.js`). Every mobile screen uses the
same API as the web screen; no backend or web changes were made.

**Status:** Present = same as web · Partial = core flows present, some web-only parts noted · Missing = not in mobile.
Nothing below has been tested on a phone yet. It compiles, lint is clean, and every menu link opens a registered screen.

## 1. Field rep / BDE

| Feature | API | Mobile |
|---|---|---|
| Sign in, company choice, first-login password | `/app/login`, `/login/choose`, `/change-password` | Present |
| Today: consent, start day, plan, check in (unpinned warning), save visit | `/app/work/*`, `/app/visits` | Present |
| Location trail for TA | `/app/work/pings` | Partial: background needs a full build (EAS), not Expo Go |
| Visit history, follow-ups, visit detail, Explain | `/app/visits`, `/work/visits/:id/explain` | Present |
| Samples / gifts given in a visit | `/app/visits` `Items` | Missing (visit saves `Items: []`) |
| My doctors, doctor detail, call, directions | `/app/my-doctors` | Present |
| Add doctor (GPS, signboard photo or reason, duplicates) | `/app/doctor-requests/*` | Present (photo upload fixed) |
| Edit / remove doctor, fix and resend | `/doctor-requests/doctors/:id/change`, `/:id/resubmit`, `/:id/cancel` | Present |
| Doctor verification (reg no. / phone / pad-card photo) | `/app/doctor-verification/*` | Present |
| Pre-call planning | `/app/precall/*` | Present |
| Standard tour plan | `/app/stp/*` | Present |
| Tour plan | `/app/tourplan` | Present |
| Plan deviation | `/app/deviations` | Present |
| DCR | `/app/dcr/*` | Present |
| RCPA | `/app/rcpa` | Present |
| Samples / gifts stock, return | `/app/stock/*` | Present |
| Feedback | `/app/feedback` | Present |
| Doctor business | `/app/doctor-business` | Present |
| Doctor spend requests | `/app/spend/*` | Present |
| POB orders (doctor / chemist with slip + GPS) | `/app/orders/*` | Present |
| Retailers / stockists accounts | `/app/sales/*` | Present |
| Secondary sales statement | `/app/secondary/*` | Present |
| Field stock & dues: deliveries, payments, chemist ledger | `/app/ledger/*` | Present |
| Business tracker | `/app/business/*` | Present |
| TA / DA statement, hold reasons, send reason, policy | `/app/expenses/statement`, `/day-reviews/:id/reason` | Present |
| Monthly claim: other expenses, submit | `/app/expenses`, `/items`, `/submit` | Partial: day remarks are not edited on mobile |
| Attendance, leave, appraisal self-review | `/app/attendance/*`, `/app/leave`, `/app/appraisals/*` | Present |
| Dashboard | `/app/dashboard` | Present (numbers and lists; simpler charts) |
| Offline visits (save without signal) | `/app/visits` | Missing |

## 2. Manager

| Feature | API | Mobile |
|---|---|---|
| Role-based tabs and menu | `/app/me/permissions` | Present |
| Approvals inbox (inline approve / return, grant DA) | `/app/approvals` | Present |
| Team dashboard (team today, coverage) | `/app/dashboard` | Present |
| Doctor requests and verification decisions, joint visit | doctor-requests / doctor-verification | Present |
| Visit explanations | via Approvals | Present |
| TA / DA day reviews, claim review | `/expenses/day-reviews/manager`, `/expenses/reviews` | Present |
| Leave, tour plan, STP, deviation, DCR approvals | each module's endpoints | Present |
| POB follow-up / verify | `/orders?scope=team` | Present |
| Secondary statement review | `/secondary/reviews` | Present |
| Team attendance, activity | `/attendance/month`, `/app/activity` | Present |
| Reports (8) | `/app/reports/*` | Partial: tiles and lists, no charts |
| Insights, alerts | `/app/insights/*` | Partial: tiles and lists, no charts |
| Sales plan targets | `/app/plans/sales/*` | Present |
| Doctor business plan review | `/app/plans/doctors/*` | Present |

## 3. Admin / head office

| Feature | API | Mobile |
|---|---|---|
| TA / DA final decision, grant DA, day report | `/expenses/day-reviews/admin`, `/report` | Present (report viewed, printing on web) |
| Payments: approve for payment, mark paid | `/expenses/finance`, `/final-approve`, `/mark-paid` | Present |
| Rate card | `/expenses/rates` | Present |
| Duplicate doctor flags | `/app/doctor-duplicates` | Present |
| Configuration masters (divisions, territories, areas, users, doctors, chemists, stockists, products, gifts) | `/create-*`, `/update-*`, `/get-*`, `/catalogue/*` | Present |
| User mappings (areas, doctors, chemists, stockists) | `/*-mapping*` | Present |
| Roles & permissions, assign roles | `/app/roles/*` | Present |
| Data import | `/app/imports/*` | Partial: upload / check / import / undo on mobile; column matching on web |
| Verified work: boundaries, exceptions, hospitals | `/app/work/*` | Partial: lists, approve, revoke; drawing and creating on web |
| Insight rules | `/app/insights/rules` | Present |
| Business data (dispatches, returns, batches, people costs) | `/app/business/*` | Partial: dispatch / return add + void; batches, salaries, milestones set on web |
| Field ledger: holdings, deposits, schemes, exits | `/app/ledger/*` | Partial: view + confirm deposits; issuing stock, schemes, exits on web |

## 4. The brief's steps

| Step | Status |
|---|---|
| 1. Feature audit | This file |
| 2.1 Doctor verification | Done |
| 2.2 Add doctor fix | Done (cause: reading the photo with `fetch()` fails on Android; now Expo's binary upload) |
| 2.3 Edit doctor | Done |
| 2.4 Role-based access | Done (tabs + menu from the web's permission codes) |
| 3. Today screen: one count, one status area, names, progress, empty states, unpinned warning | Done |
| 3. Sync status | Partial: "updated x min ago" + trail status; no offline queue yet |
| 4. Shared design system, skeletons, pull-to-refresh, error / offline states, toasts, keyboard-safe forms | Done |
| 4. Inline validation | Partial: "Still needed …" lines and field errors on the main forms; not on every field of every form |

## 5. Still to do

1. Offline queue for visits (save without signal, sync later).
2. Samples / gifts given during a visit.
3. Charts for reports / insights / dashboard trend (currently simple bars and lists).
4. The head-office setup actions marked Partial above (if you want them on the phone too).
5. A full app build (EAS) for background location.
