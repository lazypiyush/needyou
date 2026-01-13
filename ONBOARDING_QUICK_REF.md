# Quick Reference: First-Time Onboarding

## What Was Built

✅ **Education & Employment Form** - Collects user's education and work details  
✅ **Location Detection** - Auto-detect or manual entry with Google Maps  
✅ **Address Input** - Full address collection  
✅ **Smart Redirects** - Automatically shows missing forms  
✅ **Error Handling** - Graceful fallbacks for all scenarios  

## Setup (Required)

1. **Get Google Maps API Key:**
   - See detailed instructions in `GOOGLE_MAPS_SETUP.md`
   
2. **Add to `.env.local`:**
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
   ```

3. **Restart dev server:**
   ```bash
   npm run dev
   ```

## How It Works

### First Sign-In Flow:
1. User signs in → System checks onboarding status
2. Missing education? → Redirect to `/onboarding/education`
3. Missing location? → Redirect to `/onboarding/location`
4. Everything complete? → Redirect to `/dashboard`

### Subsequent Sign-Ins:
- Goes directly to dashboard (no onboarding)

## Testing

1. Create a new test account
2. Complete email + phone verification
3. Sign in - should redirect to education form
4. Fill education/employment → redirects to location
5. Choose auto-detect or manual entry
6. Enter address → completes onboarding
7. Sign out and sign in again → goes to dashboard

## Files Created

- `frontend/src/lib/location.ts` - Location utilities
- `frontend/src/app/(onboarding)/layout.tsx` - Onboarding layout
- `frontend/src/app/(onboarding)/education/page.tsx` - Education form
- `frontend/src/app/(onboarding)/location/page.tsx` - Location form

## Files Modified

- `frontend/src/lib/auth.ts` - Added onboarding functions
- `frontend/src/app/(auth)/signin/page.tsx` - Added onboarding checks

## Database Fields Added

Each user document now has:
- `onboardingComplete`: boolean
- `education`: { degree, fieldOfStudy, institution, graduationYear }
- `employment`: { status, company, position, experienceYears }
- `location`: { latitude, longitude, city, state, country }
- `address`: string
