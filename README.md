# TurfClub — Fresh Spark + Vercel

A mobile-first React + Firebase football turf booking, administration and financial system prepared for a brand-new Firebase project on the Spark plan.

## Stack
- Vite + React
- Firebase Authentication (Email/Password)
- Cloud Firestore
- Vercel frontend hosting

## Spark-only architecture
This package intentionally does not deploy or depend on Cloud Functions, Firebase Storage, or Firebase Hosting. Public booking uses a Firestore transaction plus a deterministic slot-lock document; admin finance mutations use Firestore transactions and security rules.

## Setup
1. Create a new Firebase project.
2. Register a Firebase Web App.
3. Enable Email/Password Authentication.
4. Create Firestore in production mode.
5. Do not enable Storage or Functions when staying on Spark.
6. Copy `.env.example` to `.env` for local testing, or set the same variables in Vercel.
7. Create an admin Email/Password Auth user, copy its UID, then create `users/{uid}` in Firestore with `role: "admin"` (and optional `email`/`name`) using the Firebase console.
8. Deploy Firestore rules/indexes with the Firebase CLI.
9. Deploy the Vite app to Vercel.

## Environment variables
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_TURF_TIMEZONE=Asia/Dhaka

## First configuration
Sign in at `/admin`. Configure Turf Information, Operating Hours, and Pricing. Public booking is rejected until valid day/night prices exist.

## Gallery
Because Firebase Storage is not part of the Spark-only setup, Gallery Admin stores public `https://` image URLs in Firestore instead of uploading files.

## Financial model
- Booking value is separate from actual collected money.
- Every payment is represented as a payment record.
- Expenses are stored as expense records and reflected in the ledger.
- Net revenue = actual collections − actual expenses.
- Cancelled bookings remain auditable and their payment history is not silently deleted.
