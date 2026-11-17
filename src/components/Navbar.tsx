import React from 'react';
import { PlusCircle, ListFilter, ShoppingBag, Wallet, Users } from 'lucide-react';
import { useTreasury } from '../context/TreasuryContext';
import { TabType } from '../types/treasury';
import { PWAInstallButton } from './PWAInstallButton';

export const Navbar: React.FC = () => {
  const {
    currentTab,
    setCurrentTab,
    currentBalance,
    sheetConfig,
  } = useTreasury();

  const handleSelectTab = (tab: TabType) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navItems: { id: TabType; label: string; mobileLabel: string; icon: React.ReactNode; active: boolean }[] = [
    {
      id: 'new-entry',
      label: 'New Entry',
      mobileLabel: 'New Entry',
      icon: <PlusCircle className="w-5 h-5 md:w-4 md:h-4 shrink-0" />,
      active: currentTab === 'new-entry',
    },
    {
      id: 'view-data',
      label: 'View Data',
      mobileLabel: 'View Data',
      icon: <ListFilter className="w-5 h-5 md:w-4 md:h-4 shrink-0" />,
      active: currentTab === 'view-data',
    },
    {
      id: 'make-order',
      label: 'Make An Order',
      mobileLabel: 'Order',
      icon: <ShoppingBag className="w-5 h-5 md:w-4 md:h-4 shrink-0" />,
      active: currentTab === 'make-order' || currentTab === 'sales',
    },
    {
      id: 'clients',
      label: 'Clients',
      mobileLabel: 'Clients',
      icon: <Users className="w-5 h-5 md:w-4 md:h-4 shrink-0" />,
      active: currentTab === 'clients',
    },
  ];

  return (
    <>
      {/* Top Header Bar: Current Balance & Install App on phone; Full Navigation + Balance on md+ */}
      <header className="w-full max-w-6xl mx-auto pt-3 md:pt-6 pb-2 md:pb-4 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2.5 md:gap-4">
          {/* Desktop Navigation Tabs (>= 768px) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:inline-flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-xs"
          >
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                  item.active
                    ? 'bg-[#284742] text-white shadow-sm'
                    : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right / Mobile Top Balance + Install Action */}
          <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
            {/* Compact Balance Bar (full width on phone, pill on desktop) */}
            <div className="flex-1 md:flex-none flex items-center justify-between md:justify-start gap-2.5 px-3.5 sm:px-4 py-2 bg-white border border-slate-200/90 rounded-2xl shadow-xs min-h-[46px] min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/favicon.png"
                  alt="Bairum Group"
                  className="w-7 h-7 rounded-lg border border-slate-200/80 object-cover md:hidden shrink-0"
                />
                <div className="hidden md:flex p-1.5 bg-[#284742]/10 text-[#284742] rounded-xl shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 md:hidden truncate">
                  Current Balance
                </span>
              </div>
              <div className="flex flex-col text-right shrink-0">
                <span className="hidden md:block text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Current Balance
                </span>
                <span className="text-sm sm:text-base font-extrabold text-[#284742] leading-none tabular-nums">
                  {currentBalance.toLocaleString()}{' '}
                  <span className="text-xs font-bold text-slate-500">{sheetConfig.currency}</span>
                </span>
              </div>
            </div>

            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Fixed Phone-Only Bottom Tab Bar (< 768px) — WhatsApp / Instagram thumb navigation */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 h-16 px-1.5 gap-1 items-center">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              aria-current={item.active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 min-h-[48px] rounded-xl text-[11px] leading-tight transition-colors duration-150 cursor-pointer ${
                item.active
                  ? 'text-[#284742] font-bold bg-[#284742]/10'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              {item.active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 bg-[#284742] rounded-b-full"
                />
              )}
              {item.icon}
              <span className="truncate max-w-full whitespace-nowrap">{item.mobileLabel}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};
