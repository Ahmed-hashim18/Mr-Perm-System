import React from 'react';
import { PlusCircle, ListFilter, ShoppingBag, Wallet, Users } from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';

export const Navbar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    currentBalance,
    sheetConfig,
  } = useTreasury();

  return (
    <header className="w-full max-w-6xl mx-auto pt-3 md:pt-6 pb-3 md:pb-4 px-3 sm:px-6">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 md:gap-4">
        {/* Navigation Tabs: grid-cols-4 with icon above short label on phone, inline on md+ */}
        <div className="grid grid-cols-4 md:inline-flex items-center gap-1 md:gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-xs w-full md:w-auto">
          <button
            type="button"
            onClick={() => setCurrentTab('new-entry')}
            className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-1.5 md:px-4 py-2 md:py-2.5 min-h-[48px] md:min-h-[40px] rounded-xl text-[11px] leading-tight md:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentTab === 'new-entry'
                ? 'bg-[#284742] text-white shadow-sm'
                : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full">New Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('view-data')}
            className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-1.5 md:px-4 py-2 md:py-2.5 min-h-[48px] md:min-h-[40px] rounded-xl text-[11px] leading-tight md:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentTab === 'view-data'
                ? 'bg-[#284742] text-white shadow-sm'
                : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ListFilter className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full">View Data</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('make-order')}
            className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-1.5 md:px-4 py-2 md:py-2.5 min-h-[48px] md:min-h-[40px] rounded-xl text-[11px] leading-tight md:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentTab === 'make-order' || currentTab === 'sales'
                ? 'bg-[#284742] text-white shadow-sm'
                : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="md:hidden truncate max-w-full">Order</span>
            <span className="hidden md:inline">Make An Order</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('clients')}
            className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-1.5 md:px-4 py-2 md:py-2.5 min-h-[48px] md:min-h-[40px] rounded-xl text-[11px] leading-tight md:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              currentTab === 'clients'
                ? 'bg-[#284742] text-white shadow-sm'
                : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full">Clients</span>
          </button>
        </div>

        {/* Balance Display: full width under tabs on phone, right side on desktop */}
        <div className="flex items-center w-full md:w-auto">
          <div className="flex items-center justify-between md:justify-start gap-2.5 px-4 py-2.5 md:py-2 bg-white border border-slate-200/90 rounded-2xl shadow-xs w-full md:w-auto min-h-[44px]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-[#284742]/10 text-[#284742] rounded-xl shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 md:hidden">
                Current Balance
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="hidden md:block text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Current Balance
              </span>
              <span className="text-sm sm:text-base font-extrabold text-[#284742] leading-none">
                {currentBalance.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-500">{sheetConfig.currency}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
