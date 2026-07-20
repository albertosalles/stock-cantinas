import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const connectionToken = await getStripe().terminal.connectionTokens.create();
        return NextResponse.json({ secret: connectionToken.secret });
    } catch (error) {
        console.error('Error creating connection token:', error);
        return NextResponse.json(
            { error: 'Failed to create connection token' },
            { status: 500 }
        );
    }
}
