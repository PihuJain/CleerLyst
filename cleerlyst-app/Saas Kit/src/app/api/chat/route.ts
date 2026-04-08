import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createChatCompletion, type ChatMessage } from '@/lib/openrouter';
import { incrementMessageCount, checkUsageLimits } from '@/lib/usage-tracking';
import { deductCredits, getUserCredits } from '@/lib/database';

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

    const userId = session.user.id;

    // Check credits first
    const currentCredits = await getUserCredits(userId);
    if (currentCredits < 1) {
      return NextResponse.json(
        {
          error: 'Insufficient credits. You need at least 1 credit to send a message.',
          code: 'INSUFFICIENT_CREDITS',
          credits: currentCredits
        },
        { status: 402 }
      );
    }

    // Check usage limits
    const usageLimits = checkUsageLimits(userId);
    if (!usageLimits.canSendMessage) {
      return NextResponse.json(
        {
          error: 'Usage limit exceeded. Please try again tomorrow or upgrade your plan.',
          code: 'USAGE_LIMIT_EXCEEDED'
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { messages, temperature, max_tokens } = body;

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Validate message format
    for (const message of messages) {
      if (!message.role || !message.content) {
        return NextResponse.json(
          { error: 'Each message must have role and content' },
          { status: 400 }
        );
      }
      if (!['system', 'user', 'assistant'].includes(message.role)) {
        return NextResponse.json(
          { error: 'Message role must be system, user, or assistant' },
          { status: 400 }
        );
      }
    }

    // Add system message if not present
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'You are a helpful AI assistant integrated into an AI SAAS platform. Be helpful, accurate, and concise in your responses.'
    };

    const finalMessages: ChatMessage[] = messages[0]?.role === 'system' 
      ? messages 
      : [systemMessage, ...messages];

    // Deduct credits before making the API call
    const creditResult = await deductCredits(userId, 1);
    if (!creditResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to deduct credits. Please try again.',
          code: 'CREDIT_DEDUCTION_FAILED',
          credits: creditResult.newBalance
        },
        { status: 402 }
      );
    }

    // Call OpenRouter API
    const completion = await createChatCompletion(finalMessages, {
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 1000,
    });

    // Track usage
    const tokensUsed = completion.usage?.total_tokens || 0;
    incrementMessageCount(userId, tokensUsed);

    // Return the response with updated credits
    return NextResponse.json({
      message: completion.choices[0]?.message,
      usage: completion.usage,
      model: completion.model,
      credits: creditResult.newBalance,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
