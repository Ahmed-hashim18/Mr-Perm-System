import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Download,
  Printer,
  Users,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import {
  exportElementToPDF,
  printElementDirectly,
  COMPANY_NAME_AR,
  COMPANY_NAME_EN,
} from '../utils/pdfExport';

type ReportTab = 'debt-report' | 'client-ledger' | 'snapshot';

function getLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeToISODate(rawDate?: string, fallback?: string): string {
  const candidates = [rawDate, fallback];
  for (const cand of candidates) {
    const str = String(cand || '').trim();
    if (!str) continue;

    // 1. YYYY-MM-DD or YYYY/MM/DD prefix (handles timestamps like "2026-11-14 13:15:00" or ISO strings)
    const isoPrefix = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[\sT])/);
    if (isoPrefix) {
      const y = isoPrefix[1];
      const m = isoPrefix[2].padStart(2, '0');
      const d = isoPrefix[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // 2. DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:$|[\sT])/);
    if (dmyMatch) {
      const p1 = parseInt(dmyMatch[1], 10);
      const p2 = parseInt(dmyMatch[2], 10);
      const y = dmyMatch[3];
      // Default to DD/MM/YYYY unless middle part exceeds 12 (MM/DD/YYYY)
      const day = p2 > 12 ? p2 : p1;
      const month = p2 > 12 ? p1 : p2;
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // 3. Fallback Date parse -> local YYYY-MM-DD
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return getLocalDateStr(parsed);
    }
  }
  return '';
}

export const ReportsView: React.FC = () => {
  const {
    clients,
    transactions,
    orders,
    syncWithGoogleSheet,
    isOnline,
    offlineQueueCount,
  } = useTreasury();

  const [activeReport, setActiveReport] = useState<ReportTab>('debt-report');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // Sync latest Google Sheet data whenever ReportsView opens (if online & no pending offline queue)
  useEffect(() => {
    if (isOnline && (typeof navigator === 'undefined' || navigator.onLine) && offlineQueueCount === 0) {
      syncWithGoogleSheet().catch(() => {
        // Ignore background sync errors; cached data remains visible
      });
    }
  }, []);

  // -------------------------------------------------------------
  // REPORT 1: CLIENT REPORT / DEBT REPORT (Sheet: "Debt Report")
  // -------------------------------------------------------------
  const [debtReportDate, setDebtReportDate] = useState<string>(() => getLocalDateStr());
  const [debtSearch, setDebtSearch] = useState<string>('');
  const debtReportPrintRef = useRef<HTMLDivElement>(null);

  const debtClients = useMemo(() => {
    return clients
      .filter(c => (c.remaining || 0) > 0)
      .filter(c => {
        if (!debtSearch) return true;
        const q = debtSearch.toLowerCase().trim();
        return (
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q)
        );
      });
  }, [clients, debtSearch]);

  const totalDebtAmount = useMemo(() => {
    return debtClients.reduce((sum, c) => sum + (c.remaining || 0), 0);
  }, [debtClients]);

  const formattedDebtDate = useMemo(() => {
    if (!debtReportDate) return '';
    const parts = debtReportDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return debtReportDate;
  }, [debtReportDate]);

  // -------------------------------------------------------------
  // REPORT 2: CLIENT LEDGER (Sheet: "Client Ledger")
  // -------------------------------------------------------------
  const [selectedClientCode, setSelectedClientCode] = useState<string>('C04');
  const clientLedgerPrintRef = useRef<HTMLDivElement>(null);

  const selectedClient = useMemo(() => {
    return (
      clients.find(c => c.code.toUpperCase() === selectedClientCode.toUpperCase()) ||
      clients[0]
    );
  }, [clients, selectedClientCode]);

  const clientLedgerData = useMemo(() => {
    if (!selectedClient) {
      return { rows: [], totalCashflow: 0, totalOrders: 0, finalBalance: 0 };
    }

    const cCode = selectedClient.code.trim().toUpperCase();
    const cName = selectedClient.name.trim();

    const matchingTxs = transactions.filter(t => {
      const matchCode = t.clientCode && t.clientCode.trim().toUpperCase() === cCode;
      const matchName = t.clientName && t.clientName.trim() === cName;
      return matchCode || matchName;
    });

    const matchingOrders = orders.filter(o => {
      const matchCode = o.clientCode && o.clientCode.trim().toUpperCase() === cCode;
      const matchName = o.clientName && o.clientName.trim() === cName;
      return matchCode || matchName;
    });

    interface LedgerRow {
      id: string;
      date: string;
      description: string;
      cashflowAmount: number | null;
      orderAmount: number | null;
      rawDate: string;
    }

    const rows: LedgerRow[] = [];

    for (const o of matchingOrders) {
      rows.push({
        id: 'ord-' + o.id,
        date: o.date,
        description: o.description || o.invoiceNumber || 'طلب بضاعة',
        cashflowAmount: null,
        orderAmount: o.amount,
        rawDate: o.date,
      });
    }

    for (const t of matchingTxs) {
      rows.push({
        id: 'tx-' + t.id,
        date: t.date,
        description: t.description || (t.refNo ? `Ref #${t.refNo}` : 'حركة نقدية'),
        cashflowAmount: t.amount,
        orderAmount: null,
        rawDate: t.date,
      });
    }

    rows.sort((a, b) => {
      const isoA = normalizeToISODate(a.rawDate);
      const isoB = normalizeToISODate(b.rawDate);
      if (isoA && isoB) return isoA.localeCompare(isoB);
      return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
    });

    const isOwner = cCode === 'C01';
    let running = 0;
    let sumCashflow = 0;
    let sumOrders = 0;

    const rowsWithBalance = rows.map(r => {
      if (r.orderAmount) {
        sumOrders += r.orderAmount;
        running += r.orderAmount;
      }
      if (r.cashflowAmount) {
        sumCashflow += r.cashflowAmount;
        if (isOwner) {
          running -= r.cashflowAmount;
        } else {
          running -= r.cashflowAmount;
        }
      }
      return {
        ...r,
        amount: running,
      };
    });

    return {
      rows: rowsWithBalance,
      totalCashflow: sumCashflow,
      totalOrders: sumOrders,
      finalBalance: isOwner
        ? -sumCashflow
        : rowsWithBalance.length > 0
        ? rowsWithBalance[rowsWithBalance.length - 1].amount
        : selectedClient.remaining || 0,
    };
  }, [selectedClient, transactions, orders]);

  // -------------------------------------------------------------
  // REPORT 3: SNAPSHOT REPORT (Sheet: "Snapshot")
  // -------------------------------------------------------------
  const [snapshotStartDate, setSnapshotStartDate] = useState<string>(() => {
    let minDate = '2026-09-01';
    for (const t of transactions) {
      const d = normalizeToISODate(t.date, t.formattedDate || t.timestamp || t.createdAt);
      if (d && d < minDate) minDate = d;
    }
    return minDate;
  });
  const [snapshotEndDate, setSnapshotEndDate] = useState<string>(() => {
    let maxDate = getLocalDateStr();
    for (const t of transactions) {
      const d = normalizeToISODate(t.date, t.formattedDate || t.timestamp || t.createdAt);
      if (d && d > maxDate) maxDate = d;
    }
    return maxDate;
  });
  const hasEditedSnapshotStartRef = useRef<boolean>(false);
  const hasEditedSnapshotEndRef = useRef<boolean>(false);
  const [snapshotSearch, setSnapshotSearch] = useState<string>('');
  const snapshotPrintRef = useRef<HTMLDivElement>(null);

  // Keep default Snapshot range inclusive of newly synced transactions unless user manually picked dates
  useEffect(() => {
    let minDate = snapshotStartDate;
    let maxDate = snapshotEndDate;
    for (const t of transactions) {
      const d = normalizeToISODate(t.date, t.formattedDate || t.timestamp || t.createdAt);
      if (!d) continue;
      if (d < minDate) minDate = d;
      if (d > maxDate) maxDate = d;
    }
    if (!hasEditedSnapshotStartRef.current && minDate < snapshotStartDate) {
      setSnapshotStartDate(minDate);
    }
    if (!hasEditedSnapshotEndRef.current && maxDate > snapshotEndDate) {
      setSnapshotEndDate(maxDate);
    }
  }, [transactions]);

  const snapshotRows = useMemo(() => {
    return transactions
      .map((t, index) => ({
        tx: t,
        index,
        isoDate: normalizeToISODate(
          t.date,
          t.formattedDate || t.timestamp || t.createdAt
        ),
      }))
      .filter(({ isoDate }) => {
        if (!isoDate) return true;
        if (snapshotStartDate && isoDate < snapshotStartDate) return false;
        if (snapshotEndDate && isoDate > snapshotEndDate) return false;
        return true;
      })
      .filter(({ tx }) => {
        if (!snapshotSearch) return true;
        const q = snapshotSearch.toLowerCase().trim();
        return (
          (tx.clientCode && tx.clientCode.toLowerCase().includes(q)) ||
          (tx.clientName && tx.clientName.toLowerCase().includes(q)) ||
          (tx.refNo && tx.refNo.toLowerCase().includes(q)) ||
          (tx.description && tx.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.isoDate !== b.isoDate) {
          return a.isoDate.localeCompare(b.isoDate);
        }
        return a.index - b.index;
      })
      .map(({ tx, isoDate }) =>
        isoDate && tx.date !== isoDate ? { ...tx, date: isoDate } : tx
      );
  }, [transactions, snapshotStartDate, snapshotEndDate, snapshotSearch]);

  const { totalCashIn, totalCashOut } = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    for (const r of snapshotRows) {
      const isIn = r.type === 'Inflow' || (r.type as string) === 'in';
      if (isIn) {
        inSum += r.amount;
      } else {
        outSum += r.amount;
      }
    }
    return { totalCashIn: inSum, totalCashOut: outSum };
  }, [snapshotRows]);

  // -------------------------------------------------------------
  // PDF EXPORT HANDLERS
  // -------------------------------------------------------------
  const handleExportPDF = async (reportType: ReportTab) => {
    setIsExporting(true);
    try {
      // Sync live data from Google Sheets before rendering PDF so exports are always up-to-date
      if (isOnline && (typeof navigator === 'undefined' || navigator.onLine) && offlineQueueCount === 0) {
        try {
          await syncWithGoogleSheet();
          await new Promise<void>(resolve => setTimeout(resolve, 120));
          await new Promise<void>(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          );
        } catch {
          // Continue exporting current state if network sync fails
        }
      }

      if (reportType === 'debt-report' && debtReportPrintRef.current) {
        await exportElementToPDF(debtReportPrintRef.current, {
          filename: `Debt_Report_${formattedDebtDate || 'Latest'}`,
          title: `${COMPANY_NAME_AR} - تقرير مديونية العملاء`,
          orientation: 'portrait',
        });
        setExportFeedback('Debt Report PDF downloaded successfully!');
      } else if (reportType === 'client-ledger' && clientLedgerPrintRef.current) {
        const clientLabel = selectedClient ? `${selectedClient.code}_${selectedClient.name}` : 'Client';
        await exportElementToPDF(clientLedgerPrintRef.current, {
          filename: `Client_Ledger_${clientLabel}`,
          title: `${COMPANY_NAME_AR} - كشف حساب عميل - ${clientLabel}`,
          orientation: 'portrait',
        });
        setExportFeedback(`Ledger for ${selectedClient?.name || 'Client'} downloaded as PDF!`);
      } else if (reportType === 'snapshot' && snapshotPrintRef.current) {
        await exportElementToPDF(snapshotPrintRef.current, {
          filename: `Snapshot_${snapshotStartDate}_to_${snapshotEndDate}`,
          title: `${COMPANY_NAME_EN} - Snapshot Report (${snapshotStartDate} to ${snapshotEndDate})`,
          orientation: 'landscape',
        });
        setExportFeedback('Snapshot Report PDF downloaded successfully!');
      }
    } catch (err) {
      console.error(err);
      alert('Could not generate PDF. Please try Print as PDF instead.');
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportFeedback(null), 4000);
    }
  };

  const handlePrint = (reportType: ReportTab) => {
    if (reportType === 'debt-report' && debtReportPrintRef.current) {
      printElementDirectly(debtReportPrintRef.current, `Debt_Report_${formattedDebtDate}`);
    } else if (reportType === 'client-ledger' && clientLedgerPrintRef.current) {
      printElementDirectly(clientLedgerPrintRef.current, `Client_Ledger_${selectedClient?.code || ''}`);
    } else if (reportType === 'snapshot' && snapshotPrintRef.current) {
      printElementDirectly(snapshotPrintRef.current, `Snapshot_${snapshotStartDate}_to_${snapshotEndDate}`);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-150">
      {/* Toast Feedback */}
      {exportFeedback && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 bg-emerald-600 text-white rounded-xl shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{exportFeedback}</p>
              <p className="text-xs text-emerald-600">Saved as PDF file</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExportFeedback(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 min-h-[40px] px-2 shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Report Type Selector Tabs */}
      <div className="bg-white rounded-3xl p-2.5 sm:p-3 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="w-full lg:w-auto overflow-x-auto">
          <div className="inline-flex p-1 bg-slate-100 rounded-2xl gap-1 flex-nowrap min-w-max">
            {/* Tab 1: Client Report (Debt Report) */}
            <button
              type="button"
              onClick={() => setActiveReport('debt-report')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeReport === 'debt-report'
                  ? 'bg-[#284742] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>1. Debt Report</span>
            </button>

            {/* Tab 2: Client Ledger */}
            <button
              type="button"
              onClick={() => setActiveReport('client-ledger')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeReport === 'client-ledger'
                  ? 'bg-[#284742] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>2. Client Ledger</span>
            </button>

            {/* Tab 3: Snapshot */}
            <button
              type="button"
              onClick={() => setActiveReport('snapshot')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                activeReport === 'snapshot'
                  ? 'bg-[#284742] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>3. Snapshot Report</span>
            </button>
          </div>
        </div>

        {/* Global Export Buttons */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <button
            type="button"
            onClick={() => handlePrint(activeReport)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Print or Save via Browser"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={() => handleExportPDF(activeReport)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. CLIENT REPORT (DEBT REPORT)                                  */}
      {/* ============================================================== */}
      {activeReport === 'debt-report' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
                <span>تقرير مديونية العملاء</span>
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg">
                  Sheet: Debt Report
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Displays clients with outstanding debt &bull; Select report date
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Date Input */}
              <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200 px-3 py-2 min-h-[40px] rounded-xl flex-1 sm:flex-none">
                <span className="text-xs font-bold text-blue-900 font-sans">التاريخ:</span>
                <input
                  type="date"
                  value={debtReportDate}
                  onChange={e => setDebtReportDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-blue-950 focus:outline-none cursor-pointer w-full sm:w-auto"
                />
              </div>

              {/* Search */}
              <div className="relative flex-1 sm:flex-none min-w-[160px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={debtSearch}
                  onChange={e => setDebtSearch(e.target.value)}
                  placeholder="Filter client..."
                  className="w-full pl-8 pr-3 py-2 min-h-[40px] text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Printable Report Container */}
          <div
            ref={debtReportPrintRef}
            className="p-3 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs"
            dir="rtl"
          >
            {/* Company Branding Header */}
            <div className="pdf-company-header pdf-report-header mb-4 pb-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base text-[#284742]">
                  {COMPANY_NAME_AR}
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="font-sans text-xs font-semibold text-slate-500">
                  {COMPANY_NAME_EN}
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="font-sans text-xs text-slate-700 font-bold">
                  تقرير المديونية
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-[#284742] text-white font-bold text-xs px-3 py-1 rounded-lg">
                  التاريخ
                </span>
                <span className="bg-slate-100 border border-slate-300 font-bold text-xs px-3 py-1 rounded-lg font-mono">
                  {formattedDebtDate}
                </span>
              </div>
            </div>

            {/* Table wrapped cleanly in overflow-x-auto */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto">
              <table className="w-full min-w-[480px] text-right text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#4a86e8] text-white font-bold border-b border-[#3b72cc]">
                    <th className="py-2.5 px-3 sm:px-4 text-center border-l border-white/20 w-16">الرقم</th>
                    <th className="py-2.5 px-3 sm:px-4 text-center border-l border-white/20 w-28">كود الشركة</th>
                    <th className="py-2.5 px-3 sm:px-4 text-right border-l border-white/20">اسم الشركة</th>
                    <th className="py-2.5 px-3 sm:px-4 text-left w-44">المديونية (SDG)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-sans">
                  {debtClients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        لا توجد مديونيات مسجلة مطابقة.
                      </td>
                    </tr>
                  ) : (
                    debtClients.map((client, idx) => {
                      const debtVal = client.remaining || 0;
                      return (
                        <tr
                          key={client.code}
                          className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                        >
                          <td className="py-2.5 px-3 sm:px-4 text-center font-bold text-slate-600 border-l border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-center font-mono font-bold text-blue-900 border-l border-slate-200">
                            {client.code}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-900 border-l border-slate-200">
                            {client.name}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-left font-mono font-bold text-rose-700">
                            {debtVal.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-bold border-t-2 border-[#4a86e8] text-slate-900">
                    <td colSpan={3} className="py-3 px-3 sm:px-4 text-right text-xs sm:text-sm text-blue-950">
                      إجمالي المديونية المستحقة ({debtClients.length} عميل):
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-left font-mono text-sm sm:text-base font-extrabold text-rose-700">
                      {totalDebtAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-xs text-slate-600">SDG</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer stamp */}
            <div
              data-pdf-static-footer="true"
              className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400 font-sans"
            >
              <span>تم استخراج التقرير آلياً من نظام إدارة الخزينة &bull; {COMPANY_NAME_AR} ({COMPANY_NAME_EN})</span>
              <span>تاريخ التقرير: {formattedDebtDate}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CLIENT LEDGER REPORT (Sheet: "Client Ledger")               */}
      {/* ============================================================== */}
      {activeReport === 'client-ledger' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
                <span>Client Ledger Report</span>
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg">
                  Sheet: Client Ledger
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Select any client to inspect all related Cashflow transactions and Order debt history
              </p>
            </div>

            {/* Client Selector Dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider shrink-0">
                Select Client:
              </label>
              <select
                value={selectedClientCode}
                onChange={e => setSelectedClientCode(e.target.value)}
                className="w-full sm:w-auto max-w-full min-w-0 px-3.5 py-2.5 min-h-[40px] bg-blue-50 border border-blue-200 text-blue-950 font-bold rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#284742]/20 cursor-pointer"
              >
                {clients.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name} {c.remaining ? `(${c.remaining.toLocaleString()} SDG)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Printable Client Ledger Container */}
          <div
            ref={clientLedgerPrintRef}
            className="p-3 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs"
          >
            {/* Company Branding Header */}
            <div
              className="pdf-company-header pdf-report-header mb-3 pb-2.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs"
              dir="rtl"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base text-[#284742]">
                  {COMPANY_NAME_AR}
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="font-semibold text-slate-600">{COMPANY_NAME_EN}</span>
                <span className="text-slate-300">&bull;</span>
                <span className="font-bold text-slate-700">Client Ledger Report</span>
              </div>
              <span className="font-mono text-slate-500">
                {getLocalDateStr()}
              </span>
            </div>

            {/* Client Title Banner */}
            <div className="mb-4 bg-slate-50 border border-slate-300 rounded-xl p-3 text-center shadow-2xs">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight" dir="auto">
                {selectedClient?.name || 'Client'}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5 break-words">
                Client Code: <strong className="text-[#284742]">{selectedClient?.code}</strong>
                {selectedClient?.phone ? ` • Phone: ${selectedClient.phone}` : ''}
                {selectedClient?.area ? ` • Area: ${selectedClient.area}` : ''}
              </p>
            </div>

            {/* Table wrapped cleanly in overflow-x-auto */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#4a86e8] text-white font-bold border-b border-[#3b72cc]">
                    <th className="py-2.5 px-3 sm:px-4 w-28 border-r border-white/20">Date</th>
                    <th className="py-2.5 px-3 sm:px-4 border-r border-white/20">Description</th>
                    <th className="py-2.5 px-3 sm:px-4 text-right w-36 border-r border-white/20">Cashflow</th>
                    <th className="py-2.5 px-3 sm:px-4 text-right w-36 border-r border-white/20">Order Log</th>
                    <th className="py-2.5 px-3 sm:px-4 text-right w-40">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {clientLedgerData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No transactions found for {selectedClient?.name}.
                      </td>
                    </tr>
                  ) : (
                    clientLedgerData.rows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                      >
                        <td className="py-2.5 px-3 sm:px-4 font-mono font-medium text-slate-700 border-r border-slate-200">
                          {row.date}
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 font-semibold text-slate-900 border-r border-slate-200" dir="auto">
                          {row.description}
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 text-right font-mono text-slate-800 border-r border-slate-200">
                          {row.cashflowAmount !== null
                            ? row.cashflowAmount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : ''}
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 text-right font-mono text-slate-800 border-r border-slate-200">
                          {row.orderAmount !== null
                            ? row.orderAmount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : ''}
                        </td>
                        <td className="py-2.5 px-3 sm:px-4 text-right font-mono font-bold text-slate-900">
                          {row.amount < 0
                            ? `${Math.abs(row.amount).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}-`
                            : row.amount.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#b3d1ff] font-bold border-t-2 border-[#4a86e8] text-slate-900 text-xs sm:text-sm">
                    <td colSpan={2} className="py-3 px-3 sm:px-4 font-extrabold text-blue-950">
                      Total Balance
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-extrabold text-blue-950 border-r border-blue-300">
                      {clientLedgerData.totalCashflow.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-extrabold text-blue-950 border-r border-blue-300">
                      {clientLedgerData.totalOrders.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-black text-rose-950">
                      {clientLedgerData.finalBalance < 0
                        ? `${Math.abs(clientLedgerData.finalBalance).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}-`
                        : clientLedgerData.finalBalance.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div
              data-pdf-static-footer="true"
              className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400"
            >
              <span>{COMPANY_NAME_AR} &bull; {COMPANY_NAME_EN} &bull; Client Ledger Report</span>
              <span>Generated: {new Date().toLocaleDateString('en-US')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. SNAPSHOT REPORT (Sheet: "Snapshot")                          */}
      {/* ============================================================== */}
      {activeReport === 'snapshot' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center flex-wrap gap-2">
                <span>Snapshot Report</span>
                <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg">
                  Sheet: Snapshot
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Cash in & Cash out summary across all client transactions within selected date range
              </p>
            </div>

            {/* Date Range Pickers */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-2 min-h-[40px] rounded-xl flex-1 sm:flex-none">
                <span className="text-xs font-bold text-blue-900">Start:</span>
                <input
                  type="date"
                  value={snapshotStartDate}
                  onChange={e => {
                    hasEditedSnapshotStartRef.current = true;
                    setSnapshotStartDate(e.target.value);
                  }}
                  className="bg-transparent text-xs font-bold text-blue-950 focus:outline-none cursor-pointer w-full sm:w-auto"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-2 min-h-[40px] rounded-xl flex-1 sm:flex-none">
                <span className="text-xs font-bold text-blue-900">End:</span>
                <input
                  type="date"
                  value={snapshotEndDate}
                  onChange={e => {
                    hasEditedSnapshotEndRef.current = true;
                    setSnapshotEndDate(e.target.value);
                  }}
                  className="bg-transparent text-xs font-bold text-blue-950 focus:outline-none cursor-pointer w-full sm:w-auto"
                />
              </div>

              <div className="relative w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={snapshotSearch}
                  onChange={e => setSnapshotSearch(e.target.value)}
                  placeholder="Search snapshot..."
                  className="w-full pl-8 pr-3 py-2 min-h-[40px] text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Printable Snapshot Container */}
          <div
            ref={snapshotPrintRef}
            className="p-3 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs"
          >
            {/* Company Branding Header */}
            <div
              className="pdf-company-header pdf-report-header mb-3 pb-2.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs"
              dir="rtl"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base text-[#284742]">
                  {COMPANY_NAME_AR}
                </span>
                <span className="text-slate-300">&bull;</span>
                <span className="font-semibold text-slate-600">{COMPANY_NAME_EN}</span>
                <span className="text-slate-300">&bull;</span>
                <span className="font-bold text-slate-700">Snapshot Report</span>
              </div>
              <span className="font-mono text-slate-500">
                {snapshotStartDate} &rarr; {snapshotEndDate}
              </span>
            </div>

            {/* Header Row: Start [Date] | End [Date] */}
            <div className="mb-4 flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="bg-[#4a86e8] text-white font-bold text-xs px-3 py-1.5 rounded-lg">
                Start
              </div>
              <div className="bg-slate-100 border border-slate-300 font-bold text-xs px-3 py-1.5 rounded-lg font-mono">
                {snapshotStartDate}
              </div>
              <div className="bg-[#4a86e8] text-white font-bold text-xs px-3 py-1.5 rounded-lg">
                End
              </div>
              <div className="bg-slate-100 border border-slate-300 font-bold text-xs px-3 py-1.5 rounded-lg font-mono">
                {snapshotEndDate}
              </div>
              <div className="sm:ml-auto text-xs font-bold text-slate-500">
                {snapshotRows.length} Records in Snapshot
              </div>
            </div>

            {/* First-page-only 3 Summary Cards for Selected Duration */}
            <div className="pdf-summary-grid grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-4">
              <div className="p-3 sm:p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 flex items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    Total Inflow
                  </span>
                  <p className="text-base sm:text-lg font-extrabold font-mono text-emerald-800 mt-1 break-words">
                    +{totalCashIn.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-[10px] sm:text-xs font-sans">SDG</span>
                  </p>
                </div>
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-rose-50/70 rounded-2xl border border-rose-200/80 flex items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    Total Outflow
                  </span>
                  <p className="text-base sm:text-lg font-extrabold font-mono text-rose-800 mt-1 break-words">
                    -{totalCashOut.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-[10px] sm:text-xs font-sans">SDG</span>
                  </p>
                </div>
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-[#284742]/5 rounded-2xl border border-[#284742]/20 flex items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#284742]">
                    Current Treasury Balance
                  </span>
                  <p
                    className={`text-base sm:text-lg font-extrabold font-mono mt-1 break-words ${
                      totalCashIn - totalCashOut < 0 ? 'text-rose-700' : 'text-slate-900'
                    }`}
                  >
                    {(totalCashIn - totalCashOut).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-[10px] sm:text-xs font-sans font-bold text-slate-500">SDG</span>
                  </p>
                </div>
                <div className="p-2 bg-[#284742]/10 text-[#284742] rounded-xl shrink-0">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>

            {/* Table wrapped cleanly in overflow-x-auto */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a86e8] text-white font-bold border-b border-[#3b72cc]">
                    <th className="py-2.5 px-3 w-28 border-r border-white/20">Date</th>
                    <th className="py-2.5 px-3 w-24 border-r border-white/20">Client Code</th>
                    <th className="py-2.5 px-3 border-r border-white/20">Client Name</th>
                    <th className="py-2.5 px-3 w-24 border-r border-white/20">Ref No.</th>
                    <th className="py-2.5 px-3 border-r border-white/20">Description</th>
                    <th className="py-2.5 px-3 text-right w-36 border-r border-white/20">Cash in</th>
                    <th className="py-2.5 px-3 text-right w-36">Cash Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {snapshotRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No transactions found in this date range.
                      </td>
                    </tr>
                  ) : (
                    snapshotRows.map((tx, idx) => {
                      const isIn = tx.type === 'Inflow' || (tx.type as string) === 'in';
                      return (
                        <tr
                          key={tx.id}
                          className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                        >
                          <td className="py-2 px-3 font-mono text-slate-700 border-r border-slate-200">
                            {tx.date}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-blue-900 border-r border-slate-200">
                            {tx.clientCode}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200" dir="auto">
                            {tx.clientName}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700 border-r border-slate-200">
                            {tx.refNo}
                          </td>
                          <td className="py-2 px-3 text-slate-800 border-r border-slate-200" dir="auto">
                            {tx.description}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 border-r border-slate-200">
                            {isIn
                              ? tx.amount.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : ''}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                            {!isIn
                              ? tx.amount.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : ''}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#b3d1ff] font-bold border-t-2 border-[#4a86e8] text-slate-900 text-xs sm:text-sm">
                    <td colSpan={5} className="py-3 px-4 font-black text-blue-950">
                      Total
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-950 border-r border-blue-300">
                      {totalCashIn.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-rose-950">
                      {totalCashOut.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div
              data-pdf-static-footer="true"
              className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-400"
            >
              <span>{COMPANY_NAME_AR} &bull; {COMPANY_NAME_EN} &bull; Snapshot Report</span>
              <span>Range: {snapshotStartDate} to {snapshotEndDate}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
