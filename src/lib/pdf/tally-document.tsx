import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ShowResultsData } from "@/lib/load-show-results";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottom: "0.5pt solid #e4e4e7",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTop: "1pt solid #18181b",
    fontWeight: 700,
  },
  disclaimer: { marginTop: 24, fontSize: 8, color: "#a1a1aa" },
});

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function TallyDocument({ data }: { data: ShowResultsData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{data.showName || "Show"} — Tally Sheet</Text>

        <Text style={styles.sectionTitle}>Entry counts by class</Text>
        {data.classes.map((cls) => {
          const shown = cls.rows.filter((r) => !r.scratched).length;
          const scratched = cls.rows.length - shown;
          return (
            <View key={cls.classId} style={styles.row}>
              <Text>
                Class {cls.classNumber} — {cls.name}
              </Text>
              <Text>
                {shown} shown{scratched > 0 ? `, ${scratched} scratched` : ""}
              </Text>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Fees</Text>
        <View style={styles.row}>
          <Text>Entry fees collected (shown entries, official classes)</Text>
          <Text>{money(data.totalEntryFeeCents)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Retainage (5%)</Text>
          <Text>{money(data.retainageCents)}</Text>
        </View>
        <View style={styles.row}>
          <Text>
            Medication fee ({money(data.medicationFeeCents)} × {data.activeEntryCount} entries)
          </Text>
          <Text>{money(data.medicationFeeTotalCents)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text>Total collected</Text>
          <Text>
            {money(data.totalEntryFeeCents + data.medicationFeeTotalCents)}
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          This is a fee tally, not a payout calculation — it does not include
          added money and does not reflect any per-placing payout schedule.
          Verify all figures before submission. Validation assistance based on
          configured rule package; final responsibility remains with show
          management and the applicable association.
        </Text>
      </Page>
    </Document>
  );
}
