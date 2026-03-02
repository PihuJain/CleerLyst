"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Send,
  XCircle,
  Upload,
  FileSpreadsheet,
  Loader2,
  Eye,
  Copy,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DatasetRow {
  id: string;
  title: string;
  type: string;
  status: string;
  audience_type: "restricted" | "public";
  has_headers: boolean;
  has_visibility: boolean;
  created_at: string;
  published_at: string | null;
}

interface AdminDatasetListClientProps {
  datasets: DatasetRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  switch (status) {
    case "draft":
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          Draft
        </Badge>
      );
    case "published":
      return (
        <Badge variant="default" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
          Published
        </Badge>
      );
    case "revoked":
      return (
        <Badge variant="destructive">Revoked</Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    placement: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    academic: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    fest: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
    finance: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return (
    <Badge variant="outline" className={colors[type] ?? colors.other}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminDatasetListClient({
  datasets,
}: AdminDatasetListClientProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [publishedBanner, setPublishedBanner] = React.useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    title: "",
    type: "placement",
    description: "",
    identifier_type: "email",
    audience_type: "restricted" as "restricted" | "public",
    expires_at: "",
  });

  function getVerificationUrl(datasetId: string) {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://cleerlyst.vercel.app";
    return `${base}/datasets/${datasetId}`;
  }

  async function copyVerificationLink(datasetId: string) {
    try {
      await navigator.clipboard.writeText(getVerificationUrl(datasetId));
      toast.success("Verification link copied.");
    } catch {
      toast.error("Failed to copy link.");
    }
  }

  // ---- Actions ----

  async function handlePublish(datasetId: string) {
    setActionLoading(datasetId);
    setError(null);
    setPublishedBanner(null);
    try {
      const res = await fetch(`/api/admin/datasets/${datasetId}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Publish failed");
        return;
      }
      setPublishedBanner(datasetId);
      router.refresh();
    } catch {
      setError("Network error — could not publish dataset");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevoke(datasetId: string) {
    setActionLoading(datasetId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/datasets/${datasetId}/revoke`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Revoke failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — could not revoke dataset");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCreate() {
    setCreateLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/datasets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title,
          type: createForm.type,
          description: createForm.description || undefined,
          identifier_type:
            createForm.audience_type === "public"
              ? null
              : createForm.identifier_type || "email",
          audience_type: createForm.audience_type,
          expires_at: createForm.expires_at || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Creation failed");
        return;
      }
      setCreateOpen(false);
      setCreateForm({
        title: "",
        type: "placement",
        description: "",
        identifier_type: "email",
        audience_type: "restricted",
        expires_at: "",
      });
      // Refresh the page to get the new dataset
      router.refresh();
    } catch {
      setError("Network error — could not create dataset");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Datasets</h1>
          <p className="text-muted-foreground">
            Manage your institute&apos;s datasets.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Dataset
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-4">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Publish success banner */}
      {publishedBanner && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                Dataset published successfully.
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-500 mt-0.5">
                Share this verification link with students.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
              onClick={() => copyVerificationLink(publishedBanner)}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy Verification Link
            </Button>
          </div>
        </div>
      )}

      {/* Dataset table */}
      {datasets.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">No datasets yet</h3>
              <p className="text-sm text-muted-foreground">
                Create your first dataset to get started.
              </p>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Dataset
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Datasets</CardTitle>
            <CardDescription>
              {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} in your institute.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell>{typeBadge(d.type)}</TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(d.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {d.published_at ? formatDate(d.published_at) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Upload button — available for draft datasets without headers */}
                        {d.status === "draft" && !d.has_headers && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link href={`/admin/datasets/${d.id}/upload`}>
                              <Upload className="mr-1.5 h-3.5 w-3.5" />
                              Upload
                            </Link>
                          </Button>
                        )}

                        {/* Visibility button — available when headers exist */}
                        {d.has_headers && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link href={`/admin/datasets/${d.id}/visibility`}>
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              Visibility
                            </Link>
                          </Button>
                        )}

                        {/* Publish button — requires headers + visibility */}
                        {d.status === "draft" && (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={
                              actionLoading === d.id ||
                              !d.has_headers ||
                              !d.has_visibility
                            }
                            onClick={() => handlePublish(d.id)}
                            title={
                              !d.has_headers
                                ? "Upload records first"
                                : !d.has_visibility
                                  ? "Configure visibility first"
                                  : "Publish dataset"
                            }
                          >
                            {actionLoading === d.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Publish
                          </Button>
                        )}

                        {/* Copy Link + Revoke — published datasets */}
                        {d.status === "published" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyVerificationLink(d.id)}
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              Copy Link
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={actionLoading === d.id}
                              onClick={() => handleRevoke(d.id)}
                            >
                              {actionLoading === d.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Revoke
                            </Button>
                          </>
                        )}

                        {/* Revoked — no actions */}
                        {d.status === "revoked" && (
                          <span className="text-xs text-muted-foreground italic">
                            No actions
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Dataset Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Dataset</DialogTitle>
            <DialogDescription>
              A new dataset will be created in draft status. Upload records
              after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ds-title">Title</Label>
              <Input
                id="ds-title"
                placeholder="e.g. Placement Results 2026"
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-type">Type</Label>
              <Select
                value={createForm.type}
                onValueChange={(v) =>
                  setCreateForm((f) => ({ ...f, type: v }))
                }
              >
                <SelectTrigger id="ds-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placement">Placement</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="fest">Fest</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-desc">Description (optional)</Label>
              <Textarea
                id="ds-desc"
                placeholder="Brief description of the dataset..."
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Audience</Label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer rounded-md border p-3 hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="audience_type"
                    value="restricted"
                    checked={createForm.audience_type === "restricted"}
                    onChange={() =>
                      setCreateForm((f) => ({
                        ...f,
                        audience_type: "restricted",
                        identifier_type: f.identifier_type || "email",
                      }))
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">Restricted</span>
                    <p className="text-xs text-muted-foreground">
                      Only matched students can view their record
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer rounded-md border p-3 hover:bg-muted/50 transition-colors">
                  <input
                    type="radio"
                    name="audience_type"
                    value="public"
                    checked={createForm.audience_type === "public"}
                    onChange={() =>
                      setCreateForm((f) => ({
                        ...f,
                        audience_type: "public",
                        identifier_type: "",
                      }))
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">Public</span>
                    <p className="text-xs text-muted-foreground">
                      Visible to all students in your institute.
                      Single row only, no identifier needed.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {createForm.audience_type === "restricted" && (
              <div className="space-y-2">
                <Label htmlFor="ds-ident">Identifier Type</Label>
                <Select
                  value={createForm.identifier_type || "email"}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, identifier_type: v }))
                  }
                >
                  <SelectTrigger id="ds-ident">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="reg_no">Registration Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ds-expires">Expires At (optional)</Label>
              <Input
                id="ds-expires"
                type="date"
                value={createForm.expires_at}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    expires_at: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createLoading || !createForm.title.trim()}
            >
              {createLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Dataset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
