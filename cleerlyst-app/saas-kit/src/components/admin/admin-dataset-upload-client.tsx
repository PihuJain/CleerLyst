"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminDatasetUploadClientProps {
  datasetId: string;
  datasetTitle: string;
  datasetStatus: string;
  identifierType: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminDatasetUploadClient({
  datasetId,
  datasetTitle,
  datasetStatus,
  identifierType,
}: AdminDatasetUploadClientProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [identifierColumn, setIdentifierColumn] = React.useState(
    identifierType === "email" ? "email" : "reg_no",
  );
  const [uploading, setUploading] = React.useState(false);
  const [result, setResult] = React.useState<{
    inserted: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("datasetId", datasetId);
      formData.append("identifierColumn", identifierColumn);

      const res = await fetch("/api/admin/datasets/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      setResult({ inserted: data.inserted, skipped: data.skipped });
      // Reset file input
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setError("Network error — upload could not be completed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/datasets">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Datasets
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Records</h1>
        <p className="text-muted-foreground mt-1">
          Dataset: <span className="font-medium text-foreground">{datasetTitle}</span>
          {" "}
          <Badge variant="secondary" className="ml-2">
            {datasetStatus}
          </Badge>
        </p>
      </div>

      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload CSV or XLSX
          </CardTitle>
          <CardDescription>
            Upload a file containing records. Each row must have an identifier
            column ({identifierType === "email" ? "email address" : "registration number"}).
            The identifier column will be hashed — all other columns will be encrypted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File input */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">File</Label>
            <Input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">
              Supported formats: CSV, XLSX. Max 10 MB.
            </p>
          </div>

          {/* Identifier column */}
          <div className="space-y-2">
            <Label htmlFor="id-column">Identifier Column Name</Label>
            <Input
              id="id-column"
              placeholder={
                identifierType === "email" ? "e.g. email" : "e.g. reg_no"
              }
              value={identifierColumn}
              onChange={(e) => setIdentifierColumn(e.target.value)}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">
              The exact column header in your file that contains the{" "}
              {identifierType === "email" ? "email" : "registration number"}.
            </p>
          </div>

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={uploading || !file || !identifierColumn.trim()}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Records
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Success result */}
      {result && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-emerald-800 dark:text-emerald-400">
                  Upload successful
                </p>
                <dl className="mt-2 text-sm text-muted-foreground space-y-1">
                  <div className="flex gap-2">
                    <dt className="font-medium">Inserted:</dt>
                    <dd>{result.inserted} records</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Skipped:</dt>
                    <dd>{result.skipped} records (empty identifier)</dd>
                  </div>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-400">
                  Upload failed
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security note */}
      <p className="text-xs text-muted-foreground text-center">
        Records are encrypted at rest. Identifiers are one-way hashed.
        Raw data is never stored or displayed.
      </p>
    </div>
  );
}
