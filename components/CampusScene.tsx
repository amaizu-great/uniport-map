"use client";

import { useId } from "react";
import { project, scene, type Face, type Tone } from "@/lib/scene";
import type { UserLocation } from "@/lib/location-store";
import type { Campus } from "@/lib/types";

interface CampusSceneProps {
  user: UserLocation | null;
  /** campus the user is standing on, highlighted */
  here: Campus | null;
  onOpen: (campus: Campus) => void;
}

const fill = (tone: Tone, shade: Face["shade"]) => {
  const t = tone === "base" ? "" : `-${tone}`;
  return `var(--scene-bld-${shade}${t})`;
};

const slabFill = (shade: Face["shade"]) =>
  shade === "top" ? "var(--scene-slab-top)" : "var(--scene-slab-side)";

export default function CampusScene({ user, here, onOpen }: CampusSceneProps) {
  const uid = useId().replace(/:/g, "");
  const { k } = scene;
  // Extra headroom for the floating tags.
  const [vx, vy0, vw, vh0] = scene.viewBox;
  const vy = vy0 - 30 * k;
  const vh = vh0 + 30 * k;
  const userPt = user ? project([user.lat, user.lng]) : null;

  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full overflow-visible select-none"
      role="group"
      aria-label="The three UNIPORT campuses. Choose one to open its map."
    >
      <defs>
        <clipPath id={`${uid}-ground`}>
          {scene.ground
            .filter((f) => f.shade === "top")
            .map((f) => (
              <path key={f.d} d={f.d} />
            ))}
        </clipPath>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#03045e" floodOpacity="0.16" />
        </filter>
        <filter id={`${uid}-tag`} x="-30%" y="-50%" width="160%" height="220%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#03045e" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Floating ground tile */}
      <g filter={`url(#${uid}-soft)`}>
        {scene.ground.map((f) => (
          <path
            key={f.d}
            d={f.d}
            fill={f.shade === "top" ? "var(--scene-ground)" : "var(--scene-slab-edge)"}
          />
        ))}
      </g>

      {/* River and roads, clipped to the ground tile */}
      <g clipPath={`url(#${uid}-ground)`}>
        {scene.river && (
          <path
            d={scene.river.d}
            fill="none"
            stroke="var(--scene-river)"
            strokeWidth={14 * k}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {scene.roads.map((r) => (
          <g key={r.name}>
            <path
              d={r.d}
              fill="none"
              stroke="var(--scene-road-edge)"
              strokeWidth={(r.major ? 15 : 8) * k}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              id={`${uid}-${r.name.replace(/\W/g, "")}`}
              d={r.d}
              fill="none"
              stroke="var(--scene-road)"
              strokeWidth={(r.major ? 12 : 6) * k}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}
        {scene.roads.map((r) => (
          <text
            key={r.name}
            fontSize={(r.major ? 7 : 4.2) * k}
            fontWeight={700}
            letterSpacing={(r.major ? 1.1 : 0.6) * k}
            fill="var(--scene-road-text)"
            dy={(r.major ? 2.4 : 1.5) * k}
          >
            <textPath
              href={`#${uid}-${r.name.replace(/\W/g, "")}`}
              startOffset={r.major ? "42%" : "30%"}
              textAnchor="middle"
            >
              {r.name.toUpperCase()}
            </textPath>
          </text>
        ))}
      </g>

      {/* Campuses */}
      {scene.campuses.map((c) => (
        <g
          key={c.id}
          className="scene-campus"
          style={{ animationDelay: `${c.delay}ms` }}
          role="link"
          tabIndex={0}
          aria-label={`Open ${c.name}`}
          onClick={() => onOpen(c.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(c.id);
            }
          }}
        >
          <g filter={`url(#${uid}-soft)`}>
            {c.slab.map((f) => (
              <path
                key={f.d}
                d={f.d}
                fill={slabFill(f.shade)}
                stroke="var(--scene-slab-edge)"
                strokeWidth={0.6 * k}
                strokeLinejoin="round"
              />
            ))}
          </g>
          {c.buildings.map((b) => (
            <g key={b.id}>
              {b.faces.map((f) => (
                <path key={f.d} d={f.d} fill={fill(b.tone, f.shade)} strokeLinejoin="round" />
              ))}
            </g>
          ))}

        </g>
      ))}

      {/* Name tags float above everything */}
      {scene.campuses.map((c) => (
        <g key={`tag-${c.id}`} className="cursor-pointer" onClick={() => onOpen(c.id)} aria-hidden="true">
        {/* Floating name tag */}
        <CampusTag
          x={c.anchor[0]}
          baseY={c.anchor[1]}
          y={c.tagY - 14 * k}
          label={c.short}
          k={k}
          active={here === c.id}
          delay={c.delay * 2}
          filter={`url(#${uid}-tag)`}
        />
        </g>
      ))}

      {/* You are here */}
      {userPt && (
        <g aria-label="Your location">
          <circle cx={userPt[0]} cy={userPt[1]} r={6 * k} fill="#1a73e8" className="scene-pulse" />
          <circle cx={userPt[0]} cy={userPt[1]} r={6 * k} fill="#1a73e8" stroke="#fff" strokeWidth={2.5 * k} />
        </g>
      )}
    </svg>
  );
}

function CampusTag({
  x,
  y,
  baseY,
  label,
  k,
  active,
  delay,
  filter,
}: {
  x: number;
  y: number;
  baseY: number;
  label: string;
  k: number;
  active: boolean;
  delay: number;
  filter: string;
}) {
  const h = 30 * k;
  const w = (label.length * 8.4 + 40) * k;
  return (
    <g className="scene-tag" style={{ animationDelay: `${delay}ms` }}>
      <line
        x1={x}
        y1={y + h / 2}
        x2={x}
        y2={baseY}
        stroke="var(--primary)"
        strokeWidth={1.4 * k}
        strokeDasharray={`${2.5 * k} ${3 * k}`}
        opacity={0.75}
      />
      <circle cx={x} cy={baseY} r={3 * k} fill="var(--primary)" />
      <g filter={filter}>
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={h / 2}
          fill={active ? "var(--primary)" : "var(--surface)"}
          stroke="var(--border)"
          strokeWidth={0.8 * k}
        />
      </g>
      <circle cx={x - w / 2 + 15 * k} cy={y} r={4.5 * k} fill={active ? "var(--on-primary)" : "var(--accent)"} />
      <text
        x={x + 7 * k}
        y={y + 5 * k}
        textAnchor="middle"
        fontSize={14.5 * k}
        fontWeight={750}
        fill={active ? "var(--on-primary)" : "var(--text)"}
      >
        {label}
      </text>
    </g>
  );
}
