import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,  // ← ADD THIS
  reload,
  onAuthStateChanged,
  User
} from 'firebase/auth'
import { doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs, onSnapshot, addDoc, orderBy, Timestamp } from 'firebase/firestore'
import { auth, db } from './firebase'

let recaptchaVerifier: RecaptchaVerifier | null = null

// Helper function to ensure db is initialized
const ensureDbInitialized = () => {
  if (!db) {
    throw new Error('Firestore is not initialized. Please ensure you are running this in a browser environment.')
  }
  return db
}


// Clear existing reCAPTCHA completely
export const clearRecaptcha = () => {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear()
      console.log('✅ Recaptcha cleared')
    } catch (e) {
      console.log('⚠️ Recaptcha clear error:', e)
    }
    recaptchaVerifier = null
  }

  // Clear the container DOM
  const container = document.getElementById('recaptcha-container')
  if (container) {
    container.innerHTML = ''
  }
}


// Setup Recaptcha for Phone Auth - INVISIBLE (No checkbox, automatic)
export const setupRecaptcha = (): RecaptchaVerifier => {
  // Ensure we're in browser environment
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA can only be initialized in browser')
  }

  // Always clear first
  clearRecaptcha()

  // Check if container exists
  const container = document.getElementById('recaptcha-container')
  if (!container) {
    throw new Error('reCAPTCHA container not found')
  }

  if (!auth) {
    throw new Error('Firebase Auth not initialized')
  }

  try {
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible', // ✅ INVISIBLE - No checkbox, automatic verification
      callback: (response: any) => {
        console.log('✅ reCAPTCHA verified automatically')
      },
      'expired-callback': () => {
        console.log('⚠️ reCAPTCHA expired, clearing...')
        clearRecaptcha()
      },
      'error-callback': (error: any) => {
        console.error('❌ reCAPTCHA error:', error)
        clearRecaptcha()
      }
    })

    console.log('✅ reCAPTCHA verifier created (invisible mode)')
    return recaptchaVerifier
  } catch (error) {
    console.error('❌ Failed to create reCAPTCHA:', error)
    clearRecaptcha()
    throw error
  }
}


// Send OTP to Phone Number - REAL SMS with invisible reCAPTCHA
export const sendOTP = async (phoneNumber: string): Promise<ConfirmationResult> => {
  try {
    console.log('📱 Sending OTP to:', phoneNumber)

    // Ensure phone number has country code
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+91' + phoneNumber.replace(/^\+91/, '')
    }

    console.log('📱 Formatted phone:', phoneNumber)

    // Setup invisible reCAPTCHA
    const verifier = setupRecaptcha()

    console.log('📤 Sending SMS (invisible reCAPTCHA will verify automatically)...')
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier)
    console.log('✅ OTP sent successfully to', phoneNumber)

    return confirmationResult
  } catch (error: any) {
    console.error('❌ OTP Send Error:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    clearRecaptcha()

    // Better error messages
    if (error.code === 'auth/invalid-phone-number') {
      throw new Error('Invalid phone number format. Use 10-digit number.')
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please try again in a few minutes.')
    } else if (error.code === 'auth/invalid-app-credential') {
      throw new Error('Phone authentication setup error.\n\n' +
        'Quick Fix:\n' +
        '1. Google Cloud Console → APIs & Services → Credentials\n' +
        '2. Edit API Key → Application restrictions: None (for testing)\n' +
        '3. Or add "localhost/*" to HTTP referrers\n' +
        '4. Wait 5 minutes and try again')
    } else if (error.code === 'auth/quota-exceeded') {
      throw new Error('SMS quota exceeded. Check Firebase Console billing.')
    } else if (error.message?.includes('reCAPTCHA')) {
      throw new Error('Verification failed. Please refresh page and try again.')
    } else {
      throw new Error(error.message || 'Failed to send OTP')
    }
  }
}


// Verify OTP (for sign-in)
export const verifyOTPSignIn = async (
  confirmationResult: ConfirmationResult,
  otp: string
) => {
  try {
    console.log('🔐 Verifying OTP...')
    const userCredential = await confirmationResult.confirm(otp)
    console.log('✅ OTP verified successfully')
    clearRecaptcha()
    return userCredential.user
  } catch (error: any) {
    console.error('❌ OTP Verify Error:', error)

    if (error.code === 'auth/invalid-verification-code') {
      throw new Error('Invalid OTP. Please check and try again.')
    } else if (error.code === 'auth/code-expired') {
      throw new Error('OTP expired. Please request a new one.')
    } else {
      throw new Error(error.message || 'Invalid OTP')
    }
  }
}


// Link phone credential to existing email account (for signup)
export const linkPhoneToEmailAccount = async (
  confirmationResult: ConfirmationResult,
  otp: string
) => {
  try {
    console.log('🔗 Linking phone credential to email account...')

    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('No user signed in. Please sign in with email first.')
    }

    // Get phone credential from OTP verification
    const { PhoneAuthProvider, linkWithCredential } = await import('firebase/auth')
    const credential = PhoneAuthProvider.credential(
      confirmationResult.verificationId,
      otp
    )

    // Link credential to current user
    await linkWithCredential(currentUser, credential)

    console.log('✅ Phone credential linked successfully')
    clearRecaptcha()

    return currentUser
  } catch (error: any) {
    console.error('❌ Link Phone Credential Error:', error)
    clearRecaptcha()

    if (error.code === 'auth/invalid-verification-code') {
      throw new Error('Invalid OTP. Please check and try again.')
    } else if (error.code === 'auth/code-expired') {
      throw new Error('OTP expired. Please request a new one.')
    } else if (error.code === 'auth/credential-already-in-use') {
      throw new Error('This phone number is already linked to another account.')
    } else if (error.code === 'auth/provider-already-linked') {
      throw new Error('Phone number is already linked to this account.')
    } else {
      throw new Error(error.message || 'Failed to link phone number')
    }
  }
}


// Sign Up with Email/Password
export const signUpWithEmail = async (
  email: string,
  password: string,
  name: string
) => {
  try {
    console.log('📧 Creating account for:', email)
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Update profile
    await updateProfile(user, { displayName: name })
    console.log('✅ Profile updated')

    // Generate Firebase verification link and send via Resend
    try {
      // Step 1: Generate Firebase verification link using Admin SDK
      const linkResponse = await fetch('/api/generate-verification-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          userName: name
        })
      })

      if (!linkResponse.ok) {
        throw new Error('Failed to generate verification link')
      }

      const { verificationLink } = await linkResponse.json()

      // Step 2: Send the Firebase link via Resend
      const emailResponse = await fetch('/api/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          verificationLink,
          userName: name
        })
      })

      if (!emailResponse.ok) {
        throw new Error('Resend failed')
      }

      console.log('✅ Verification email sent via Resend with Firebase link')
    } catch (emailError) {
      console.error('⚠️ Resend failed, using Firebase fallback:', emailError)
      // Fallback to Firebase's default email
      await sendEmailVerification(user, {
        url: `${window.location.origin}/signup`,
        handleCodeInApp: false
      })
    }

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      name: name,
      phoneNumber: null,
      emailVerified: false,
      phoneVerified: false,
      createdAt: new Date().toISOString(),
      profileComplete: false,
      // Onboarding fields
      onboardingComplete: false,
      education: null,
      employment: null,
      location: null,
      address: null,
      // Stats
      jobsCompleted: 0,
      servicesOffered: 0,
      rating: 0,
      reviews: []
    })
    console.log('✅ User document created in Firestore')

    return user
  } catch (error: any) {
    console.error('❌ Sign Up Error:', error)

    // Handle specific error codes
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered.')
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password should be at least 6 characters.')
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.')
    } else {
      throw new Error(error.message || 'Failed to create account')
    }
  }
}


// Get user verification status from Firestore
export const getUserVerificationStatus = async (userId: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      const data = userDoc.data()
      return {
        emailVerified: data.emailVerified || false,
        phoneVerified: data.phoneVerified || false,
        profileComplete: data.profileComplete || false
      }
    }
    return null
  } catch (error: any) {
    console.error('❌ Get Verification Status Error:', error)
    return null
  }
}


// Check if email is verified (requires user to sign in temporarily)
export const checkEmailVerification = async (email: string, password: string) => {
  try {
    console.log('🔍 Checking email verification for:', email)

    // Check if user is already signed in
    let user = auth.currentUser

    // If not signed in or different email, sign in
    if (!user || user.email !== email) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      user = userCredential.user
    }

    // Reload user to get latest verification status
    await reload(user)
    console.log('✅ User data reloaded')

    if (user.emailVerified) {
      console.log('✅ Email verified!')

      // Update Firestore with verification status
      await updateDoc(doc(db, 'users', user.uid), {
        emailVerified: true
      })

      return { verified: true, userId: user.uid }
    } else {
      console.log('⚠️ Email not verified yet')
      return { verified: false, userId: user.uid }
    }
  } catch (error: any) {
    console.error('❌ Verification Check Error:', error)
    throw new Error('Failed to check verification status')
  }
}


// Add Phone Number to Existing User
export const addPhoneToUser = async (
  userId: string,
  phoneNumber: string
) => {
  try {
    console.log('📱 Adding phone number to user:', userId)

    await updateDoc(doc(db, 'users', userId), {
      phoneNumber: phoneNumber,
      phoneVerified: true,
      profileComplete: true
    })

    console.log('✅ Phone number added successfully')
  } catch (error: any) {
    console.error('❌ Add Phone Error:', error)
    throw new Error(error.message)
  }
}


// Sign In with Email/Password - Just authenticate, let UI handle verification checks
export const signInWithEmail = async (email: string, password: string) => {
  try {
    console.log('🔐 Signing in:', email)
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    console.log('✅ Sign in successful for:', user.uid)

    // Return user object - Let UI handle verification checks and redirects
    return user

  } catch (error: any) {
    console.error('❌ Sign In Error:', error)

    // Handle specific error codes
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email. Please sign up first.')
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.')
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.')
    } else if (error.code === 'auth/user-disabled') {
      throw new Error('This account has been disabled.')
    } else if (error.code === 'auth/invalid-credential') {
      throw new Error('Invalid email or password.')
    } else {
      throw new Error(error.message || 'Failed to sign in')
    }
  }
}


// Reset Password - Send password reset email via Resend with Firebase link
export const resetPassword = async (email: string) => {
  try {
    console.log('📧 Sending password reset email to:', email)

    // Generate Firebase password reset link and send via Resend
    try {
      // Step 1: Generate Firebase password reset link using Admin SDK
      const linkResponse = await fetch('/api/generate-password-reset-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      if (!linkResponse.ok) {
        throw new Error('Failed to generate password reset link')
      }

      const { resetLink } = await linkResponse.json()

      // Step 2: Send the Firebase link via Resend
      const emailResponse = await fetch('/api/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          resetLink: resetLink,
          userName: email.split('@')[0]
        })
      })

      if (!emailResponse.ok) {
        throw new Error('Resend failed')
      }

      console.log('✅ Password reset email sent via Resend with Firebase link')
    } catch (emailError) {
      console.error('⚠️ Resend failed, using Firebase fallback:', emailError)
      // Fallback to Firebase's default email
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/signin`,
        handleCodeInApp: false
      })
    }
  } catch (error: any) {
    console.error('❌ Password Reset Error:', error)

    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email address.')
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.')
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many requests. Please try again later.')
    } else {
      throw new Error(error.message || 'Failed to send reset email')
    }
  }
}


// Resend verification email
export const resendVerificationEmail = async (email: string, password: string) => {
  try {
    console.log('📧 Resending verification email to:', email)

    // Check if user is already signed in
    let user = auth.currentUser

    // If not signed in, sign in first
    if (!user) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      user = userCredential.user
    }

    if (!user.emailVerified) {
      // Generate Firebase verification link using Admin SDK
      const linkResponse = await fetch('/api/generate-verification-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      })

      if (!linkResponse.ok) {
        throw new Error('Failed to generate verification link')
      }

      const { verificationLink } = await linkResponse.json()

      // Send email using Resend API
      const emailResponse = await fetch('/api/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          verificationLink,
          userName: user.displayName || email.split('@')[0]
        })
      })

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json()
        throw new Error(errorData.error || 'Failed to send verification email')
      }

      console.log('✅ Verification email sent via Resend')
    } else {
      console.log('ℹ️ Email already verified')
    }
  } catch (error: any) {
    console.error('❌ Resend Email Error:', error)

    // Handle specific error codes
    if (error.code === 'auth/too-many-requests') {
      throw new Error('⏱️ Too many requests. Please wait a few minutes before requesting another verification email.\n\nTip: Check your spam/junk folder - the email may already be there!')
    } else if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email.')
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password.')
    } else {
      throw new Error(error.message || 'Failed to resend verification email')
    }
  }
}


// Sign Out
export const signOutUser = async () => {
  try {
    console.log('👋 Signing out...')
    clearRecaptcha()
    await auth.signOut()
    console.log('✅ Signed out successfully')
  } catch (error: any) {
    console.error('❌ Sign Out Error:', error)
    throw new Error('Failed to sign out')
  }
}


// Auth state observer
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback)
}


// Check if phone number exists in Firestore (excluding current user)
export const checkPhoneNumberExists = async (phoneNumber: string, excludeUserId?: string) => {
  try {
    console.log('🔍 Checking phone number:', phoneNumber)
    console.log('🔍 Excluding user ID:', excludeUserId || 'none')

    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('phoneNumber', '==', phoneNumber))
    const snapshot = await getDocs(q)

    console.log('📊 Query results:', snapshot.size, 'documents found')

    if (snapshot.empty) {
      console.log('✅ Phone number is available')
      return false
    }

    // If we have an excludeUserId, check if all matches are for that user
    if (excludeUserId) {
      const otherUsers = snapshot.docs.filter(doc => doc.id !== excludeUserId)
      console.log('📊 Other users with this phone:', otherUsers.length)
      return otherUsers.length > 0
    }

    console.log('⚠️ Phone number already exists')
    return true
  } catch (error: any) {
    console.error('❌ Check Phone Number Error:', error)
    console.error('Error details:', error.code, error.message)
    // On error, allow the operation to proceed (fail open for better UX)
    return false
  }
}


// Get user by phone number
export const getUserByPhoneNumber = async (phoneNumber: string) => {
  try {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('phoneNumber', '==', phoneNumber))
    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      console.log('⚠️ No user found with phone number:', phoneNumber)
      return null
    }

    const userData = snapshot.docs[0].data()
    console.log('✅ Found user by phone:', userData.uid)
    return {
      uid: userData.uid,
      email: userData.email,
      name: userData.name,
      emailVerified: userData.emailVerified || false,
      phoneVerified: userData.phoneVerified || false,
      profileComplete: userData.profileComplete || false
    }
  } catch (error: any) {
    console.error('❌ Get User By Phone Error:', error)
    return null
  }
}


// Message interface with media support
export interface Message {
  id: string
  senderId: string
  senderName: string
  text?: string
  mediaUrl?: string
  mediaType?: 'image' | 'video' | 'audio'
  fileName?: string
  fileSize?: number
  caption?: string
  timestamp: number
  read: boolean
}
// ========================================
// ONBOARDING FUNCTIONS
// ========================================

// Check onboarding completion status
export const checkOnboardingStatus = async (userId: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      const data = userDoc.data()
      return {
        onboardingComplete: data.onboardingComplete || false,
        education: data.education || null,
        employment: data.employment || null,
        location: data.location || null,
        address: data.address || null
      }
    }
    return null
  } catch (error: any) {
    console.error('❌ Check Onboarding Status Error:', error)
    return null
  }
}


// Update user education information
export const updateUserEducation = async (
  userId: string,
  educationData: {
    degree: string
    fieldOfStudy: string
    institution: string
    graduationYear: number
  }
) => {
  try {
    console.log('📚 Updating education for user:', userId)
    await updateDoc(doc(db, 'users', userId), {
      education: educationData
    })
    console.log('✅ Education updated successfully')
  } catch (error: any) {
    console.error('❌ Update Education Error:', error)
    throw new Error(error.message || 'Failed to update education')
  }
}


// Update user employment information
export const updateUserEmployment = async (
  userId: string,
  employmentData: {
    status: string
    company: string | null
    position: string | null
    experienceYears: number | null
  }
) => {
  try {
    console.log('💼 Updating employment for user:', userId)
    await updateDoc(doc(db, 'users', userId), {
      employment: employmentData
    })
    console.log('✅ Employment updated successfully')
  } catch (error: any) {
    console.error('❌ Update Employment Error:', error)
    throw new Error(error.message || 'Failed to update employment')
  }
}


// Update user location information
export const updateUserLocation = async (
  userId: string,
  locationData: {
    latitude: number
    longitude: number
    city: string
    state: string
    country: string
  }
) => {
  try {
    console.log('📍 Updating location for user:', userId)
    await updateDoc(doc(db, 'users', userId), {
      location: locationData
    })
    console.log('✅ Location updated successfully')
  } catch (error: any) {
    console.error('❌ Update Location Error:', error)
    throw new Error(error.message || 'Failed to update location')
  }
}


// Update user address
export const updateUserAddress = async (userId: string, address: string) => {
  try {
    console.log('🏠 Updating address for user:', userId)
    await updateDoc(doc(db, 'users', userId), {
      address: address
    })
    console.log('✅ Address updated successfully')
  } catch (error: any) {
    console.error('❌ Update Address Error:', error)
    throw new Error(error.message || 'Failed to update address')
  }
}


// Complete onboarding process
export const completeOnboarding = async (userId: string) => {
  try {
    console.log('🎉 Completing onboarding for user:', userId)
    await updateDoc(doc(db, 'users', userId), {
      onboardingComplete: true
    })
    console.log('✅ Onboarding completed successfully')
  } catch (error: any) {
    console.error('❌ Complete Onboarding Error:', error)
    throw new Error(error.message || 'Failed to complete onboarding')
  }
}

// ========================================
// MULTIPLE ADDRESSES FUNCTIONS
// ========================================

export interface SavedAddress {
  id: string
  type: 'home' | 'office' | 'other'
  label: string
  houseNumber: string
  detailedAddress: string
  location: {
    latitude: number
    longitude: number
    city: string
    state: string
    country: string
    area?: string
  }
  isDefault: boolean
  createdAt: number
}

// Get all saved addresses for a user
export const getUserAddresses = async (userId: string): Promise<SavedAddress[]> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      const userData = userDoc.data()
      return userData.savedAddresses || []
    }
    return []
  } catch (error: any) {
    console.error('❌ Get Addresses Error:', error)
    throw new Error(error.message || 'Failed to get addresses')
  }
}

// Add a new address
export const addUserAddress = async (
  userId: string,
  address: Omit<SavedAddress, 'id' | 'createdAt'>
): Promise<string> => {
  try {
    const addresses = await getUserAddresses(userId)

    // Generate unique ID
    const newId = `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // If this is set as default, unset all other defaults
    const updatedAddresses = address.isDefault
      ? addresses.map(addr => ({ ...addr, isDefault: false }))
      : addresses

    const newAddress: SavedAddress = {
      ...address,
      id: newId,
      createdAt: Date.now()
    }

    updatedAddresses.push(newAddress)

    await updateDoc(doc(db, 'users', userId), {
      savedAddresses: updatedAddresses,
      // Update primary location if this is default
      ...(address.isDefault && {
        location: address.location,
        address: `${address.type === 'home' ? 'Home' : address.type === 'office' ? 'Office' : 'Other'}: ${address.houseNumber}, ${address.detailedAddress}`
      })
    })

    console.log('✅ Address added successfully')
    return newId
  } catch (error: any) {
    console.error('❌ Add Address Error:', error)
    throw new Error(error.message || 'Failed to add address')
  }
}

// Update an existing address
export const updateAddress = async (
  userId: string,
  addressId: string,
  updates: Partial<Omit<SavedAddress, 'id' | 'createdAt'>>
): Promise<void> => {
  try {
    const addresses = await getUserAddresses(userId)
    const addressIndex = addresses.findIndex(addr => addr.id === addressId)

    if (addressIndex === -1) {
      throw new Error('Address not found')
    }

    // If setting as default, unset all other defaults
    let updatedAddresses = addresses
    if (updates.isDefault) {
      updatedAddresses = addresses.map(addr => ({ ...addr, isDefault: false }))
    }

    updatedAddresses[addressIndex] = {
      ...updatedAddresses[addressIndex],
      ...updates
    }

    await updateDoc(doc(db, 'users', userId), {
      savedAddresses: updatedAddresses,
      // Update primary location if this is default
      ...(updates.isDefault && {
        location: updatedAddresses[addressIndex].location,
        address: `${updatedAddresses[addressIndex].type === 'home' ? 'Home' : updatedAddresses[addressIndex].type === 'office' ? 'Office' : 'Other'}: ${updatedAddresses[addressIndex].houseNumber}, ${updatedAddresses[addressIndex].detailedAddress}`
      })
    })

    console.log('✅ Address updated successfully')
  } catch (error: any) {
    console.error('❌ Update Address Error:', error)
    throw new Error(error.message || 'Failed to update address')
  }
}

// Delete an address
export const deleteAddress = async (userId: string, addressId: string): Promise<void> => {
  try {
    const addresses = await getUserAddresses(userId)
    const updatedAddresses = addresses.filter(addr => addr.id !== addressId)

    await updateDoc(doc(db, 'users', userId), {
      savedAddresses: updatedAddresses
    })

    console.log('✅ Address deleted successfully')
  } catch (error: any) {
    console.error('❌ Delete Address Error:', error)
    throw new Error(error.message || 'Failed to delete address')
  }
}

// Set an address as default
export const setDefaultAddress = async (userId: string, addressId: string): Promise<void> => {
  try {
    const addresses = await getUserAddresses(userId)
    const updatedAddresses = addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === addressId
    }))

    const defaultAddress = updatedAddresses.find(addr => addr.id === addressId)
    if (!defaultAddress) {
      throw new Error('Address not found')
    }

    await updateDoc(doc(db, 'users', userId), {
      savedAddresses: updatedAddresses,
      location: defaultAddress.location,
      address: `${defaultAddress.type === 'home' ? 'Home' : defaultAddress.type === 'office' ? 'Office' : 'Other'}: ${defaultAddress.houseNumber}, ${defaultAddress.detailedAddress}`
    })

    console.log('✅ Default address set successfully')
  } catch (error: any) {
    console.error('❌ Set Default Address Error:', error)
    throw new Error(error.message || 'Failed to set default address')
  }
}

// ========================================
// JOB MANAGEMENT FUNCTIONS
// ========================================

export interface JobMedia {
  type: 'image' | 'video'
  url: string
  publicId: string
  thumbnailUrl?: string
}

export interface Job {
  id: string
  userId: string
  userName: string
  userEmail: string
  caption: string
  budget: number | null
  budgetNotSet?: boolean
  media: JobMedia[]
  location: {
    latitude: number
    longitude: number
    city: string
    state: string
    country: string
    area?: string
    detailedAddress?: string
  }
  status: 'open' | 'in-progress' | 'completed' | 'cancelled'
  applicants: string[]
  category?: string // AI-generated category
  createdAt: number
  updatedAt: number
}

export interface CreateJobData {
  caption: string
  budget: number | null
  budgetNotSet?: boolean
  media: JobMedia[]
  location: {
    latitude: number
    longitude: number
    city: string
    state: string
    country: string
    area?: string
    detailedAddress?: string
  }
}

// Notification interface
export interface Notification {
  id: string
  userId: string  // Recipient
  type: 'new_application' | 'counter_offer_received' | 'applicant_counter_offer' | 'budget_accepted' | 'new_job_nearby'
  title: string
  message: string
  jobId: string
  jobTitle: string
  applicationId?: string
  amount?: number
  createdAt: number
  read: boolean
}

// Negotiation offer interface
export interface NegotiationOffer {
  amount: number
  offeredBy: 'poster' | 'applicant'
  offeredAt: number
  message?: string
}

// Create a new job
export const createJob = async (userId: string, jobData: CreateJobData): Promise<string> => {
  try {
    console.log('💼 Creating job for user:', userId)

    // Get user info
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (!userDoc.exists()) {
      throw new Error('User not found')
    }

    const userData = userDoc.data()
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Clean location data - remove undefined fields
    const cleanLocation: any = {
      latitude: jobData.location.latitude,
      longitude: jobData.location.longitude,
      city: jobData.location.city,
      state: jobData.location.state,
      country: jobData.location.country,
    }

    // Only add area if it's defined
    if (jobData.location.area) {
      cleanLocation.area = jobData.location.area
    }

    // Only add detailedAddress if it's defined
    if (jobData.location.detailedAddress) {
      cleanLocation.detailedAddress = jobData.location.detailedAddress
    }

    // Fetch existing categories from database
    let existingCategories: string[] = []
    try {
      const jobsSnapshot = await getDocs(collection(db, 'jobs'))
      const categoriesSet = new Set<string>()
      jobsSnapshot.forEach((doc) => {
        const job = doc.data() as Job
        // Exclude 'Other' - we don't want AI to think it's a valid category choice
        if (job.category && job.category !== 'Other') {
          categoriesSet.add(job.category)
        }
      })
      existingCategories = Array.from(categoriesSet)
      console.log('📊 Found existing categories:', existingCategories)
    } catch (error) {
      console.warn('⚠️ Could not fetch existing categories:', error)
    }

    // Categorize job using Gemini AI with existing categories
    let category = 'Other'
    try {
      const { categorizeJobWithAI } = await import('./gemini')
      const result = await categorizeJobWithAI(jobData.caption, existingCategories)
      if (result.success) {
        category = result.category
      }
    } catch (aiError) {
      console.warn('⚠️ AI categorization failed, using default category:', aiError)
    }

    const job: Job = {
      id: jobId,
      userId,
      userName: userData.name || 'Unknown',
      userEmail: userData.email || '',
      caption: jobData.caption,
      budget: jobData.budget,
      budgetNotSet: jobData.budgetNotSet || false,
      media: jobData.media || [], // Ensure media is always an array
      location: cleanLocation,
      status: 'open',
      applicants: [],
      category, // AI-generated category
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await setDoc(doc(db, 'jobs', jobId), job)
    console.log('✅ Job created successfully:', jobId, '| Category:', category)

    return jobId
  } catch (error: any) {
    console.error('❌ Create Job Error:', error)
    throw new Error(error.message || 'Failed to create job')
  }
}

// Get all jobs with optional filters
export const getJobs = async (filters?: {
  userId?: string
  status?: string
  limit?: number
}): Promise<Job[]> => {
  try {
    console.log('📋 Fetching jobs with filters:', filters)

    if (!db) {
      console.error('❌ Firestore not initialized')
      return []
    }

    const jobsRef = collection(db, 'jobs')
    let q = query(jobsRef)

    // Apply filters
    if (filters?.userId) {
      q = query(q, where('userId', '==', filters.userId))
    }
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status))
    }

    const snapshot = await getDocs(q)
    const jobs: Job[] = []

    snapshot.forEach((doc) => {
      jobs.push(doc.data() as Job)
    })

    // Sort by newest first
    jobs.sort((a, b) => b.createdAt - a.createdAt)

    // Apply limit if specified
    if (filters?.limit) {
      return jobs.slice(0, filters.limit)
    }

    console.log('✅ Fetched', jobs.length, 'jobs')
    return jobs
  } catch (error: any) {
    console.error('❌ Get Jobs Error:', error)
    throw new Error(error.message || 'Failed to fetch jobs')
  }
}

// Get a single job by ID
export const getJobById = async (jobId: string): Promise<Job | null> => {
  try {
    const jobDoc = await getDoc(doc(db, 'jobs', jobId))
    if (jobDoc.exists()) {
      return jobDoc.data() as Job
    }
    return null
  } catch (error: any) {
    console.error('❌ Get Job Error:', error)
    throw new Error(error.message || 'Failed to fetch job')
  }
}

// Apply to a job
export const applyToJob = async (
  jobId: string,
  userId: string,
  description: string,
  budgetSatisfied: boolean,
  counterOffer?: number,
  message?: string
): Promise<void> => {
  try {
    console.log('📝 User', userId, 'applying to job', jobId)

    const jobDoc = await getDoc(doc(db, 'jobs', jobId))
    if (!jobDoc.exists()) {
      throw new Error('Job not found')
    }

    const job = jobDoc.data() as Job

    // Check if user is the job owner
    if (job.userId === userId) {
      throw new Error('You cannot apply to your own job')
    }

    // Check if already applied
    if (job.applicants.includes(userId)) {
      throw new Error('You have already applied to this job')
    }

    // Add user to applicants
    await updateDoc(doc(db, 'jobs', jobId), {
      applicants: [...job.applicants, userId],
      updatedAt: Date.now(),
    })

    // Fetch user data to include in application
    const userDoc = await getDoc(doc(db, 'users', userId))
    const userData = userDoc.data()

    // Create application document with details
    const applicationData: any = {
      jobId,
      userId: userId,
      userName: userData?.name || 'Unknown',
      userEmail: userData?.email || '',
      userPhone: userData?.phoneNumber || '',
      description,
      budgetSatisfied,
      counterOffer: counterOffer || null,
      appliedAt: Date.now(),
      status: 'pending'
    }

    // Add message if provided
    if (message) {
      applicationData.budgetProposalReason = message
    }

    const applicationRef = await addDoc(collection(db, 'job_applications'), applicationData)

    // Create notification for job poster
    try {
      const { createNotification } = await import('./notifications')
      const notificationMessage = budgetSatisfied
        ? `${userData?.name || 'Someone'} applied to your job "${job.caption}"`
        : `${userData?.name || 'Someone'} applied with counter-offer of ₹${counterOffer?.toLocaleString()} for "${job.caption}"`

      await createNotification({
        userId: job.userId, // Job poster
        type: 'new_application',
        title: 'New Application',
        message: notificationMessage,
        jobId,
        jobTitle: job.caption,
        applicationId: applicationRef.id,
        amount: counterOffer || job.budget || 0,
        createdAt: Date.now(),
        read: false
      })
    } catch (notifError) {
      console.error('Failed to create notification:', notifError)
      // Don't fail the application if notification fails
    }

    console.log('✅ Application submitted successfully')
  } catch (error: any) {
    console.error('❌ Apply to Job Error:', error)
    throw new Error(error.message || 'Failed to apply to job')
  }
}

// Update job status
export const updateJobStatus = async (
  jobId: string,
  status: 'open' | 'in-progress' | 'completed' | 'cancelled'
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'jobs', jobId), {
      status,
      updatedAt: Date.now(),
    })
    console.log('✅ Job status updated to:', status)
  } catch (error: any) {
    console.error('❌ Update Job Status Error:', error)
    throw new Error(error.message || 'Failed to update job status')
  }
}

// Delete a job
export const deleteJob = async (jobId: string): Promise<void> => {
  try {
    const { deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(db, 'jobs', jobId))
    console.log('✅ Job deleted successfully')
  } catch (error: any) {
    console.error('❌ Delete Job Error:', error)
    throw new Error(error.message || 'Failed to delete job')
  }
}



// ========================================
// CHAT FUNCTIONS
// ========================================


export interface Conversation {
  id: string
  jobId: string
  jobTitle: string
  participants: string[]
  participantDetails: {
    [userId: string]: {
      name: string
      email: string
    }
  }
  lastMessage: string
  lastMessageTime: number
  unreadCount: {
    [userId: string]: number
  }
  createdAt: number
  updatedAt: number
}

// Create or get conversation for a specific job
export const createOrGetConversation = async (
  jobId: string,
  jobTitle: string,
  user1Id: string,
  user1Name: string,
  user1Email: string,
  user2Id: string,
  user2Name: string,
  user2Email: string
): Promise<string> => {
  try {
    // Create conversation ID: jobId + sorted user IDs
    const sortedUsers = [user1Id, user2Id].sort()
    const conversationId = `${jobId}_${sortedUsers.join('_')}`

    const conversationRef = doc(db, 'conversations', conversationId)
    const conversationDoc = await getDoc(conversationRef)

    if (!conversationDoc.exists()) {
      // Create new conversation
      const conversationData: Conversation = {
        id: conversationId,
        jobId,
        jobTitle,
        participants: [user1Id, user2Id],
        participantDetails: {
          [user1Id]: { name: user1Name, email: user1Email },
          [user2Id]: { name: user2Name, email: user2Email }
        },
        lastMessage: '',
        lastMessageTime: Date.now(),
        unreadCount: {
          [user1Id]: 0,
          [user2Id]: 0
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      await setDoc(conversationRef, conversationData)
      console.log(' Conversation created:', conversationId)
    }

    return conversationId
  } catch (error: any) {
    console.error(' Create Conversation Error:', error)
    throw new Error(error.message || 'Failed to create conversation')
  }
}

// Send message in a conversation
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<void> => {
  try {
    // Add message to subcollection
    const messagesRef = collection(db, `conversations/${conversationId}/messages`)
    await addDoc(messagesRef, {
      senderId,
      senderName,
      text,
      timestamp: Date.now(),
      read: false
    })

    // Update conversation metadata
    const conversationRef = doc(db, 'conversations', conversationId)
    const conversationDoc = await getDoc(conversationRef)

    if (conversationDoc.exists()) {
      const conversation = conversationDoc.data() as Conversation
      const receiverId = conversation.participants.find(id => id !== senderId)

      if (receiverId) {
        await updateDoc(conversationRef, {
          lastMessage: text.substring(0, 100), // Preview
          lastMessageTime: Date.now(),
          updatedAt: Date.now(),
          [`unreadCount.${receiverId}`]: (conversation.unreadCount[receiverId] || 0) + 1
        })
      }
    }

    console.log('✅ Message sent')
  } catch (error: any) {
    console.error(' Send Message Error:', error)
    throw new Error(error.message || 'Failed to send message')
  }
}

// Subscribe to user's conversations (real-time)
export const subscribeToConversations = (
  userId: string,
  callback: (conversations: Conversation[]) => void
): (() => void) => {
  try {
    const conversationsRef = collection(db, 'conversations')
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Conversation[]
      callback(conversations)
    })

    return unsubscribe
  } catch (error: any) {
    console.error(' Subscribe to Conversations Error:', error)
    return () => { }
  }
}

// Subscribe to messages in a conversation (real-time)
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void
): (() => void) => {
  try {
    const messagesRef = collection(db, `conversations/${conversationId}/messages`)
    const q = query(messagesRef, orderBy('timestamp', 'asc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Message[]
      callback(messages)
    })

    return unsubscribe
  } catch (error: any) {
    console.error(' Subscribe to Messages Error:', error)
    return () => { }
  }
}

// Mark messages as read
export const markMessagesAsRead = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    // Update conversation unread count
    const conversationRef = doc(db, 'conversations', conversationId)
    await updateDoc(conversationRef, {
      [`unreadCount.${userId}`]: 0
    })

    // Mark all unread messages from other user as read
    const messagesRef = collection(db, `conversations/${conversationId}/messages`)
    const q = query(
      messagesRef,
      where('senderId', '!=', userId),
      where('read', '==', false)
    )

    const snapshot = await getDocs(q)
    const { writeBatch } = await import('firebase/firestore')
    const batch = writeBatch(db)

    snapshot.docs.forEach((messageDoc) => {
      batch.update(messageDoc.ref, { read: true })
    })

    if (!snapshot.empty) {
      await batch.commit()
    }

    console.log('✅ Messages marked as read')
  } catch (error: any) {
    console.error('❌ Mark Messages as Read Error:', error)
  }
}

// Get total unread count for a user
export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    const conversationsRef = collection(db, 'conversations')
    const q = query(conversationsRef, where('participants', 'array-contains', userId))
    const snapshot = await getDocs(q)

    let totalUnread = 0
    snapshot.docs.forEach(doc => {
      const conversation = doc.data() as Conversation
      totalUnread += conversation.unreadCount[userId] || 0
    })

    return totalUnread
  } catch (error: any) {
    console.error(' Get Unread Count Error:', error)
    return 0
  }
}


// Get job applications for a specific job
export const getJobApplications = async (jobId: string): Promise<any[]> => {
  try {
    const applicationsRef = collection(db, 'job_applications')
    const q = query(applicationsRef, where('jobId', '==', jobId), orderBy('appliedAt', 'desc'))
    const snapshot = await getDocs(q)

    const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Batch-fetch photoURL from users collection for each unique applicant
    const uniqueUserIds = [...new Set(apps.map((a: any) => a.userId).filter(Boolean))]
    const userPhotoMap: Record<string, string> = {}
    await Promise.all(
      uniqueUserIds.map(async (uid: string) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid))
          if (userSnap.exists()) {
            userPhotoMap[uid] = userSnap.data().photoURL || ''
          }
        } catch { /* skip */ }
      })
    )

    return apps.map((a: any) => ({
      ...a,
      userPhotoURL: userPhotoMap[a.userId] || ''
    }))
  } catch (error: any) {
    console.error(' Get Job Applications Error:', error)
    throw new Error(error.message || 'Failed to get job applications')
  }
}


// Check if user has already applied to a job
export const checkIfUserApplied = async (jobId: string, userId: string): Promise<boolean> => {
  try {
    const applicationsQuery = query(
      collection(db, 'job_applications'),
      where('jobId', '==', jobId),
      where('userId', '==', userId)
    )
    const existingApplications = await getDocs(applicationsQuery)
    return !existingApplications.empty
  } catch (error: any) {
    console.error(' Check Application Error:', error)
    return false
  }
}

// Get user's own application for a specific job
export const getUserOwnApplication = async (jobId: string, userId: string): Promise<any | null> => {
  try {
    console.log('🔍 Query parameters:', {
      collection: 'job_applications',
      jobId,
      userId,
      queryFields: ['jobId', 'userId']
    })

    const applicationsQuery = query(
      collection(db, 'job_applications'),
      where('jobId', '==', jobId),
      where('userId', '==', userId)
    )
    const snapshot = await getDocs(applicationsQuery)

    console.log('📊 Query results:', {
      found: snapshot.size,
      empty: snapshot.empty
    })

    if (snapshot.empty) {
      console.warn('⚠️ No application found with these criteria')
      return null
    }

    const doc = snapshot.docs[0]
    const data = {
      id: doc.id,
      ...doc.data()
    }
    console.log('✅ Found application:', data)
    return data
  } catch (error: any) {
    console.error('❌ Get User Application Error:', error)
    return null
  }
}

// Get all jobs a user has applied to, with their application details attached
export const getUserAppliedJobs = async (userId: string): Promise<Array<Job & { application: any }>> => {
  try {
    const applicationsQuery = query(
      collection(db, 'job_applications'),
      where('userId', '==', userId),
      orderBy('appliedAt', 'desc')
    )
    const snapshot = await getDocs(applicationsQuery)
    if (snapshot.empty) return []

    // Fetch each corresponding job doc in parallel
    const results = await Promise.all(
      snapshot.docs.map(async (appDoc) => {
        const application = { id: appDoc.id, ...appDoc.data() }
        try {
          const jobDoc = await getDoc(doc(db, 'jobs', (application as any).jobId))
          if (!jobDoc.exists()) return null
          return {
            ...(jobDoc.data() as Job),
            id: jobDoc.id,
            application,
          }
        } catch {
          return null
        }
      })
    )
    return results.filter(Boolean) as Array<Job & { application: any }>
  } catch (error: any) {
    console.error('❌ Get Applied Jobs Error:', error)
    return []
  }
}

// Upload media file to Cloudinary (instead of Firebase Storage)
export const uploadChatMedia = async (
  conversationId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    console.log('📤 Starting upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      fileType: file.type
    })

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
      console.error('❌ Missing Cloudinary config:', { cloudName: !!cloudName, uploadPreset: !!uploadPreset })
      throw new Error('Cloudinary configuration missing')
    }

    // Check file size - Cloudinary free tier has 10MB limit for images
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      console.warn('⚠️ File too large, attempting compression...')

      // If it's an image, try to compress it
      if (file.type.startsWith('image/')) {
        try {
          const compressedFile = await compressImage(file, 0.7) // 70% quality
          console.log('✅ Compressed:', {
            originalSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            compressedSize: (compressedFile.size / (1024 * 1024)).toFixed(2) + ' MB',
            reduction: (((file.size - compressedFile.size) / file.size) * 100).toFixed(1) + '%'
          })
          file = compressedFile
        } catch (compressionError) {
          console.error('❌ Compression failed:', compressionError)
          throw new Error('File too large and compression failed. Please use a smaller image.')
        }
      } else {
        throw new Error(`File too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 10MB.`)
      }
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset)
    formData.append('folder', `needyou/chat/${conversationId}`)

    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100
          console.log(`📊 Upload progress: ${progress.toFixed(1)}%`)
          onProgress?.(progress)
        }
      })

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText)
            console.log('✅ File uploaded to Cloudinary:', {
              url: response.secure_url,
              publicId: response.public_id,
              size: response.bytes
            })
            resolve(response.secure_url)
          } catch (parseError) {
            console.error('❌ Failed to parse response:', xhr.responseText)
            reject(new Error('Invalid response from server'))
          }
        } else {
          console.error('❌ Upload failed with status:', xhr.status, xhr.statusText)
          console.error('Response:', xhr.responseText)
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            reject(new Error(errorResponse.error?.message || `Upload failed: ${xhr.statusText}`))
          } catch {
            reject(new Error(`Upload failed: ${xhr.statusText}`))
          }
        }
      })

      // Handle errors
      xhr.addEventListener('error', () => {
        console.error('❌ Network error during upload')
        reject(new Error('Network error. Please check your connection and try again.'))
      })

      xhr.addEventListener('abort', () => {
        console.error('❌ Upload aborted')
        reject(new Error('Upload cancelled'))
      })

      // Handle timeout
      xhr.timeout = 60000 // 60 seconds
      xhr.addEventListener('timeout', () => {
        console.error('❌ Upload timeout')
        reject(new Error('Upload timeout. Please try again with a smaller file.'))
      })

      // Send request
      console.log('🚀 Sending request to Cloudinary...')
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`)
      xhr.send(formData)
    })
  } catch (error: any) {
    console.error('❌ Upload Media Error:', error)
    throw new Error(error.message || 'Failed to upload media')
  }
}

// Helper function to compress images
const compressImage = async (file: File, quality: number = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Resize if too large (max 2048px on longest side)
        const maxDimension = 2048
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension
            width = maxDimension
          } else {
            width = (width / height) * maxDimension
            height = maxDimension
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// Send media message
export const sendMediaMessage = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  mediaUrl: string,
  mediaType: 'image' | 'video' | 'audio',
  fileName: string,
  fileSize: number,
  caption?: string
): Promise<void> => {
  try {
    // Add message to subcollection
    const messagesRef = collection(db, `conversations/${conversationId}/messages`)
    const messageData: any = {
      senderId,
      senderName,
      mediaUrl,
      mediaType,
      fileName,
      fileSize,
      timestamp: Date.now(),
      read: false
    }

    // Add caption if provided
    if (caption) {
      messageData.caption = caption
    }

    await addDoc(messagesRef, messageData)

    // Update conversation metadata
    const conversationRef = doc(db, 'conversations', conversationId)
    const conversationDoc = await getDoc(conversationRef)

    if (conversationDoc.exists()) {
      const conversation = conversationDoc.data() as Conversation
      const receiverId = conversation.participants.find(id => id !== senderId)

      if (receiverId) {
        const mediaPreview = mediaType === 'image' ? '📷 Photo' : mediaType === 'video' ? '🎥 Video' : '🎵 Audio'
        await updateDoc(conversationRef, {
          lastMessage: mediaPreview,
          lastMessageTime: Date.now(),
          updatedAt: Date.now(),
          [`unreadCount.${receiverId}`]: (conversation.unreadCount[receiverId] || 0) + 1
        })
      }
    }

    console.log('✅ Media message sent')
  } catch (error: any) {
    console.error('❌ Send Media Message Error:', error)
    throw new Error(error.message || 'Failed to send media message')
  }
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export const updateUserProfile = async (
  uid: string,
  data: { photoURL?: string; aboutMe?: string }
): Promise<void> => {
  const database = ensureDbInitialized()
  const userRef = doc(database, 'users', uid)
  await updateDoc(userRef, {
    ...(data.photoURL !== undefined && { photoURL: data.photoURL }),
    ...(data.aboutMe !== undefined && { aboutMe: data.aboutMe }),
    updatedAt: Date.now(),
  })
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export interface Review {
  id: string
  reviewerId: string
  reviewerName: string
  revieweeId: string
  jobId: string
  jobTitle: string
  rating: number // 1–5
  comment: string
  createdAt: number
}

export const submitReview = async (
  reviewData: Omit<Review, 'id'>
): Promise<string> => {
  const database = ensureDbInitialized()
  const ref = await addDoc(collection(database, 'reviews'), {
    ...reviewData,
    createdAt: Date.now(),
  })
  return ref.id
}

export const getUserReviews = async (uid: string): Promise<Review[]> => {
  const database = ensureDbInitialized()
  const q = query(
    collection(database, 'reviews'),
    where('revieweeId', '==', uid),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Review))
}
