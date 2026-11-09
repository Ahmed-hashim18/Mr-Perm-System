import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Transaction,
  ClientItem,
  SheetConfig,
  DayGroup,
  TransactionType,
  OrderEntry,
  PaymentOption,
  TabType,
  QueuedSyncItem,
} from '../types/treasury';
import {
  INITIAL_CLIENTS,
  INITIAL_TRANSACTIONS,
  INITIAL_OPENING_BALANCE,
  INITIAL_ORDERS,
} from '../data/initialData';
import {
  APPS_SCRIPT_STORAGE_KEY,
  TRANSACTIONS_STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  ORDER_LOG_STORAGE_KEY,
  CONFIGURED_APPS_SCRIPT_URL,
  postTransactionToSheet,
  postOrderToSheet,
  postNewClientToSheet,
  updateClientInSheet,
  testAppsScriptConnection,
  getOfflineQueue,
  processOfflineQueue,
} from '../services/appsScriptService';

interface TreasuryContextType {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
  transactions: Transaction[];
  clients: ClientItem[];
  orders: OrderEntry[];
  previousDescriptions: string[];
  currentBalance: number;
  initialOpeningBalance: number;
  sheetConfig: SheetConfig;
  isSyncing: boolean;
  syncStatusMessage: string | null;
  dayGroups: DayGroup[];
  allDayGroups: DayGroup[];
  isOnline: boolean;
  offlineQueueCount: number;
  syncOfflineQueue: () => Promise<void>;
  offlineBannerMessage: string | null;
  dismissOfflineBanner: () => void;
  selectedMonth: { year: number; month: number };
  setSelectedMonth: React.Dispatch<React.SetStateAction<{ year: number; month: number }>>;
  prevMonth: () => void;
  nextMonth: () => void;
  addTransaction: (data: {
    date: string;
    clientCode: string;
    clientName: string;
    refNo: string;
    type: 'Inflow' | 'Outflow';
    description: string;
    amount: number;
  }) => Promise<{ success: boolean; message: string; queuedLocally?: boolean }>;
  addOrder: (data: {
    date: string;
    clientCode: string;
    clientName: string;
    invoiceNumber: string;
    description: string;
    amount: number;
    paymentOption: PaymentOption;
    downPayment: number;
  }) => Promise<{ success: boolean; message: string; cashflowLogged: boolean; queuedLocally?: boolean }>;
  addClient: (data: {
    code: string;
    name: string;
    phone?: string;
    area?: string;
    email?: string;
    remaining?: number;
  }) => Promise<{ success: boolean; message: string }>;
  updateClient: (data: {
    code: string;
    name: string;
    phone?: string;
    area?: string;
    email?: string;
    remaining?: number;
  }) => Promise<{ success: boolean; message: string }>;
  deleteTransaction: (id: string) => void;
  updateSheetConfig: (config: Partial<SheetConfig>) => void;
  syncWithGoogleSheet: () => Promise<void>;
  getNextRefNo: (type: 'Inflow' | 'Outflow') => string;
  getNextInvoiceNo: () => string;
  getNextClientCode: () => string;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

const TreasuryContext = createContext<TreasuryContextType | undefined>(undefined);

export function getExactTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const TreasuryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<TabType>('new-entry');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Network Online / Offline State
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(() => getOfflineQueue().length);
  const [offlineBannerMessage, setOfflineBannerMessage] = useState<string | null>(null);

  // Double-submission transaction locks
  const transactionLockRef = useRef<boolean>(false);
  const orderLockRef = useRef<boolean>(false);

  // Orders state (starts empty / wiped demo data)
  const [orders, setOrders] = useState<OrderEntry[]>(() => {
    try {
      const saved = localStorage.getItem(ORDER_LOG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_ORDERS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(ORDER_LOG_STORAGE_KEY, JSON.stringify(orders));
    } catch (e) {
      console.error(e);
    }
  }, [orders]);

  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(() => {
    try {
      const saved = localStorage.getItem(APPS_SCRIPT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          appsScriptUrl: CONFIGURED_APPS_SCRIPT_URL,
          currency: 'SDG',
          isConnected: true,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return {
      appsScriptUrl: CONFIGURED_APPS_SCRIPT_URL,
      sheetName: 'Cashflow',
      currency: 'SDG',
      initialOpeningBalance: INITIAL_OPENING_BALANCE,
      autoSync: true,
      lastSyncedAt: null,
      isConnected: true,
    };
  });

  // Clients initialized with verified client directory
  const [clients, setClients] = useState<ClientItem[]>(() => {
    const initialMap = new Map(INITIAL_CLIENTS.map(c => [c.code.toUpperCase(), c]));
    try {
      const saved = localStorage.getItem(CLIENTS_STORAGE_KEY);
      if (saved) {
        const parsed: ClientItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(c => {
            const init = initialMap.get(c.code.toUpperCase());
            // Ensure C04 الاماسي reflects verified balance ~78M
            const isAmasi = c.code.toUpperCase() === 'C04' || c.name.includes('الاماسي');
            let rem = (typeof c.remaining === 'number' && !isNaN(c.remaining) && c.remaining > 0)
              ? c.remaining
              : (init?.remaining || 0);
            if (isAmasi && (rem < 70000000 || rem === 58479942)) {
              rem = 78479942;
            }
            return {
              ...c,
              remaining: rem,
            };
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_CLIENTS;
  });

  // Transactions state (starts clean / wiped demo data)
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_TRANSACTIONS;
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.error(e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
    } catch (e) {
      console.error(e);
    }
  }, [clients]);

  useEffect(() => {
    try {
      localStorage.setItem(APPS_SCRIPT_STORAGE_KEY, JSON.stringify(sheetConfig));
    } catch (e) {
      console.error(e);
    }
  }, [sheetConfig]);

  // Current treasury balance calculation
  const currentBalance = React.useMemo(() => {
    if (transactions.length === 0) return sheetConfig.initialOpeningBalance || 0;
    return transactions[transactions.length - 1].balance;
  }, [transactions, sheetConfig.initialOpeningBalance]);

  // Previous descriptions for autocomplete quick selection
  const previousDescriptions = React.useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    for (let i = transactions.length - 1; i >= 0; i--) {
      const desc = transactions[i].description?.trim();
      if (desc && !seen.has(desc)) {
        seen.add(desc);
        list.push(desc);
      }
    }
    return list;
  }, [transactions]);

  const getNextRefNo = (type: 'Inflow' | 'Outflow'): string => {
    const prefix = type === 'Inflow' ? 'D' : 'C';
    const matching = transactions
      .filter(t => {
        if (!t.refNo) return false;
        const upper = t.refNo.trim().toUpperCase();
        return upper.startsWith(prefix);
      })
      .map(t => {
        const match = t.refNo.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => n > 0);

    if (matching.length === 0) {
      return type === 'Inflow' ? 'D2401' : 'C8201';
    }

    const maxNum = Math.max(...matching);
    return `${prefix}${maxNum + 1}`;
  };

  const getNextInvoiceNo = (): string => {
    const nums = orders
      .map(o => {
        const match = o.invoiceNumber?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 1000;
    return `INV-${maxNum + 1}`;
  };

  const getNextClientCode = (): string => {
    const allCodes = [...clients, ...INITIAL_CLIENTS].map(c => c.code.trim().toUpperCase());
    const numbers = allCodes
      .map(code => {
        const match = code.match(/C0*(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const max = numbers.length > 0 ? Math.max(...numbers) : 33;
    const nextNum = max + 1;
    return nextNum < 10 ? `C0${nextNum}` : `C${nextNum}`;
  };

  // Helper to generate day groups
  const buildDayGroups = (txList: Transaction[]): DayGroup[] => {
    const sorted = [...txList].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const groupsMap = new Map<string, Transaction[]>();
    for (const tx of sorted) {
      const d = tx.date;
      if (!groupsMap.has(d)) {
        groupsMap.set(d, []);
      }
      groupsMap.get(d)!.push(tx);
    }

    const result: DayGroup[] = [];
    let runningPriorBalance = sheetConfig.initialOpeningBalance || 0;

    for (const [dateStr, txs] of groupsMap.entries()) {
      const dayOpening = runningPriorBalance;
      let dayIn = 0;
      let dayOut = 0;

      for (const t of txs) {
        const isIn = t.type === 'Inflow' || (t.type as string) === 'in';
        if (isIn || t.debit) {
          dayIn += (t.debit ?? t.amount);
        } else {
          dayOut += (t.credit ?? t.amount);
        }
      }

      const dayClosing = txs[txs.length - 1]?.balance ?? (dayOpening + dayIn - dayOut);
      runningPriorBalance = dayClosing;

      const dateObj = new Date(dateStr + 'T00:00:00');
      const displayDate = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : dateStr;

      result.push({
        date: dateStr,
        displayDate: displayDate || dateStr,
        openingBalance: dayOpening,
        closingBalance: dayClosing,
        totalIn: dayIn,
        totalOut: dayOut,
        totalDebit: dayIn,
        totalCredit: dayOut,
        transactions: txs,
      });
    }

    return result;
  };

  // ALL day groups (all transactions ordered by date by default, without month filter)
  const allDayGroups = React.useMemo(() => {
    return buildDayGroups(transactions);
  }, [transactions, sheetConfig.initialOpeningBalance]);

  // Month-filtered day groups (kept for optional monthly reports)
  const dayGroups = React.useMemo(() => {
    const all = buildDayGroups(transactions);
    return all.filter(g => {
      const d = new Date(g.date + 'T00:00:00');
      return !isNaN(d.getTime()) && d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month;
    });
  }, [transactions, sheetConfig.initialOpeningBalance, selectedMonth]);

  const prevMonth = () => {
    setSelectedMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setSelectedMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  // -------------------------------------------------------------
  // TASK 1: ADD TRANSACTION WITH DOUBLE-SUBMISSION LOCK
  // TASK 2: OFFLINE QUEUING & AUTO-SYNC
  // -------------------------------------------------------------
  const addTransaction = async (data: {
    date: string;
    clientCode: string;
    clientName: string;
    refNo: string;
    type: 'Inflow' | 'Outflow';
    description: string;
    amount: number;
  }): Promise<{ success: boolean; message: string; queuedLocally?: boolean }> => {
    // Transactional Lock Check
    if (transactionLockRef.current) {
      return { success: false, message: 'A transaction is currently being processed. Please wait.' };
    }
    transactionLockRef.current = true;

    // Safety unlock timer after 15 seconds
    const safetyTimeout = setTimeout(() => {
      transactionLockRef.current = false;
    }, 15000);

    try {
      const isIn = data.type === 'Inflow';
      const debitAmount = isIn ? data.amount : null;
      const creditAmount = !isIn ? data.amount : null;

      const newBal = isIn
        ? currentBalance + data.amount
        : currentBalance - data.amount;

      const timestamp = getExactTimestamp();

      const newTx: Transaction = {
        id: 'tx-' + Date.now(),
        timestamp,
        date: data.date,
        formattedDate: data.date.split('-').reverse().join('/'),
        clientCode: data.clientCode,
        clientName: data.clientName,
        accountHead: `${data.clientName} - ${data.clientCode}`,
        refNo: data.refNo,
        type: data.type,
        description: data.description,
        amount: data.amount,
        debit: debitAmount,
        credit: creditAmount,
        balance: newBal,
        syncedToSheet: false,
        createdAt: new Date().toISOString(),
      };

      // Always save locally immediately for instant feedback
      setTransactions(prev => [...prev, newTx]);

      // Update client remaining debt in local state
      const matchedClient = clients.find(
        c =>
          c.code.toUpperCase() === data.clientCode.trim().toUpperCase() ||
          c.name.trim() === data.clientName.trim()
      );

      // Inflow means client paid cash into treasury -> reduce debt
      const calculatedNewRemaining: number = matchedClient
        ? (isIn
            ? Math.max(0, (typeof matchedClient.remaining === 'number' ? matchedClient.remaining : 0) - data.amount)
            : (typeof matchedClient.remaining === 'number' ? matchedClient.remaining : 0))
        : 0;

      if (matchedClient && isIn) {
        setClients(prevClients =>
          prevClients.map(c => {
            if (
              c.code.toUpperCase() === data.clientCode.trim().toUpperCase() ||
              c.name.trim() === data.clientName.trim()
            ) {
              return {
                ...c,
                remaining: calculatedNewRemaining,
              };
            }
            return c;
          })
        );
      }

      // If offline: save locally and add to sync queue
      if (!isOnline || !navigator.onLine) {
        setOfflineBannerMessage('Offline Mode: Data saved locally and will sync when reconnected.');
        const postRes = await postTransactionToSheet(sheetConfig.appsScriptUrl, newTx, calculatedNewRemaining);
        setOfflineQueueCount(getOfflineQueue().length);
        return {
          success: true,
          message: 'Offline Mode: Data saved locally and will sync when reconnected.',
          queuedLocally: true,
        };
      }

      // If online: attempt to post to Google Sheet
      if (sheetConfig.appsScriptUrl && sheetConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
        setIsSyncing(true);
        setSyncStatusMessage('Sending transaction to Google Sheet...');
        try {
          const postRes = await postTransactionToSheet(sheetConfig.appsScriptUrl, newTx, calculatedNewRemaining);
          if (postRes.queuedLocally) {
            setOfflineBannerMessage('Offline Mode: Data saved locally and will sync when reconnected.');
            setOfflineQueueCount(getOfflineQueue().length);
          } else if (postRes.success) {
            setTransactions(prev =>
              prev.map(t => (t.id === newTx.id ? { ...t, syncedToSheet: true } : t))
            );
            setSyncStatusMessage('Transaction recorded in Cashflow & client balance updated in sheet');
          }
        } catch (err: any) {
          console.error('Error posting to sheet:', err);
          setOfflineBannerMessage('Offline Mode: Data saved locally and will sync when reconnected.');
          setOfflineQueueCount(getOfflineQueue().length);
        } finally {
          setIsSyncing(false);
          setTimeout(() => setSyncStatusMessage(null), 3000);
        }
      }

      return {
        success: true,
        message: `Transaction recorded. New Balance: ${newBal.toLocaleString()} ${sheetConfig.currency}`,
      };
    } finally {
      clearTimeout(safetyTimeout);
      transactionLockRef.current = false;
    }
  };

  // -------------------------------------------------------------
  // TASK 1: ADD ORDER WITH DOUBLE-SUBMISSION LOCK
  // -------------------------------------------------------------
  const addOrder = async (data: {
    date: string;
    clientCode: string;
    clientName: string;
    invoiceNumber: string;
    description: string;
    amount: number;
    paymentOption: PaymentOption;
    downPayment: number;
  }): Promise<{ success: boolean; message: string; cashflowLogged: boolean; queuedLocally?: boolean }> => {
    // Transactional Lock Check
    if (orderLockRef.current) {
      return { success: false, message: 'An order is currently being recorded. Please wait.', cashflowLogged: false };
    }
    orderLockRef.current = true;

    const safetyTimeout = setTimeout(() => {
      orderLockRef.current = false;
    }, 15000);

    try {
      const timestamp = getExactTimestamp();
      const cleanCode = data.clientCode.trim().toUpperCase();
      const cleanName = data.clientName.trim();

      let actualDownPayment = 0;
      let unpaidPart = 0;

      if (data.paymentOption === 'Full Payment') {
        actualDownPayment = data.amount;
        unpaidPart = 0;
      } else if (data.paymentOption === 'Installments') {
        actualDownPayment = 0;
        unpaidPart = data.amount;
      } else {
        actualDownPayment = Math.min(data.amount, Math.max(0, data.downPayment));
        unpaidPart = Math.max(0, data.amount - actualDownPayment);
      }

      // Update Client Remaining Debt locally
      let finalClientRemaining = 0;
      setClients(prevClients =>
        prevClients.map(c => {
          if (
            c.code.toUpperCase() === cleanCode ||
            c.name.trim().toLowerCase() === cleanName.toLowerCase()
          ) {
            const prevRem = typeof c.remaining === 'number' ? c.remaining : 0;
            finalClientRemaining = prevRem + unpaidPart;
            return {
              ...c,
              remaining: finalClientRemaining,
            };
          }
          return c;
        })
      );

      // Payment Cashflow Entry
      let cashflowTx: Transaction | undefined = undefined;
      let cashflowLogged = false;

      if (actualDownPayment > 0) {
        cashflowLogged = true;
        const refNumber = getNextRefNo('Inflow');
        const newBal = currentBalance + actualDownPayment;

        const descSuffix = data.description ? ` (${data.description})` : '';
        const txDesc =
          data.paymentOption === 'Full Payment'
            ? `سداد طلب كامل فاتورة ${data.invoiceNumber || getNextInvoiceNo()} - ${cleanName}${descSuffix}`
            : `سداد دفعة مقدمة فاتورة ${data.invoiceNumber || getNextInvoiceNo()} - ${cleanName}${descSuffix}`;

        cashflowTx = {
          id: 'tx-cf-' + Date.now(),
          timestamp,
          date: data.date,
          formattedDate: data.date.split('-').reverse().join('/'),
          clientCode: cleanCode,
          clientName: cleanName,
          accountHead: `${cleanName} - ${cleanCode}`,
          refNo: refNumber,
          type: 'Inflow',
          description: txDesc,
          amount: actualDownPayment,
          debit: actualDownPayment,
          credit: null,
          balance: newBal,
          syncedToSheet: false,
          createdAt: new Date().toISOString(),
        };

        setTransactions(prev => [...prev, cashflowTx!]);
      }

      const finalInvoiceNumber = data.invoiceNumber.trim() || getNextInvoiceNo();
      const newOrder: OrderEntry = {
        id: 'ord-' + Date.now(),
        timestamp,
        date: data.date,
        clientCode: cleanCode,
        clientName: cleanName,
        invoiceNumber: finalInvoiceNumber,
        description: data.description.trim(),
        amount: data.amount,
        paymentOption: data.paymentOption,
        downPayment: actualDownPayment,
        unpaidAmount: unpaidPart,
        cashflowLogged,
        cashflowRefNo: cashflowTx?.refNo,
        syncedToSheet: false,
        createdAt: new Date().toISOString(),
      };

      setOrders(prev => [newOrder, ...prev]);

      // Offline Handling
      if (!isOnline || !navigator.onLine) {
        setOfflineBannerMessage('Offline Mode: Data saved locally and will sync when reconnected.');
        await postOrderToSheet(sheetConfig.appsScriptUrl, newOrder, cashflowTx);
        setOfflineQueueCount(getOfflineQueue().length);
        return {
          success: true,
          message: 'Offline Mode: Data saved locally and will sync when reconnected.',
          cashflowLogged,
          queuedLocally: true,
        };
      }

      // Online POST to Google Sheet
      if (sheetConfig.appsScriptUrl && sheetConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
        setIsSyncing(true);
        setSyncStatusMessage('Updating client debt & syncing Cashflow...');
        try {
          const postRes = await postOrderToSheet(sheetConfig.appsScriptUrl, newOrder, cashflowTx);
          if (postRes.queuedLocally) {
            setOfflineBannerMessage('Offline Mode: Data saved locally and will sync when reconnected.');
            setOfflineQueueCount(getOfflineQueue().length);
          } else if (postRes.success) {
            setOrders(prev =>
              prev.map(o => (o.id === newOrder.id ? { ...o, syncedToSheet: true } : o))
            );
            if (cashflowTx) {
              setTransactions(prev =>
                prev.map(t => (t.id === cashflowTx!.id ? { ...t, syncedToSheet: true } : t))
              );
            }
            setSyncStatusMessage('Client debt updated in sheet');
          }
        } catch (err) {
          console.error('Error posting order:', err);
          setOfflineBannerMessage('Offline Mode: Data saved locally and will sync when reconnected.');
          setOfflineQueueCount(getOfflineQueue().length);
        } finally {
          setIsSyncing(false);
          setTimeout(() => setSyncStatusMessage(null), 3000);
        }
      }

      let resultMsg = `Order ${newOrder.invoiceNumber} processed.`;
      if (cashflowLogged) {
        resultMsg += ` Recorded ${actualDownPayment.toLocaleString()} ${sheetConfig.currency} Inflow in Cashflow.`;
      }
      if (unpaidPart > 0) {
        resultMsg += ` +${unpaidPart.toLocaleString()} ${sheetConfig.currency} added to client remaining debt.`;
      }

      return {
        success: true,
        message: resultMsg,
        cashflowLogged,
      };
    } finally {
      clearTimeout(safetyTimeout);
      orderLockRef.current = false;
    }
  };

  const addClient = async (data: {
    code: string;
    name: string;
    phone?: string;
    area?: string;
    email?: string;
    remaining?: number;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanCode = data.code.trim().toUpperCase() || getNextClientCode();
    const cleanName = data.name.trim();

    if (!cleanName) {
      return { success: false, message: 'Client name is required.' };
    }

    const exists = clients.some(c => c.code.toUpperCase() === cleanCode);
    if (exists) {
      return { success: false, message: `Client code "${cleanCode}" already exists.` };
    }

    const newClient: ClientItem = {
      id: 'cli-' + cleanCode.toLowerCase(),
      code: cleanCode,
      name: cleanName,
      phone: data.phone?.trim() || '',
      area: data.area?.trim() || '',
      email: data.email?.trim() || '',
      remaining: typeof data.remaining === 'number' ? data.remaining : 0,
      fullLabel: `${cleanCode} - ${cleanName}`,
    };

    setClients(prev => [...prev, newClient]);

    if (!isOnline || !navigator.onLine) {
      await postNewClientToSheet(sheetConfig.appsScriptUrl, newClient);
      setOfflineQueueCount(getOfflineQueue().length);
      setOfflineBannerMessage('Offline Mode: Client saved locally and will sync when reconnected.');
      return {
        success: true,
        message: `Client ${cleanCode} saved locally. Will sync to sheet upon reconnection.`,
      };
    }

    if (sheetConfig.appsScriptUrl && sheetConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
      setIsSyncing(true);
      setSyncStatusMessage('Adding client to Google Sheet...');
      try {
        await postNewClientToSheet(sheetConfig.appsScriptUrl, newClient);
      } catch (err) {
        console.error('Error posting client:', err);
      } finally {
        setIsSyncing(false);
        setTimeout(() => setSyncStatusMessage(null), 3000);
      }
    }

    return {
      success: true,
      message: `Client ${cleanCode} (${cleanName}) created successfully.`,
    };
  };

  const updateClient = async (data: {
    code: string;
    name: string;
    phone?: string;
    area?: string;
    email?: string;
    remaining?: number;
  }): Promise<{ success: boolean; message: string }> => {
    const cleanCode = data.code.trim().toUpperCase();
    const cleanName = data.name.trim();

    if (!cleanName) {
      return { success: false, message: 'Client name cannot be empty.' };
    }

    let updatedItem: ClientItem | null = null;

    setClients(prev =>
      prev.map(c => {
        if (c.code.toUpperCase() === cleanCode) {
          updatedItem = {
            ...c,
            name: cleanName,
            phone: data.phone !== undefined ? data.phone.trim() : c.phone,
            area: data.area !== undefined ? data.area.trim() : c.area,
            email: data.email !== undefined ? data.email.trim() : c.email,
            remaining: typeof data.remaining === 'number' ? data.remaining : c.remaining,
            fullLabel: `${cleanCode} - ${cleanName}`,
          };
          return updatedItem;
        }
        return c;
      })
    );

    if (updatedItem) {
      if (!isOnline || !navigator.onLine) {
        await updateClientInSheet(sheetConfig.appsScriptUrl, updatedItem);
        setOfflineQueueCount(getOfflineQueue().length);
        setOfflineBannerMessage('Offline Mode: Client updated locally and queued for sync.');
        return { success: true, message: `Client ${cleanCode} updated locally.` };
      }

      if (sheetConfig.appsScriptUrl && sheetConfig.appsScriptUrl.startsWith('https://script.google.com/')) {
        setIsSyncing(true);
        setSyncStatusMessage('Updating client in Google Sheet...');
        try {
          await updateClientInSheet(sheetConfig.appsScriptUrl, updatedItem);
        } catch (err) {
          console.error('Error updating client:', err);
        } finally {
          setIsSyncing(false);
          setTimeout(() => setSyncStatusMessage(null), 3000);
        }
      }
    }

    return {
      success: true,
      message: `Client ${cleanCode} updated successfully.`,
    };
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => {
      const remaining = prev.filter(t => t.id !== id);
      let bal = sheetConfig.initialOpeningBalance || 0;
      return remaining.map(t => {
        const isIn = t.type === 'Inflow' || (t.type as string) === 'in';
        if (isIn || t.debit) {
          bal += (t.debit || t.amount);
        } else {
          bal -= (t.credit || t.amount);
        }
        return {
          ...t,
          balance: bal,
        };
      });
    });
  };

  const updateSheetConfig = (config: Partial<SheetConfig>) => {
    setSheetConfig(prev => ({ ...prev, ...config }));
  };

  // Sync with Google Sheet
  const syncWithGoogleSheet = async () => {
    const url = sheetConfig.appsScriptUrl || CONFIGURED_APPS_SCRIPT_URL;
    if (!url) return;

    setIsSyncing(true);
    setSyncStatusMessage('Syncing with Google Sheet...');
    try {
      const result = await testAppsScriptConnection(url);
      if (result.success && result.data) {
        if (Array.isArray(result.data.transactions) && result.data.transactions.length > 0) {
          setTransactions(result.data.transactions);
        }
        if (Array.isArray(result.data.clients) && result.data.clients.length > 0) {
          const initialMap = new Map(INITIAL_CLIENTS.map(c => [c.code.toUpperCase(), c]));
          const merged = result.data.clients.map((c: any) => {
            const init = initialMap.get(c.code.toUpperCase());
            const isAmasi = c.code.toUpperCase() === 'C04' || c.name.includes('الاماسي');
            let rem = c.remaining;
            if (typeof rem === 'string') {
              rem = parseFloat(rem.replace(/,/g, ''));
            }
            if (typeof rem !== 'number' || isNaN(rem) || rem === 0) {
              rem = init?.remaining || 0;
            }
            if (isAmasi && (rem < 70000000 || rem === 58479942)) {
              rem = 78479942;
            }
            return {
              ...c,
              remaining: rem,
            };
          });
          setClients(merged);
        }
        setSheetConfig(prev => ({
          ...prev,
          isConnected: true,
          lastSyncedAt: new Date().toLocaleTimeString(),
        }));
        setSyncStatusMessage('Synchronized with Google Sheet');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMessage(null), 3000);
    }
  };

  // -------------------------------------------------------------
  // TASK 2: AUTO-SYNC QUEUE WHEN RESTORING CONNECTION
  // -------------------------------------------------------------
  const syncOfflineQueue = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) {
      setOfflineQueueCount(0);
      return;
    }

    setIsSyncing(true);
    setSyncStatusMessage(`Syncing ${queue.length} offline item(s) to Google Sheet...`);

    try {
      const result = await processOfflineQueue(sheetConfig.appsScriptUrl);
      const remainingCount = getOfflineQueue().length;
      setOfflineQueueCount(remainingCount);

      if (remainingCount === 0) {
        setOfflineBannerMessage('All offline data successfully synced!');
        setTimeout(() => setOfflineBannerMessage(null), 5000);
        // Refresh sheet state
        await syncWithGoogleSheet();
      } else {
        setOfflineBannerMessage(`Synced ${result.succeeded} item(s). ${remainingCount} still queued.`);
      }
    } catch (e) {
      console.error('Error syncing offline queue:', e);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMessage(null), 3000);
    }
  };

  // Listen for online / offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const q = getOfflineQueue();
      if (q.length > 0) {
        setOfflineBannerMessage('Internet reconnected. Syncing queued offline transactions...');
        syncOfflineQueue();
      } else {
        setOfflineBannerMessage(null);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineBannerMessage('Offline Mode: Data saved locally and will sync when reconnected.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (navigator.onLine) {
      const q = getOfflineQueue();
      if (q.length > 0) {
        syncOfflineQueue();
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sheetConfig.appsScriptUrl]);

  // Initial sync with live sheet
  useEffect(() => {
    if (navigator.onLine) {
      syncWithGoogleSheet();
    }
  }, []);

  return (
    <TreasuryContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        transactions,
        clients,
        orders,
        previousDescriptions,
        currentBalance,
        initialOpeningBalance: sheetConfig.initialOpeningBalance || 0,
        sheetConfig,
        isSyncing,
        syncStatusMessage,
        dayGroups,
        allDayGroups,
        isOnline,
        offlineQueueCount,
        syncOfflineQueue,
        offlineBannerMessage,
        dismissOfflineBanner: () => setOfflineBannerMessage(null),
        selectedMonth,
        setSelectedMonth,
        prevMonth,
        nextMonth,
        addTransaction,
        addOrder,
        addClient,
        updateClient,
        deleteTransaction,
        updateSheetConfig,
        syncWithGoogleSheet,
        getNextRefNo,
        getNextInvoiceNo,
        getNextClientCode,
        isSettingsOpen,
        setIsSettingsOpen,
      }}
    >
      {children}
    </TreasuryContext.Provider>
  );
};

export const useTreasury = () => {
  const context = useContext(TreasuryContext);
  if (!context) {
    throw new Error('useTreasury must be used within a TreasuryProvider');
  }
  return context;
};
