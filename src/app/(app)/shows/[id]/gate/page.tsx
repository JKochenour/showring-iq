import Link from "next/link";
import { notFound } from "next/navigation";
import { hasOrgPermission, requireUser } from "@/lib/authz";
import { loadClassDraw, type DrawRunRow } from "@/lib/load-draw";
import { AutoRefresh } from "@/components/auto-refresh";
import { KioskToggle } from "@/components/kiosk-toggle";
import { GateActionButtons } from "@/components/show/gate-actions";
import { RunStatusBadge } from "@/components/show/run-status-badge";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import type { ShowClass } from "@/lib/types";

export const metadata = { title: "Gate — ShowRing IQ" };

function upNext(rows: DrawRunRow[]): DrawRunRow[] {
  return rows.filter(
    (r) =>
      ["pending", "at_gate"].includes(r.run_status) &&
      r.entryClassStatus === "entered"
  );
}

export default async function GatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ class?: string }>;
}) {
  const { id } = await params;
  const { class: selectedClassId } = await searchParams;
  const { supabase } = await requireUser();

  const { data: show } = await supabase
    .from("shows")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!show) notFound();

  const [{ data: drawnClassRows }, canGate] = await Promise.all([
    supabase.from("class_draws").select("class_id").eq("show_id", id),
    hasOrgPermission(show.organization_id, "entry.check_in"),
  ]);

  const drawnClassIds = [
    ...new Set((drawnClassRows ?? []).map((r) => r.class_id)),
  ];

  const { data: classes } =
    drawnClassIds.length > 0
      ? await supabase
          .from("classes")
          .select("*")
          .in("id", drawnClassIds)
          .order("display_order")
      : { data: [] };

  const classList = (classes as ShowClass[]) ?? [];
  const selected =
    classList.find((c) => c.id === selectedClassId) ?? classList[0] ?? null;

  const rows = selected ? await loadClassDraw(supabase, id, selected.id) : [];
  const queue = upNext(rows);
  const inArena = rows.find((r) => r.run_status === "in_arena") ?? null;
  const completed = rows.filter((r) => r.run_status === "completed").length;

  const slots: { label: string; row: DrawRunRow | null }[] = [
    { label: "Now", row: inArena },
    { label: "On deck", row: queue[0] ?? null },
    { label: "2 away", row: queue[1] ?? null },
    { label: "3 away", row: queue[2] ?? null },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      <PageHeader
        title="Gate"
        description="One-tap run tracking. The screen refreshes automatically every 10 seconds."
        action={<KioskToggle />}
      />

      {classList.length === 0 ? (
        <EmptyState
          title="No draws yet"
          description="Generate a draw for a class first — the gate screen runs off the order of go."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {classList.map((cls) => (
              <Link
                key={cls.id}
                href={`/shows/${id}/gate?class=${cls.id}`}
                className={`touch-manipulation rounded-full border px-4 py-2 text-sm font-medium transition-colors sm:text-base ${
                  selected?.id === cls.id
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-stone-300 text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                }`}
              >
                {cls.class_number} — {cls.name}
              </Link>
            ))}
          </div>

          {selected && (
            <>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {selected.pattern_number &&
                  `Pattern ${selected.pattern_number} · `}
                {completed} of {rows.length} complete
                {selected.drag_every_n &&
                  ` · drag every ${selected.drag_every_n} runs`}
              </p>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {slots.map((slot) => (
                  <Card
                    key={slot.label}
                    className={
                      slot.label === "Now"
                        ? "border-brand-600 dark:border-brand-500"
                        : ""
                    }
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      {slot.label}
                    </p>
                    {slot.row ? (
                      <>
                        <p
                          className={`mt-1 font-mono font-bold ${
                            slot.label === "Now" ? "text-5xl" : "text-3xl"
                          }`}
                        >
                          {slot.row.backNumber
                            ? `#${slot.row.backNumber}`
                            : `Draw ${slot.row.position}`}
                        </p>
                        <p className="mt-1 truncate text-base font-medium">
                          {slot.row.riderName}
                        </p>
                        <p className="truncate text-sm text-stone-500 dark:text-stone-400">
                          {slot.row.horseName}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-stone-400">—</p>
                    )}
                  </Card>
                ))}
              </div>

              <Card>
                <h3 className="mb-4 text-base font-semibold">Order of go</h3>
                <ul className="divide-y divide-stone-200 dark:divide-stone-800">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <div
                        className={`flex flex-wrap items-center justify-between gap-3 py-3 ${
                          ["completed", "no_show", "scratched"].includes(
                            row.run_status
                          ) || row.entryClassStatus === "scratched"
                            ? "opacity-50"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="w-8 text-right font-mono text-sm text-stone-400">
                            {row.position}
                          </span>
                          <span className="w-16 font-mono text-lg font-bold">
                            {row.backNumber ? `#${row.backNumber}` : "—"}
                          </span>
                          <div>
                            <p className="text-sm font-medium">
                              {row.riderName}
                              {!row.checkedInAt && (
                                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  not checked in
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                              {row.horseName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <RunStatusBadge
                            status={
                              row.entryClassStatus === "scratched"
                                ? "scratched"
                                : row.run_status
                            }
                          />
                          {canGate && row.entryClassStatus === "entered" && (
                            <GateActionButtons
                              rowId={row.id}
                              currentStatus={row.run_status}
                            />
                          )}
                        </div>
                      </div>
                      {selected.drag_every_n &&
                        row.position % selected.drag_every_n === 0 && (
                          <p className="border-t border-dashed border-stone-300 py-1 text-center text-xs uppercase tracking-widest text-stone-400 dark:border-stone-700">
                            — drag —
                          </p>
                        )}
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
