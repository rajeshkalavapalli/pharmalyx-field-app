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
