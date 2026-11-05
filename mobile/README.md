# Shareholder Desk (iOS app)

The investor app for Carrow & Vale clients. Investors sign in with the email address their investment firm has on file and see that firm's branding, never Carrow & Vale's. One app serves every client: the email decides which firm's account opens, and an investor who holds investments with several firms chooses one (and can switch in Settings).

Built with Expo (React Native), so it compiles to a native iOS app. It shares its data and brand logic with the web portal: `src/core` is a copy of `../assets/js/{brand,tenants,data,nacha}.js`, so every figure (amounts invested, distributions, time to redemption, next distribution dates) matches the portal exactly.

## What investors can do

| Tab | Contents |
|---|---|
| Investments | Notices from the firm, totals, current investments (invested, distributions received, date invested, time to redemption), completed investments, and each investment's last and next distribution |
| Investment (detail) | Figures, time to redemption with the holding-period bar, key terms, latest update, every distribution, and that investment's documents |
| Distributions | Totals, payment history filterable by year |
| Documents | Reports, tax documents, statements and agreements, filterable by type; opens a document's cover on the firm's letterhead |
| Account | Investor details, distribution bank account (masked), tax form and accreditation, call or email investor relations |
| Settings | Light, dark or match device; Face ID unlock; switch between firms; sign out; request account deletion |

Sign-in is email, then password, then a 6-digit authenticator code. With Face ID on, the app locks on launch and after five minutes in the background. The session is stored in the iOS Keychain.

## Run it

```sh
npm install
npm start          # then press i for the iOS simulator (needs a Mac with Xcode), or scan the QR code
npm run web        # quick preview in a browser
npm run typecheck
```

Face ID and the Keychain need a development build rather than Expo Go:

```sh
npx expo run:ios                       # on a Mac with Xcode
npx eas-cli@latest build --profile preview --platform ios   # or build in the cloud
```

Sample login: `jordan.davis@example.com`, any password, code `482913`. That investor holds accounts with all three sample firms, so the account chooser appears.

## Publish to the App Store

1. Join the Apple Developer Program for the publishing entity ($99 per year).
2. Change `ios.bundleIdentifier` in `app.json` (currently `com.shareholderdesk.app`) to one under a domain you control.
3. Build and submit:

   ```sh
   npx eas-cli@latest build --profile production --platform ios
   npx eas-cli@latest submit --platform ios
   ```

4. In App Store Connect, complete the listing (name **Shareholder Desk**, subtitle such as "Your investments and statements", Finance category), the privacy details (contact info, financial info; data linked to the user; no tracking), and a privacy policy URL.
5. Give App Review a working demo login and the 6-digit code, since every screen is behind sign-in.

Things App Review checks for an app like this:

- **Account deletion.** Apps that let people create an account must let them start deletion inside the app (Settings has "Request account deletion"; connect it to a real request in production).
- **Seller name.** The App Store shows the developer account's name under the app. If investors should never see Carrow & Vale, publish from an account under a neutral entity name.
- **Login-only apps** are accepted when they serve existing customers, as this one does.

## Before production

- Replace the sample data in `src/lib/session.tsx` (`workspaces`, `lookup`) with calls to the portal API: look up the email, verify password and code on the server, and return the investor's accounts and records.
- Open real PDFs in Documents (download from the API, preview with the iOS share sheet).
- Send push notifications when a notice is posted (`expo-notifications` plus your server).
- Keep `src/core` in sync with the web portal: `npm run sync-core` after changing `../assets/js`.

## Files

```
app.json                  app name, bundle ID, icon, Face ID permission text
eas.json                  cloud build profiles (preview, production)
scripts/sync-core.js      copies the shared core from the web portal
src/core/                 shared core (generated) and its loader
src/lib/session.tsx       sign-in, accounts, Face ID lock, appearance, brand colors
src/lib/format.ts         money, dates, time to redemption
src/lib/storage.ts        Keychain storage (browser storage in web preview)
src/components/           logo lockups, icons, shared UI
src/app/                  screens (Expo Router): sign-in, tabs, investment and document detail
assets/                   app icon, splash and favicon
```
