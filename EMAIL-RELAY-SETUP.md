# Feng Cha two-store email migration — Review

Prepared 2026-10-19. Owner authorized configuration, deployment and two labelled email-only tests in this chat. Local checks passed; production delivery has NOT been restored or deployed.

A standalone project is saved under the business Google account: [Feng Cha Ops Report Relay](https://script.google.com/home/projects/10ZVv7d-xnLLz8nkisE2mxw5_XCKmnEma6FHv3a8WU8rzBnZPxqvdJWe9/edit). The owner completed Google's mail authorization. Version 2 was deployed on 2026-10-19 at 6:05 PM Chicago time. The shared token is not configured yet, so requests are rejected until configuration is complete.

Vercel login is complete and the correct `fengcha-ops` project/production environment was verified. Both environment-variable rows are prepared in the UI; the relay URL is filled, the shared token value is blank. Google Script Properties has the `REPORT_RELAY_TOKEN` name prepared with an empty value. The owner has been asked to enter the same newly generated credential in both providers and save; no credential has been created, read, logged or written to a local file by this implementation. Browser rules require the human to enter new authentication credentials. App deployment and the two mail-only tests remain pending.

Relay endpoint (not a credential; requests require the private token): `https://script.google.com/macros/s/AKfycbyOvgyCRmSaVfCFMzg6LpbDCOH2jVN1p_OnIqt60QAlixf46foVUlU1cYNptu-FLsaU/exec`.

## Result

- Heights and Spring Branch each have separate employee/store/mode drafts and pending reports.
- Successful inventory writes clear the draft and queue an immutable email report locally.
- Mail failures explicitly say inventory was saved. Retry sends queued mail only, without writing inventory again.
- Daily, bi-weekly and closing checklist reports use the same server mail endpoint.
- Closing checklist report log is written after mail success instead of before it.
- Google Sheet sync starts independently of email and remains explicitly unconfirmed (its existing no-CORS integration cannot verify writes).
- No production data/schema changes are required. Existing inventory data is preserved.

## Owner authorization boundary

The project Operating Constitution requires explicit confirmation for deployments and account/security changes. Next actions require permission to enable a Google Apps Script mail relay under `fengchaspringbranch@gmail.com`, grant its send-mail scope, configure protected server environment values, deploy the two-store app, and send two labelled test reports to that same inbox. Do not submit fabricated inventory to production for email verification.

## Exact setup

1. In the business Google account create a standalone Apps Script project named `Feng Cha Ops Report Relay`. Paste `google-gmail-report-relay.gs` into its editor. This is separate from the existing inventory Sheet sync script.
2. Configure project timezone `America/Chicago`. Use only the `https://www.googleapis.com/auth/script.send_mail` OAuth scope. MailApp sends mail without reading the inbox. Authorize as the business account.
3. Generate a fresh random shared token using a password manager. Store it only in Apps Script Project Settings → Script Properties as `REPORT_RELAY_TOKEN` and in Vercel protected environment settings as `GMAIL_REPORT_RELAY_TOKEN`. Never put its value in a repo, local env file, chat, screenshot or vault. Rotate through the two provider settings if exposed.
4. Deploy the script as a Web App: execute as the owner, accessible to Anyone. The relay checks the shared token before sending; its fixed recipient is `fengchaspringbranch@gmail.com`. Set its `/exec` deployment URL in Vercel as `GMAIL_REPORT_RELAY_URL`.
5. Deploy the app with the new `api/send-report.js` endpoint. A deployment before relay configuration safely returns an explicit email-setup error while inventory saving continues. Prefer configuring first.
6. Send one clearly labelled email-only test for Heights and one for Spring Branch via the deployed endpoint; confirm arrival in the business inbox. No inventory POST is needed. Verify two distinct store subject prefixes.
7. Re-send the same test ID and body once; expect `duplicate:true` and no additional email. Confirm same-origin requests work in the production phone PWA after reload.

The server fixes the recipient, limits report size and validates the request origin/store. The relay serializes sends, checks daily quota, retains deduplication receipts for 35 days and caps each store at 20 new reports per Chicago day. This app retains its existing employee-name/PIN access model; origin checks are not user authentication. A crash after Google accepts a message but before saving its receipt can still cause a duplicate on retry. Success confirms Google accepted the send, not inbox delivery; final live verification checks the inbox.

## Local acceptance evidence

Run from this directory: `node --test tests/inventory.test.cjs`.

Nine regression checks cover store/mode/employee isolation, reload persistence, single-flight submit, queued email retry, save failure, nonnegative input, switching stores during a request, relay origin/input/config validation, two-store send labels, token validation, duplicate suppression and relay error handling.

Browser acceptance used mock data only at 390×844 and 1280×900. The simulated mail failure followed by retry produced exactly **1 inventory write and 2 email attempts**. Store switching did not carry the other store's draft. Refresh restored the selected store's draft. No console errors appeared in desktop acceptance.

Screenshots: `/tmp/fengcha-mail-pending-mobile.jpg` and `/tmp/fengcha-desktop-preview.jpg` (temporary local evidence).

## Operational limits and rollback

Pending reports and drafts are local to the employee, browser and device. Clearing browser storage removes unsent reports; do not clear it while mail is pending. Previously failed EmailJS reports are not automatically backfilled by this change. Gmail still has provider sending limits; quota failures remain queued. Inventory network failures preserve the draft but can have an ambiguous write outcome; manager confirmation is required before retrying.

Rollback the source revision and redeploy only with owner approval. Do not delete any inventory records. A rollback to EmailJS will not restore its exhausted quota. Keep relay credentials private and retain pending reports until confirmed sent.

References: [Google MailApp](https://developers.google.com/apps-script/reference/mail/mail-app), [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js).
