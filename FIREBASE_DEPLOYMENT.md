# Firebase Functions Deployment

This project deploys the callable Functions from `functions/` to Firebase project `test-project-8b8a5`.
All Functions, including `acceptBooking`, use the `us-central1` region in `functions/index.js`.

## Login and project selection

```powershell
firebase login
firebase use test-project-8b8a5
firebase use
```

The repository also stores this selection in `.firebaserc`. The frontend project ID in `.env` must remain `test-project-8b8a5`.

## Install and deploy Functions

```powershell
npm install
Push-Location functions
npm install
Pop-Location
firebase deploy --project test-project-8b8a5 --only functions
```

This deploys only the Functions configuration. Firestore rules and indexes are deployed separately:

```powershell
firebase deploy --project test-project-8b8a5 --only firestore
```

## Verify `acceptBooking`

After deployment, list Functions in the target project:

```powershell
firebase functions:list --project test-project-8b8a5
```

Verify that `acceptBooking` is listed in region `us-central1`. Its callable endpoint is:

```text
https://us-central1-test-project-8b8a5.cloudfunctions.net/acceptBooking
```

The frontend must continue to call it with `httpsCallable(functions, 'acceptBooking')`; do not convert it to an HTTP `onRequest` endpoint.

## Inspect deployment failures

```powershell
firebase functions:log --project test-project-8b8a5 --only acceptBooking
```

For deployment diagnostics, rerun with debug output:

```powershell
firebase deploy --project test-project-8b8a5 --only functions --debug
```
