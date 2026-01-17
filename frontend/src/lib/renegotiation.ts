import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { NegotiationOffer } from './auth'
import { createNotification } from './notifications'

// Helper function to ensure db is initialized
const ensureDbInitialized = () => {
    if (!db) {
        throw new Error('Firestore is not initialized. Please ensure you are running this in a browser environment.')
    }
    return db
}

// Renegotiate budget (job poster makes counter-offer)
export const renegotiateBudget = async (
    applicationId: string,
    jobId: string,
    jobTitle: string,
    newOffer: number,
    message?: string
): Promise<void> => {
    try {
        const dbInstance = ensureDbInitialized()
        const applicationRef = doc(dbInstance, 'job_applications', applicationId)
        const applicationDoc = await getDoc(applicationRef)

        if (!applicationDoc.exists()) {
            throw new Error('Application not found')
        }

        const application = applicationDoc.data()
        const negotiationHistory = application.negotiationHistory || []

        // If this is the first negotiation, add the initial applicant's counter-offer to history
        if (negotiationHistory.length === 0 && application.counterOffer) {
            negotiationHistory.push({
                amount: application.counterOffer,
                offeredBy: 'applicant',
                offeredAt: application.appliedAt || Date.now(),
                message: 'Initial counter-offer'
            })
        }

        // Add new offer to history
        const newNegotiation: NegotiationOffer = {
            amount: newOffer,
            offeredBy: 'poster',
            offeredAt: Date.now()
        }

        // Only add message if provided
        if (message) {
            newNegotiation.message = message
        }

        negotiationHistory.push(newNegotiation)

        // Update application
        await updateDoc(applicationRef, {
            negotiationHistory,
            currentOffer: newOffer,
            offerBy: 'poster',
            negotiationStatus: 'ongoing',
            budgetSatisfied: false
        })

        // Create notification for applicant
        await createNotification({
            userId: application.userId, // Get applicant ID from application
            type: 'counter_offer_received',
            title: 'New Counter-Offer',
            message: `Job poster offered ₹${newOffer.toLocaleString()} for "${jobTitle}"`,
            jobId,
            jobTitle,
            applicationId,
            amount: newOffer,
            createdAt: Date.now(),
            read: false
        })

        console.log('✅ Budget renegotiated successfully')
    } catch (error: any) {
        console.error('❌ Renegotiate Budget Error:', error)
        throw new Error(error.message || 'Failed to renegotiate budget')
    }
}

// Respond to renegotiation (applicant accepts or counters)
export const respondToRenegotiation = async (
    applicationId: string,
    jobId: string,
    jobTitle: string,
    jobPosterId: string,
    accept: boolean,
    counterOffer?: number,
    message?: string
): Promise<void> => {
    try {
        const dbInstance = ensureDbInitialized()
        const applicationRef = doc(dbInstance, 'job_applications', applicationId)
        const applicationDoc = await getDoc(applicationRef)

        if (!applicationDoc.exists()) {
            throw new Error('Application not found')
        }

        const application = applicationDoc.data()
        const negotiationHistory = application.negotiationHistory || []

        if (accept) {
            // Accept the current offer
            const finalAmount = application.currentOffer || application.counterOffer
            await updateDoc(applicationRef, {
                negotiationHistory,
                currentOffer: finalAmount,
                negotiationStatus: 'accepted',
                budgetSatisfied: true
            })

            // Create notification for job poster
            await createNotification({
                userId: jobPosterId,
                type: 'budget_accepted',
                title: 'Offer Accepted!',
                message: `Applicant accepted your offer of ₹${application.currentOffer.toLocaleString()} for "${jobTitle}"`,
                jobId,
                jobTitle,
                applicationId,
                amount: application.currentOffer,
                createdAt: Date.now(),
                read: false
            })

            console.log('✅ Offer accepted')
        } else if (counterOffer) {
            // Make counter-offer
            const newNegotiation: NegotiationOffer = {
                amount: counterOffer,
                offeredBy: 'applicant',
                offeredAt: Date.now()
            }

            // Only add message if provided
            if (message) {
                newNegotiation.message = message
            }

            negotiationHistory.push(newNegotiation)

            await updateDoc(applicationRef, {
                negotiationHistory,
                currentOffer: counterOffer,
                offerBy: 'applicant',
                negotiationStatus: 'ongoing',
                counterOffer,
                budgetSatisfied: false
            })

            // Create notification for job poster
            await createNotification({
                userId: jobPosterId,
                type: 'applicant_counter_offer',
                title: 'New Counter-Offer',
                message: `Applicant offered ₹${counterOffer.toLocaleString()} for "${jobTitle}"`,
                jobId,
                jobTitle,
                applicationId,
                amount: counterOffer,
                createdAt: Date.now(),
                read: false
            })

            console.log('✅ Counter-offer sent')
        }
    } catch (error: any) {
        console.error('❌ Respond to Renegotiation Error:', error)
        throw new Error(error.message || 'Failed to respond to renegotiation')
    }
}
