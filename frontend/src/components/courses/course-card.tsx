"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, ExternalLink, Heart, Clock, Flame, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Course } from "@/lib/api-client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CourseCardProps {
  course: Course;
  isFavorited?: boolean;
  onToggleFavorite?: (courseId: string) => void;
  onGetCourse?: (course: Course) => void;
  compact?: boolean;
}

function useCountdown(expiresAt: string | null) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        setIsExpired(true);
        setIsUrgent(false);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setIsUrgent(hours < 6);
      setIsExpired(false);

      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h remaining`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m remaining`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s remaining`);
      } else {
        setTimeLeft(`${seconds}s remaining`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) {
    return { timeLeft: null, isUrgent: false, isExpired: false };
  }

  return { timeLeft, isUrgent, isExpired };
}

export function CourseCard({
  course,
  isFavorited = false,
  onToggleFavorite,
  onGetCourse,
  compact = false,
}: CourseCardProps) {
  const { timeLeft, isUrgent, isExpired } = useCountdown(course.expiresAt);
  const [imgError, setImgError] = useState(false);
  const isHot = (course.rating && course.rating >= 4.5) || (course._count?.history && course._count.history >= 3);

  const handleGetCourse = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onGetCourse) {
      onGetCourse(course);
    } else {
      window.open(course.couponUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (compact) {
    return (
      <div className="group/compact flex items-center gap-3 rounded-xl border border-border/30 bg-card/40 p-3 backdrop-blur-sm transition-all duration-300 hover:bg-muted/50 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
        {/* Thumbnail */}
        <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/20">
          {!imgError && course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              priority
              sizes="64px"
              className="object-cover transition-transform duration-300 group-hover/compact:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center gradient-primary opacity-60">
              <span className="text-xs font-bold text-white/40">
                {course.title.charAt(0)}
              </span>
            </div>
          )}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <Link href={`/courses/${course.id}`}>
            <p className="text-xs sm:text-sm font-semibold truncate text-foreground/90 hover:text-primary transition-colors">
              {course.title}
            </p>
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {course.provider && (
              <span className="text-[10px] text-muted-foreground font-medium">
                {course.provider.name}
              </span>
            )}
            {isHot && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/10 font-bold dark:bg-amber-500/20 dark:text-amber-400">
                <Flame className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                HOT
              </Badge>
            )}
            {timeLeft && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] px-1 py-0 gap-0.5 transition-colors duration-300 font-semibold",
                  isExpired
                    ? "bg-muted text-muted-foreground border-border/30"
                    : isUrgent
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                )}
              >
                <Clock className="h-2.5 w-2.5" />
                {timeLeft}
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGetCourse}
          className="h-8 px-2.5 text-xs font-bold rounded-lg opacity-0 group-hover/compact:opacity-100 transition-opacity"
        >
          Get
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="group relative flex flex-col overflow-hidden rounded-2xl border-border/30 bg-card/45 backdrop-blur-md shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20">
      {/* Aspect ratio image container */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted/40">
        {!imgError && course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={course.title}
            fill
            loading="eager"
            sizes="(max-width: 768px) 100vw, 300px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center gradient-primary opacity-80 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-purple-600/30 to-background/80" />
            <span className="text-4xl font-black text-foreground/40 drop-shadow-sm select-none z-10">
              {course.title.charAt(0)}
            </span>
          </div>
        )}
        {/* Favorite button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(course.id);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/20 shadow-sm hover:scale-105 hover:bg-background transition-all duration-200 active:scale-95 z-20"
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-all duration-300 hover:text-rose-500",
                isFavorited
                  ? "fill-rose-500 text-rose-500 scale-110 animate-heart-bounce"
                  : "text-muted-foreground"
              )}
            />
          </button>
        )}
        {/* Expiry badge */}
        {/* Dynamic Tags */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 items-start z-10">
          {(!course.isActive || isExpired) && (
            <Badge variant="destructive" className="text-[10px] font-extrabold shadow-md border-0 bg-red-600">
              Expired
            </Badge>
          )}
          {course.isActive && !isExpired && timeLeft && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-extrabold shadow-md gap-1 transition-all duration-300 border-0 text-white",
                isUrgent
                  ? "bg-red-500 animate-pulse shadow-red-500/20"
                  : "bg-amber-500/90 shadow-amber-500/20"
              )}
            >
              <Clock className="h-3 w-3" />
              {timeLeft}
            </Badge>
          )}
          {isHot && (
            <Badge
              className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white font-extrabold border-0 text-[10px] gap-1 shadow-md shadow-orange-500/10 animate-float"
            >
              <Flame className="h-3 w-3 fill-white text-white" />
              HOT COUPON
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        <Link href={`/courses/${course.id}`}>
          <h3 className="font-bold text-sm text-foreground/90 line-clamp-2 hover:text-primary transition-colors leading-snug">
            {course.title}
          </h3>
        </Link>

        {course.instructor && (
          <p className="text-xs text-muted-foreground font-medium">{course.instructor}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {course.rating && (
            <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/10 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
              <span>{course.rating.toFixed(1)}</span>
            </div>
          )}
          <Badge variant="success" className="text-[10px] font-extrabold tracking-wide uppercase px-1.5 py-0.5 bg-emerald-500/10 border-emerald-500/10">
            FREE
          </Badge>
          {course.provider && (
            <Badge variant="outline" className="text-[10px] font-semibold border-border/40 text-muted-foreground/90 bg-muted/20">
              {course.provider.name}
            </Badge>
          )}
          {course.category && (
            <Badge variant="secondary" className="text-[10px] font-semibold bg-primary/5 text-primary border border-primary/10">
              {course.category.name}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="gradient"
            className="flex-1 text-xs font-bold shadow-md shadow-primary/10 hover:shadow-primary/20"
            onClick={handleGetCourse}
          >
            <ExternalLink className="h-3 w-3" />
            Get Course
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs font-semibold hover:bg-accent border-border/40 px-2.5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigator.clipboard.writeText(course.couponUrl || course.udemyUrl);
              toast.success("Course link copied to clipboard!");
            }}
            title="Copy course link"
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="text-xs font-semibold hover:bg-accent border-border/40" asChild>
            <Link href={`/courses/${course.id}`}>Details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
