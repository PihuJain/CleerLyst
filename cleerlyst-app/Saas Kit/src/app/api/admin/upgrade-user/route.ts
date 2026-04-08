import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAccess } from '@/lib/admin-auth';
import { getUserByEmail, updateUserSubscription, addCredits } from '@/lib/database';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    await requireAdminAccess();

    const { email, reason } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already Pro
    if (user.subscription_status === 'pro') {
      return NextResponse.json(
        { error: 'User is already a Pro member' },
        { status: 400 }
      );
    }

    // Update user to Pro subscription
    const updateResult = await updateUserSubscription(user.id, {
      subscription_status: 'pro',
      stripe_customer_id: user.stripe_customer_id,
      subscription_id: `manual_upgrade_${Date.now()}`,
      // For manual upgrade, no end date (lifetime access)
    });

    if (!updateResult) {
      return NextResponse.json(
        { error: 'Failed to update user subscription' },
        { status: 500 }
      );
    }

    // Add bonus credits for Pro users (1000 credits)
    const creditsResult = await addCredits(user.id, 1000);

    console.log(`Admin manually upgraded user ${user.email} to Pro:`, {
      userId: user.id,
      reason: reason || 'Manual admin upgrade',
      subscriptionUpdated: updateResult,
      creditsAdded: creditsResult.success,
      newCreditBalance: creditsResult.newBalance
    });

    return NextResponse.json({
      success: true,
      message: `User ${user.email} successfully upgraded to Pro`,
      user: {
        id: user.id,
        email: user.email,
        subscription_status: 'pro',
        credits: creditsResult.newBalance
      }
    });

  } catch (error) {
    console.error('Manual upgrade error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
