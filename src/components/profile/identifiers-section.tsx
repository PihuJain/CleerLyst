"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Identifier {
  type: string;
  value: string;
}

/** Human-readable labels for each identifier type. */
const TYPE_LABELS: Record<string, string> = {
  reg_no: "Registration Number",
  roll_no: "Roll Number",
};

/** Ordered list of supported identifier types. */
const IDENTIFIER_TYPES = ["reg_no", "roll_no"] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
//
// SECURITY:
//   • Identifier values are never stored in localStorage.
//   • Identifier values are never logged (console.log, etc.).
//   • Fetch happens client-side only — after auth.
//   • Input is uppercased on blur (canonical form).
//
// ---------------------------------------------------------------------------

export function IdentifiersSection() {
  const [identifiers, setIdentifiers] = useState<Identifier[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<string>("");
  const [dialogValue, setDialogValue] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteType, setDeleteType] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ----- Fetch identifiers -----

  const fetchIdentifiers = useCallback(async () => {
    try {
      const res = await fetch("/api/me/identifiers");
      if (res.ok) {
        const data: Identifier[] = await res.json();
        setIdentifiers(data);
      }
    } catch {
      // Silently fail — identifiers section will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIdentifiers();
  }, [fetchIdentifiers]);

  // ----- Add / Edit handler -----

  const openAddDialog = (type: string) => {
    setDialogType(type);
    setDialogValue("");
    setIsEdit(false);
    setDialogOpen(true);
  };

  const openEditDialog = (type: string, currentValue: string) => {
    setDialogType(type);
    setDialogValue(currentValue);
    setIsEdit(true);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const trimmed = dialogValue.trim();
    if (!trimmed) return;

    setSubmitting(true);

    try {
      // If editing, delete the old one first
      if (isEdit) {
        await fetch(`/api/me/identifiers/${dialogType}`, {
          method: "DELETE",
        });
      }

      const res = await fetch("/api/me/identifiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: dialogType, value: trimmed }),
      });

      const body = await res.json();

      if (res.ok) {
        toast.success(
          isEdit ? "Identifier updated successfully." : "Identifier added successfully.",
        );
        setDialogOpen(false);
        await fetchIdentifiers();
      } else if (body.error === "identifier_already_exists") {
        toast.error("You already have this identifier type registered.");
      } else if (body.error === "identifier_already_registered") {
        toast.error("This identifier is already registered by another account.");
      } else if (body.error === "rate_limited") {
        toast.error("Too many requests. Please wait a moment and try again.");
      } else {
        toast.error(body.error || "Failed to save identifier.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Delete handler -----

  const handleDelete = async () => {
    if (!deleteType) return;

    setDeleting(true);

    try {
      const res = await fetch(`/api/me/identifiers/${deleteType}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Identifier removed.");
        setDeleteType(null);
        await fetchIdentifiers();
      } else {
        toast.error("Failed to remove identifier.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // ----- Render helpers -----

  const getIdentifier = (type: string) =>
    identifiers.find((id) => id.type === type);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Institutional Identifiers</CardTitle>
              <CardDescription>
                Stored encrypted. Used only for matching.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {IDENTIFIER_TYPES.map((type) => (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-lg border p-4 animate-pulse"
                >
                  <div className="space-y-1">
                    <div className="h-4 w-32 rounded bg-muted" />
                    <div className="h-3 w-20 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {IDENTIFIER_TYPES.map((type) => {
                const existing = getIdentifier(type);

                return (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {TYPE_LABELS[type] || type}
                      </p>
                      {existing ? (
                        <p className="text-sm text-muted-foreground font-mono">
                          {existing.value}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Not added
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {existing ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openEditDialog(type, existing.value)
                            }
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteType(type)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Remove
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAddDialog(type)}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----- Add / Edit Dialog ----- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit" : "Add"} {TYPE_LABELS[dialogType] || dialogType}
            </DialogTitle>
            <DialogDescription>
              Your identifier is stored encrypted and used only for matching
              your records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="identifier-value">
                {TYPE_LABELS[dialogType] || dialogType}
              </Label>
              <Input
                id="identifier-value"
                placeholder={`Enter your ${(TYPE_LABELS[dialogType] || "identifier").toLowerCase()}`}
                value={dialogValue}
                onChange={(e) => setDialogValue(e.target.value)}
                onBlur={(e) =>
                  setDialogValue(e.target.value.trim().toUpperCase())
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !submitting) handleSubmit();
                }}
                autoComplete="off"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This will be converted to uppercase automatically.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !dialogValue.trim()}
            >
              {submitting
                ? "Saving..."
                : isEdit
                  ? "Update"
                  : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----- Delete Confirmation ----- */}
      <AlertDialog
        open={deleteType !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteType(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Identifier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove your{" "}
              {TYPE_LABELS[deleteType ?? ""] || "identifier"}? You can add it
              again later, but any pending verifications that require it will
              no longer match.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
