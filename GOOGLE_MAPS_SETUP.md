# Google Maps API Setup

To enable location detection in the onboarding flow, you need to set up a Google Maps API key.

## Steps:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create or Select a Project**
   - Create a new project or select your existing project

3. **Enable APIs**
   - Go to "APIs & Services" > "Library"
   - Search for and enable:
     - **Geocoding API**
     - **Maps JavaScript API** (optional, for future map features)

4. **Create API Key**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

5. **Restrict API Key (Recommended)**
   - Click on your API key to edit
   - Under "Application restrictions":
     - For development: Select "HTTP referrers"
     - Add: `localhost:3000/*` and `127.0.0.1:3000/*`
     - For production: Add your domain
   - Under "API restrictions":
     - Select "Restrict key"
     - Choose "Geocoding API"
   - Save

6. **Add to Environment Variables**
   - Create or edit `frontend/.env.local` file
   - Add the following line:
     ```
     NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
     ```
   - Replace `your_api_key_here` with your actual API key

7. **Restart Development Server**
   - Stop the current dev server (Ctrl+C)
   - Run `npm run dev` again

## Testing:

1. Sign up for a new account
2. Complete email and phone verification
3. Sign in - you should be redirected to the education page
4. Fill in education and employment details
5. On the location page, try both:
   - Auto-detect (requires browser location permission)
   - Manual entry

## Notes:

- The Geocoding API has a free tier with generous limits
- For production, consider setting up billing alerts
- Keep your API key secure and never commit it to version control
