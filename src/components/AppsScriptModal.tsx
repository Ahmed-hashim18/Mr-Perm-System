import React, { useState } from 'react';
import {
  X,
  Code2,
  Copy,
  Check,
  FileSpreadsheet,
  Link2,
  ExternalLink,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import { GOOGLE_APPS_SCRIPT_CODE, testAppsScriptConnection } from '../services/appsScriptService';

export const AppsScriptModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    sheetConfig,
    updateSheetConfig,
    syncWithGoogleSheet,
    pushAllClientBalances,
  } = useTreasury();

  const [urlInput, setUrlInput] = useState(sheetConfig.appsScriptUrl);
  const [openingBalInput, setOpeningBalInput] = useState(sheetConfig.initialOpeningBalance.toString());
  const [currencyInput, setCurrencyInput] = useState(sheetConfig.currency);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'setup' | 'code' | 'structure'>('setup');

  if (!isSettingsOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setHasCopiedCode(true);
      setTimeout(() => setHasCopiedCode(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestAndSave = async () => {
    setIsTesting(true);
    setTestResult(null);

    const trimmedUrl = urlInput.trim();
    const parsedBal = parseFloat(openingBalInput) || 0;

    updateSheetConfig({
      appsScriptUrl: trimmedUrl,
      initialOpeningBalance: parsedBal,
      currency: currencyInput.trim() || 'MRU',
    });

    if (!trimmedUrl) {
      setTestResult({
        success: true,
        message: 'Settings saved in Local Storage Ledger mode.',
      });
      setIsTesting(false);
      return;
    }

    const res = await testAppsScriptConnection(trimmedUrl);
    setTestResult(res);
    setIsTesting(false);

    if (res.success) {
      updateSheetConfig({ isConnected: true });
      await syncWithGoogleSheet();
    } else {
      updateSheetConfig({ isConnected: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#284742] text-white rounded-2xl shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-lg">
                Google Sheets & Apps Script Sync
              </h2>
              <p className="text-xs text-slate-500">
                Connect your Cash Flow spreadsheet to submit and view live data
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation within modal */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6">
          <button
            onClick={() => setActiveTab('setup')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'setup'
                ? 'border-[#284742] text-[#284742]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. Setup Guide & Webhook URL
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'code'
                ? 'border-[#284742] text-[#284742]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Google Apps Script Code
          </button>
          <button
            onClick={() => setActiveTab('structure')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'structure'
                ? 'border-[#284742] text-[#284742]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3. Sheet Columns Structure
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[72vh] overflow-y-auto space-y-6">
          {activeTab === 'setup' && (
            <div className="space-y-6">
              {/* How it works banner */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 leading-relaxed">
                  <strong>Direct Google Sheet Integration via Apps Script:</strong> When connected, every transaction you submit in the form is instantly appended to your Google Sheet as a new row with date, account, ref, debit/credit, and updated balance.
                </div>
              </div>

              {/* Step by step checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Quick Setup in 4 Steps
                </h4>

                <div className="space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="w-5 h-5 rounded-full bg-[#284742] text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Open your Google Sheet
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        In the top menu, go to <strong>Extensions</strong> → <strong>Apps Script</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="w-5 h-5 rounded-full bg-[#284742] text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Paste the Script Code
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Copy the code from the <strong>"Google Apps Script Code"</strong> tab, paste it into the editor, and click <strong>Save</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="w-5 h-5 rounded-full bg-[#284742] text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                      3
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Deploy / Update as Web App
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        When updating code: Click <strong>Deploy</strong> → <strong>Manage deployments</strong> → click <strong>Edit (pencil icon)</strong> → set <em>Version</em> to <strong>New version</strong> → click <strong>Deploy</strong>.<br />
                        <span className="text-[11px] text-amber-700 font-semibold">Important: Selecting "New version" is required by Google for script code updates to take effect.</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                    <span className="w-5 h-5 rounded-full bg-[#284742] text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                      4
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">
                        Paste the Web App URL below
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        Copy the generated URL (starts with <code>https://script.google.com/macros/s/...</code>) and paste it below.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Web App URL Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Google Apps Script Web App URL
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20 focus:border-[#284742]"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Leave blank to use the built-in browser local storage ledger.
                </p>
              </div>

              {/* General Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Initial Opening Balance
                  </label>
                  <input
                    type="number"
                    value={openingBalInput}
                    onChange={e => setOpeningBalInput(e.target.value)}
                    placeholder="5585"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20 focus:border-[#284742]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Matching initial balance from your sheet ({openingBalInput} {currencyInput})
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={currencyInput}
                    onChange={e => setCurrencyInput(e.target.value)}
                    placeholder="MRU"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#284742]/20 focus:border-[#284742]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    MRU (Mauritanian Ouguiya)
                  </p>
                </div>
              </div>

              {/* Push client balances to sheet button */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Sync Client Remining amount to Sheet</span>
                  </h4>
                  <p className="text-[11px] text-emerald-800/80 mt-0.5">
                    Updates the <strong>Remining amount</strong> column in your Google Sheet (Client tab) for all clients with their current debt.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={async () => {
                    setIsTesting(true);
                    const res = await pushAllClientBalances();
                    setTestResult(res);
                    setIsTesting(false);
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Push Client Balances Now
                </button>
              </div>

              {/* Test Connection Results */}
              {testResult && (
                <div
                  className={`p-4 rounded-2xl text-xs border flex items-start gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.success ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">{testResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Apps Script Code Snippet
                  </h4>
                  <p className="text-xs text-slate-500">
                    Paste this into your Google Sheet's Apps Script editor
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#284742] hover:bg-[#1e3632] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  {hasCopiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Full Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                  <code>{GOOGLE_APPS_SCRIPT_CODE}</code>
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'structure' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Google Sheet Tabs & Columns Structure
                </h4>
                <p className="text-xs text-slate-500">
                  Your Google Spreadsheet is synchronized across three sheets:
                </p>
              </div>

              {/* 1. Cashflow Sheet */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-[#284742] text-white text-[11px] font-bold rounded-md">
                    Sheet 1: Cashflow
                  </span>
                  <span className="text-xs text-slate-500">
                    Logs all inflow & outflow cash transactions and down payments
                  </span>
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#284742] text-white font-bold">
                      <tr>
                        <th className="py-2 px-3">Col</th>
                        <th className="py-2 px-3">Header</th>
                        <th className="py-2 px-3">Example</th>
                        <th className="py-2 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">A</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Timestamp</td>
                        <td className="py-1.5 px-3 text-slate-600">2026-11-11 12:30:15</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Exact date and time stamp</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">B</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Date</td>
                        <td className="py-1.5 px-3 text-slate-600">2026-11-11</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Transaction date</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">C</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Client Code</td>
                        <td className="py-1.5 px-3 text-slate-600">C04</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">e.g. C01 to C34</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">D</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Client Name</td>
                        <td className="py-1.5 px-3 text-slate-600" dir="auto">الاماسي</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Client name</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">E</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Ref No.</td>
                        <td className="py-1.5 px-3 text-slate-600">D2401 / C8201</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Reference identifier</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">F</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Description</td>
                        <td className="py-1.5 px-3 text-slate-600 font-sans" dir="auto">سداد دفعة طلب</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Transaction details</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">G</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Type</td>
                        <td className="py-1.5 px-3 text-emerald-700 font-bold">in / out</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">"in" (Inflow) or "out" (Outflow)</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">H</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Amount</td>
                        <td className="py-1.5 px-3 text-slate-900 font-bold">5000000</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Amount in SDG</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Order Log Sheet */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-blue-700 text-white text-[11px] font-bold rounded-md">
                    Sheet 2: Order Log
                  </span>
                  <span className="text-xs text-slate-500">
                    Automatically records every order submitted from &quot;Make An Order&quot;
                  </span>
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-blue-800 text-white font-bold">
                      <tr>
                        <th className="py-2 px-3">Col</th>
                        <th className="py-2 px-3">Header</th>
                        <th className="py-2 px-3">Example</th>
                        <th className="py-2 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">A</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Timestamp</td>
                        <td className="py-1.5 px-3 text-slate-600">2026-11-11 14:10:00</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Exact time of submission</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">B</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Date</td>
                        <td className="py-1.5 px-3 text-slate-600">2026-11-11</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Order invoice date</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">C</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Client Code</td>
                        <td className="py-1.5 px-3 text-slate-600">C26</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">e.g. C26</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">D</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Client Name</td>
                        <td className="py-1.5 px-3 text-slate-600" dir="auto">ميديكال بلص</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Client company name</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">E</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Invoice No.</td>
                        <td className="py-1.5 px-3 text-slate-600">INV-1002</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Invoice number</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">F</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Description</td>
                        <td className="py-1.5 px-3 text-slate-600 font-sans" dir="auto">طلب بضاعة</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Order details</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">G</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Amount</td>
                        <td className="py-1.5 px-3 text-slate-900 font-bold">10000000</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Total order amount</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">H</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Payment Option</td>
                        <td className="py-1.5 px-3 text-slate-700">Partial Payment</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Full / Partial / Installments</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">I</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Down Payment</td>
                        <td className="py-1.5 px-3 text-emerald-700 font-bold">3000000</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Paid amount (logged to Cashflow)</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">J</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Unpaid Amount</td>
                        <td className="py-1.5 px-3 text-rose-700 font-bold">7000000</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Added to Client Remining amount</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">K</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Cashflow Ref</td>
                        <td className="py-1.5 px-3 text-slate-600">D2405</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Cashflow entry ref number</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Client Sheet */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-emerald-700 text-white text-[11px] font-bold rounded-md">
                    Sheet 3: Client / Clients
                  </span>
                  <span className="text-xs text-slate-500">
                    Contains clients directory &amp; automatically updates <strong>Remining amount</strong> and <strong>Date</strong>
                  </span>
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-emerald-800 text-white font-bold">
                      <tr>
                        <th className="py-2 px-3">Col</th>
                        <th className="py-2 px-3">Header</th>
                        <th className="py-2 px-3">Example</th>
                        <th className="py-2 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">A</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Client Code</td>
                        <td className="py-1.5 px-3 text-slate-600">C04</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Unique client identifier</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">B</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Client Name</td>
                        <td className="py-1.5 px-3 text-slate-600" dir="auto">الاماسي</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Client / Company name</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">C</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Phone Number</td>
                        <td className="py-1.5 px-3 text-slate-600">0912345678</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Contact phone</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">D</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Area</td>
                        <td className="py-1.5 px-3 text-slate-600" dir="auto">الخرطوم</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">City / District</td>
                      </tr>
                      <tr className="bg-emerald-50">
                        <td className="py-1.5 px-3 font-bold text-emerald-800">E</td>
                        <td className="py-1.5 px-3 font-bold text-emerald-900">Remining amount</td>
                        <td className="py-1.5 px-3 text-rose-700 font-bold">78479942</td>
                        <td className="py-1.5 px-3 font-sans text-emerald-950 font-semibold">
                          Auto-updates on Orders (+unpaid) and Payments (-cashflow in)
                        </td>
                      </tr>
                      <tr className="bg-white">
                        <td className="py-1.5 px-3 font-bold text-slate-500">F</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Date</td>
                        <td className="py-1.5 px-3 text-slate-600">2026-11-11</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Last updated date of client debt</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-1.5 px-3 font-bold text-slate-500">G</td>
                        <td className="py-1.5 px-3 font-bold text-slate-800">Email</td>
                        <td className="py-1.5 px-3 text-slate-600">client@example.com</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600">Email address</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleTestAndSave}
            disabled={isTesting}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#284742] hover:bg-[#1e3632] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            {isTesting ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Testing Connection...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Save & Test Connection</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
