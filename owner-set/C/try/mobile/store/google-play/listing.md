# Google Play listing: Shareholder Desk

Everything to enter in Play Console for the first release. Graphics are in this folder.

## Store listing

| Field | Value |
|---|---|
| App name (30 max) | Shareholder Desk |
| Short description (80 max) | Your investments, distributions and documents from the firm you invested with. |
| Category | Finance |
| Tags | Investing, Finance |
| App icon | `icon-512.png` (512 × 512) |
| Feature graphic | `feature-graphic.png` (1024 × 500) |
| Phone screenshots | `screenshots/1-sign-in.png` to `6-investments-dark.png` (1080 × 1920) |
| Contact email | An investor support address you monitor (required, shown publicly) |
| Privacy policy | A public URL (required) |

The screenshots come from the app's preview build and show a sample firm, Kestrel Bay Capital, which is fictional. Replace them with captures from a real Android phone before launch if you prefer.

### Full description (4,000 max)

```
Shareholder Desk gives investors a private view of the investments they hold with their investment firm or private placement sponsor.

Sign in with the login your firm sent you and the app opens directly to your firm's account, in your firm's branding.

• Investments: what you invested, distributions received, the date you invested and the time remaining to redemption, for each investment
• Distributions: every payment, with the next scheduled distribution date for each investment
• Documents: quarterly reports, tax documents, statements and agreements, available as soon as your firm posts them
• Account: your contact details, distribution bank account (masked) and tax and accreditation status, plus a direct line to your firm's investor relations team
• Security: two-step verification at sign-in, and optional fingerprint or face unlock
• Light and dark appearance

Shareholder Desk is for investors whose firm offers it. Your firm sends you an invitation to activate your account; there is no sign-up in the app. For help with your login, contact the firm you invested with.
```

## App content

| Section | Answer |
|---|---|
| App access | All functionality requires a login. Give reviewers a working test login and its fixed verification code. In this preview build: `jordan.davis@example.com`, any password, code `482913`. Production needs a real reviewer account whose 6-digit code doesn't change. |
| Ads | No ads |
| Content rating | Complete the questionnaire as a finance or reference app with no user-generated content, no violence, no gambling. Expected rating: Everyone / PEGI 3. |
| Target audience | 18 and over only |
| News app | No |
| Government app | No |
| Financial features | Complete the declaration. The app displays investment account information; it does not trade securities, lend, or move money. Confirm with counsel which options fit your firms' offerings. |
| Health | No |

### Data safety (draft, confirm against the production server)

| Question | Answer |
|---|---|
| Does the app collect or share user data? | Yes, collects. No sharing with third parties. |
| Encrypted in transit | Yes (HTTPS only) |
| Users can request deletion | Yes. Settings has "Request account deletion". Also publish a web page where investors can request it, and give that URL. |
| Personal info: name, email address, phone number, address | Collected; required; purpose: app functionality and account management |
| Financial info: other financial info (investment holdings, distributions, bank account last four) | Collected; required; purpose: app functionality |
| App activity, location, contacts, photos, device IDs | Not collected |

"Collected" here means the data is sent between the phone and your server. If you add crash reporting or analytics later, update this form.

## Release checklist

1. Create a Google Play developer account ($25, one time). Choose **Organization** and register it under the neutral publishing entity. The developer name and contact details appear on the listing, so investors would see "Carrow & Vale" if the account carries that name. Organization accounts need a D-U-N-S number.
   - A new **personal** account must first run a closed test with at least 12 testers for 14 days before it can publish to production. Organization accounts skip this.
2. Create the app in Play Console: name Shareholder Desk, App, Free.
3. Build the release bundle: `npx eas-cli@latest build --profile production --platform android`. EAS creates the upload key on the first build; Google Play App Signing holds the app signing key.
4. Upload that first `.aab` by hand in Play Console (Testing, then Internal testing). Google's API can't create the first release, so `eas submit` works only after this.
5. Fill in the store listing and App content sections above.
6. Promote from internal testing to production and send for review.
7. For later releases: create a Google Cloud service account with access to the Play Console account, save its JSON key as `mobile/google-play-service-account.json` (git ignores it), then run `npx eas-cli@latest submit --platform android`.
