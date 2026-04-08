import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDetailedUserStats, getRecentUserActivity, type User } from "@/lib/database";
import { 
  Users, 
  UserPlus, 
  Activity, 
  Calendar,
  TrendingUp,
  Clock
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const runtime = 'nodejs';

export default async function AdminDashboard() {
  // Get detailed statistics
  let stats;
  try {
    console.log("Fetching admin dashboard stats...");
    stats = await getDetailedUserStats();
    console.log("Admin stats fetched:", stats);
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    stats = {
      totalUsers: 0,
      activeToday: 0,
      activeThisWeek: 0,
      activeThisMonth: 0,
      newToday: 0,
      newThisWeek: 0,
      newThisMonth: 0,
      dailySignups: []
    };
  }

  // Get recent user activity
  let recentUsers: User[];
  try {
    recentUsers = await getRecentUserActivity(10);
  } catch (error) {
    console.error("Error fetching recent users:", error);
    recentUsers = [];
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isRecentLogin = (lastLogin: Date) => {
    const now = new Date();
    const loginDate = new Date(lastLogin);
    const diffHours = (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  const overviewStats = [
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      change: `+${stats.newThisMonth} this month`,
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "Active Today",
      value: stats.activeToday.toLocaleString(),
      change: `${stats.activeThisWeek} this week`,
      icon: Activity,
      color: "text-green-600"
    },
    {
      title: "New Today",
      value: stats.newToday.toLocaleString(),
      change: `${stats.newThisWeek} this week`,
      icon: UserPlus,
      color: "text-purple-600"
    },
    {
      title: "Monthly Active",
      value: stats.activeThisMonth.toLocaleString(),
      change: "Active this month",
      icon: Calendar,
      color: "text-orange-600"
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of user activity and system statistics (Real-time data from database).
        </p>
        {/* Debug info to verify real data */}
        <div className="text-xs text-muted-foreground mt-2">
          Last updated: {new Date().toLocaleString()} | Total Users: {stats.totalUsers} | Data Source: PostgreSQL Database
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {overviewStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  <span className={stat.color}>{stat.change}</span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent User Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent User Activity</span>
            </CardTitle>
            <CardDescription>
              Latest user logins and registrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image_url || ""} alt={user.name || ""} />
                        <AvatarFallback className="text-xs">
                          {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium">{user.name || "No name"}</p>
                          {isRecentLogin(user.last_login) && (
                            <Badge variant="secondary" className="text-xs">
                              Online
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(user.last_login)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Quick Stats</span>
            </CardTitle>
            <CardDescription>
              Key metrics at a glance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Users Today</span>
                <span className="text-lg font-bold text-green-600">+{stats.newToday}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Users This Week</span>
                <span className="text-lg font-bold text-blue-600">+{stats.newThisWeek}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Users This Month</span>
                <span className="text-lg font-bold text-purple-600">+{stats.newThisMonth}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Active Rate</span>
                <span className="text-lg font-bold text-orange-600">
                  {stats.totalUsers > 0 ? Math.round((stats.activeThisMonth / stats.totalUsers) * 100) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
