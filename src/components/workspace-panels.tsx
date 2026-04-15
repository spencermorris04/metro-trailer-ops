"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type WorkspacePanelLayout = {
  left: number;
  right: number;
};

type WorkspacePanelsProps = {
  pageKey: string;
  initialLayout: WorkspacePanelLayout;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  minLeft?: number;
  maxLeft?: number;
  minRight?: number;
  maxRight?: number;
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function WorkspacePanels({
  pageKey,
  initialLayout,
  left,
  center,
  right,
  minLeft = 240,
  maxLeft = 520,
  minRight = 240,
  maxRight = 520,
  className = "",
}: WorkspacePanelsProps) {
  const [layout, setLayout] = useState(initialLayout);
  const layoutRef = useRef(initialLayout);
  const saveTimerRef = useRef<number | null>(null);
  const didHydrateRef = useRef(false);

  useEffect(() => {
    setLayout(initialLayout);
    layoutRef.current = initialLayout;
  }, [initialLayout]);

  useEffect(() => {
    if (!didHydrateRef.current) {
      didHydrateRef.current = true;
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void fetch("/api/workspace/layouts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageKey,
          layout: layoutRef.current,
        }),
      }).catch(() => {
        // Keep local state responsive even if persistence fails.
      });
    }, 180);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [layout, pageKey]);

  function updateLayout(next: WorkspacePanelLayout) {
    layoutRef.current = next;
    setLayout(next);
  }

  function beginResize(side: "left" | "right") {
    return (event: React.PointerEvent<HTMLButtonElement>) => {
      const startX = event.clientX;
      const startLayout = layoutRef.current;

      function handleMove(moveEvent: PointerEvent) {
        const delta = moveEvent.clientX - startX;

        if (side === "left") {
          updateLayout({
            ...layoutRef.current,
            left: clamp(startLayout.left + delta, minLeft, maxLeft),
          });
          return;
        }

        updateLayout({
          ...layoutRef.current,
          right: clamp(startLayout.right - delta, minRight, maxRight),
        });
      }

      function handleUp() {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      }

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp, { once: true });
    };
  }

  return (
    <section
      className={`grid gap-4 xl:gap-0 ${className}`}
      style={{
        gridTemplateColumns: "1fr",
      }}
    >
      <div
        className="hidden min-h-0 xl:grid"
        style={{
          gridTemplateColumns: `${layout.left}px 12px minmax(0, 1fr) 12px ${layout.right}px`,
        }}
      >
        <div className="min-h-0 min-w-0 pr-4">{left}</div>
        <button
          type="button"
          aria-label="Resize left panel"
          onPointerDown={beginResize("left")}
          className="workspace-divider"
        />
        <div className="min-h-0 min-w-0 px-2">{center}</div>
        <button
          type="button"
          aria-label="Resize right panel"
          onPointerDown={beginResize("right")}
          className="workspace-divider"
        />
        <div className="min-h-0 min-w-0 pl-4">{right}</div>
      </div>

      <div className="grid gap-4 xl:hidden">
        <div>{left}</div>
        <div>{center}</div>
        <div>{right}</div>
      </div>
    </section>
  );
}
