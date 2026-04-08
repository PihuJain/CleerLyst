import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllUsers, type User } from "@/lib/database";
import { UserManagementClient } from "@/components/admin/user-management-client";

export const runtime = 'nodejs';

export default async function AdminUsersPage() {
  // Get all users from database
  let users: User[];
  try {
    users = await getAllUsers();
  } catch (error) {
    console.error("Error fetching users:", error);
    users = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage all registered users in your application.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users ({users.length})</CardTitle>
          <CardDescription>
            View, search, and manage user accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagementClient initialUsers={users} />
        </CardContent>
      </Card>
    </div>
  );
}
