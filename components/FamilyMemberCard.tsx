"use client";

// FamilyMemberCard — displays one family member with their relation and attributes.
// Mobile-first: larger touch targets, confirm-delete flow.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Loader2 } from "lucide-react";
import { getInitials, capitalize } from "@/lib/utils";
import type { FamilyMemberFull } from "@/types/app";

interface Props {
  familyMember: FamilyMemberFull;
  personId: string;
}

const RELATION_COLORS: Record<string, string> = {
  son: "bg-sky-100 text-sky-700",
  daughter: "bg-rose-100 text-rose-700",
  spouse: "bg-purple-100 text-purple-700",
  partner: "bg-purple-100 text-purple-700",
  wife: "bg-pink-100 text-pink-700",
  husband: "bg-indigo-100 text-indigo-700",
  mother: "bg-amber-100 text-amber-700",
  father: "bg-orange-100 text-orange-700",
  sister: "bg-fuchsia-100 text-fuchsia-700",
  brother: "bg-cyan-100 text-cyan-700",
  default: "bg-gray-100 text-gray-700",
};

function getRelationColor(relation: string): string {
  return RELATION_COLORS[relation.toLowerCase()] ?? RELATION_COLORS.default;
}

export function FamilyMemberCard({ familyMember, personId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const avatarColor = getRelationColor(familyMember.relation);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/people/${personId}/family/${familyMember.id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Delete failed");

      toast({ title: `${familyMember.name} removed` });
      router.refresh();
    } catch (err: unknown) {
      toast({
        title: "Failed to delete",
        description:
          err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-3">
          {/* Avatar — slightly larger for readability on small screens */}
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarFallback className={`text-xs font-semibold ${avatarColor}`}>
              {getInitials(familyMember.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm text-gray-900 truncate">
              {familyMember.name}
            </p>
            <Badge
              variant="outline"
              className={`text-xs mt-0.5 border-0 py-0.5 ${avatarColor}`}
            >
              {capitalize(familyMember.relation)}
            </Badge>
          </div>

          {/* Delete — 44px touch target */}
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={handleDelete}
            disabled={deleting}
            title={
              confirmDelete
                ? "Tap again to confirm delete"
                : "Delete family member"
            }
            aria-label={
              confirmDelete
                ? "Tap again to confirm delete"
                : "Delete family member"
            }
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Confirm delete hint */}
        {confirmDelete && !deleting && (
          <p className="text-xs text-destructive font-medium">
            Tap the trash icon again to confirm deletion.
          </p>
        )}

        {/* Notes */}
        {familyMember.notes && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {familyMember.notes}
          </p>
        )}

        {/* Attributes */}
        {familyMember.attributes.length > 0 && (
          <div className="space-y-1.5">
            {familyMember.attributes.map((attr) => (
              <div key={attr.id} className="flex gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">
                  {attr.key}:
                </span>
                <span className="text-gray-800">{attr.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
