# Cloudinary Setup Instructions

## Environment Variables

Add these to your `.env.local` file:

```env
# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dqqqiguao
NEXT_PUBLIC_CLOUDINARY_API_KEY=639758818134344
CLOUDINARY_API_SECRET=oHW_ySS8KsO1pCGJt2i3ccDltzc
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=needyou_unsigned
```

## Create Upload Preset

1. Go to [Cloudinary Dashboard](https://console.cloudinary.com/)
2. Navigate to **Settings** → **Upload** → **Upload presets**
3. Click **Add upload preset**
4. Configure:
   - **Preset name**: `needyou_unsigned`
   - **Signing mode**: **Unsigned**
   - **Folder**: `needyou/jobs`
   - **Resource type**: Auto
   - **Format**: Auto
   - **Max file size**: 
     - Images: 10 MB
     - Videos: 50 MB
5. Click **Save**

## Testing

Once the upload preset is created, the job creation system will be able to upload photos and videos directly from the browser.
