import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { validateDiscountCode } from '@/lib/database';

export const runtime = 'nodejs';

// POST /api/discounts/validate - Validate discount code for users
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code } = body;

    // Validate required fields
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Discount code is required' },
        { status: 400 }
      );
    }

    // Validate discount code
    const validation = await validateDiscountCode(code.toUpperCase());

    if (!validation.is_valid) {
      return NextResponse.json({
        success: false,
        error: validation.error_message || 'Invalid discount code'
      }, { status: 400 });
    }

    // Return validation success with discount details
    return NextResponse.json({
      success: true,
      data: {
        discount_id: validation.discount_id,
        discount_type: validation.discount_type,
        discount_value: validation.discount_value,
        code: code.toUpperCase()
      }
    });

  } catch (error) {
    console.error('Discount validation error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
