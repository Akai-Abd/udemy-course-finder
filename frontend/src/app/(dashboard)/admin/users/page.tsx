"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Shield, Trash2, UserCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usersApi, type UserItem } from "@/lib/api-client";
import { toast } from "sonner";
import { LoadingState } from "@/components/shared/loading-state";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await usersApi.list();
      setUsers(res.data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error("Failed to fetch users: " + (errorObj.response?.data?.message || errorObj.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    usersApi.list()
      .then((res) => {
        if (isMounted) {
          setUsers(res.data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
          toast.error("Failed to fetch users: " + (errorObj.response?.data?.message || errorObj.message || "Unknown error"));
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleRole = async (user: UserItem) => {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    setActionId(user.id);
    try {
      await usersApi.updateRole(user.id, newRole);
      toast.success(`Role updated to ${newRole}`);
      fetchUsers();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error("Failed to update role: " + (errorObj.response?.data?.message || errorObj.message || "Unknown error"));
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    setActionId(userId);
    try {
      await usersApi.delete(userId);
      toast.success("User deleted");
      fetchUsers();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error("Failed to delete user: " + (errorObj.response?.data?.message || errorObj.message || "Unknown error"));
    } finally {
      setActionId(null);
    }
  };

  if (isLoading) return <LoadingState message="Loading users..." />;

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">
          Manage registered accounts, grant administrator privileges, or clean up inactive users.
        </p>
      </div>

      <Card className="border border-border/30 bg-card/45 backdrop-blur-sm shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground/90">
            <Users className="h-4.5 w-4.5 text-indigo-500" />
            Registered Accounts ({users.length})
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            List of users with system access credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-border/30 bg-muted/10 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xs">
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground/90">{u.email}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Joined {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    variant={u.role === "ADMIN" ? "default" : "secondary"}
                    className="text-[10px] font-extrabold"
                  >
                    {u.role}
                  </Badge>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleRole(u)}
                    disabled={actionId === u.id}
                    className="h-8 text-xs font-semibold rounded-xl border-border/40 gap-1"
                  >
                    {actionId === u.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : u.role === "ADMIN" ? (
                      <>
                        <UserCheck className="h-3 w-3 text-muted-foreground" />
                        Make User
                      </>
                    ) : (
                      <>
                        <Shield className="h-3 w-3 text-indigo-500" />
                        Make Admin
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteUser(u.id)}
                    disabled={actionId === u.id}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-xl"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
