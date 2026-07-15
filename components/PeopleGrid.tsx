"use client";

// PeopleGrid — client wrapper around the people list that adds a live search/filter bar.
// Receives all people from the server component and filters in-browser — no extra API calls.

import { useState, useMemo, useEffect } from "react";
import { PersonCard } from "@/components/PersonCard";
import { ManageGroupsSheet } from "@/components/ManageGroupsSheet";
import { Input } from "@/components/ui/input";
import { Plus, Search, X } from "lucide-react";
import type { PersonFull } from "@/types/app";
import { usePersistedIdSet, HOME_EXPANDED_KEY } from "@/lib/use-collapsed-set";
import { useGroups } from "@/lib/use-groups";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  people: PersonFull[];
}

function isKorean(name: string): boolean {
  return /^[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(name.trim());
}

function sortPeople(list: PersonFull[]): PersonFull[] {
  return [...list].sort((a, b) => {
    const aKo = isKorean(a.name);
    const bKo = isKorean(b.name);
    if (aKo && !bKo) return -1;
    if (!aKo && bKo) return 1;
    return a.name.localeCompare(b.name, aKo ? "ko" : "en");
  });
}

export function PeopleGrid({ people }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");

  // Per-card detail visibility, persisted on the device. Cards default
  // COLLAPSED; the set stores the ids the user has expanded. Pruned against
  // the full people list so deleted people's ids don't accumulate forever.
  const { has: isExpanded, toggle, prune, hydrated } = usePersistedIdSet(HOME_EXPANDED_KEY);
  useEffect(() => {
    if (hydrated) prune(people.map((p) => p.id));
  }, [hydrated, people, prune]);

  // Group filter chips. Selection is in-memory (resets to All each visit).
  const { groups, hydrated: groupsHydrated } = useGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [manageOpen, setManageOpen] = useState(false);
  // If the selected group disappears (deleted here or on another device),
  // fall back to All instead of showing a filter no chip represents.
  useEffect(() => {
    if (
      groupsHydrated &&
      selectedGroupId !== "all" &&
      !groups.some((g) => g.id === selectedGroupId)
    ) {
      setSelectedGroupId("all");
    }
  }, [groups, groupsHydrated, selectedGroupId]);
  const selectedGroup =
    selectedGroupId === "all" ? null : groups.find((g) => g.id === selectedGroupId) ?? null;

  const filtered = useMemo(() => {
    // Group filter first, then the text query on top of it.
    const inGroup =
      selectedGroupId === "all"
        ? people
        : people.filter((p) => (p.group_ids ?? []).includes(selectedGroupId));
    const q = query.trim().toLowerCase();
    const base = q
      ? inGroup.filter((person) => {
          if (person.name.toLowerCase().includes(q)) return true;
          if (person.attributes.some((a) => a.value.toLowerCase().includes(q))) return true;
          if (person.family_members.some((fm) => fm.name.toLowerCase().includes(q))) return true;
          if (person.notes?.toLowerCase().includes(q)) return true;
          return false;
        })
      : inGroup;
    return sortPeople(base);
  }, [people, query, selectedGroupId]);

  const chipStyle = (selected: boolean): React.CSSProperties => ({
    borderRadius: "10px 2px 10px 2px",
    fontFamily: "'Hammersmith One', sans-serif",
    ...(selected
      ? { background: "linear-gradient(to right, #284e72, #482d7c)", color: "#ffffff" }
      : { backgroundColor: "#f0e8ff", border: "1px solid #dccaff", color: "#284e72" }),
  });

  return (
    <div className="space-y-4">
      {/* Group filter chips: [All] [group…] [+ manage] */}
      {groupsHydrated && (
        <div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            <button
              type="button"
              onClick={() => setSelectedGroupId("all")}
              className="shrink-0 whitespace-nowrap h-8 px-3 text-[12px] transition-opacity active:opacity-80"
              style={chipStyle(selectedGroupId === "all")}
            >
              {t("groups.all")}
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroupId(g.id)}
                className="shrink-0 whitespace-nowrap h-8 px-3 text-[12px] transition-opacity active:opacity-80 max-w-[180px] truncate"
                style={chipStyle(selectedGroupId === g.id)}
              >
                {g.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              aria-label={t("groups.manage_title")}
              className="shrink-0 w-8 h-8 flex items-center justify-center transition-opacity active:opacity-80"
              style={chipStyle(false)}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {selectedGroup?.description && (
            <p className="text-[11px] px-1 mt-1" style={{ color: "#5e7983" }}>
              {selectedGroup.description}
            </p>
          )}
        </div>
      )}

      {/* Search bar */}
      {people.length >= 4 && (
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: "#5e7983" }}
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            className="h-11 text-base pl-9 pr-9 rounded-[10px_2px_10px_2px]"
            style={{ backgroundColor: "#f0e8ff", borderColor: "#dccaff" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: "#5e7983" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* People — single column, phone-first */}
      {filtered.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filtered.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              collapsed={!isExpanded(person.id)}
              onToggleCollapse={() => toggle(person.id)}
            />
          ))}
        </div>
      ) : query.trim() ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="w-8 h-8 mb-3 opacity-30" style={{ color: "#5e7983" }} />
          <p className="text-sm" style={{ color: "#5e7983" }}>
            No results for &quot;{query}&quot;
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 text-sm underline"
            style={{ color: "#482d7c" }}
          >
            Clear search
          </button>
        </div>
      ) : selectedGroupId !== "all" ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm" style={{ color: "#5e7983" }}>
            {t("groups.none_in_group")}
          </p>
          <button
            type="button"
            onClick={() => setSelectedGroupId("all")}
            className="mt-2 text-sm underline"
            style={{ color: "#482d7c" }}
          >
            {t("groups.show_all")}
          </button>
        </div>
      ) : null}

      <ManageGroupsSheet open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}
