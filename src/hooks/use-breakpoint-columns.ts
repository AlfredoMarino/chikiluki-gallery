"use client";

import { useState, useEffect } from "react";

/**
 * Returns the correct column count based on current viewport width.
 * Breakpoints match Tailwind: sm=640px, lg=1024px.
 */
export function useBreakpointColumns(
  mobile: number,
  tablet: number,
  desktop: number
): number {
  const [columns, setColumns] = useState(desktop);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) setColumns(mobile);
      else if (w < 1024) setColumns(tablet);
      else setColumns(desktop);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mobile, tablet, desktop]);

  return columns;
}
