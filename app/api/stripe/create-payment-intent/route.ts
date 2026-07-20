import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { amount, metadata } = await req.json();

        if (!amount || amount <= 0) {
            return NextResponse.json(
                { error: 'Invalid amount' },
                { status: 400 }
            );
        }

        const paymentIntent = await getStripe().paymentIntents.create({
            amount: Math.round(amount), // amount in cents
            currency: 'eur',
            payment_method_types: ['card_present'],
            capture_method: 'automatic',
            metadata: metadata || {},
        });

        return NextResponse.json({
            id: paymentIntent.id,
            client_secret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        return NextResponse.json(
            { error: 'Failed to create payment intent' },
            { status: 500 }
        );
    }
}
