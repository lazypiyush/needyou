import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY_TRANSLATE || '')

// Cache to store translations and reduce API calls
const translationCache = new Map<string, { translatedText: string; detectedLanguage: string; timestamp: number }>()
const CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 hours

export async function POST(request: NextRequest) {
    try {
        // Validate API key
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY_TRANSLATE
        if (!apiKey) {
            console.error('Translation API key is not configured')
            return NextResponse.json(
                { error: 'Translation service is not configured' },
                { status: 500 }
            )
        }

        const { text, targetLanguage } = await request.json()

        if (!text || !targetLanguage) {
            return NextResponse.json(
                { error: 'Text and target language are required' },
                { status: 400 }
            )
        }

        // Check cache first
        const cacheKey = `${text}:${targetLanguage}`
        const cached = translationCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return NextResponse.json({
                translatedText: cached.translatedText,
                detectedLanguage: cached.detectedLanguage,
                targetLanguage,
                cached: true
            })
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: 8192, // Higher token limit for large captions
            }
        })

        // Step 1: Detect source language
        const detectionPrompt = `Detect the language of the following text and respond with ONLY the language name in English (e.g., "English", "Hindi", "Spanish"). Do not include any other text or explanation.

Text: "${text}"`

        const detectionResult = await model.generateContent(detectionPrompt)
        const detectedLanguage = detectionResult.response.text().trim()

        // Step 2: Translate the text
        const translationPrompt = `Translate the following text from ${detectedLanguage} to ${targetLanguage}. Provide ONLY the translated text without any explanations, notes, or additional commentary. Maintain the original tone and context.

Text to translate: "${text}"`

        const translationResult = await model.generateContent(translationPrompt)
        const translatedText = translationResult.response.text().trim()

        // Store in cache
        translationCache.set(cacheKey, {
            translatedText,
            detectedLanguage,
            timestamp: Date.now()
        })

        // Clean old cache entries (keep cache size manageable)
        if (translationCache.size > 1000) {
            const now = Date.now()
            for (const [key, value] of translationCache.entries()) {
                if (now - value.timestamp > CACHE_DURATION) {
                    translationCache.delete(key)
                }
            }
        }

        return NextResponse.json({
            translatedText,
            detectedLanguage,
            targetLanguage,
            cached: false
        })

    } catch (error: any) {
        console.error('Translation error:', error)
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        })
        return NextResponse.json(
            { error: 'Translation failed', details: error.message },
            { status: 500 }
        )
    }
}
