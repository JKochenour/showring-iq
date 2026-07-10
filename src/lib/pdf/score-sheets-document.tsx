import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ShowResultsData } from "@/lib/load-show-results";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  sheet: {
    border: "1pt solid #18181b",
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 13, fontWeight: 700, marginBottom: 8 },
  fieldRow: { flexDirection: "row", marginBottom: 6 },
  fieldLabel: { width: 90, color: "#52525b" },
  fieldValue: { fontWeight: 700 },
  signatureRow: {
    flexDirection: "row",
    marginTop: 24,
    paddingTop: 8,
    borderTop: "0.5pt solid #d4d4d8",
  },
  signatureBlock: { width: "50%" },
  signatureLine: {
    marginTop: 24,
    borderTop: "0.5pt solid #18181b",
    paddingTop: 4,
    width: "80%",
  },
});

export function ScoreSheetsDocument({ data }: { data: ShowResultsData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {data.classes.flatMap((cls) =>
          cls.rows
            .filter((row) => !row.scratched)
            .map((row, i) => (
              <View key={`${cls.classId}-${i}`} style={styles.sheet} wrap={false}>
                <Text style={styles.title}>
                  Class {cls.classNumber} — {cls.name}
                  {cls.patternNumber && `  ·  Pattern ${cls.patternNumber}`}
                </Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Back number</Text>
                  <Text style={styles.fieldValue}>
                    {row.backNumber ? `#${row.backNumber}` : "—"}
                  </Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Rider</Text>
                  <Text style={styles.fieldValue}>{row.riderName}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Horse</Text>
                  <Text style={styles.fieldValue}>{row.horseName}</Text>
                </View>
                {row.ownerName && (
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Owner</Text>
                    <Text style={styles.fieldValue}>{row.ownerName}</Text>
                  </View>
                )}
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Recorded score</Text>
                  <Text style={styles.fieldValue}>{row.scoreLabel}</Text>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Placing</Text>
                  <Text style={styles.fieldValue}>
                    {row.placing ? row.placing : "—"}
                  </Text>
                </View>
                <View style={styles.signatureRow}>
                  <View style={styles.signatureBlock}>
                    <Text style={styles.signatureLine}>Judge signature</Text>
                  </View>
                  <View style={styles.signatureBlock}>
                    <Text style={styles.signatureLine}>Date</Text>
                  </View>
                </View>
              </View>
            ))
        )}
      </Page>
    </Document>
  );
}
