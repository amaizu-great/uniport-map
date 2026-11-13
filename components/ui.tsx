"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { formatDistance } from "@/lib/geo";
import { dismissLocationMessage, useLocation } from "@/lib/location-store";
import { CATEGORY_META, campusName } from "@/lib/places";
import { toggleTheme, useTheme } from "@/lib/theme-store";
import type { Category, Place } from "@/lib/types";

// ---------- icons (24px, currentColor) ----------

const paths = {
  back: "M15.4 4.6 14 3.2 5.2 12l8.8 8.8 1.4-1.4L8 12l7.4-7.4Z",
  search: "M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.4-5.4-5.39A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z",
  close: "m12 10.6 4.95-4.95 1.4 1.4L13.4 12l4.95 4.95-1.4 1.4L12 13.4l-4.95 4.95-1.4-1.4L10.6 12 5.65 7.05l1.4-1.4L12 10.6Z",
  locate: "M21 3 3 10.5l7.2 2.3L12.5 20 21 3Z",
  layers: "m12 2 10 5.5-10 5.5L2 7.5 12 2Zm-7.9 9.4L12 15.8l7.9-4.4L22 12.6 12 18.1 2 12.6l2.1-1.2Zm0 5L12 20.8l7.9-4.4 2.1 1.2-10 5.5-10-5.5 2.1-1.2Z",
  sun: "M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-1-6h2v3h-2V1Zm0 19h2v3h-2v-3ZM3.5 4.9l1.4-1.4L7 5.6 5.6 7 3.5 4.9Zm13.4 13.5 1.4-1.4 2.2 2.1-1.4 1.4-2.2-2.1ZM1 11h3v2H1v-2Zm19 0h3v2h-3v-2ZM5.6 17 7 18.4l-2.1 2.2-1.4-1.4L5.6 17ZM19.1 3.5l1.4 1.4L18.4 7 17 5.6l2.1-2.1Z",
  moon: "M10 2a8.5 8.5 0 0 0 11.5 11.5A10 10 0 1 1 10 2Z",
  chevron: "m9 18 6-6-6-6-1.4 1.4 4.6 4.6-4.6 4.6L9 18Z",
  chevronDown: "m6 9 6 6 6-6-1.4-1.4L12 12.2 7.4 7.6 6 9Z",
  walk: "M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6A2 2 0 0 0 12 6c-.3 0-.5 0-.8.1L6 8.3V13h2V9.6l1.8-.7Z",
  share: "M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1Z",
  flag: "M5 21V4h9l.4 2H20v10h-7l-.4-2H7v7H5Z",
  pin: "M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  pinOff: "M2.8 2.8 1.4 4.2l3.8 3.8A7 7 0 0 0 5 9c0 5 7 13 7 13s1.9-2.2 3.7-5l4.1 4.1 1.4-1.4L2.8 2.8ZM12 2a7 7 0 0 0-5 2.1l3.1 3.1A2.5 2.5 0 0 1 13.8 11l3.6 3.6C18.3 12.6 19 10.6 19 9a7 7 0 0 0-7-7Z",
  info: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 8v7h2v-7h-2Zm0-3v2h2V7h-2Z",
  check: "m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4-9.6 9.6Z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path fill="currentColor" d={paths[name]} />
    </svg>
  );
}

/** Coloured round badge with a white line icon for a place category. */
export function CategoryBadge({ category, size = 40, className = "" }: { category: Category; size?: number; className?: string }) {
  const { node, color } = CATEGORY_ICONS[category];
  const glyph = Math.round(size * 0.5);
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full text-white ${className}`}
      style={{ width: size, height: size, background: color }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
        {node.map(([tag, attrs], i) => {
          const Tag = tag as "path";
          return <Tag key={i} {...(attrs as Record<string, string>)} />;
        })}
      </svg>
    </span>
  );
}

// ---------- buttons ----------

type RoundButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  active?: boolean;
};

/** Round floating "glass" button, like the map controls in the reference. */
export const RoundButton = forwardRef<HTMLButtonElement, RoundButtonProps>(function RoundButton(
  { icon, label, active, className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`pointer-events-auto grid size-11 place-items-center rounded-full border border-line bg-glass shadow-float backdrop-blur-md transition active:scale-95 ${
        active ? "text-[#1a73e8]" : "text-ink"
      } ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
});

export function ThemeToggle() {
  const theme = useTheme();
  return (
    <RoundButton
      icon={theme === "dark" ? "sun" : "moon"}
      label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
    />
  );
}

// ---------- search field ----------

interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function SearchField({ value, onChange, placeholder, onFocus, onKeyDown, inputRef }: SearchFieldProps) {
  return (
    <label className="flex h-12 items-center gap-2.5 rounded-2xl bg-surface-2 px-4 text-ink-muted focus-within:ring-2 focus-within:ring-primary/40">
      <Icon name="search" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="-mr-2 grid size-9 place-items-center rounded-full hover:bg-surface-3"
        >
          <Icon name="close" className="size-4" />
        </button>
      )}
    </label>
  );
}

// ---------- place rows ----------

export function PlaceRow({
  place,
  distance,
  showCampus,
  active,
  onClick,
  id,
}: {
  place: Place;
  distance?: number | null;
  showCampus?: boolean;
  active?: boolean;
  onClick: () => void;
  id?: string;
}) {
  const meta = CATEGORY_META[place.category];
  const located = place.lat !== null;
  return (
    <li id={id} role="option" aria-selected={active ?? false}>
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-16 w-full items-center gap-3.5 px-5 py-2.5 text-left transition-colors hover:bg-surface-2 ${
          active ? "bg-surface-2" : ""
        }`}
      >
        <CategoryBadge category={place.category} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{place.name}</span>
          <span className="block truncate text-[13px] text-ink-muted">
            {meta.label}
            {showCampus && ` · ${campusName(place.campus)}`}
            {!located && " · Location coming soon"}
          </span>
        </span>
        {distance != null && (
          <span className="shrink-0 text-[13px] font-medium tabular-nums text-ink-muted">{formatDistance(distance)}</span>
        )}
      </button>
    </li>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="px-5 pb-1 pt-4 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">{children}</h3>;
}

// ---------- location message toast ----------

export function LocationToast({ bottom }: { bottom: number }) {
  const { message } = useLocation();
  if (!message) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 z-[1150] flex justify-center" style={{ bottom }}>
      <div
        role="alert"
        className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-[14px] text-ink shadow-float"
      >
        <Icon name="pin" className="mt-px size-5 shrink-0 text-primary" />
        <p className="flex-1">{message}</p>
        <button
          type="button"
          onClick={dismissLocationMessage}
          aria-label="Dismiss"
          className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-2"
        >
          <Icon name="close" className="size-4" />
        </button>
      </div>
    </div>
  );
}
