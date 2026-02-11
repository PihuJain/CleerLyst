import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendEmail, createSubscriptionConfirmationEmail } from '@/lib/resend';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userName, userEmail, planName = 'Pro' } = body;

    // Validate required fields
    if (!userName || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: userName, userEmail' },
        { status: 400 }
      );
    }

    // Create subscription confirmation email
    const emailData = createSubscriptionConfirmationEmail(userName, userEmail, planName);
    
    // Send email
    const result = await sendEmail(emailData);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Subscription confirmation email sent successfully',
        data: result.data
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to send email', details: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Subscription email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
