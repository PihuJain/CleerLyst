"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Eye,
  Lock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DatasetVisibilityClientProps {
  datasetId: string;
  datasetTitle: string;
  datasetType: string;
  datasetStatus: string;
  headers: string[];
  allowedFields: string[];
  identifierType: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FIELDS = 50;
const MAX_FIELD_NAME_LENGTH = 128;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  switch (status) {
    case "draft":
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        >
          Draft
        </Badge>
      );
    case "published":
      return (
        <Badge
          variant="default"
          className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
        >
          Published
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function typeBadge(type: string) {
  const colors: Record<string, string> = {
    placement:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    academic:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    fest: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
    finance:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    other:
      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return (
    <Badge variant="outline" className={colors[type] ?? colors.other}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DatasetVisibilityClient({
  datasetId,
  datasetTitle,
  datasetType,
  datasetStatus,
  headers,
  allowedFields: initialAllowedFields,
  identifierType,
}: DatasetVisibilityClientProps) {
  const router = useRouter();
  const isReadOnly = datasetStatus !== "draft";
  const hasHeaders = headers.length > 0;

  // Filter out the identifier column — defense in depth
  // The identifier column name depends on identifier_type:
  //   email → "email", reg_no → "reg_no"
  // Headers should already exclude the identifier (done at upload time),
  // but we filter again here for safety.
  const selectableHeaders = React.useMemo(
    () =>
      headers.filter(
        (h) =>
          h !== identifierType &&
          h.trim().length > 0 &&
          h.length <= MAX_FIELD_NAME_LENGTH,
      ),
    [headers, identifierType],
  );

  // Controlled state for selected fields
  const [selected, setSelected] = React.useState<string[]>(() => {
    // Initialize only with fields that actually exist in headers
    return initialAllowedFields.filter((f) => selectableHeaders.includes(f));
  });

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Track whether selection has changed from initial
  const initialRef = React.useRef(
    initialAllowedFields
      .filter((f) => selectableHeaders.includes(f))
      .sort()
      .join(","),
  );
  const hasChanged = selected.sort().join(",") !== initialRef.current;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function toggleField(field: string) {
    if (isReadOnly) return;

    setSelected((prev) => {
      if (prev.includes(field)) {
        return prev.filter((f) => f !== field);
      }
      if (prev.length >= MAX_FIELDS) {
        toast.error(`Maximum ${MAX_FIELDS} fields allowed`);
        return prev;
      }
      return [...prev, field];
    });
    setError(null);
  }

  function selectAll() {
    if (isReadOnly) return;
    const toSelect = selectableHeaders.slice(0, MAX_FIELDS);
    setSelected(toSelect);
    setError(null);
  }

  function deselectAll() {
    if (isReadOnly) return;
    setSelected([]);
    setError(null);
  }

  async function handleSave() {
    // ----- Client-side validation (mirrors backend) -----

    // Trim and deduplicate
    const cleaned = [...new Set(selected.map((f) => f.trim()).filter(Boolean))];

    // Must have at least 1 field
    if (cleaned.length === 0) {
      setError("Select at least one field to make visible.");
      return;
    }

    // Max 50 fields
    if (cleaned.length > MAX_FIELDS) {
      setError(`Maximum ${MAX_FIELDS} fields allowed.`);
      return;
    }

    // Every field must exist in headers
    const invalid = cleaned.filter((f) => !selectableHeaders.includes(f));
    if (invalid.length > 0) {
      setError(`Invalid field(s): ${invalid.join(", ")}`);
      return;
    }

    // Max 128 chars per field
    const tooLong = cleaned.filter((f) => f.length > MAX_FIELD_NAME_LENGTH);
    if (tooLong.length > 0) {
      setError(`Field name too long: ${tooLong[0]}`);
      return;
    }

    // Ensure identifier column not included (defense in depth)
    const sanitized = cleaned.filter((f) => f !== identifierType);

    // ----- API call -----

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/datasets/${datasetId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowed_fields: sanitized }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific backend errors
        if (res.status === 403 && data.error === "visibility_locked") {
          toast.error("Visibility is locked after publication.");
          router.push("/admin/datasets");
          return;
        }
        if (res.status === 404) {
          toast.error("Dataset not found.");
          router.push("/admin/datasets");
          return;
        }
        setError(data.error || "Save failed");
        return;
      }

      // Success → redirect to dataset list
      toast.success("Visibility configuration saved.");
      router.push("/admin/datasets");
      router.refresh();
    } catch {
      setError("Network error — could not save visibility configuration.");
    } finally {
      setSaving(false);
    }
  }

  // =========================================================================
  // CASE 1 — No Headers (no upload yet)
  // =========================================================================

  if (!hasHeaders) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/datasets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Datasets
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Configure Visibility
          </h1>
          <p className="text-muted-foreground mt-1">
            Dataset:{" "}
            <span className="font-medium text-foreground">{datasetTitle}</span>
          </p>
        </div>

        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-400">
                  Upload records before configuring visibility
                </p>
                <p className="text-sm text-muted-foreground">
                  This dataset has no uploaded records yet. Column headers are
                  extracted during upload and used to configure which fields
                  students can see.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/datasets/${datasetId}/upload`}>
                    Upload Records
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // CASE 2 — Published Dataset (read-only)
  // CASE 3 — Draft Dataset (editable)
  // =========================================================================

  return (
    <div className="space-y-6 max-w-2xl pb-24">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/datasets">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Datasets
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Configure Visibility
        </h1>
        <p className="text-muted-foreground mt-1">
          Choose which fields students can see when viewing their records.
        </p>
      </div>

      {/* Dataset info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {datasetTitle}
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            {typeBadge(datasetType)}
            {statusBadge(datasetStatus)}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Read-only banner */}
      {isReadOnly && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-400">
                  Visibility is locked after publication
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  This dataset has been published. Visibility configuration
                  cannot be changed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error banner */}
      {error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-400">
                  {error}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Field selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Field Visibility
          </CardTitle>
          <CardDescription>
            {selected.length} of {selectableHeaders.length} field
            {selectableHeaders.length !== 1 ? "s" : ""} selected
            {selected.length > 0 && !isReadOnly && (
              <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                — ready to save
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk actions (draft only) */}
          {!isReadOnly && (
            <div className="flex items-center gap-2 pb-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={
                  selected.length === selectableHeaders.length || saving
                }
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                disabled={selected.length === 0 || saving}
              >
                Deselect All
              </Button>
            </div>
          )}

          {/* Checkbox list */}
          <div className="space-y-3">
            {selectableHeaders.map((header) => {
              const isChecked = selected.includes(header);
              return (
                <div
                  key={header}
                  className="flex items-center space-x-3 py-1.5"
                >
                  <Checkbox
                    id={`field-${header}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleField(header)}
                    disabled={isReadOnly || saving}
                  />
                  <Label
                    htmlFor={`field-${header}`}
                    className={
                      isReadOnly
                        ? "text-muted-foreground cursor-not-allowed"
                        : "cursor-pointer"
                    }
                  >
                    {header}
                  </Label>
                </div>
              );
            })}
          </div>

          {selectableHeaders.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No configurable fields found.
            </p>
          )}

          {/* Warning if all fields selected */}
          {selected.length === selectableHeaders.length &&
            selectableHeaders.length > 0 &&
            !isReadOnly && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 mt-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-400">
                  All fields are selected. Students will see every data column.
                  Consider selecting only the fields students need.
                </p>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Security note */}
      <p className="text-xs text-muted-foreground text-center">
        {identifierType
          ? `Identifier column (${identifierType}) is never exposed to students. `
          : ""}
        Unselected fields remain encrypted and inaccessible.
      </p>

      {/* Sticky footer save bar (draft only) */}
      {!isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-6 py-4 z-40">
          <div className="max-w-2xl flex items-center justify-between gap-4">
            <Button variant="outline" asChild disabled={saving}>
              <Link href="/admin/datasets">Cancel</Link>
            </Button>

            <div className="flex items-center gap-3">
              {hasChanged && selected.length > 0 && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-600 mr-1" />
                  {selected.length} field{selected.length !== 1 ? "s" : ""}{" "}
                  selected
                </span>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || selected.length === 0 || !hasChanged}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Save Visibility
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
