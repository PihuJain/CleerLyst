import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserByGoogleId } from "@/lib/database";
import { BillingClient } from "@/components/billing/billing-client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Crown, Zap } from "lucide-react";

export const runtime = 'nodejs';

export default async function BillingPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return <div>Please sign in to view billing information.</div>;
  }

  // Get user from database
  let user;
  try {
    user = await getUserByGoogleId(session.user.id);
  } catch (error) {
    console.error("Error fetching user:", error);
    return <div>Error loading billing information.</div>;
  }

  if (!user) {
    return <div>User not found.</div>;
  }

  const isPro = user.subscription_status === 'pro';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing information.
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                {isPro ? <Crown className="h-5 w-5 text-yellow-500" /> : <Zap className="h-5 w-5" />}
                <span>Current Plan</span>
              </CardTitle>
              <CardDescription>
                Your current subscription status and features
              </CardDescription>
            </div>
            <Badge variant={isPro ? "default" : "secondary"} className="text-sm">
              {isPro ? "Pro" : "Free"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium">Plan Features</h4>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {isPro ? (
                    <>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Unlimited AI chat messages</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>1000+ bonus credits</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Priority support</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Advanced features</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>10 free credits</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Basic AI chat</span>
                      </li>
                      <li className="text-muted-foreground">
                        <span>Limited features</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium">Account Details</h4>
                <div className="mt-2 space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Email:</span> {user.email}</p>
                  <p><span className="text-muted-foreground">Credits:</span> {user.credits}</p>
                  <p><span className="text-muted-foreground">Status:</span> {isPro ? "Pro Member" : "Free User"}</p>
                  {isPro && user.subscription_end_date && (
                    <p><span className="text-muted-foreground">Valid until:</span> {new Date(user.subscription_end_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Section */}
      {!isPro && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              <span>Upgrade to Pro</span>
            </CardTitle>
            <CardDescription>
              Unlock unlimited features with our Pro plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Pro Plan</h3>
                    <p className="text-sm text-muted-foreground">One-time payment</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">$99</div>
                    <div className="text-sm text-muted-foreground">one-time</div>
                  </div>
                </div>
                
                <ul className="mt-4 space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Unlimited AI chat messages</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>1000+ bonus credits</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Lifetime access</span>
                  </li>
                </ul>
              </div>
              
              <BillingClient currentPlan={user.subscription_status} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pro Member Benefits */}
      {isPro && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              <span>Pro Member Benefits</span>
            </CardTitle>
            <CardDescription>
              Thank you for being a Pro member!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="text-center p-4 border rounded-lg">
                <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <h4 className="font-medium">Unlimited Chat</h4>
                <p className="text-sm text-muted-foreground">No limits on AI conversations</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <h4 className="font-medium">Bonus Credits</h4>
                <p className="text-sm text-muted-foreground">1000+ credits added to your account</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <Crown className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <h4 className="font-medium">Priority Support</h4>
                <p className="text-sm text-muted-foreground">Get help when you need it</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
