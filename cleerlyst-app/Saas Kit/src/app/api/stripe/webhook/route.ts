import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { getUserByStripeCustomerId, updateUserSubscription, addCredits, getUserByEmail, getUserById, incrementDiscountUsage } from '@/lib/database';
import { sendEmail, createSubscriptionConfirmationEmail } from '@/lib/resend';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    console.log('Webhook received:', {
      hasBody: !!body,
      hasSignature: !!signature,
      bodyLength: body.length
    });

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature);
      console.log('Webhook signature verified successfully, event type:', event.type);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log('Processing checkout.session.completed:', {
          sessionId: session.id,
          paymentStatus: session.payment_status,
          customerId: session.customer,
          amount: session.amount_total,
          metadata: session.metadata
        });

        if (session.payment_status === 'paid') {
          let user = null;

          // Method 1: Try to find user by Stripe customer ID
          if (session.customer) {
            try {
              user = await getUserByStripeCustomerId(session.customer as string);
              if (user) {
                console.log(`Found user by customer ID ${session.customer}: ${user.email}`);
              }
            } catch (error) {
              console.error('Error finding user by customer ID:', error);
            }
          }

          // Method 2: Try to find user by metadata user ID
          if (!user && session.metadata?.userId) {
            try {
              const userId = parseInt(session.metadata.userId);
              user = await getUserById(userId);
              if (user) {
                console.log(`Found user by metadata user ID ${userId}: ${user.email}`);
              }
            } catch (error) {
              console.error('Error finding user by metadata user ID:', error);
            }
          }

          // Method 3: Try to find user by metadata email
          if (!user && session.metadata?.userEmail) {
            try {
              user = await getUserByEmail(session.metadata.userEmail);
              if (user) {
                console.log(`Found user by metadata email ${session.metadata.userEmail}: ${user.email}`);
              }
            } catch (error) {
              console.error('Error finding user by metadata email:', error);
            }
          }

          if (user) {
            try {
              // Update user to Pro subscription
              const updateResult = await updateUserSubscription(user.id, {
                subscription_status: 'pro',
                stripe_customer_id: session.customer as string,
                subscription_id: session.id,
                // For one-time payment, no end date (lifetime access)
              });

              // Add bonus credits for Pro users (1000 credits)
              const creditsResult = await addCredits(user.id, 1000);

              // Track discount usage if a discount was applied
              if (session.total_details?.breakdown?.discounts && session.total_details.breakdown.discounts.length > 0) {
                for (const discount of session.total_details.breakdown.discounts) {
                  if (discount.discount?.coupon?.id) {
                    // Extract discount code from Stripe coupon ID (format: discount_CODENAME)
                    const couponId = discount.discount.coupon.id;
                    if (couponId.startsWith('discount_')) {
                      const discountCode = couponId.replace('discount_', '').toUpperCase();
                      try {
                        const usageTracked = await incrementDiscountUsage(discountCode);
                        console.log(`Discount usage tracked for code ${discountCode}:`, usageTracked);
                      } catch (discountError) {
                        console.error(`Error tracking discount usage for code ${discountCode}:`, discountError);
                      }
                    }
                  }
                }
              }

              // Send subscription confirmation email
              if (user.name && user.email) {
                try {
                  const subscriptionEmailData = createSubscriptionConfirmationEmail(user.name, user.email, 'Pro');
                  await sendEmail(subscriptionEmailData);
                  console.log(`Subscription confirmation email sent to ${user.email}`);
                } catch (emailError) {
                  console.error("Failed to send subscription confirmation email:", emailError);
                  // Don't fail the subscription if email fails
                }
              }

              console.log(`✅ User ${user.email} successfully upgraded to Pro plan:`, {
                userId: user.id,
                subscriptionUpdated: updateResult,
                creditsAdded: creditsResult ? creditsResult.success : false,
                newCreditBalance: creditsResult ? creditsResult.newBalance : 'unknown'
              });
            } catch (error) {
              console.error(`❌ Error upgrading user ${user.email} to Pro:`, error);
            }
          } else {
            console.error(`❌ No user found for checkout session ${session.id}:`, {
              customerId: session.customer,
              metadata: session.metadata
            });
          }
        } else {
          console.log('Checkout session not processed - payment not completed:', {
            paymentStatus: session.payment_status,
            hasCustomer: !!session.customer
          });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', paymentIntent.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
