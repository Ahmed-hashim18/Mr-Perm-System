/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TreasuryProvider, useTreasury } from './context/TreasuryContext';
import { Navbar } from './components/Navbar';
import { NewTransactionForm } from './components/NewTransactionForm';
import { SubmittedTransactionsView } from './components/SubmittedTransactionsView';
import { MakeAnOrderView } from './components/MakeAnOrderView';
import { ClientsView } from './components/ClientsView';
import { AppsScriptModal } from './components/AppsScriptModal';

const TreasuryContent: React.FC = () => {
  const { currentTab, sheetConfig, isOnline, offlineQueueCount } = useTreasury();

  return (
    <div className="min-h-screen bg-[#f3f4f6]/70 text-slate-900 flex flex-col font-sans antialiased overflow-x-hidden">
      {/* Top Header / Desktop Navigation */}
      <Navbar />

      {/* Main Content Area (extra bottom padding on phone so fixed bottom nav never covers content) */}
      <main className="flex-1 pb-24 md:pb-16 min-w-0">
        {currentTab === 'new-entry' && <NewTransactionForm />}
        {currentTab === 'view-data' && <SubmittedTransactionsView />}
        {(currentTab === 'make-order' || currentTab === 'sales') && <MakeAnOrderView />}
        {currentTab === 'clients' && <ClientsView />}
      </main>

      {/* Settings Modal */}
      <AppsScriptModal />

      {/* Subtle Offline Connectivity Indicator */}
      {!isOnline && (
        <div className="fixed bottom-20 md:bottom-4 left-4 z-30 flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
          <span>
            Offline Mode{offlineQueueCount > 0 ? ` · ${offlineQueueCount} queued` : ''}
          </span>
        </div>
      )}

      {/* Clean Minimal Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white/70 pt-4 pb-24 md:pb-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Cash Flow & Treasury</span>
            <span className="text-slate-300">•</span>
            <span>Currency: <strong>{sheetConfig.currency}</strong></span>
          </div>
          
          <div className="text-slate-400">
            Automated Cash Flow Sheet System
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <TreasuryProvider>
      <TreasuryContent />
    </TreasuryProvider>
  );
}
