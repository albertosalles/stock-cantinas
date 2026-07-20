import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    typescript: true,
});

export async function POST() {
    try {
        const connectionToken = await stripe.terminal.connectionTokens.create();
        return NextResponse.json({ secret: connectionToken.secret });
    } catch (error) {
        console.error('Error creating connection token:', error);
        return NextResponse.json(
            { error: 'Failed to create connection token' },
            { status: 500 }
        );
    }
}
