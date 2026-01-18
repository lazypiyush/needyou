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

Make sure these are also set (copy from your `.env.local`):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
NEXT_PUBLIC_GEMINI_API_KEY_CATEGORY=your_gemini_key
```

**Note:** Replace all placeholder values with your actual credentials from `.env.local`

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
