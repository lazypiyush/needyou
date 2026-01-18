# Vercel Deployment Guide - Firebase Admin Setup

## Environment Variables for Vercel

Add these environment variables in your Vercel project settings:

### 1. Go to Vercel Dashboard
- Navigate to your project
- Go to **Settings** → **Environment Variables**

### 2. Add Firebase Admin Credentials

Open your `serviceAccountKey.json` file and extract these values:

```env
FIREBASE_PROJECT_ID=needyou-b8e00
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@needyou-b8e00.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

**Important for `FIREBASE_PRIVATE_KEY`:**
- Copy the entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Keep the `\n` characters (they represent line breaks)
- Wrap the entire value in quotes

### 3. Add Resend API Key

```env
RESEND_API_KEY=re_9uM6CyYj_38ohb1jK3rSvncy196GL47hV
```

### 4. Existing Environment Variables

Make sure these are also set (already in your `.env.local`):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCXF5NY_IDC0goqMCfCZKgikAXOLN3VLRE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=needyou-b8e00.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=needyou-b8e00
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=needyou-b8e00.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=11557689616
NEXT_PUBLIC_FIREBASE_APP_ID=1:11557689616:web:030a968fc6e2d18f122d95
NEXT_PUBLIC_API_URL=https://need-you.xyz
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCSnY9wlZLsWox9EFpbOeGVj5myh96TfzE
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dqqqiguao
NEXT_PUBLIC_CLOUDINARY_API_KEY=639758818134344
CLOUDINARY_API_SECRET=oHW_ySS8KsO1pCGJt2i3ccDltzc
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=needyou_unsigned
NEXT_PUBLIC_GEMINI_API_KEY_CATEGORY=AIzaSyC71AfzIbSuZnVIQFJoXQS6KhT1d0I9D88
```

## How It Works

- **Local Development**: Uses `serviceAccountKey.json` file
- **Production (Vercel)**: Uses environment variables

The code automatically detects which environment it's running in and uses the appropriate credentials.

## Deployment Checklist

- [ ] Add all environment variables to Vercel
- [ ] Verify domain in Resend dashboard
- [ ] Deploy to Vercel
- [ ] Test email verification
- [ ] Test password reset
- [ ] Monitor Resend dashboard for delivery metrics

## Security Notes

✅ `serviceAccountKey.json` is in `.gitignore` (never committed)  
✅ Environment variables are encrypted in Vercel  
✅ Private keys are only accessible to your deployment
