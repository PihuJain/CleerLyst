import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const runtime = 'nodejs';
import {
  User,
  Settings
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;

  // Role is stored in the DB — no plaintext email check
  const isAdmin = user?.role === "admin";

  // Regular user stats
  const regularUserStats = [
    {
      title: "Profile",
      value: "Complete",
      change: "Manage your account",
      icon: User,
    },
    {
      title: "Settings",
      value: "Customize",
      change: "Personalize your experience",
      icon: Settings,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isAdmin ? "Admin Dashboard" : `Welcome back, ${user?.name?.split(' ')[0] || "User"}!`}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Here's what's happening with your application."
              : "Explore the features below."
            }
          </p>
        </div>
        {isAdmin && (
          <div className="flex space-x-2">
            <Button asChild>
              <Link href="/admin">
                <Settings className="mr-2 h-4 w-4" />
                Admin Panel
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {regularUserStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-blue-600">{stat.change}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? "Admin Actions" : "Quick Start"}</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Manage your application"
                : "Get started with features"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isAdmin ? (
              <>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/admin">Admin Panel</Link>
                </Button>
              </>
            ) : (
              <>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/dashboard/profile">Edit Profile</Link>
                </Button>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/dashboard/settings">Settings</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>
              Your current account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Name</span>
                <span className="text-sm font-medium">{user?.name || "Not set"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Role</span>
                <Badge variant={isAdmin ? "default" : "secondary"}>
                  {user?.role === "admin" ? "Admin" : "Student"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
