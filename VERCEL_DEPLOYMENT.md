# Vercel Deployment Setup for Cloudinary

## Environment Variables to Add in Vercel

Go to your Vercel project dashboard and add these environment variables:

### Settings → Environment Variables

Add the following variables for **Production**, **Preview**, and **Development** environments:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dqqqiguao
NEXT_PUBLIC_CLOUDINARY_API_KEY=639758818134344
CLOUDINARY_API_SECRET=oHW_ySS8KsO1pCGJt2i3ccDltzc
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=needyou_unsigned
```

## Steps to Add Environment Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`needyou`)
3. Go to **Settings** → **Environment Variables**
4. For each variable:
   - **Key**: Variable name (e.g., `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`)
   - **Value**: Variable value (e.g., `dqqqiguao`)
   - **Environments**: Select all (Production, Preview, Development)
   - Click **Save**

## Important Notes

- **NEXT_PUBLIC_** prefix: These variables are exposed to the browser (needed for client-side uploads)
- **CLOUDINARY_API_SECRET**: This is server-side only (no NEXT_PUBLIC_ prefix)
- After adding variables, **redeploy** your app for changes to take effect

## Redeploy After Adding Variables

Option 1: **Automatic** - Push a new commit to trigger deployment
Option 2: **Manual** - Go to Deployments → Click "..." → Redeploy

## Verify Deployment

After redeployment, test job creation:
1. Go to your production URL
2. Navigate to dashboard → Create Job
3. Upload a photo/video
4. If upload works, Cloudinary is configured correctly ✓

## Troubleshooting

If uploads fail:
- Check browser console for errors
- Verify all 4 environment variables are set in Vercel
- Ensure upload preset `needyou_unsigned` exists in Cloudinary
- Check that preset is set to "Unsigned" mode
