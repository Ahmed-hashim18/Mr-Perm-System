import React, { useState, useRef } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import { DayGroup } from '../types/treasury';
import { ReportsView } from './ReportsView';
import {
  exportElementToPDF,
  formatPdfFilename,
  COMPANY_NAME_AR,
  COMPANY_NAME_EN,
} from '../utils/pdfExport';

interface DailyPdfPayload {
  groups: DayGroup[];
  subtitle: string;
  filename: string;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
}

export const SubmittedTransactionsView: React.FC = () => {
  const {
    dayGroups,
    currentBalance,
    sheetConfig,
    isSyncing,
    syncWithGoogleSheet,
    selectedMonth,
    prevMonth,
    nextMonth,
  } = useTreasury();

  const [activeSection, setActiveSection] = useState<'transactions' | 'reports'>('transactions');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Inflow' | 'Outflow'>('All');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfPayload, setPdfPayload] = useState<DailyPdfPayload | null>(null);
  const dailyPdfPrintRef = useRef<HTMLDivElement>(null);

  const monthNames = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
  ];
  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonthLabel = `${monthNames[selectedMonth.month]} ${selectedMonth.year}`;
  const fullMonthLabel = `${fullMonthNames[selectedMonth.month]} ${selectedMonth.year}`;

  const filteredGroups = dayGroups
    .map(group => {
      const filteredTxs = group.transactions.filter(tx => {
        const matchesSearch =
          (tx.clientName && tx.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (tx.clientCode && tx.clientCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (tx.refNo && tx.refNo.toLowerCase().includes(searchQuery.toLowerCase()));

        const isIn = tx.type === 'Inflow' || (tx.type as string) === 'in';
        const matchesType =
          filterType === 'All' ||
          (filterType === 'Inflow' && isIn) ||
          (filterType === 'Outflow' && !isIn);

        return matchesSearch && matchesType;
      });

      let dayIn = 0;
      let dayOut = 0;
      for (const t of filteredTxs) {
        const isIn = t.type === 'Inflow' || (t.type as string) === 'in';
        if (isIn) {
          dayIn += t.amount;
        } else {
          dayOut += t.amount;
        }
      }

      return {
        ...group,
        totalIn: dayIn,
        totalOut: dayOut,
        transactions: filteredTxs,
      };
    })
    .filter(group => group.transactions.length > 0);

  const allMonthTxs = dayGroups.flatMap(g => g.transactions);
  const totalMonthIn = allMonthTxs.reduce((sum, t) => {
    const isIn = t.type === 'Inflow' || (t.type as string) === 'in';
    return sum + (isIn ? t.amount : 0);
  }, 0);
  const totalMonthOut = allMonthTxs.reduce((sum, t) => {
    const isIn = t.type === 'Inflow' || (t.type as string) === 'in';
    return sum + (!isIn ? t.amount : 0);
  }, 0);

  const handleDownloadDailyPdf = async (
    groupsToExport: DayGroup[],
    subtitle: string,
    filenamePrefix: string,
    explicitDate?: string
  ) => {
    if (groupsToExport.length === 0 || isExportingPdf) return;

    const totalIn = groupsToExport.reduce((s, g) => s + g.totalIn, 0);
    const totalOut = groupsToExport.reduce((s, g) => s + g.totalOut, 0);
    const lastGroup = groupsToExport[groupsToExport.length - 1];
    const closingBalance = lastGroup ? lastGroup.closingBalance : currentBalance;
    const filename = formatPdfFilename(filenamePrefix, explicitDate);

    setIsExportingPdf(true);
    setPdfPayload({
      groups: groupsToExport,
      subtitle,
      filename,
      totalIn,
      totalOut,
      closingBalance,
    });

    try {
      // Wait for React to commit the structured daily table into dailyPdfPrintRef
      await new Promise<void>(resolve => setTimeout(resolve, 60));
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      if (dailyPdfPrintRef.current) {
        await exportElementToPDF(dailyPdfPrintRef.current, {
          filename,
          title: `${COMPANY_NAME_AR} - ${subtitle}`,
          orientation: 'landscape',
        });
      }
    } catch (err) {
      console.error('Error generating daily CashFlow PDF:', err);
      alert('Could not generate PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 space-y-4 sm:space-y-6">
      {/* View Data Sub-Navigation Bar */}
      <div className="bg-white rounded-3xl p-2.5 sm:p-3 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="grid grid-cols-2 sm:inline-flex p-1 bg-slate-100 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setActiveSection('transactions')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSection === 'transactions'
                ? 'bg-[#284742] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="md:hidden">Transactions</span>
            <span className="hidden md:inline">Transactions Log</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('reports')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSection === 'reports'
                ? 'bg-[#284742] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="md:hidden">Reports</span>
            <span className="hidden md:inline">3 Reports & PDF Export</span>
            <span className="text-[10px] bg-rose-500 text-white font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
              PDF
            </span>
          </button>
        </div>

        {activeSection === 'transactions' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('reports')}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-bold text-[#284742] bg-[#284742]/10 hover:bg-[#284742]/20 rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Reports</span>
            </button>
          </div>
        )}
      </div>

      {/* Conditionally Render ReportsView */}
      {activeSection === 'reports' ? (
        <ReportsView />
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-4 md:p-10">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 md:pb-6 border-b border-slate-100 mb-5 md:mb-8">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Submitted Transactions
              </h1>
              <div className="flex items-center flex-wrap gap-2 text-slate-500 text-xs sm:text-sm mt-1">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{fullMonthLabel}</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  {allMonthTxs.length} Transactions
                </span>
              </div>
            </div>

            {/* Month Switcher & Refresh controls */}
            <div className="flex items-center justify-between sm:justify-start gap-2.5 flex-wrap">
              <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-2xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-xs font-black uppercase tracking-wider text-slate-800 whitespace-nowrap">
                  {currentMonthLabel}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-white text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={syncWithGoogleSheet}
                disabled={isSyncing}
                title="Refresh / Sync"
                className="min-w-[42px] min-h-[42px] flex items-center justify-center bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 rounded-2xl shadow-2xs transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#284742]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Top Summary Stats: 2-column grid on phones (hide 3rd balance card on phones), 3-col on md+ */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4 mb-5 sm:mb-6">
            <div className="p-3 sm:p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Total Inflow
                </p>
                <p className="text-sm sm:text-xl font-extrabold text-emerald-800 mt-1 break-words tabular-nums">
                  +{totalMonthIn.toLocaleString()} <span className="text-[10px] sm:text-xs">SDG</span>
                </p>
              </div>
              <div className="hidden sm:flex p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-rose-50/60 rounded-2xl border border-rose-100 flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Total Outflow
                </p>
                <p className="text-sm sm:text-xl font-extrabold text-rose-800 mt-1 break-words tabular-nums">
                  -{totalMonthOut.toLocaleString()} <span className="text-[10px] sm:text-xs">SDG</span>
                </p>
              </div>
              <div className="hidden sm:flex p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            <div className="hidden md:flex p-4 bg-[#284742]/5 rounded-2xl border border-[#284742]/15 items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#284742]">
                  Current Treasury Balance
                </p>
                <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                  {currentBalance.toLocaleString()} <span className="text-xs font-bold text-slate-500">SDG</span>
                </p>
              </div>
              <div className="p-2.5 bg-[#284742]/10 text-[#284742] rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5 sm:mb-6">
            <div className="relative flex-1 sm:max-w-md min-w-0">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by client, ref no., or description..."
                className="w-full pl-9 pr-4 py-2.5 min-h-[40px] bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20 focus:border-[#284742]"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterType('All')}
                  className={`px-3 py-1.5 min-h-[34px] rounded-lg transition-colors cursor-pointer ${
                    filterType === 'All' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('Inflow')}
                  className={`px-3 py-1.5 min-h-[34px] rounded-lg transition-colors cursor-pointer ${
                    filterType === 'Inflow' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Inflow
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('Outflow')}
                  className={`px-3 py-1.5 min-h-[34px] rounded-lg transition-colors cursor-pointer ${
                    filterType === 'Outflow' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Outflow
                </button>
              </div>

              <button
                type="button"
                disabled={isExportingPdf || filteredGroups.length === 0}
                onClick={() =>
                  handleDownloadDailyPdf(
                    filteredGroups,
                    `Daily Cash Flow Log — ${fullMonthLabel}`,
                    `CashFlow_${currentMonthLabel.replace(/\s+/g, '_')}`
                  )
                }
                className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-[#284742] hover:bg-[#1e3632] text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                title="Download daily-grouped PDF for this month"
              >
                <Download className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
                <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
              </button>
            </div>
          </div>

          {/* Day Groups List */}
          {filteredGroups.length > 0 ? (
            <div className="space-y-5 sm:space-y-8">
              {filteredGroups.map(group => (
                <div key={group.date} className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                  {/* Date Group Header Banner (stacks cleanly on phone) */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 px-3.5 sm:px-5 py-3 sm:py-3.5 bg-slate-50/90 border-b border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="font-bold text-slate-900 text-sm sm:text-base truncate">
                          {group.displayDate}
                        </span>
                      </div>
                      <span className="md:hidden px-2 py-0.5 bg-slate-200/70 text-slate-700 text-xs font-bold rounded-lg shrink-0">
                        ({group.transactions.length})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={isExportingPdf}
                        onClick={() =>
                          handleDownloadDailyPdf(
                            [group],
                            `Daily Cash Flow — ${group.displayDate}`,
                            'CashFlow_Day',
                            group.date
                          )
                        }
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center bg-white hover:bg-[#284742] border border-slate-200 text-slate-600 hover:text-white rounded-lg shadow-2xs transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                        title={`Download PDF for ${group.date}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <div className="px-2.5 sm:px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                          OPENING:
                        </span>
                        <span className="font-extrabold text-slate-800 tabular-nums">
                          {group.openingBalance.toLocaleString()}{' '}
                          <span className="text-[10px] text-slate-400 font-semibold">SDG</span>
                        </span>
                      </div>

                      <div className="px-2.5 sm:px-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                          CLOSING:
                        </span>
                        <span className="font-extrabold text-slate-900 tabular-nums">
                          {group.closingBalance.toLocaleString()}{' '}
                          <span className="text-[10px] text-slate-400 font-semibold">SDG</span>
                        </span>
                      </div>

                      <span className="hidden md:inline-block px-2 py-0.5 bg-slate-200/70 text-slate-700 text-xs font-bold rounded-lg">
                        ({group.transactions.length})
                      </span>
                    </div>
                  </div>

                  {/* Phone Card List (< 768px) */}
                  <div className="md:hidden divide-y divide-slate-100 bg-white">
                    {group.transactions.map(tx => {
                      const isInflow = tx.type === 'Inflow' || (tx.type as string) === 'in';
                      return (
                        <div key={tx.id} className="p-3.5 space-y-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm break-words" dir="auto">
                              {tx.clientName}
                            </span>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                isInflow
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isInflow ? 'Inflow' : 'Outflow'}
                            </span>
                          </div>

                          {tx.description && (
                            <p className="text-xs text-slate-500 break-words leading-snug" dir="auto">
                              {tx.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                            <span
                              className={`text-base font-extrabold tabular-nums ${
                                isInflow ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {isInflow ? '+' : '-'}{tx.amount.toLocaleString()}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 tabular-nums">
                              Balance: {tx.balance.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-white">
                          <th className="py-3 px-3">DATE</th>
                          <th className="py-3 px-3">CLIENT CODE</th>
                          <th className="py-3 px-4">CLIENT NAME</th>
                          <th className="py-3 px-3">REF NO.</th>
                          <th className="py-3 px-4">DESCRIPTION</th>
                          <th className="py-3 px-3 text-center">TYPE</th>
                          <th className="py-3 px-4 text-right">AMOUNT</th>
                          <th className="py-3 px-4 text-right">BALANCE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {group.transactions.map(tx => {
                          const isInflow = tx.type === 'Inflow' || (tx.type as string) === 'in';
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                              {/* Date */}
                              <td className="py-3 px-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                                {tx.date}
                              </td>

                              {/* Client Code */}
                              <td className="py-3 px-3 font-mono font-bold text-[#284742] whitespace-nowrap">
                                {tx.clientCode}
                              </td>

                              {/* Client Name */}
                              <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap" dir="auto">
                                {tx.clientName}
                              </td>

                              {/* Ref No. */}
                              <td className="py-3 px-3 font-mono font-medium text-slate-600 whitespace-nowrap">
                                {tx.refNo}
                              </td>

                              {/* Description */}
                              <td className="py-3 px-4 text-slate-700 max-w-xs sm:max-w-md break-words" dir="auto">
                                {tx.description}
                              </td>

                              {/* Type {Inflow / Outflow} */}
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                                    isInflow
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {isInflow ? 'Inflow' : 'Outflow'}
                                </span>
                              </td>

                              {/* Amount */}
                              <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                                <span
                                  className={`font-bold ${
                                    isInflow ? 'text-emerald-600' : 'text-rose-600'
                                  }`}
                                >
                                  {isInflow ? '+' : '-'}{tx.amount.toLocaleString()}
                                </span>
                              </td>

                              {/* Running Balance */}
                              <td className="py-3 px-4 text-right font-extrabold text-slate-900 whitespace-nowrap tabular-nums">
                                {tx.balance.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl px-4">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">No transactions found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                There are no recorded transactions for {fullMonthLabel} matching your search filters.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Off-screen Printable Daily-Grouped PDF Template (cloned by exportElementToPDF) */}
      <div
        aria-hidden="true"
        className="fixed -left-[15000px] top-0 w-[1120px] pointer-events-none bg-white"
      >
        <div ref={dailyPdfPrintRef} className="p-6 bg-white text-slate-900">
          {pdfPayload && (
            <>
              {/* Company Branding Header */}
              <div
                className="pdf-company-header pdf-report-header mb-3 pb-2.5 border-b border-slate-200 flex items-center justify-between gap-2 text-xs"
                dir="rtl"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-base text-[#284742]">
                    {COMPANY_NAME_AR}
                  </span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="font-semibold text-slate-600">{COMPANY_NAME_EN}</span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="font-bold text-slate-700" dir="ltr">
                    {pdfPayload.subtitle}
                  </span>
                </div>
                <span className="font-mono text-slate-500" dir="ltr">
                  {pdfPayload.groups.length} Day(s)
                </span>
              </div>

              {/* 3 Compact Summary Cards */}
              <div className="pdf-summary-grid grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Total Inflow
                  </span>
                  <p className="text-base font-extrabold font-mono text-emerald-800 mt-1">
                    +{pdfPayload.totalIn.toLocaleString()} {sheetConfig.currency}
                  </p>
                </div>

                <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-700">
                    Total Outflow
                  </span>
                  <p className="text-base font-extrabold font-mono text-rose-800 mt-1">
                    -{pdfPayload.totalOut.toLocaleString()} {sheetConfig.currency}
                  </p>
                </div>

                <div className="p-3 bg-[#284742]/5 rounded-xl border border-[#284742]/20">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#284742]">
                    Closing Treasury Balance
                  </span>
                  <p className="text-base font-extrabold font-mono text-slate-900 mt-1">
                    {pdfPayload.closingBalance.toLocaleString()} {sheetConfig.currency}
                  </p>
                </div>
              </div>

              {/* Unified Daily-Grouped Table for crisp repeating headers & row-safe pagination */}
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#284742] text-white font-bold">
                      <th className="py-2 px-3 w-24 border-r border-white/20">DATE</th>
                      <th className="py-2 px-3 w-24 border-r border-white/20">CLIENT CODE</th>
                      <th className="py-2 px-3 border-r border-white/20">CLIENT NAME</th>
                      <th className="py-2 px-3 w-20 border-r border-white/20">REF NO.</th>
                      <th className="py-2 px-3 border-r border-white/20">DESCRIPTION</th>
                      <th className="py-2 px-3 text-center w-20 border-r border-white/20">TYPE</th>
                      <th className="py-2 px-3 text-right w-32 border-r border-white/20">AMOUNT</th>
                      <th className="py-2 px-3 text-right w-32">BALANCE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pdfPayload.groups.map(group => (
                      <React.Fragment key={group.date}>
                        <tr className="pdf-day-banner-row">
                          <td colSpan={8} className="py-2 px-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-extrabold text-[#284742]">
                                {group.displayDate} ({group.transactions.length})
                              </span>
                              <span className="font-mono text-[11px] text-slate-700">
                                OPENING: {group.openingBalance.toLocaleString()} {sheetConfig.currency}
                                {'  |  '}
                                CLOSING: {group.closingBalance.toLocaleString()} {sheetConfig.currency}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {group.transactions.map(tx => {
                          const isInflow = tx.type === 'Inflow' || (tx.type as string) === 'in';
                          return (
                            <tr key={tx.id}>
                              <td className="py-1.5 px-3 font-mono text-slate-700 border-r border-slate-200">
                                {tx.date}
                              </td>
                              <td className="py-1.5 px-3 font-mono font-bold text-[#284742] border-r border-slate-200">
                                {tx.clientCode}
                              </td>
                              <td className="py-1.5 px-3 font-semibold text-slate-900 border-r border-slate-200" dir="auto">
                                {tx.clientName}
                              </td>
                              <td className="py-1.5 px-3 font-mono text-slate-600 border-r border-slate-200">
                                {tx.refNo}
                              </td>
                              <td className="py-1.5 px-3 text-slate-700 border-r border-slate-200" dir="auto">
                                {tx.description}
                              </td>
                              <td className="py-1.5 px-3 text-center border-r border-slate-200">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isInflow
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {isInflow ? 'Inflow' : 'Outflow'}
                                </span>
                              </td>
                              <td
                                className={`py-1.5 px-3 text-right font-mono font-bold border-r border-slate-200 ${
                                  isInflow ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {isInflow ? '+' : '-'}{tx.amount.toLocaleString()}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-extrabold text-slate-900">
                                {tx.balance.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#e6f0ee] font-extrabold border-t-2 border-[#284742]">
                      <td colSpan={6} className="py-2.5 px-3 text-[#284742]">
                        Total ({pdfPayload.groups.reduce((s, g) => s + g.transactions.length, 0)} Transactions)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 border-r border-slate-300">
                        {pdfPayload.totalIn - pdfPayload.totalOut >= 0 ? '+' : ''}
                        {(pdfPayload.totalIn - pdfPayload.totalOut).toLocaleString()} {sheetConfig.currency}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#284742]">
                        {pdfPayload.closingBalance.toLocaleString()} {sheetConfig.currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
