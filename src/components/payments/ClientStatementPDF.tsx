// Portfolio client monthly statement — disbursement or amount due.
// SERVER-SIDE ONLY via renderToBuffer().

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface ClientStatementData {
  orgName: string
  portfolioName: string
  periodYear: number
  periodMonth: number
  direction: 'disburse' | 'collect'
  netAmount: number
  rentCollected: number
  totalExpenses: number
  managementFees: number
  strNet: number
  properties: Array<{
    address: string
    rentCollected: number
    expenses: number
    managementFee: number
    strNet: number
    net: number
  }>
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1c1917',
  },
  header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e7e5e4', paddingBottom: 14 },
  orgName: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#78716c' },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  muted: { color: '#78716c' },
  totalBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f5f5f4',
    borderRadius: 4,
  },
  totalLabel: { fontSize: 11, color: '#57534e', marginBottom: 4 },
  totalValue: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  propRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
    paddingVertical: 5,
  },
  propAddr: { flex: 2 },
  propNum: { flex: 1, textAlign: 'right' },
})

export function ClientStatementPDF({ data }: { data: ClientStatementData }) {
  const period = `${MONTH_NAMES[data.periodMonth - 1]} ${data.periodYear}`
  const headline =
    data.direction === 'disburse'
      ? `Disbursement to client: ${formatCAD(data.netAmount)}`
      : `Amount due from client: ${formatCAD(data.netAmount)}`

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.orgName}>{data.orgName}</Text>
          <Text style={styles.subtitle}>
            Client statement · {data.portfolioName} · {period}
          </Text>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>
            {data.direction === 'disburse'
              ? 'Net to client (zero account)'
              : 'Amount requested to zero account (expenses exceeded collections)'}
          </Text>
          <Text style={styles.totalValue}>{headline}</Text>
        </View>

        <Text style={styles.sectionTitle}>Period totals</Text>
        <View style={styles.row}>
          <Text style={styles.muted}>Rent collected</Text>
          <Text>{formatCAD(data.rentCollected)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.muted}>STR net</Text>
          <Text>{formatCAD(data.strNet)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.muted}>Billed expenses</Text>
          <Text>{formatCAD(data.totalExpenses)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.muted}>Management fees</Text>
          <Text>{formatCAD(data.managementFees)}</Text>
        </View>

        <Text style={styles.sectionTitle}>By property</Text>
        <View style={styles.propRow}>
          <Text style={[styles.propAddr, styles.muted]}>Property</Text>
          <Text style={[styles.propNum, styles.muted]}>Rent</Text>
          <Text style={[styles.propNum, styles.muted]}>Exp</Text>
          <Text style={[styles.propNum, styles.muted]}>Net</Text>
        </View>
        {data.properties.map((p) => (
          <View key={p.address} style={styles.propRow}>
            <Text style={styles.propAddr}>{p.address}</Text>
            <Text style={styles.propNum}>{formatCAD(p.rentCollected)}</Text>
            <Text style={styles.propNum}>{formatCAD(p.expenses)}</Text>
            <Text style={styles.propNum}>{formatCAD(p.net)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}
