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
import { doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from './firebase'


let recaptchaVerifier: RecaptchaVerifier | null = null


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

    // Send verification email
    await sendEmailVerification(user)
    console.log('✅ Verification email sent')

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


// Reset Password - Send password reset email
export const resetPassword = async (email: string) => {
  try {
    console.log('📧 Sending password reset email to:', email)
    await sendPasswordResetEmail(auth, email)
    console.log('✅ Password reset email sent')
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
      await sendEmailVerification(user)
      console.log('✅ Verification email sent')
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

