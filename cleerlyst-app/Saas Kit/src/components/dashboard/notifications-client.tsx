"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bell,
  BellOff,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationItem {
  id: string;
  dataset_id: string;
  dataset_title: string;
  type: string;
  read_at: string | null;
  created_at: string;
}

interface NotificationsClientProps {
  notifications: NotificationItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notificationTypeLabel(type: string): string {
  switch (type) {
    case "new":
      return "New Dataset";
    case "update":
      return "Updated";
    case "action_required":
      return "Action Required";
    default:
      return type;
  }
}

function notificationTypeBadge(type: string) {
  switch (type) {
    case "new":
      return (
        <Badge
          variant="default"
          className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        >
          New
        </Badge>
      );
    case "update":
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        >
          Update
        </Badge>
      );
    case "action_required":
      return (
        <Badge variant="destructive">Action Required</Badge>
      );
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationsClient({
  notifications: initialNotifications,
}: NotificationsClientProps) {
  const [notifications, setNotifications] = React.useState(initialNotifications);
  const [markingRead, setMarkingRead] = React.useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function handleMarkRead(notificationId: string) {
    setMarkingRead(notificationId);
    try {
      const res = await fetch(
        `/api/me/notifications/${notificationId}/read`,
        { method: "PATCH" },
      );
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ),
        );
      }
    } catch {
      // Silent failure — notification stays unread
    } finally {
      setMarkingRead(null);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up"}
          </p>
        </div>
        <Bell className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* Notification list */}
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <BellOff className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">No notifications</h3>
              <p className="text-sm text-muted-foreground">
                You&apos;ll be notified when new datasets are available.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const isUnread = !n.read_at;
            return (
              <Card
                key={n.id}
                className={cn(
                  "transition-colors",
                  isUnread
                    ? "border-primary/30 bg-primary/5 dark:bg-primary/5"
                    : "opacity-75",
                )}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: content */}
                    <div className="flex items-start gap-3 min-w-0">
                      <FileSpreadsheet
                        className={cn(
                          "h-5 w-5 mt-0.5 shrink-0",
                          isUnread
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">
                            {n.dataset_title}
                          </span>
                          {notificationTypeBadge(n.type)}
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notificationTypeLabel(n.type)} &middot;{" "}
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/datasets/${n.dataset_id}`}>
                          View
                        </Link>
                      </Button>
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={markingRead === n.id}
                          onClick={() => handleMarkRead(n.id)}
                          title="Mark as read"
                        >
                          {markingRead === n.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
