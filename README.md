# Pharmalyx field app (MR / BDE)

### V 1.0.0

- Added app grids in the scrren


### V 1.0.1

- Admin → Users: editing a user (for example changing the territory) no longer fails with "UserId is required"
- Softer wording for GPS checks and review alerts
- Tour plan: unplanned Sundays show as "Sunday · holiday" and are saved as off days; the button says "Send for approval" when the company needs manager approval
- New Joint Work screen (Daily Work): ask colleagues for a day, confirm / decline, coaching feedback; Alerts and the tile badge show waiting requests
- APK builds with EAS (`npm run build:apk`) and over-the-air updates (`npm run update:preview -- --message "..."`); the API address comes from the EAS "preview" environment


### V 1.0.2

- Tour plan: "Joint work" day type for seniors with a team member picker; "Change their area" for a joint day; days a senior planned with me are shown as "With <name>" and locked
- My Day shows today's joint work; Alerts show days to replan (team member on leave) and joint days a senior planned with me


### V 1.0.3

- Phone notifications (expo-notifications): the app registers the phone after sign-in, shows notifications while open, and a tap opens the right screen (Approvals, Tour Plan, Joint Work, Leave, DCR, TA / DA); sign-out removes the phone
- New native module: app.json version 1.1.0 (new runtime), so a new APK is needed; older APKs keep their own updates
- Android push needs Firebase (FCM) set-up: google-services.json in the project and the FCM V1 key uploaded with `eas credentials`

### V 1.0.4

- Firebase (FCM) config for Android push: google-services.json (Firebase project pharmalyx-7d46a) linked in app.json `android.googleServicesFile`; it holds public identifiers only

### V 1.0.5

- New app icon: the Pharmalyx "P" (jade gradient, Fraunces), replacing the Expo template icon; Android adaptive icon, themed (monochrome) icon, splash and favicon to match
- Notification small icon: white "P" (assets/notification-icon.png) tinted jade

### V 1.0.6

- Branded splash screen (expo-splash-screen): the "P" tile on dark navy; it stays until fonts and the saved sign-in are loaded, then fades, so there is no blank screen with a spinner
- Sign-in screen: larger dark hero with the Fraunces "P" mark (same as the app icon), "Field intelligence for pharma teams", three points (GPS-verified calls, DCR fills itself, TA / DA worked out), the form card overlapping the hero, app version at the bottom
- New native module: app.json version 1.2.0 (new runtime), so a new APK is needed


### V 1.0.7

- Admin pharmacies / stockists: owner, phone, address (and area for stockists) are required, as the database needs them; doctors: qualification and clinic are required like the web form
- Country / state on doctors, pharmacies and stockists say "blank = territory's" (the server fills them in)
- JS-only change: shipped as an OTA update (npm run update:preview), no new APK


### V 1.0.8

- Samples / gifts: Issue list comes from /app/stock/recipients (direct reports, or everyone for an admin) with the designation shown; the button shows for anyone who can issue
- JS-only change: shipped as an OTA update


### V 1.0.9

- Visit screen: "Samples & gifts given" lists the samples and gifts in hand (balance > 0) with - / + steppers; what is given is saved with the visit and taken from the rep's stock (before, the phone always sent no items)
- JS-only change: shipped as an OTA update


### V 1.0.10

- Sign-in: light hero (jade mist to page background, gradients.mist) with the dark-text logo, ink title and white point icons, instead of the dark navy hero; dark status bar icons on the sign-in and change-password screens
- JS-only change: shipped as an OTA update


### V 1.0.11

- Light header cards (gradients.soft: white into jade mist, thin border, ink text) instead of dark navy on Home (welcome card), Today (DA status card) and Me (profile card)
- JS-only change: shipped as an OTA update


### V 1.0.12

- Joint Audits screen (seniors): today's audit doctors (only the auditor sees them) with check-in at the clinic and the result (Doctor met / not found / clinic not found / didn't know the rep), plus Team scores with the Field Truth Score breakdown; also under Insights > Field Truth
- Me: My Field Truth Score card (score, band, the four parts, how to raise it; learning-mode note)
- My Day: Usual time / Nearest first switch - one GPS reading orders the doctors by distance and shows how far each clinic is
- Visit: Same as last visit - fills feedback, notes and samples / gifts from the last visit to this doctor (never more than is in hand)
- JS-only change: shipped as an OTA update
- OTA updates are published for Android only (npm run update:preview adds --platform android): bundling iOS and Android together ran out of memory on the build PC, and the field team uses Android
- Nearest-first distance maths uses Math.pow


### V 1.0.13

- Chemist Check screen (Sales menu): pick the chemist, mark each product on the shelf (✓) or missing (✕) with the last check shown, optional notes
- JS-only change: shipped as an OTA update (Android)
