"use client";

import { useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ExternalLink,
  Heart,
  Star,
  Clock,
  Globe,
  User,
  Calendar,
  Tag,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCourse, useSimilarCourses } from "@/lib/hooks/use-courses";
import { useFavorites, useToggleFavorite } from "@/lib/hooks/use-favorites";
import { useRecordHistory } from "@/lib/hooks/use-history";
import { CourseCard } from "@/components/courses/course-card";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { toast } from "sonner";
import { useState } from "react";

function getExpiryInfo(expiresAt: string | null): {
  text: string;
  urgent: boolean;
} | null {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return { text: "Expired", urgent: true };
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 48) return null;
  if (hours < 1) return { text: `${minutes} minutes remaining`, urgent: true };
  return {
    text: `${hours}h ${minutes}m remaining`,
    urgent: hours < 6,
  };
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const [copied, setCopied] = useState(false);

  const { data: course, isLoading, error, refetch } = useCourse(courseId);
  const { data: favorites } = useFavorites();
  const { addFavorite, removeFavorite } = useToggleFavorite();
  const recordHistory = useRecordHistory();

  // Fetch semantically similar courses
  const { data: similarCourses } = useSimilarCourses(courseId, 4);
  const relatedCourses = similarCourses ?? [];

  const isFavorited = favorites?.some((f) => f.courseId === courseId) ?? false;

  // Auto-record VIEWED history on mount
  useEffect(() => {
    if (courseId) {
      recordHistory.mutate({ courseId, action: "VIEWED" });
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const handleToggleFavorite = useCallback(() => {
    if (isFavorited) {
      removeFavorite.mutate(courseId, {
        onSuccess: () => toast.success("Removed from favorites"),
      });
    } else {
      addFavorite.mutate(courseId, {
        onSuccess: () => toast.success("Added to favorites"),
      });
    }
  }, [isFavorited, courseId, addFavorite, removeFavorite]);

  const handleGetCourse = useCallback(() => {
    if (course) {
      recordHistory.mutate({ courseId, action: "CLICKED" });
      window.open(course.couponUrl, "_blank", "noopener,noreferrer");
    }
  }, [course, courseId, recordHistory]);

  const handleCopyUrl = useCallback(async () => {
    if (course) {
      await navigator.clipboard.writeText(course.couponUrl);
      setCopied(true);
      toast.success("Coupon URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [course]);

  if (isLoading) return <LoadingState message="Loading course details..." />;
  if (error || !course) return <ErrorState onRetry={() => refetch()} />;

  const expiryInfo = getExpiryInfo(course.expiresAt);

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/courses"
          className="hover:text-foreground transition-colors"
        >
          Courses
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {course.category && (
          <>
            <span>{course.category.name}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground truncate max-w-[300px]">
          {course.title}
        </span>
      </div>

      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Main Card */}
      <Card className="overflow-hidden">
        {/* Hero */}
        <div className="relative h-56 bg-muted">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center gradient-primary opacity-70">
              <span className="text-6xl font-bold text-white/30">
                {course.title.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          <div className="absolute bottom-4 left-6 right-6">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="success">FREE</Badge>
              {!course.isActive && (
                <Badge variant="destructive">Expired</Badge>
              )}
              {course.category && (
                <Badge
                  variant="outline"
                  className="bg-background/50 backdrop-blur-sm"
                >
                  {course.category.name}
                </Badge>
              )}
              {expiryInfo && (
                <Badge
                  variant={expiryInfo.urgent ? "destructive" : "outline"}
                  className="gap-1"
                >
                  <Clock className="h-3 w-3" />
                  {expiryInfo.text}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {course.title}
            </h1>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="gradient"
              size="lg"
              onClick={handleGetCourse}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Get Course for Free
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleToggleFavorite}
              className="gap-2"
            >
              <Heart
                className={`h-4 w-4 transition-all duration-200 ${
                  isFavorited ? "fill-rose-500 text-rose-500 scale-110" : ""
                }`}
              />
              {isFavorited ? "Remove from Favorites" : "Add to Favorites"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleCopyUrl}
              className="gap-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy URL"}
            </Button>
          </div>

          <Separator />

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {course.instructor && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Instructor</p>
                  <p className="text-sm font-medium">{course.instructor}</p>
                </div>
              </div>
            )}
            {course.rating && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rating</p>
                  <p className="text-sm font-medium">
                    {course.rating.toFixed(1)} / 5.0
                  </p>
                </div>
              </div>
            )}
            {course.provider && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm font-medium">{course.provider.name}</p>
                </div>
              </div>
            )}
            {course.expiresAt && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="text-sm font-medium">
                    {new Date(course.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
            {course.priceOriginal && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Original Price
                  </p>
                  <p className="text-sm font-medium">
                    <span className="line-through text-muted-foreground">
                      ${course.priceOriginal}
                    </span>{" "}
                    <span className="text-emerald-500 font-bold">FREE</span>
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">First Seen</p>
                <p className="text-sm font-medium">
                  {new Date(course.firstSeenAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {course.description && (
            <>
              <Separator />
              <div>
                <h2 className="font-semibold mb-2">Description</h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {course.description}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Similar Courses */}
      {relatedCourses.length > 0 && (
        <Card className="border border-border/30 bg-card/45 backdrop-blur-sm shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-indigo-500 fill-indigo-500/20" />
              Similar Courses (AI-Recommended)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relatedCourses.map((rc) => (
                <CourseCard key={rc.id} course={rc} compact />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
