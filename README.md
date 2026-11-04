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
