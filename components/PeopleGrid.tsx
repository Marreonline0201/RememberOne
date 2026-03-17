"use client";

// PeopleGrid — client wrapper around the people list that adds a live search/filter bar.
// Receives all people from the server component and filters in-browser — no extra API calls.

import { useState, useMemo } from "react";
import { PersonCard } from "@/components/PersonCard";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import type { PersonFull } from "@/types/app";

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
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? people.filter((person) => {
          if (person.name.toLowerCase().includes(q)) return true;
          if (person.attributes.some((a) => a.value.toLowerCase().includes(q))) return true;
          if (person.family_members.some((fm) => fm.name.toLowerCase().includes(q))) return true;
          if (person.notes?.toLowerCase().includes(q)) return true;
          return false;
        })
      : people;
    return sortPeople(base);
  }, [people, query]);

  return (
    <div className="space-y-4">
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
            <PersonCard key={person.id} person={person} />
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
      ) : null}
    </div>
  );
}
