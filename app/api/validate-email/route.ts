import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Basic format validation first
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({
                valid: false,
                reason: 'Invalid email format'
            });
        }

        const apiKey = process.env.ABSTRACT_API_KEY;

        if (!apiKey) {
            console.warn('ABSTRACT_API_KEY not set, using basic validation only');
            // Fallback: solo validar formato si no hay API key
            return NextResponse.json({
                valid: true,
                fallback: true,
                message: 'API key not configured, using basic validation'
            });
        }

        // Call Abstract API (Email Reputation)
        // Documentation: https://docs.abstractapi.com/email-reputation-validation/
        const response = await fetch(
            `https://emailreputation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`,
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            console.error('Abstract API error:', response.status);
            // Fallback to basic validation if API fails
            return NextResponse.json({
                valid: true,
                fallback: true,
                message: 'API unavailable, using basic validation'
            });
        }

        const data = await response.json();

        // Check if email is deliverable based on reputation data
        // API returns fields like: deliverability, quality_score, is_valid_format, etc.
        const isDeliverable = data.deliverability === 'DELIVERABLE' || data.deliverability === 'RISKY';
        const isDisposable = data.is_disposable_email?.value || false;

        // Quality score threshold (optional, e.g. < 0.5 might be suspicious)
        const qualityScore = data.quality_score;

        return NextResponse.json({
            valid: isDeliverable && !isDisposable,
            quality_score: qualityScore,
            is_disposable: isDisposable,
            deliverability: data.deliverability,
            is_valid_format: data.is_valid_format?.value,
            is_free_email: data.is_free_email?.value,
            reason: !isDeliverable ? `Email is ${data.deliverability?.toLowerCase() || 'undeliverable'}` : (isDisposable ? 'Disposable email not allowed' : null)
        });
    } catch (error) {
        console.error('Email validation error:', error);
        // Fallback to basic validation on error
        return NextResponse.json({
            valid: true,
            fallback: true,
            message: 'Validation service error, using basic validation'
        });
    }
}
