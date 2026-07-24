"use client";

import { Download, FileSpreadsheet, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getExportUrl } from "@/lib/api-client";
import { toast } from "sonner";

interface ExportButtonProps {
  type?: "all" | "favorites";
}

export function ExportButton({ type = "all" }: ExportButtonProps) {
  const handleExport = (format: "csv" | "json") => {
    const url = getExportUrl(format, type);
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    
    // Fetch directly with auth header or trigger download
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Export failed");
        return res.blob();
      })
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `udemy-courses-${type}-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        toast.success(`Exported as ${format.toUpperCase()}`);
      })
      .catch((err) => {
        toast.error("Export failed: " + (err.message || "Unknown error"));
      });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-xl border-border/40 gap-1.5 text-xs font-semibold hover:bg-muted/60">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 bg-popover/95 backdrop-blur-md border-border/40">
        <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer font-semibold text-xs py-2">
          <FileSpreadsheet className="mr-2 h-3.5 w-3.5 text-emerald-500" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer font-semibold text-xs py-2">
          <FileJson className="mr-2 h-3.5 w-3.5 text-amber-500" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
