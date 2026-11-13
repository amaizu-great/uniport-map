"use client";

import { useMemo, useState } from "react";
import { createSearcher } from "./search";
import type { Place } from "./types";

/** Fuzzy search over `list` with arrow-key/Enter navigation for the results. */
export function usePlaceSearch(list: Place[], query: string, onPick: (p: Place) => void, limit = 25) {
  const search = useMemo(() => createSearcher(list), [list]);
  const results = useMemo(() => search(query, limit), [search, query, limit]);
  const [active, setActive] = useState(0);
  const safeActive = Math.min(active, Math.max(0, results.length - 1));

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(safeActive + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(safeActive - 1, 0));
    } else if (e.key === "Enter" && results[safeActive]) {
      e.preventDefault();
      onPick(results[safeActive]);
    }
  }

  return { results, active: safeActive, setActive, onKeyDown };
}
