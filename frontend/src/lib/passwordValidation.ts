// Password validation utility
export interface PasswordValidation {
    isValid: boolean
    errors: {
        length: boolean
        uppercase: boolean
        lowercase: boolean
        number: boolean
    }
}

export const validatePassword = (password: string): PasswordValidation => {
    const minLength = 8
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)

    const errors = {
        length: password.length < minLength,
        uppercase: !hasUpperCase,
        lowercase: !hasLowerCase,
        number: !hasNumber,
    }

    const isValid = !errors.length && !errors.uppercase && !errors.lowercase && !errors.number

    return { isValid, errors }
}

export const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    const validation = validatePassword(password)
    const passedChecks = Object.values(validation.errors).filter(error => !error).length

    if (passedChecks <= 2) return 'weak'
    if (passedChecks === 3) return 'medium'
    return 'strong'
}

export const getPasswordStrengthColor = (strength: 'weak' | 'medium' | 'strong'): string => {
    switch (strength) {
        case 'weak':
            return '#ef4444' // red
        case 'medium':
            return '#f59e0b' // orange
        case 'strong':
            return '#10b981' // green
    }
}
