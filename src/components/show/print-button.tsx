"use client";

import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button className="no-print" onClick={() => window.print()}>
      Print
    </Button>
  );
}
