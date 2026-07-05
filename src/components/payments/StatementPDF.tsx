// src/components/payments/StatementPDF.tsx
// react-pdf/renderer Document component for owner monthly statements.
// SERVER-SIDE ONLY — rendered via renderToBuffer(). Never imported in 'use client' files.
// SECURITY: vendor_cost is never referenced or rendered here (T-04-17).

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatementData {
  orgName: string
  propertyAddress: string
  ownerName: string
  periodYear: number
  periodMonth: number
  rentCollected: number
  expenses: Array<{ description: string; billedAmount: number }>
  managementFeeLabel: string // e.g. "Management Fee (8%)" or "Management Fee (flat $250)"
  managementFee: number
  netToOwner: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount)
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1c1917', // stone-900
  },
  // Header
  headerSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4', // stone-200
    paddingBottom: 16,
  },
  orgName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1c1917',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#78716c', // stone-500
  },
  // Property section
  propertySection: {
    marginBottom: 20,
  },
  propertyAddress: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  propertyMeta: {
    fontSize: 10,
    color: '#57534e', // stone-600
    marginBottom: 2,
  },
  // Summary table
  summarySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#292524', // stone-800
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4', // stone-100
  },
  summaryLabel: {
    fontSize: 10,
    color: '#57534e',
  },
  summaryValue: {
    fontSize: 10,
    color: '#1c1917',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderTopWidth: 2,
    borderTopColor: '#a8a29e', // stone-400
    marginTop: 4,
  },
  netLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1c1917',
  },
  netValue: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1c1917',
  },
  // Expenses detail
  expensesSection: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f4', // stone-100
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#57534e',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f4',
  },
  tableCell: {
    fontSize: 9,
    color: '#44403c', // stone-700
  },
  colDescription: { flex: 3 },
  colAmount: { flex: 1, textAlign: 'right' },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: '#e7e5e4',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#a8a29e', // stone-400
    textAlign: 'center',
  },
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatementPDF({ statement }: { statement: StatementData }) {
  const {
    orgName,
    propertyAddress,
    ownerName,
    periodYear,
    periodMonth,
    rentCollected,
    expenses,
    managementFeeLabel,
    managementFee,
    netToOwner,
  } = statement

  const periodLabel = `${MONTH_NAMES[periodMonth - 1]} ${periodYear}`
  const totalExpensesBilled = expenses.reduce((sum, e) => sum + e.billedAmount, 0)
  const generatedDate = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* 1. Header */}
        <View style={styles.headerSection}>
          <Text style={styles.orgName}>{orgName}</Text>
          <Text style={styles.subtitle}>Owner Statement</Text>
        </View>

        {/* 2. Property + Period */}
        <View style={styles.propertySection}>
          <Text style={styles.propertyAddress}>{propertyAddress}</Text>
          <Text style={styles.propertyMeta}>Owner: {ownerName}</Text>
          <Text style={styles.propertyMeta}>Period: {periodLabel}</Text>
        </View>

        {/* 3. Summary table */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Rent Collected</Text>
            <Text style={styles.summaryValue}>{formatCAD(rentCollected)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Expenses (Billed)</Text>
            <Text style={styles.summaryValue}>-{formatCAD(totalExpensesBilled)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{managementFeeLabel}</Text>
            <Text style={styles.summaryValue}>-{formatCAD(managementFee)}</Text>
          </View>

          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net to Owner</Text>
            <Text style={styles.netValue}>{formatCAD(netToOwner)}</Text>
          </View>
        </View>

        {/* 4. Expense detail — billed_amount ONLY, vendor_cost intentionally excluded */}
        {expenses.length > 0 && (
          <View style={styles.expensesSection}>
            <Text style={styles.sectionTitle}>Expense Detail</Text>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
            </View>

            {expenses.map((expense, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colDescription]}>{expense.description}</Text>
                <Text style={[styles.tableCell, styles.colAmount]}>{formatCAD(expense.billedAmount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 5. Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated on {generatedDate}. Historical statements are immutable snapshots.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
