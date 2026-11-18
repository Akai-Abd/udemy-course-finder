"use client";

import { X, Filter, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/lib/hooks/use-categories";
import { useProviders } from "@/lib/hooks/use-providers";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CourseFiltersProps {
  categoryId: string | undefined;
  providerId: string | undefined;
  expiryStatus: string;
  language: string;
  hideClicked?: boolean;
  onCategoryChange: (categoryId: string | undefined) => void;
  onProviderChange: (providerId: string | undefined) => void;
  onExpiryChange: (status: string) => void;
  onLanguageChange: (lang: string) => void;
  onHideClickedChange?: (hide: boolean) => void;
  onClearAll: () => void;
}

export function CourseFilters({
  categoryId,
  providerId,
  expiryStatus,
  language,
  hideClicked = false,
  onCategoryChange,
  onProviderChange,
  onExpiryChange,
  onLanguageChange,
  onHideClickedChange,
  onClearAll,
}: CourseFiltersProps) {
  const { data: categories } = useCategories();
  const { data: providers } = useProviders();
  const [expanded, setExpanded] = useState(false);

  const hasActiveFilters =
    categoryId || providerId || expiryStatus !== "active" || language !== "English" || hideClicked;

  const activeFilters: { label: string; onRemove: () => void }[] = [];

  if (hideClicked && onHideClickedChange) {
    activeFilters.push({
      label: "Hide Opened",
      onRemove: () => onHideClickedChange(false),
    });
  }

  if (categoryId) {
    const cat = categories?.find((c) => c.id === categoryId);
    activeFilters.push({
      label: cat?.name ?? "Category",
      onRemove: () => onCategoryChange(undefined),
    });
  }

  if (providerId) {
    const prov = providers?.find((p) => p.id === providerId);
    activeFilters.push({
      label: prov?.name ?? "Provider",
      onRemove: () => onProviderChange(undefined),
    });
  }

  if (expiryStatus !== "active") {
    activeFilters.push({
      label: expiryStatus === "expired" ? "Expired" : "All Coupon Statuses",
      onRemove: () => onExpiryChange("active"),
    });
  }

  if (language !== "English") {
    activeFilters.push({
      label: language === "all" ? "All Languages (378)" : `Language: ${language}`,
      onRemove: () => onLanguageChange("English"),
    });
  }

  return (
    <div className="space-y-3">
      {/* Toggle + Dropdowns */}
      <div className="flex items-center gap-2 select-none flex-wrap">
        <Button
          variant={expanded ? "secondary" : "outline"}
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "gap-1.5 text-xs font-bold rounded-xl h-8.5 transition-colors border-border/40",
            expanded ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-[9px] font-extrabold text-primary-foreground">
              {activeFilters.length}
            </span>
          )}
        </Button>

        {onHideClickedChange && (
          <Button
            variant={hideClicked ? "secondary" : "outline"}
            size="sm"
            onClick={() => onHideClickedChange(!hideClicked)}
            className={cn(
              "gap-1.5 text-xs font-bold rounded-xl h-8.5 transition-all border-border/40",
              hideClicked
                ? "bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-400 font-extrabold"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Hide Opened</span>
          </Button>
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-transparent"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Expanded filter dropdowns */}
      {expanded && (
        <div className="flex flex-wrap gap-3.5 rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-4 animate-fade-in shadow-sm select-none">
          {/* Category */}
          <Select
            value={categoryId ?? "__all__"}
            onValueChange={(v) =>
              onCategoryChange(v === "__all__" ? undefined : v)
            }
          >
            <SelectTrigger className="w-full sm:w-48 bg-background/50 border-border/40 rounded-xl text-xs font-semibold h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground/60" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border/45 rounded-xl">
              <SelectItem value="__all__" className="font-semibold text-xs py-2">All Categories</SelectItem>
              {categories?.map((cat) => (
                <SelectItem key={cat.id} value={cat.id} className="font-semibold text-xs py-2">
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Provider */}
          <Select
            value={providerId ?? "__all__"}
            onValueChange={(v) =>
              onProviderChange(v === "__all__" ? undefined : v)
            }
          >
            <SelectTrigger className="w-full sm:w-48 bg-background/50 border-border/40 rounded-xl text-xs font-semibold h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground/60" />
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border/45 rounded-xl">
              <SelectItem value="__all__" className="font-semibold text-xs py-2">All Sources</SelectItem>
              {providers?.map((prov) => (
                <SelectItem key={prov.id} value={prov.id} className="font-semibold text-xs py-2">
                  {prov.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Expiry */}
          <Select value={expiryStatus} onValueChange={onExpiryChange}>
            <SelectTrigger className="w-full sm:w-40 bg-background/50 border-border/40 rounded-xl text-xs font-semibold h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border/45 rounded-xl">
              <SelectItem value="active" className="font-semibold text-xs py-2">Active Only</SelectItem>
              <SelectItem value="expired" className="font-semibold text-xs py-2">Expired Only</SelectItem>
              <SelectItem value="all" className="font-semibold text-xs py-2">All Coupon Statuses</SelectItem>
            </SelectContent>
          </Select>

          {/* Language */}
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger className="w-full sm:w-44 bg-background/50 border-border/40 rounded-xl text-xs font-semibold h-9">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border/45 rounded-xl">
              <SelectItem value="English" className="font-semibold text-xs py-2">English Only</SelectItem>
              <SelectItem value="all" className="font-semibold text-xs py-2">All Languages</SelectItem>
              <SelectItem value="Non-English" className="font-semibold text-xs py-2">Non-English Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5 select-none animate-fade-in">
          {activeFilters.map((filter) => (
            <Badge
              key={filter.label}
              variant="secondary"
              className="gap-1 pl-2.5 pr-1.5 py-1 text-[10px] font-bold tracking-wide rounded-lg cursor-pointer hover:bg-secondary/80 border border-border/30 bg-muted/30 transition-colors duration-200"
              onClick={filter.onRemove}
            >
              <span>{filter.label}</span>
              <X className="h-3 w-3 text-muted-foreground/80 hover:text-foreground hover:scale-105 transition-all" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
