"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Lock,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedStatus =
  | "shortlisted"
  | "public"
  | "not_applicable"
  | "missing_identifier";

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
  identifier_type?: string;
}

interface FeedResponse {
  requires_identifier_setup: boolean;
  required_identifier_types: string[];
  items: FeedItem[];
}

// ---------------------------------------------------------------------------
// Status config — emotional clarity mapping
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  FeedStatus,
  {
    label: string;
    subtitle: string;
    badgeClass: string;
    icon: React.ElementType;
    iconClass: string;
    cardBorderClass: string;
  }
> = {
  shortlisted: {
    label: "Selected",
    subtitle: "You\u2019re selected.",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: ShieldCheck,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    cardBorderClass: "border-emerald-200 dark:border-emerald-800/40",
  },
  public: {
    label: "Institute Update",
    subtitle: "Open to all students.",
    badgeClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: Globe,
    iconClass: "text-blue-600 dark:text-blue-400",
    cardBorderClass: "border-blue-200 dark:border-blue-800/40",
  },
  not_applicable: {
    label: "Not part of this list",
    subtitle: "This result does not apply to you.",
    badgeClass:
      "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400",
    icon: ShieldOff,
    iconClass: "text-gray-400 dark:text-gray-500",
    cardBorderClass: "",
  },
  missing_identifier: {
    label: "Action needed",
    subtitle: "We need your identifier to check this result.",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: AlertTriangle,
    iconClass: "text-amber-500 dark:text-amber-400",
    cardBorderClass: "border-amber-200 dark:border-amber-800/40",
  },
};

// ---------------------------------------------------------------------------
// Priority ordering — psychological ranking
// ---------------------------------------------------------------------------

const STATUS_PRIORITY: Record<FeedStatus, number> = {
  shortlisted: 1,
  public: 2,
  not_applicable: 3,
  missing_identifier: 4,
};

function sortFeed(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 99;
    const pb = STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    return (
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function formatIdentifierType(type?: string): string {
  if (!type) return "your identifier";
  if (type === "email") return "your email";
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
// Global identifier gate banner
// ---------------------------------------------------------------------------

function IdentifierGateBanner({
  types,
}: {
  types: string[];
}) {
  const label =
    types.length === 1
      ? formatIdentifierType(types[0])
      : types.map(formatIdentifierType).join(" and ");

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/20 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-2 min-w-0">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Add {label} to see your results
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-400/80 leading-relaxed">
            Some lists require your identifier to check if you&apos;re
            included. Add it once and your results will appear automatically.
          </p>
          <Button
            asChild
            size="sm"
            className="mt-1 bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            <Link href="/dashboard/profile">
              Add Identifier
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed card
// ---------------------------------------------------------------------------

function FeedCard({
  item,
  index = 0,
  highlightId,
}: {
  item: FeedItem;
  index?: number;
  highlightId?: string | null;
}) {
  const config = STATUS_CONFIG[item.status];
  const StatusIcon = config.icon;
  const expiry = expiryLabel(item.expires_at);
  const dataEntries = item.data ? Object.entries(item.data) : [];
  const hasData = dataEntries.length > 0;
  const isSelected = item.status === "shortlisted";
  const isPublic = item.status === "public";
  const isHighlighted = highlightId === item.dataset_id;

  const cardRef = React.useRef<HTMLDivElement>(null);
  const [showHighlight, setShowHighlight] = React.useState(false);

  React.useEffect(() => {
    if (!isHighlighted || !cardRef.current) return;
    const el = cardRef.current;
    const timer = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setShowHighlight(true);
    }, 350);
    const fadeTimer = setTimeout(() => setShowHighlight(false), 1600);
    return () => {
      clearTimeout(timer);
      clearTimeout(fadeTimer);
    };
  }, [isHighlighted]);

  const cardInner = (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200 ease-out",
        isSelected && [
          "border-l-4 border-l-emerald-500 dark:border-l-emerald-400",
          "shadow-sm hover:shadow-md hover:shadow-emerald-200/40 dark:hover:shadow-emerald-900/20",
          "hover:-translate-y-0.5",
          "group-hover:ring-1 group-hover:ring-emerald-300/30",
        ],
        isPublic && [
          "shadow-sm hover:shadow-md",
          "group-hover:ring-1 group-hover:ring-blue-200/30",
        ],
        !isSelected &&
          !isPublic &&
          item.status !== "missing_identifier" &&
          "hover:shadow-md group-hover:ring-1 group-hover:ring-primary/20",
        config.cardBorderClass,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <StatusIcon
              className={cn("h-5 w-5 mt-0.5 shrink-0", config.iconClass)}
            />
            <CardTitle className="text-sm leading-snug line-clamp-2">
              {item.title}
            </CardTitle>
          </div>
          <Badge
            variant="secondary"
            className={cn("shrink-0 text-[11px]", config.badgeClass)}
          >
            {isPublic && <Globe className="mr-1 h-3 w-3" />}
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

        {item.status === "not_applicable" && (
          <p className="text-xs text-muted-foreground pl-1">
            {config.subtitle}
          </p>
        )}

        {item.status === "missing_identifier" && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-3 space-y-2">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Add {formatIdentifierType(item.identifier_type)} to see
              your result for this list.
            </p>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20"
            >
              <Link href="/dashboard/profile">
                Add Identifier
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        )}

        {/* Footer: date + expiry + CTA */}
        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileSpreadsheet className="h-3 w-3" />
            {publishedDate(item.published_at)}
          </span>
          <div className="flex items-center gap-3">
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
            {isSelected && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                View Details &rarr;
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const wrapper = (children: React.ReactNode) => (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className={cn(
        "rounded-xl transition-shadow duration-700",
        showHighlight &&
          "ring-2 ring-emerald-400/50 dark:ring-emerald-500/40 shadow-lg shadow-emerald-100/40 dark:shadow-emerald-900/20",
      )}
    >
      {children}
    </motion.div>
  );

  if (item.status === "missing_identifier") {
    return wrapper(<div>{cardInner}</div>);
  }

  return wrapper(
    <Link href={`/datasets/${item.dataset_id}`} className="block group">
      {cardInner}
    </Link>,
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FeedClient() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [feedData, setFeedData] = React.useState<FeedResponse | null>(null);
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
        const data: FeedResponse = await res.json();
        if (!cancelled) setFeedData(data);
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

  if (error || !feedData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Results</h1>
          <p className="text-muted-foreground">
            View your results across all published lists.
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-sm text-destructive">
              {error ?? "Something went wrong."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { requires_identifier_setup, required_identifier_types, items } =
    feedData;

  const visibleItems = requires_identifier_setup
    ? items.filter((f) => f.status !== "missing_identifier")
    : items;

  const sorted = sortFeed(visibleItems);

  const highlighted = sorted.filter(
    (f) => f.status === "shortlisted" || f.status === "public",
  );
  const rest = sorted.filter(
    (f) => f.status !== "shortlisted" && f.status !== "public",
  );

  const totalVisible = visibleItems.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Results</h1>
        <p className="text-muted-foreground">
          {items.length === 0
            ? "No results available yet."
            : `${items.length} list${items.length !== 1 ? "s" : ""} published by your institute`}
        </p>
      </div>

      {/* Global identifier gate banner */}
      {requires_identifier_setup && (
        <IdentifierGateBanner types={required_identifier_types} />
      )}

      {items.length === 0 ? (
        <EmptyFeed />
      ) : totalVisible === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-2">
              <Lock className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Add your identifier above to unlock your results.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Selected / Public — prominent */}
          {highlighted.length > 0 && (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  Your Matches
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Lists where you have results or announcements.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {highlighted.map((item, i) => (
                  <FeedCard
                    key={item.dataset_id}
                    item={item}
                    index={i}
                    highlightId={highlightId}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Others — subdued, visually separated */}
          {rest.length > 0 && (
            <section
              className={cn(
                "space-y-4",
                highlighted.length > 0 && "mt-8 pt-6 border-t border-muted",
              )}
            >
              <div>
                <h2
                  className={cn(
                    "text-lg font-semibold tracking-tight",
                    highlighted.length > 0 && "text-muted-foreground",
                  )}
                >
                  Other Lists
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Other published lists from your institute.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((item, i) => (
                  <FeedCard
                    key={item.dataset_id}
                    item={item}
                    index={highlighted.length + i}
                    highlightId={highlightId}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
