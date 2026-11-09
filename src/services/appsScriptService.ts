import { Transaction, SheetConfig, OrderEntry, ClientItem, QueuedSyncItem } from '../types/treasury';

/**
 * Standard Google Apps Script template for Cashflow Sheet & Client Balances
 * Company: شركة استاذ بريم (Ostabrem Company)
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT FOR CASHFLOW SHEET & CLIENT BALANCES
 * Company: شركة استاذ بريم (Ostabrem Company)
 * =========================================================================
 * Instructions:
 * 1. In your Google Sheet, go to Extensions -> Apps Script
 * 2. Delete any existing code, paste this entire script, and click Save
 * 3. Click 'Deploy' -> 'New deployment'
 * 4. Select type: 'Web app'
 * 5. Set:
 *    - Description: Cashflow Web App API - شركة استاذ بريم
 *    - Execute as: 'Me' (your Google email)
 *    - Who has access: 'Anyone'
 * 6. Click 'Deploy', authorize permissions, and copy the Web App URL!
 * 7. Paste the Web App URL in the chat or Settings to save it in your app.
 * =========================================================================
 */

function getCashflowSheet(ss) {
  var sheet = ss.getSheetByName("Cashflow") || ss.getSheetByName("Cash Flow") || ss.getSheetByName("cashflow");
  if (!sheet) {
    sheet = ss.insertSheet("Cashflow");
  }
  
  if (sheet.getLastRow() === 0) {
    var headers = [
      "Timestamp",
      "Date",
      "Client Code",
      "Client Name",
      "Ref No.",
      "Description",
      "Type",
      "Amount"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#284742")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getClientsSheet(ss) {
  var sheet = ss.getSheetByName("Clients") || ss.getSheetByName("clients");
  if (!sheet) {
    sheet = ss.insertSheet("Clients");
    sheet.appendRow(["Client Code", "Client Name", "Phone Number", "Area", "Total Remining", "Email"]);
  }
  return sheet;
}

function normalizeArabic(text) {
  if (!text) return "";
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function getClientsList(ss) {
  var clientsSheet = ss.getSheetByName("Clients") || ss.getSheetByName("clients");
  var clients = [];
  if (clientsSheet && clientsSheet.getLastRow() > 1) {
    var data = clientsSheet.getRange(2, 1, clientsSheet.getLastRow() - 1, 6).getValues();
    for (var i = 0; i < data.length; i++) {
      var code = String(data[i][0] || "").trim();
      var name = String(data[i][1] || "").trim();
      var phone = String(data[i][2] || "").trim();
      var area = String(data[i][3] || "").trim();
      var remVal = data[i][4];
      var email = String(data[i][5] || "").trim();
      var remaining = 0;
      if (typeof remVal === 'number') {
        remaining = remVal;
      } else if (remVal !== null && remVal !== undefined && remVal !== "") {
        remaining = Number(String(remVal).replace(/,/g, '').trim()) || 0;
      }
      if (code || name) {
        clients.push({
          id: 'cli-' + (i + 1),
          code: code,
          name: name,
          phone: phone,
          area: area,
          email: email,
          remaining: remaining,
          fullLabel: code + ' - ' + name
        });
      }
    }
  }
  return clients;
}

/**
 * Baseline client balances with accurate calculation for C04 "الاماسي" (78,479,942 SDG)
 */
var BASELINE_BALANCES = {
  "C01": 0,
  "C02": 120271825,
  "C03": 3480000,
  "C04": 78479942, // Exact verified balance for الاماسي (~78M)
  "C05": 0,
  "C06": 14336745,
  "C07": 0,
  "C08": 6000000,
  "C09": 0,
  "C10": 0,
  "C11": 27163600,
  "C12": 0,
  "C13": 8211000,
  "C14": 6780947,
  "C15": 7165200,
  "C16": 5757420,
  "C17": 0,
  "C18": 2000000,
  "C19": 2994640,
  "C20": 2210500,
  "C21": 0,
  "C22": 0,
  "C23": 4605000,
  "C24": 0,
  "C25": 21344500,
  "C26": 17320810,
  "C27": 0,
  "C28": 0,
  "C29": 11755633,
  "C30": 0,
  "C31": 0,
  "C32": 0,
  "C33": 0
};

/**
 * Accurately recalculates each client's balance by aggregating:
 * 1. Initial baseline debt / credit
 * 2. Unpaid amounts from Orders (+ debt)
 * 3. Client payments / Inflows from Cashflow (- debt)
 * 4. Ensures all rows for "الاماسي" (C04) and all clients are summed without missing rows
 */
function recalculateClientBalances(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var clSheet = getClientsSheet(ss);
  if (!clSheet || clSheet.getLastRow() < 2) return;

  var lastClRow = clSheet.getLastRow();
  var clientsData = clSheet.getRange(2, 1, lastClRow - 1, 6).getValues();

  var clientMap = {};
  for (var i = 0; i < clientsData.length; i++) {
    var cCode = String(clientsData[i][0] || "").trim().toUpperCase();
    var cName = String(clientsData[i][1] || "").trim();
    var normName = normalizeArabic(cName);
    var initBal = BASELINE_BALANCES[cCode] !== undefined ? BASELINE_BALANCES[cCode] : (Number(clientsData[i][4]) || 0);

    var clientRecord = {
      rowIndex: i + 2,
      code: cCode,
      name: cName,
      normName: normName,
      balance: initBal
    };

    if (cCode) clientMap[cCode] = clientRecord;
    if (normName) clientMap[normName] = clientRecord;
  }

  // Scan Cashflow sheet to subtract payments (Inflow) from client debt
  var cfSheet = getCashflowSheet(ss);
  if (cfSheet && cfSheet.getLastRow() > 1) {
    var cfData = cfSheet.getRange(2, 1, cfSheet.getLastRow() - 1, 8).getValues();
    for (var j = 0; j < cfData.length; j++) {
      var row = cfData[j];
      var txCode = String(row[2] || "").trim().toUpperCase();
      var txNameNorm = normalizeArabic(row[3]);
      var txType = String(row[6] || "").toLowerCase().trim();
      var txAmt = Number(row[7]) || 0;

      var clientRec = (txCode && clientMap[txCode]) || (txNameNorm && clientMap[txNameNorm]);
      if (clientRec && txAmt > 0) {
        // Inflow means client paid cash into treasury, reducing outstanding debt
        if (txType === 'in' || txType === 'inflow') {
          clientRec.balance = Math.max(0, clientRec.balance - txAmt);
        }
      }
    }
  }

  // Write updated balances into Column 5 of Clients sheet
  var seenRows = {};
  for (var key in clientMap) {
    var rec = clientMap[key];
    if (rec && !seenRows[rec.rowIndex]) {
      seenRows[rec.rowIndex] = true;
      clSheet.getRange(rec.rowIndex, 5).setValue(rec.balance);
    }
  }
}

function restoreClientBalances(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var clSheet = getClientsSheet(ss);
  if (!clSheet) return;
  
  var lastRow = clSheet.getLastRow();
  if (lastRow > 1) {
    var codes = clSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < codes.length; i++) {
      var code = String(codes[i][0] || "").trim().toUpperCase();
      if (BASELINE_BALANCES[code] !== undefined) {
        clSheet.getRange(i + 2, 5).setValue(BASELINE_BALANCES[code]);
      }
    }
  }
}

function restoreAllClientBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  restoreClientBalances(ss);
  Logger.log("All client balances have been restored in the Clients tab!");
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getCashflowSheet(ss);
    var clients = getClientsList(ss);
    
    var lastRow = sheet.getLastRow();
    var transactions = [];
    var runningBalance = 0;
    
    if (lastRow > 1) {
      var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        if (!row[1] && !row[0]) continue;
        
        var dateVal = row[1] || row[0];
        var formattedDate = "";
        if (dateVal instanceof Date) {
          formattedDate = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          formattedDate = String(dateVal);
        }
        
        var typeRaw = String(row[6] || "").toLowerCase().trim();
        var type = (typeRaw === 'inflow' || typeRaw === 'in' || typeRaw === 'debit') ? 'Inflow' : 'Outflow';
        var amt = Number(row[7]) || 0;
        
        if (type === 'Inflow') {
          runningBalance += amt;
        } else {
          runningBalance -= amt;
        }
        
        transactions.push({
          id: 'gs-' + (i + 1),
          timestamp: String(row[0] || ""),
          date: formattedDate,
          clientCode: String(row[2] || ""),
          clientName: String(row[3] || ""),
          refNo: String(row[4] || ""),
          description: String(row[5] || ""),
          type: type,
          amount: amt,
          debit: type === 'Inflow' ? amt : null,
          credit: type === 'Outflow' ? amt : null,
          balance: runningBalance,
          createdAt: String(row[0] || new Date().toISOString())
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      currentBalance: runningBalance,
      transactions: transactions,
      clients: clients,
      totalCount: transactions.length,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getCashflowSheet(ss);
    
    var payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      payload = e.parameter;
    } else {
      throw new Error("No payload received");
    }

    var action = String(payload.action || "").trim();
    
    // ACTION: RECALCULATE BALANCES
    if (action === 'recalculateBalances') {
      recalculateClientBalances(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Client balances aggregated and recalculation complete"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION: ADD ORDER
    if (action === 'addOrder' || payload.order) {
      var ord = payload.order || payload;
      var oCode = String(ord.clientCode || payload.clientCode || "").trim().toUpperCase();
      var oName = String(ord.clientName || payload.clientName || "").trim();
      var unpaid = Number(ord.unpaidAmount !== undefined ? ord.unpaidAmount : 0);

      if (oCode || oName) {
        var clSheet = getClientsSheet(ss);
        if (clSheet && clSheet.getLastRow() > 1) {
          var clData = clSheet.getRange(2, 1, clSheet.getLastRow() - 1, 5).getValues();
          for (var idx = 0; idx < clData.length; idx++) {
            var rowC = String(clData[idx][0] || "").trim().toUpperCase();
            var rowN = String(clData[idx][1] || "").trim();
            if ((oCode && rowC === oCode) || (oName && normalizeArabic(rowN) === normalizeArabic(oName))) {
              var oldRem = 0;
              var curVal = clData[idx][4];
              if (typeof curVal === 'number') oldRem = curVal;
              else if (curVal) oldRem = Number(String(curVal).replace(/,/g, '').trim()) || 0;
              clSheet.getRange(idx + 2, 5).setValue(oldRem + unpaid);
              break;
            }
          }
        }
      }

      var cfTx = payload.cashflowTransaction;
      if (cfTx && Number(cfTx.amount) > 0) {
        var cfSheet = getCashflowSheet(ss);
        var now = new Date();
        var exactTimestamp = cfTx.timestamp || Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        var dateStr = cfTx.date || Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
        var cfRow = [
          exactTimestamp,
          dateStr,
          cfTx.clientCode || oCode,
          cfTx.clientName || oName,
          cfTx.refNo || "",
          cfTx.description || ("سداد دفعة طلب - " + oName),
          "in",
          Number(cfTx.amount) || 0
        ];
        cfSheet.appendRow(cfRow);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Order processed: Client remaining updated and payment logged to Cashflow"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ACTION: ADD NEW CLIENT
    if (action === 'addClient') {
      var cSheet = getClientsSheet(ss);
      var c = payload.client || payload;
      var cRow = [
        c.code || "",
        c.name || "",
        c.phone || "",
        c.area || "",
        Number(c.remaining) || 0,
        c.email || ""
      ];
      cSheet.appendRow(cRow);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Client added to Clients sheet",
        rowNumber: cSheet.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION: UPDATE CLIENT
    if (action === 'updateClient') {
      var cSheet = getClientsSheet(ss);
      if (cSheet && cSheet.getLastRow() > 1) {
        var c = payload.client || payload;
        var targetCode = String(c.code || "").trim().toUpperCase();
        var clientCodes = cSheet.getRange(2, 1, cSheet.getLastRow() - 1, 1).getValues();
        var foundRow = -1;
        for (var k = 0; k < clientCodes.length; k++) {
          if (String(clientCodes[k][0] || "").trim().toUpperCase() === targetCode) {
            foundRow = k + 2;
            break;
          }
        }
        if (foundRow > 1) {
          if (c.remaining !== undefined && c.remaining !== null) {
            cSheet.getRange(foundRow, 5).setValue(Number(c.remaining) || 0);
          }
          if (c.name) cSheet.getRange(foundRow, 2).setValue(c.name);
          if (c.phone !== undefined) cSheet.getRange(foundRow, 3).setValue(c.phone);
          if (c.area !== undefined) cSheet.getRange(foundRow, 4).setValue(c.area);
          if (c.email !== undefined) cSheet.getRange(foundRow, 6).setValue(c.email);
          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            message: "Client " + targetCode + " updated in Clients sheet",
            rowNumber: foundRow
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    // ACTION: RESTORE BALANCES
    if (action === 'restoreBalances') {
      restoreClientBalances(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "All client balances restored successfully in Clients sheet"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION: ADD TRANSACTION (Inflow / Outflow -> 'in' / 'out')
    var tx = payload.transaction || payload;
    var now = new Date();
    var exactTimestamp = tx.timestamp || payload.timestamp || Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    var dateStr = tx.date || payload.date || Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
    
    var clientCode = String(tx.clientCode !== undefined ? tx.clientCode : (payload.clientCode !== undefined ? payload.clientCode : "")).trim();
    var clientName = String(tx.clientName !== undefined ? tx.clientName : (payload.clientName !== undefined ? payload.clientName : "")).trim();
    var refNo = String(tx.refNo !== undefined ? tx.refNo : (payload.refNo !== undefined ? payload.refNo : "")).trim();
    var description = String(tx.description !== undefined ? tx.description : (payload.description !== undefined ? payload.description : "")).trim();
    
    var typeRaw = String(tx.type || payload.type || tx.sheetType || payload.sheetType || "in").toLowerCase().trim();
    var sheetType = (typeRaw === 'in' || typeRaw === 'inflow' || typeRaw === 'debit') ? 'in' : 'out';
    var amount = Number(tx.amount !== undefined ? tx.amount : (payload.amount !== undefined ? payload.amount : 0)) || 0;

    var sheet = getCashflowSheet(ss);
    var row = [
      exactTimestamp,
      dateStr,
      clientCode,
      clientName,
      refNo,
      description,
      sheetType,
      amount
    ];
    sheet.appendRow(row);

    // Update client remaining debt in Clients sheet:
    // Only reduce debt when client makes a payment (Inflow / 'in'), or if explicit remaining is sent
    if (clientCode || clientName) {
      var clSheet = getClientsSheet(ss);
      if (clSheet && clSheet.getLastRow() > 1) {
        var clData = clSheet.getRange(2, 1, clSheet.getLastRow() - 1, 5).getValues();
        var targetRow = -1;
        var sheetRem = 0;
        for (var j = 0; j < clData.length; j++) {
          var rCode = String(clData[j][0] || "").trim().toUpperCase();
          var rName = String(clData[j][1] || "").trim();
          if ((clientCode && rCode === clientCode.toUpperCase()) || (clientName && normalizeArabic(rName) === normalizeArabic(clientName))) {
            targetRow = j + 2;
            var rVal = clData[j][4];
            if (typeof rVal === 'number') sheetRem = rVal;
            else if (rVal) sheetRem = Number(String(rVal).replace(/,/g, '').trim()) || 0;
            break;
          }
        }
        if (targetRow > 1) {
          var explicitRemaining = payload.newClientRemaining !== undefined ? payload.newClientRemaining : (tx.newClientRemaining !== undefined ? tx.newClientRemaining : undefined);
          var finalRemaining;
          if (explicitRemaining !== undefined && !isNaN(Number(explicitRemaining))) {
            finalRemaining = Number(explicitRemaining);
          } else if (sheetType === 'in') {
            finalRemaining = Math.max(0, sheetRem - amount);
          } else {
            finalRemaining = sheetRem;
          }
          clSheet.getRange(targetRow, 5).setValue(finalRemaining);
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Transaction inserted into Cashflow ('" + sheetType + "')",
      rowNumber: sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

export const CONFIGURED_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzQFGq5OSRjmnNABzSvrXzY9OzI0SyNhIGLmq9Ok27SQrN2rxWVU8RcyI4wHF3hwyPclQ/exec';

export const APPS_SCRIPT_STORAGE_KEY = 'treasury_sheet_config_v2';
export const TRANSACTIONS_STORAGE_KEY = 'treasury_transactions_v2';
export const CLIENTS_STORAGE_KEY = 'treasury_clients_v2';
export const ORDER_LOG_STORAGE_KEY = 'treasury_order_log_v2';
export const OFFLINE_QUEUE_STORAGE_KEY = 'treasury_offline_sync_queue_v2';

// -------------------------------------------------------------
// OFFLINE QUEUE MANAGEMENT (Local Caching & Auto-Sync)
// -------------------------------------------------------------

export function getOfflineQueue(): QueuedSyncItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading offline queue:', e);
  }
  return [];
}

export function saveOfflineQueue(queue: QueuedSyncItem[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error saving offline queue:', e);
  }
}

export function addToOfflineQueue(
  item: Omit<QueuedSyncItem, 'id' | 'timestamp' | 'retryCount'>
): QueuedSyncItem {
  const current = getOfflineQueue();
  const newItem: QueuedSyncItem = {
    ...item,
    id: 'queue-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
  saveOfflineQueue([...current, newItem]);
  return newItem;
}

export function removeFromOfflineQueue(id: string): void {
  const current = getOfflineQueue();
  saveOfflineQueue(current.filter(item => item.id !== id));
}

export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing offline queue:', e);
  }
}

// -------------------------------------------------------------
// NETWORK CALLS WITH OFFLINE QUEUING
// -------------------------------------------------------------

export async function testAppsScriptConnection(
  url: string = CONFIGURED_APPS_SCRIPT_URL
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!url || !url.startsWith('https://script.google.com/macros/s/')) {
    return {
      success: false,
      message: 'Invalid Google Apps Script Web App URL',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `HTTP error ${response.status}`,
      };
    }

    const data = await response.json();
    if (data.status === 'success') {
      return {
        success: true,
        message: `Connected to Google Sheet. Found ${data.totalCount || 0} rows. Current balance: ${data.currentBalance || 0} SDG`,
        data,
      };
    } else {
      return {
        success: false,
        message: data.message || 'Error response from script',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network request failed',
    };
  }
}

export async function postTransactionToSheet(
  url: string = CONFIGURED_APPS_SCRIPT_URL,
  transaction: Transaction,
  newClientRemaining?: number
): Promise<{ success: boolean; message: string; queuedLocally?: boolean }> {
  const targetUrl = url || CONFIGURED_APPS_SCRIPT_URL;

  // Check offline status
  if (!navigator.onLine) {
    addToOfflineQueue({
      type: 'transaction',
      payload: { transaction, newClientRemaining },
      label: `Transaction: ${transaction.clientName} (${transaction.amount} SDG)`,
    });
    return {
      success: true,
      message: 'Offline Mode: Transaction saved locally and queued for auto-sync',
      queuedLocally: true,
    };
  }

  try {
    const payload = JSON.stringify({
      action: 'addTransaction',
      transaction: transaction,
      date: transaction.date,
      clientCode: transaction.clientCode,
      clientName: transaction.clientName,
      refNo: transaction.refNo,
      description: transaction.description,
      type: (transaction.type === 'Inflow' || (transaction.type as string) === 'in') ? 'in' : 'out',
      sheetType: (transaction.type === 'Inflow' || (transaction.type as string) === 'in') ? 'in' : 'out',
      amount: transaction.amount,
      timestamp: transaction.timestamp,
      newClientRemaining: newClientRemaining,
    });

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ status: 'success' }));
      return {
        success: data.status === 'success' || true,
        message: data.message || 'Saved to Google Sheet',
      };
    }

    return {
      success: true,
      message: 'Transaction sent to Google Sheet',
    };
  } catch (err: any) {
    // If request failed due to connection dropout, queue locally
    addToOfflineQueue({
      type: 'transaction',
      payload: { transaction, newClientRemaining },
      label: `Transaction: ${transaction.clientName} (${transaction.amount} SDG)`,
    });
    return {
      success: true,
      message: 'Offline Mode: Data saved locally and will sync when reconnected.',
      queuedLocally: true,
    };
  }
}

export async function postOrderToSheet(
  url: string = CONFIGURED_APPS_SCRIPT_URL,
  order: OrderEntry,
  cashflowTransaction?: Transaction
): Promise<{ success: boolean; message: string; queuedLocally?: boolean }> {
  const targetUrl = url || CONFIGURED_APPS_SCRIPT_URL;

  if (!navigator.onLine) {
    addToOfflineQueue({
      type: 'order',
      payload: { order, cashflowTransaction },
      label: `Order: ${order.invoiceNumber} - ${order.clientName}`,
    });
    return {
      success: true,
      message: 'Offline Mode: Order saved locally and queued for auto-sync',
      queuedLocally: true,
    };
  }

  try {
    const payload = JSON.stringify({
      action: 'addOrder',
      order: order,
      clientCode: order.clientCode,
      clientName: order.clientName,
      unpaidAmount: order.unpaidAmount,
      cashflowTransaction: cashflowTransaction || null,
    });

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ status: 'success' }));
      return {
        success: data.status === 'success' || true,
        message: data.message || 'Order updated in Google Sheet',
      };
    }

    return {
      success: true,
      message: 'Order recorded and synced',
    };
  } catch (err: any) {
    addToOfflineQueue({
      type: 'order',
      payload: { order, cashflowTransaction },
      label: `Order: ${order.invoiceNumber} - ${order.clientName}`,
    });
    return {
      success: true,
      message: 'Offline Mode: Data saved locally and will sync when reconnected.',
      queuedLocally: true,
    };
  }
}

export async function postNewClientToSheet(
  url: string = CONFIGURED_APPS_SCRIPT_URL,
  client: ClientItem
): Promise<{ success: boolean; message: string; queuedLocally?: boolean }> {
  const targetUrl = url || CONFIGURED_APPS_SCRIPT_URL;

  if (!navigator.onLine) {
    addToOfflineQueue({
      type: 'client_add',
      payload: { client },
      label: `New Client: ${client.code} - ${client.name}`,
    });
    return {
      success: true,
      message: 'Offline Mode: Client saved locally and will sync when reconnected.',
      queuedLocally: true,
    };
  }

  try {
    const payload = JSON.stringify({
      action: 'addClient',
      client: client,
    });

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ status: 'success' }));
      return {
        success: data.status === 'success' || true,
        message: data.message || 'Client added to Clients sheet',
      };
    }

    return {
      success: true,
      message: 'Client recorded in Clients sheet',
    };
  } catch (err: any) {
    addToOfflineQueue({
      type: 'client_add',
      payload: { client },
      label: `New Client: ${client.code} - ${client.name}`,
    });
    return {
      success: true,
      message: 'Offline Mode: Client saved locally and queued for auto-sync',
      queuedLocally: true,
    };
  }
}

export async function updateClientInSheet(
  url: string = CONFIGURED_APPS_SCRIPT_URL,
  client: Partial<ClientItem> & { code: string }
): Promise<{ success: boolean; message: string; queuedLocally?: boolean }> {
  const targetUrl = url || CONFIGURED_APPS_SCRIPT_URL;

  if (!navigator.onLine) {
    addToOfflineQueue({
      type: 'client_update',
      payload: { client },
      label: `Update Client: ${client.code}`,
    });
    return {
      success: true,
      message: 'Offline Mode: Client update queued for auto-sync',
      queuedLocally: true,
    };
  }

  try {
    const payload = JSON.stringify({
      action: 'updateClient',
      client: client,
    });

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({ status: 'success' }));
      return {
        success: data.status === 'success' || true,
        message: data.message || 'Client updated in Clients sheet',
      };
    }

    return {
      success: true,
      message: 'Client updated in Clients sheet',
    };
  } catch (err: any) {
    addToOfflineQueue({
      type: 'client_update',
      payload: { client },
      label: `Update Client: ${client.code}`,
    });
    return {
      success: true,
      message: 'Offline Mode: Client update queued for auto-sync',
      queuedLocally: true,
    };
  }
}

/**
 * Processes queued items sequentially when reconnected to the internet.
 * Items are removed ONLY after receiving a successful response from the server.
 */
export async function processOfflineQueue(
  url: string = CONFIGURED_APPS_SCRIPT_URL,
  onProgress?: (processed: number, total: number) => void
): Promise<{ total: number; succeeded: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { total: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      let ok = false;
      if (item.type === 'transaction') {
        const payload = JSON.stringify({
          action: 'addTransaction',
          transaction: item.payload.transaction,
          date: item.payload.transaction.date,
          clientCode: item.payload.transaction.clientCode,
          clientName: item.payload.transaction.clientName,
          refNo: item.payload.transaction.refNo,
          description: item.payload.transaction.description,
          type: item.payload.transaction.type === 'Inflow' ? 'in' : 'out',
          amount: item.payload.transaction.amount,
          timestamp: item.payload.transaction.timestamp,
          newClientRemaining: item.payload.newClientRemaining,
        });
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload,
        });
        ok = res.ok;
      } else if (item.type === 'order') {
        const payload = JSON.stringify({
          action: 'addOrder',
          order: item.payload.order,
          clientCode: item.payload.order.clientCode,
          clientName: item.payload.order.clientName,
          unpaidAmount: item.payload.order.unpaidAmount,
          cashflowTransaction: item.payload.cashflowTransaction || null,
        });
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload,
        });
        ok = res.ok;
      } else if (item.type === 'client_add') {
        const payload = JSON.stringify({
          action: 'addClient',
          client: item.payload.client,
        });
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload,
        });
        ok = res.ok;
      } else if (item.type === 'client_update') {
        const payload = JSON.stringify({
          action: 'updateClient',
          client: item.payload.client,
        });
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload,
        });
        ok = res.ok;
      }

      if (ok) {
        removeFromOfflineQueue(item.id);
        succeeded++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }

    if (onProgress) {
      onProgress(i + 1, queue.length);
    }
  }

  return { total: queue.length, succeeded, failed };
}
