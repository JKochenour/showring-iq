/**
 * Server-side PDF text extraction for show-bill import. Groups text items
 * into lines by vertical position (2px tolerance) and orders left-to-right
 * within a line — the same reading-order reconstruction the parser was
 * calibrated against. Designed one-page bills interleave sidebar text into
 * table rows; the show-bill parser is built to tolerate that.
 */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data, useSystemFonts: true });
  const doc = await task.promise;
  const out: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const lines = new Map<number, { x: number; s: string }[]>();
      for (const item of tc.items) {
        if (!("str" in item) || !item.str) continue;
        const y = Math.round(item.transform[5]);
        let key: number | null = null;
        for (const k of lines.keys()) {
          if (Math.abs(k - y) <= 2) {
            key = k;
            break;
          }
        }
        if (key === null) {
          key = y;
          lines.set(key, []);
        }
        lines.get(key)!.push({ x: item.transform[4], s: item.str });
      }
      const sorted = [...lines.entries()].sort((a, b) => b[0] - a[0]);
      for (const [, items] of sorted) {
        items.sort((a, b) => a.x - b.x);
        out.push(items.map((i) => i.s).join(" ").replace(/\s+/g, " ").trim());
      }
    }
  } finally {
    await task.destroy();
  }
  return out.join("\n");
}
