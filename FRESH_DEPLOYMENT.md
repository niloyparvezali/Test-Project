# TurfClub Fresh Spark + Vercel Deployment

This package is prepared for a brand-new Firebase project using the Firebase Spark plan and Vercel for frontend hosting.

## Firebase services used
- Authentication: Email/Password
- Firestore: bookings, slot locks, payments, expenses, settings, turf, pricing, gallery

## Intentionally not used
- Cloud Functions (requires Blaze)
- Firebase Storage (requires Blaze for new Storage usage)
- Firebase Hosting (Vercel hosts the Vite app)

## Environment variables
Set these in Vercel:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_TURF_TIMEZONE=Asia/Dhaka

## Admin bootstrap
1. Create an Email/Password user in Firebase Authentication.
2. Copy that user's UID.
3. In Firestore, create `users/{UID}` with `role: "admin"`.
4. Sign in at `/admin`.

Gallery images are managed as public image URLs because Firebase Storage is not enabled on Spark.
