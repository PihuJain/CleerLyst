"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Clock,
  FileSpreadsheet,
  Globe,
  Inbox,
  ShieldCheck,
  ShieldX,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedStatus = "shortlisted" | "not_selected" | "no_record" | "public";

interface FeedItem {
  dataset_id: string;
  title: string;
  type: string;
  description: string | null;
  audience_type: "restricted" | "public";
  status: FeedStatus;
  data: Record<string, unknown> | null;
  published_at: string;
  expires_at: string | null;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  FeedStatus,
  {
    label: string;
    badgeClass: string;
    icon: React.ElementType;
    cardBorderClass: string;
  }
> = {
  shortlisted: {
    label: "Selected",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: ShieldCheck,
    cardBorderClass: "border-emerald-200 dark:border-emerald-800/40",
  },
  not_selected: {
    label: "Not Selected",
    badgeClass:
      "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    icon: ShieldX,
    cardBorderClass: "",
  },
  public: {
    label: "Open to All",
    badgeClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: Globe,
    cardBorderClass: "border-blue-200 dark:border-blue-800/40",
  },
  no_record: {
    label: "Pending",
    badgeClass:
      "bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400",
    icon: HelpCircle,
    cardBorderClass: "",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function expiryLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days <= 7) return `Expires in ${days} days`;
  return `Expires ${new Date(expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
}

function publishedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-36 rounded bg-muted animate-pulse" />
                <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="space-y-2 pt-2">
                <div className="h-3 w-full rounded bg-muted animate-pulse" />
                <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyFeed() {
  return (
    <Card>
      <CardContent className="py-16">
        <div className="text-center space-y-3">
          <Inbox className="mx-auto h-14 w-14 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">No results yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Published results will appear here once available. Check back soon.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Feed card
// ---------------------------------------------------------------------------

function FeedCard({ item }: { item: FeedItem }) {
  const config = STATUS_CONFIG[item.status];
  const StatusIcon = config.icon;
  const expiry = expiryLabel(item.expires_at);
  const dataEntries = item.data ? Object.entries(item.data) : [];
  const hasData = dataEntries.length > 0;

  return (
    <Link href={`/datasets/${item.dataset_id}`} className="block group">
      <Card
        className={cn(
          "overflow-hidden transition-all hover:shadow-md group-hover:ring-1 group-hover:ring-primary/20",
          config.cardBorderClass,
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <StatusIcon
                className={cn(
                  "h-5 w-5 mt-0.5 shrink-0",
                  item.status === "shortlisted" && "text-emerald-600 dark:text-emerald-400",
                  item.status === "public" && "text-blue-600 dark:text-blue-400",
                  item.status === "not_selected" && "text-gray-400",
                  item.status === "no_record" && "text-slate-400",
                )}
              />
              <CardTitle className="text-sm leading-snug line-clamp-2">
                {item.title}
              </CardTitle>
            </div>
            <Badge
              variant="secondary"
              className={cn("shrink-0 text-[11px]", config.badgeClass)}
            >
              {config.label}
            </Badge>
          </div>

          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 pl-7">
              {item.description}
            </p>
          )}
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {/* Data fields */}
          {hasData && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              {dataEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-muted-foreground text-xs shrink-0">
                    {formatFieldLabel(key)}
                  </span>
                  <span className="font-medium text-right truncate text-xs">
                    {formatFieldValue(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* No data message for not_selected / no_record */}
          {!hasData &&
            (item.status === "not_selected" ||
              item.status === "no_record") && (
              <p className="text-xs text-muted-foreground italic pl-1">
                {item.status === "not_selected"
                  ? "Your identifier was not found in this dataset."
                  : "Awaiting verification data."}
              </p>
            )}

          {/* Footer: date + expiry */}
          <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" />
              {publishedDate(item.published_at)}
            </span>
            {expiry && (
              <span
                className={cn(
                  "flex items-center gap-1",
                  expiry === "Expired"
                    ? "text-red-500"
                    : expiry.includes("today") || expiry.includes("tomorrow")
                      ? "text-amber-500"
                      : "",
                )}
              >
                <Clock className="h-3 w-3" />
                {expiry}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FeedClient() {
  const [feed, setFeed] = React.useState<FeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadFeed() {
      try {
        const res = await fetch("/api/me/feed");
        if (!res.ok) {
          setError("Unable to load your results. Please try again later.");
          return;
        }
        const data: FeedItem[] = await res.json();
        if (!cancelled) setFeed(data);
      } catch {
        if (!cancelled) setError("Something went wrong. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <FeedSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Results</h1>
          <p className="text-muted-foreground">
            View your verification results across all datasets.
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selected = feed.filter(
    (f) => f.status === "shortlisted" || f.status === "public",
  );
  const rest = feed.filter(
    (f) => f.status !== "shortlisted" && f.status !== "public",
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Results</h1>
        <p className="text-muted-foreground">
          {feed.length === 0
            ? "No results available yet."
            : `${feed.length} dataset${feed.length !== 1 ? "s" : ""} published by your institute`}
        </p>
      </div>

      {feed.length === 0 ? (
        <EmptyFeed />
      ) : (
        <>
          {/* Selected / Public section */}
          {selected.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Your Matches
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selected.map((item) => (
                  <FeedCard key={item.dataset_id} item={item} />
                ))}
              </div>
            </section>
          )}

          {/* Others section */}
          {rest.length > 0 && (
            <section className="space-y-3">
              {selected.length > 0 && (
                <h2 className="text-lg font-semibold tracking-tight text-muted-foreground">
                  Other Datasets
                </h2>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((item) => (
                  <FeedCard key={item.dataset_id} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
