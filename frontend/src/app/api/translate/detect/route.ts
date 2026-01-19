import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY_TRANSLATE || '')

export async function POST(request: NextRequest) {
    try {
        // Validate API key
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY_TRANSLATE
        console.log('Translation API Key exists:', !!apiKey)
        console.log('API Key length:', apiKey?.length)

        if (!apiKey) {
            console.error('Translation API key is not configured')
            return NextResponse.json(
                { error: 'Translation service is not configured' },
                { status: 500 }
            )
        }

        const { text } = await request.json()

        if (!text) {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            )
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                maxOutputTokens: 8192, // Higher token limit for large captions
            }
        })

        // Detect source language
        const detectionPrompt = `Detect the language of the following text and respond with ONLY the language name in English (e.g., "English", "Hindi", "Spanish"). Do not include any other text or explanation.

Text: "${text}"`

        const detectionResult = await model.generateContent(detectionPrompt)
        const detectedLanguage = detectionResult.response.text().trim()

        return NextResponse.json({
            detectedLanguage
        })

    } catch (error: any) {
        console.error('=== Language detection error ===')
        console.error('Error:', error)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
        console.error('Error name:', error.name)
        console.error('Full error object:', JSON.stringify(error, null, 2))
        return NextResponse.json(
            { error: 'Language detection failed', details: error.message },
            { status: 500 }
        )
    }
}
