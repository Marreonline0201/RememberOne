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

export function PeopleGrid({ people }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;

    return people.filter((person) => {
      // Match on name
      if (person.name.toLowerCase().includes(q)) return true;
      // Match on any attribute value (job title, company, city, etc.)
      if (person.attributes.some((a) => a.value.toLowerCase().includes(q))) return true;
      // Match on family member names
      if (person.family_members.some((fm) => fm.name.toLowerCase().includes(q))) return true;
      // Match on notes
      if (person.notes?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [people, query]);

  return (
    <div className="space-y-4">
      {/* Search bar — only show when there are enough people to warrant filtering */}
      {people.length >= 4 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, company, city..."
            /*
              h-11 = 44px touch target.
              text-base prevents iOS zoom.
              pl-9 leaves room for the search icon; pr-9 for the clear button.
            */
            className="h-11 text-base md:text-sm pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Result count — only show while filtering */}
      {query.trim() && (
        <p className="text-sm text-muted-foreground">
          {filtered.length === 0
            ? "No people match your search."
            : `${filtered.length} of ${people.length} ${people.length === 1 ? "person" : "people"}`}
        </p>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      ) : query.trim() ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Search className="w-8 h-8 text-muted-foreground mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            No results for &quot;{query}&quot;
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : null}
    </div>
  );
}
