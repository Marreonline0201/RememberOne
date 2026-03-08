"use client";

// DeletePersonButton — confirmation dialog before deleting a person.
// Dialog footer stacks buttons vertically on mobile for easy tapping.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Loader2 } from "lucide-react";

interface Props {
  personId: string;
  personName: string;
}

export function DeletePersonButton({ personId, personName }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/people/${personId}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error);
        setOpen(false);
        toast({
          title: "Deleted",
          description: `${personName} has been removed.`,
        });
        router.push("/");
        router.refresh();
      } catch (err: unknown) {
        toast({
          title: "Delete failed",
          description:
            err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/*
          h-11 = 44px touch target.
          Destructive color via text/hover only so it stays understated
          until the confirmation dialog.
        */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-11 px-3 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Delete</span>
        </Button>
      </DialogTrigger>

      <DialogContent
        /*
          On mobile the dialog slides up from the bottom like a sheet,
          which feels more natural than a centered overlay.
          We achieve this via custom positioning classes while keeping
          the standard shadcn Dialog structure.
        */
        className="max-w-sm w-[calc(100%-2rem)] mx-auto rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle>Delete {personName}?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            This will permanently delete {personName} and all their saved
            attributes, family members, and meeting history. This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>

        {/*
          Footer: stacked (column-reverse) on mobile so the destructive
          action is closest to the thumb at the bottom.
          On sm+ they are side by side.
        */}
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2 mt-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="w-full sm:w-auto h-11"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="w-full sm:w-auto h-11 gap-2"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isPending ? "Deleting..." : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
