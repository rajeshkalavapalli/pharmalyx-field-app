# Pharmalyx field app (MR / BDE)

React Native (Expo) app for field users. It uses the same Pharmalyx API as the web app; managers and
admin keep using the web app.

## What is in it

- Sign in (username / email + password), company choice, first-login password change
- My Day: one-time location consent, start my day (also checks in attendance), today's plan,
  other doctors due, today's visits with their result
- Visit: live check-in with GPS, stay timer, distance-to-clinic guidance, feedback and notes, save
- Doctors: my doctors (search, class filter, call), doctors I added and their approval, Add doctor at the
  clinic (live GPS, signboard photo or the reason there is none, duplicate warning)
- Orders: my POB orders by month, mark supplied / cancel, book a doctor or chemist order (chemist: GPS + slip photo)
- TA/DA: daily statement with status, hold reasons, running total, "send my reason", policy acceptance
- Me: attendance today (check out), this month, leave balances, apply / cancel leave, sign out
- Location trail for TA: in the background in a full app build; while the app is open in Expo Go

## Test it on your Android phone (Expo Go)

1. Phone and this PC on the **same Wi-Fi**.
2. Install **Expo Go** from the Play Store.
3. In `.env`, set `EXPO_PUBLIC_API_URL` to this PC's address and the API port
   (find the address with `ipconfig` → IPv4), e.g. `http://10.23.90.63:5000`.
4. Keep the API running (`pharmalyx-config-api`, port 5000).
5. In this folder run `npx expo start`, then scan the QR code with Expo Go.
6. If Windows asks whether Node.js may use the network, allow **Private networks** (otherwise the phone
   can't reach the API on port 5000 or the app bundle on port 8081).

Sign in as a field user (for example TestBde), start your day, and check in at a doctor.

## Full app build (background location)

Expo Go can't record location in the background. For that, build the app in Expo's cloud
(no Android Studio needed):

```
npx eas-cli@latest build --profile development --platform android
```

This needs a free Expo account. Install the APK it produces on the phone.

## Production

Point `EXPO_PUBLIC_API_URL` at the hosted **HTTPS** API before building a release.
