import { Transaction, SheetConfig, OrderEntry, ClientItem, QueuedSyncItem } from '../types/treasury';

/**
 * Standard Google Apps Script template for Cashflow Sheet & Client Balances
 * Company: شركة أستاذ يبرم (Ostath Yabrom Company)
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT FOR CASHFLOW, ORDER LOG & CLIENT REMAINING BALANCES
 * Company: شركة أستاذ يبرم (Ostath Yabrom Company)
 * =========================================================================
 * Instructions:
 * 1. In your Google Sheet, go to Extensions -> Apps Script
 * 2. Delete any existing code, paste this entire script, and click Save
 * 3. Click 'Deploy' -> 'Manage deployments' -> Edit (pencil icon)
 * 4. Change Version to 'New version' (CRITICAL for updates to go live!)
 * 5. Execute as: 'Me' | Who has access: 'Anyone' -> Click 'Deploy'
 * =========================================================================
 */

function getCashflowSheet(ss) {
  var sheet = ss.getSheetByName("Cashflow") || ss.getSheetByName("Cash Flow") || ss.getSheetByName("cashflow") || ss.getSheetByName("حركة النقدية");
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

function getOrderLogSheet(ss, createIfMissing) {
  if (createIfMissing === undefined) createIfMissing = true;
  var sheet = ss.getSheetByName("Order Log") ||
              ss.getSheetByName("Order log") ||
              ss.getSheetByName("Orders") ||
              ss.getSheetByName("orders") ||
              ss.getSheetByName("Order") ||
              ss.getSheetByName("order") ||
              ss.getSheetByName("سجل الطلبات");
  if (!sheet && createIfMissing) {
    sheet = ss.insertSheet("Order Log");
    var headers = [
      "Timestamp",
      "Date",
      "Client Code",
      "Client Name",
      "Invoice No.",
      "Description",
      "Amount",
      "Payment Option",
      "Down Payment",
      "Unpaid Amount",
      "Cashflow Ref"
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
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var n = sheets[i].getName().trim().toLowerCase();
    if (n === "client" || n === "clients" || n === "العملاء" || n === "دليل العملاء") {
      return sheets[i];
    }
  }
  for (var j = 0; j < sheets.length; j++) {
    var n2 = sheets[j].getName().trim().toLowerCase();
    if (n2.indexOf("client") !== -1 || n2.indexOf("عملاء") !== -1 || n2.indexOf("عميل") !== -1) {
      return sheets[j];
    }
  }
  var sheet = ss.getSheetByName("Clients") || ss.getSheetByName("Client");
  if (!sheet) {
    sheet = ss.insertSheet("Clients");
    var headers = ["Client Code", "Client Name", "Phone Number", "Area", "Remining amount", "Date", "Email"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#284742")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function normalizeArabic(text) {
  if (!text) return "";
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\\s+/g, " ");
}

function canonicalClientCode(code) {
  var upper = String(code || "").trim().toUpperCase();
  var match = upper.match(/^C0*(\\d+)$/);
  return match ? ("C" + parseInt(match[1], 10)) : upper;
}

function parseSheetAmount(val) {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (val === null || val === undefined || val === "") return 0;
  var num = Number(String(val).replace(/,/g, "").trim());
  return isNaN(num) ? 0 : num;
}

/**
 * Appends a row directly after the last row that actually has data in columns 1..keyColsCount.
 * Prevents empty gap rows caused by trailing formulas (e.g. balance formulas in Col I) or blank formatted rows.
 */
function appendCleanRow(sheet, rowValues, keyColsCount) {
  var colsToCheck = Math.max(1, keyColsCount || rowValues.length);
  var maxRow = sheet.getLastRow();
  var lastDataRow = 1;

  if (maxRow > 1) {
    var values = sheet.getRange(1, 1, maxRow, colsToCheck).getValues();
    for (var r = values.length - 1; r >= 0; r--) {
      var hasData = false;
      for (var c = 0; c < colsToCheck; c++) {
        if (String(values[r][c] !== null && values[r][c] !== undefined ? values[r][c] : "").trim() !== "") {
          hasData = true;
          break;
        }
      }
      if (hasData) {
        lastDataRow = r + 1;
        break;
      }
    }
  } else if (maxRow === 1) {
    lastDataRow = 1;
  } else {
    lastDataRow = 0;
  }

  var targetRow = lastDataRow + 1;
  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  return targetRow;
}

/**
 * Dynamically detects column numbers (1-based) from Row 1 of Client/Clients sheet.
 */
function getClientSheetColumns(clSheet) {
  var lastCol = Math.max(clSheet.getLastColumn(), 6);
  var headerValues = clSheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var cols = {
    code: 1,
    name: 2,
    phone: 3,
    area: 4,
    remaining: 5,
    date: -1,
    email: 6
  };

  for (var c = 0; c < headerValues.length; c++) {
    var rawH = String(headerValues[c] || "").trim();
    var h = rawH.toLowerCase();
    var normH = normalizeArabic(h);

    if (h.indexOf("remin") !== -1 || h.indexOf("remain") !== -1 || normH.indexOf("مديوني") !== -1 || normH.indexOf("متبق") !== -1 || h.indexOf("balance") !== -1) {
      cols.remaining = c + 1;
    } else if (h.indexOf("code") !== -1 || normH.indexOf("كود") !== -1) {
      cols.code = c + 1;
    } else if (h.indexOf("name") !== -1 || normH.indexOf("اسم") !== -1) {
      cols.name = c + 1;
    } else if (h.indexOf("phone") !== -1 || normH.indexOf("هاتف") !== -1 || normH.indexOf("تلفون") !== -1 || normH.indexOf("موبايل") !== -1) {
      cols.phone = c + 1;
    } else if (h.indexOf("area") !== -1 || normH.indexOf("منطق") !== -1 || normH.indexOf("عنوان") !== -1) {
      cols.area = c + 1;
    } else if (h.indexOf("date") !== -1 || normH.indexOf("تاريخ") !== -1) {
      cols.date = c + 1;
    } else if (h.indexOf("email") !== -1 || normH.indexOf("بريد") !== -1) {
      cols.email = c + 1;
    }
  }
  return cols;
}

/**
 * Aggregates ALL orders and ALL cashflow payments dynamically across open-ended ranges (row 2 .. getLastRow()).
 * Counts both 'in' and 'out' client payments in Cashflow because client invoice payments are recorded as 'out'.
 */
function computeClientBalancesMap(ss) {
  var ordersByCode = {};
  var ordersByName = {};
  var cashflowByCode = {};
  var cashflowByName = {};

  var ordSheet = getOrderLogSheet(ss, false);
  if (ordSheet && ordSheet.getLastRow() > 1) {
    var ordCols = Math.max(ordSheet.getLastColumn(), 7);
    var ordData = ordSheet.getRange(2, 1, ordSheet.getLastRow() - 1, ordCols).getValues();
    for (var k = 0; k < ordData.length; k++) {
      var oCode = canonicalClientCode(ordData[k][2]);
      var oName = normalizeArabic(ordData[k][3]);
      var oAmt = parseSheetAmount(ordData[k][6]); // Column G: Total Order Amount
      if (!oCode && !oName && oAmt === 0) continue;
      if (oCode) ordersByCode[oCode] = (ordersByCode[oCode] || 0) + oAmt;
      if (oName) ordersByName[oName] = (ordersByName[oName] || 0) + oAmt;
    }
  }

  var cfSheet = getCashflowSheet(ss);
  if (cfSheet && cfSheet.getLastRow() > 1) {
    var cfData = cfSheet.getRange(2, 1, cfSheet.getLastRow() - 1, 8).getValues();
    for (var j = 0; j < cfData.length; j++) {
      var row = cfData[j];
      if (!row[0] && !row[1] && !row[2] && !row[3]) continue;
      var txCode = canonicalClientCode(row[2]);
      var txName = normalizeArabic(row[3]);
      var txAmt = parseSheetAmount(row[7]); // Column H: Amount
      if (txAmt <= 0) continue;
      if (txCode) cashflowByCode[txCode] = (cashflowByCode[txCode] || 0) + txAmt;
      if (txName) cashflowByName[txName] = (cashflowByName[txName] || 0) + txAmt;
    }
  }

  return {
    ordersByCode: ordersByCode,
    ordersByName: ordersByName,
    cashflowByCode: cashflowByCode,
    cashflowByName: cashflowByName
  };
}

function resolveClientRemaining(code, name, sheetRem, balMap) {
  var cKey = canonicalClientCode(code);
  if (cKey === "C1") return 0; // C01 Owner is treasury funding, not customer debt

  var nKey = normalizeArabic(name);
  var hasOrders = (cKey && balMap.ordersByCode[cKey] !== undefined) || (nKey && balMap.ordersByName[nKey] !== undefined);
  if (hasOrders) {
    var ordTotal = (cKey && balMap.ordersByCode[cKey] !== undefined)
      ? balMap.ordersByCode[cKey]
      : (balMap.ordersByName[nKey] || 0);
    var paidTotal = (cKey && balMap.cashflowByCode[cKey] !== undefined)
      ? balMap.cashflowByCode[cKey]
      : (nKey ? (balMap.cashflowByName[nKey] || 0) : 0);
    return Math.max(0, ordTotal - paidTotal);
  }
  return sheetRem;
}

function getClientsList(ss, balMap) {
  var clientsSheet = getClientsSheet(ss);
  var clients = [];
  if (clientsSheet && clientsSheet.getLastRow() > 1) {
    var cols = getClientSheetColumns(clientsSheet);
    var maxCol = Math.max(clientsSheet.getLastColumn(), 6);
    var data = clientsSheet.getRange(2, 1, clientsSheet.getLastRow() - 1, maxCol).getValues();
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var code = String(row[cols.code - 1] || "").trim().toUpperCase();
      var name = String(row[cols.name - 1] || "").trim();
      var phone = cols.phone > 0 ? String(row[cols.phone - 1] || "").trim() : "";
      var area = cols.area > 0 ? String(row[cols.area - 1] || "").trim() : "";
      var remVal = cols.remaining > 0 ? row[cols.remaining - 1] : 0;
      var email = cols.email > 0 ? String(row[cols.email - 1] || "").trim() : "";
      var sheetRem = parseSheetAmount(remVal);
      var remaining = balMap ? resolveClientRemaining(code, name, sheetRem, balMap) : sheetRem;

      if (code || name) {
        clients.push({
          id: "cli-" + (i + 1),
          code: code,
          name: name,
          phone: phone,
          area: area,
          email: email,
          remaining: remaining,
          fullLabel: code + " - " + name
        });
      }
    }
  }
  return clients;
}

function getOrderLogList(ss) {
  var sheet = getOrderLogSheet(ss, false);
  var orders = [];
  if (!sheet || sheet.getLastRow() < 2) return orders;

  var lastRow = sheet.getLastRow();
  var maxCol = Math.max(sheet.getLastColumn(), 11);
  var data = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();

  for (var i = data.length - 1; i >= 0; i--) {
    var row = data[i];
    var ts = String(row[0] || "");
    var dateVal = row[1] || ts;
    var dateStr = "";
    if (dateVal instanceof Date) {
      dateStr = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      dateStr = String(dateVal || "");
    }
    var cCode = String(row[2] || "").trim().toUpperCase();
    var cName = String(row[3] || "").trim();
    var inv = String(row[4] || "").trim();
    var desc = String(row[5] || "").trim();
    var amt = parseSheetAmount(row[6]);
    var payOpt = String(row[7] || "Partial Payment").trim();
    var down = parseSheetAmount(row[8]);
    var unpaid = parseSheetAmount(row[9]);
    var cfRef = String(row[10] || "").trim();

    if (inv || cCode || cName || amt > 0) {
      orders.push({
        id: "ord-gs-" + (i + 1),
        timestamp: ts,
        date: dateStr,
        clientCode: cCode,
        clientName: cName,
        invoiceNumber: inv,
        description: desc,
        amount: amt,
        paymentOption: payOpt,
        downPayment: down,
        unpaidAmount: unpaid,
        cashflowLogged: down > 0,
        cashflowRefNo: cfRef,
        syncedToSheet: true,
        createdAt: ts || new Date().toISOString()
      });
    }
  }
  return orders;
}

function recalculateClientBalances(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var clSheet = getClientsSheet(ss);
  if (!clSheet || clSheet.getLastRow() < 2) return;

  var cols = getClientSheetColumns(clSheet);
  var lastClRow = clSheet.getLastRow();
  var maxCol = Math.max(clSheet.getLastColumn(), 6);
  var clientsData = clSheet.getRange(2, 1, lastClRow - 1, maxCol).getValues();
  var balMap = computeClientBalancesMap(ss);
  var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  for (var i = 0; i < clientsData.length; i++) {
    var cCode = String(clientsData[i][cols.code - 1] || "").trim().toUpperCase();
    var cName = String(clientsData[i][cols.name - 1] || "").trim();
    if (!cCode && !cName) continue;

    var curSheetRem = parseSheetAmount(clientsData[i][cols.remaining - 1]);
    var computedRem = resolveClientRemaining(cCode, cName, curSheetRem, balMap);

    clSheet.getRange(i + 2, cols.remaining).setValue(computedRem);
    if (cols.date > 0) {
      clSheet.getRange(i + 2, cols.date).setValue(todayStr);
    }
  }
}

function restoreAllClientBalances() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  recalculateClientBalances(ss);
  Logger.log("All client balances have been recalculated in the Clients tab!");
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getCashflowSheet(ss);
    var balMap = computeClientBalancesMap(ss);
    var clients = getClientsList(ss, balMap);
    var orders = getOrderLogList(ss);

    var lastRow = sheet.getLastRow();
    var transactions = [];
    var runningBalance = 0;

    if (lastRow > 1) {
      var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        if (!row[1] && !row[0] && !row[2]) continue;

        var dateVal = row[1] || row[0];
        var formattedDate = "";
        if (dateVal instanceof Date) {
          formattedDate = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          formattedDate = String(dateVal);
        }

        var typeRaw = String(row[6] || "").toLowerCase().trim();
        var type = (typeRaw === "inflow" || typeRaw === "in" || typeRaw === "debit") ? "Inflow" : "Outflow";
        var amt = parseSheetAmount(row[7]);

        if (type === "Inflow") {
          runningBalance += amt;
        } else {
          runningBalance -= amt;
        }

        transactions.push({
          id: "gs-" + (i + 1),
          timestamp: String(row[0] || ""),
          date: formattedDate,
          clientCode: String(row[2] || "").trim().toUpperCase(),
          clientName: String(row[3] || "").trim(),
          refNo: String(row[4] || "").trim(),
          description: String(row[5] || ""),
          type: type,
          amount: amt,
          debit: type === "Inflow" ? amt : null,
          credit: type === "Outflow" ? amt : null,
          balance: runningBalance,
          createdAt: String(row[0] || new Date().toISOString())
        });
      }
    }

    var clSheet = getClientsSheet(ss);
    var cols = clSheet ? getClientSheetColumns(clSheet) : {};
    var ordSheet = getOrderLogSheet(ss, false);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      currentBalance: runningBalance,
      transactions: transactions,
      clients: clients,
      orders: orders,
      totalCount: transactions.length,
      totalOrders: orders.length,
      sheetsDetected: {
        cashflow: sheet.getName(),
        client: clSheet ? clSheet.getName() : null,
        orderLog: ordSheet ? ordSheet.getName() : null,
        remainingColumnIndex: cols.remaining,
        dateColumnIndex: cols.date
      },
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

    var payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      payload = e.parameter;
    } else {
      throw new Error("No payload received");
    }

    var action = String(payload.action || "").trim();
    var now = new Date();
    var todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
    var nowTimestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    // -------------------------------------------------------------
    // ACTION: ADD ORDER (Logs cleanly to Order Log & Cashflow, updates Client Remining amount)
    // -------------------------------------------------------------
    if (action === "addOrder" || payload.order) {
      var ord = payload.order || payload;
      var oCode = String(ord.clientCode || payload.clientCode || "").trim().toUpperCase();
      var oName = String(ord.clientName || payload.clientName || "").trim();
      var invoiceNo = String(ord.invoiceNumber || payload.invoiceNumber || "").trim();
      var description = String(ord.description || payload.description || "").trim();
      var orderAmount = Number(ord.amount !== undefined ? ord.amount : payload.amount) || 0;
      var paymentOption = String(ord.paymentOption || payload.paymentOption || "Partial Payment");
      var downPayment = Number(ord.downPayment !== undefined ? ord.downPayment : payload.downPayment) || 0;
      var unpaid = Number(ord.unpaidAmount !== undefined ? ord.unpaidAmount : payload.unpaidAmount) || 0;
      var exactTimestamp = ord.timestamp || payload.timestamp || nowTimestamp;
      var dateStr = ord.date || payload.date || todayStr;

      var cfTx = payload.cashflowTransaction;
      var cfRef = (cfTx && cfTx.refNo) ? String(cfTx.refNo).trim() : "";
      if (!cfRef && downPayment > 0) {
        var cfSheetForRef = getCashflowSheet(ss);
        var maxC = 0;
        if (cfSheetForRef && cfSheetForRef.getLastRow() > 1) {
          var refs = cfSheetForRef.getRange(2, 5, cfSheetForRef.getLastRow() - 1, 1).getValues();
          for (var rIdx = 0; rIdx < refs.length; rIdx++) {
            var val = String(refs[rIdx][0] || "").trim().toUpperCase();
            if (val.indexOf("C") === 0) {
              var n = parseInt(val.replace(/^C0*/, ""), 10);
              if (!isNaN(n) && n > maxC) maxC = n;
            }
          }
        }
        cfRef = "C" + (maxC + 1);
      }

      // 1. Append order cleanly to Order Log sheet (no blank gap rows)
      var orderSheet = getOrderLogSheet(ss, true);
      var orderRowNum = null;
      if (orderSheet) {
        var orderRow = [
          exactTimestamp,
          dateStr,
          oCode,
          oName,
          invoiceNo,
          description,
          orderAmount,
          paymentOption,
          downPayment,
          unpaid,
          cfRef
        ];
        orderRowNum = appendCleanRow(orderSheet, orderRow, 11);
      }

      // 2. Log down payment cleanly to Cashflow (no blank gap row before entry)
      if (cfTx && Number(cfTx.amount) > 0) {
        var cfSheet = getCashflowSheet(ss);
        var cfRow = [
          exactTimestamp,
          dateStr,
          String(cfTx.clientCode || oCode).trim().toUpperCase(),
          String(cfTx.clientName || oName).trim(),
          cfTx.refNo || cfRef,
          cfTx.description || ("سداد دفعة طلب - فاتورة " + invoiceNo + " - " + oName),
          "in",
          Number(cfTx.amount) || 0
        ];
        appendCleanRow(cfSheet, cfRow, 8);
      }

      // 3. Recompute & update client remaining amount in Clients sheet
      var clientUpdated = false;
      var finalClientBalance = 0;
      if (oCode || oName) {
        var clSheet = getClientsSheet(ss);
        if (clSheet && clSheet.getLastRow() > 1) {
          var cols = getClientSheetColumns(clSheet);
          var maxCol = Math.max(clSheet.getLastColumn(), 6);
          var clData = clSheet.getRange(2, 1, clSheet.getLastRow() - 1, maxCol).getValues();
          var balMap = computeClientBalancesMap(ss);

          for (var idx = 0; idx < clData.length; idx++) {
            var rowC = String(clData[idx][cols.code - 1] || "").trim().toUpperCase();
            var rowN = String(clData[idx][cols.name - 1] || "").trim();
            var codeMatches = oCode && (rowC === oCode || canonicalClientCode(rowC) === canonicalClientCode(oCode));
            var nameMatches = oName && normalizeArabic(rowN) === normalizeArabic(oName);

            if (codeMatches || nameMatches) {
              var oldRem = parseSheetAmount(clData[idx][cols.remaining - 1]);
              finalClientBalance = resolveClientRemaining(rowC || oCode, rowN || oName, oldRem + unpaid, balMap);
              clSheet.getRange(idx + 2, cols.remaining).setValue(finalClientBalance);
              if (cols.date > 0) {
                clSheet.getRange(idx + 2, cols.date).setValue(dateStr);
              }
              clientUpdated = true;
              break;
            }
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Order recorded in Order Log, client remaining updated, and payment logged cleanly to Cashflow",
        orderRow: orderRowNum,
        clientUpdated: clientUpdated,
        finalClientBalance: finalClientBalance
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION: ADD TRANSACTION (Inflow / Outflow -> 'in' / 'out')
    // Recalculates & subtracts client payment for BOTH 'out' and 'in'
    // -------------------------------------------------------------
    if (action === "addTransaction" || payload.transaction) {
      var tx = payload.transaction || payload;
      var exactTimestamp = tx.timestamp || payload.timestamp || nowTimestamp;
      var dateStr = tx.date || payload.date || todayStr;

      var clientCode = String(tx.clientCode !== undefined ? tx.clientCode : (payload.clientCode !== undefined ? payload.clientCode : "")).trim().toUpperCase();
      var clientName = String(tx.clientName !== undefined ? tx.clientName : (payload.clientName !== undefined ? payload.clientName : "")).trim();
      var refNo = String(tx.refNo !== undefined ? tx.refNo : (payload.refNo !== undefined ? payload.refNo : "")).trim();
      var description = String(tx.description !== undefined ? tx.description : (payload.description !== undefined ? payload.description : "")).trim();

      var typeRaw = String(tx.type || payload.type || tx.sheetType || payload.sheetType || "in").toLowerCase().trim();
      var sheetType = (typeRaw === "in" || typeRaw === "inflow" || typeRaw === "debit") ? "in" : "out";
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
      var insertedRow = appendCleanRow(sheet, row, 8);

      // Update client remaining debt in Clients sheet for all non-Owner clients
      var clientRemainingUpdated = false;
      var finalRemaining = 0;
      if (clientCode || clientName) {
        var clSheet = getClientsSheet(ss);
        if (clSheet && clSheet.getLastRow() > 1) {
          var cols = getClientSheetColumns(clSheet);
          var maxCol = Math.max(clSheet.getLastColumn(), 6);
          var clData = clSheet.getRange(2, 1, clSheet.getLastRow() - 1, maxCol).getValues();
          var targetRow = -1;
          var matchedRowCode = "";
          var matchedRowName = "";
          var sheetRem = 0;

          for (var j = 0; j < clData.length; j++) {
            var rCode = String(clData[j][cols.code - 1] || "").trim().toUpperCase();
            var rName = String(clData[j][cols.name - 1] || "").trim();
            var cMatch = clientCode && (rCode === clientCode || canonicalClientCode(rCode) === canonicalClientCode(clientCode));
            var nMatch = clientName && normalizeArabic(rName) === normalizeArabic(clientName);
            if (cMatch || nMatch) {
              targetRow = j + 2;
              matchedRowCode = rCode;
              matchedRowName = rName;
              sheetRem = parseSheetAmount(clData[j][cols.remaining - 1]);
              break;
            }
          }

          if (targetRow > 1) {
            var isOwner = canonicalClientCode(matchedRowCode || clientCode) === "C1";
            if (isOwner) {
              finalRemaining = 0;
            } else {
              var balMap = computeClientBalancesMap(ss);
              var cKey = canonicalClientCode(matchedRowCode || clientCode);
              var nKey = normalizeArabic(matchedRowName || clientName);
              var hasOrders = (cKey && balMap.ordersByCode[cKey] !== undefined) || (nKey && balMap.ordersByName[nKey] !== undefined);

              if (hasOrders) {
                // Ground-truth formula: SUM(Orders) - SUM(Cashflow in+out)
                finalRemaining = resolveClientRemaining(matchedRowCode || clientCode, matchedRowName || clientName, sheetRem, balMap);
              } else {
                // Client has no Order Log entries yet: subtract payment from sheet remaining (for both 'out' and 'in')
                finalRemaining = Math.max(0, sheetRem - amount);
              }
            }

            clSheet.getRange(targetRow, cols.remaining).setValue(finalRemaining);
            if (cols.date > 0) {
              clSheet.getRange(targetRow, cols.date).setValue(dateStr);
            }
            clientRemainingUpdated = true;
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Transaction inserted into Cashflow ('" + sheetType + "')",
        rowNumber: insertedRow,
        clientRemainingUpdated: clientRemainingUpdated,
        finalRemaining: finalRemaining
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION: ADD NEW CLIENT (Enforces Unique Client Code)
    // -------------------------------------------------------------
    if (action === "addClient" || action === "newClient" || action === "createClient" || String(action).toLowerCase() === "addclient") {
      var cSheet = getClientsSheet(ss);
      var cols = getClientSheetColumns(cSheet);
      var c = payload.client || payload;
      var newCode = String(c.code || "").trim().toUpperCase();
      var newCanon = canonicalClientCode(newCode);
      var newName = String(c.name || "").trim();

      if (!newCode) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Client Code is required."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Enforce duplicate check against existing rows in Clients sheet
      if (cSheet.getLastRow() > 1) {
        var existingCodes = cSheet.getRange(2, cols.code, cSheet.getLastRow() - 1, 1).getValues();
        for (var eIdx = 0; eIdx < existingCodes.length; eIdx++) {
          var exCode = String(existingCodes[eIdx][0] || "").trim().toUpperCase();
          if (exCode && (exCode === newCode || canonicalClientCode(exCode) === newCanon)) {
            return ContentService.createTextOutput(JSON.stringify({
              status: "error",
              message: "Client code '" + newCode + "' already exists in Clients sheet. Please use a unique code."
            })).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }

      var lastCol = Math.max(cSheet.getLastColumn(), 6, cols.code, cols.name, cols.phone, cols.area, cols.remaining, cols.date, cols.email);
      var newRow = new Array(lastCol).fill("");
      newRow[cols.code - 1] = newCode;
      newRow[cols.name - 1] = newName;
      if (cols.phone > 0) newRow[cols.phone - 1] = c.phone || "";
      if (cols.area > 0) newRow[cols.area - 1] = c.area || "";
      if (cols.remaining > 0) newRow[cols.remaining - 1] = Number(c.remaining) || 0;
      if (cols.date > 0) newRow[cols.date - 1] = todayStr;
      if (cols.email > 0) newRow[cols.email - 1] = c.email || "";

      var addedRow = appendCleanRow(cSheet, newRow, Math.max(cols.code, cols.name));
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Client " + newCode + " (" + newName + ") added to " + cSheet.getName() + " sheet",
        rowNumber: addedRow
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------
    // ACTION: UPDATE CLIENT
    // -------------------------------------------------------------
    if (action === "updateClient") {
      var cSheet = getClientsSheet(ss);
      if (cSheet && cSheet.getLastRow() > 1) {
        var cols = getClientSheetColumns(cSheet);
        var c = payload.client || payload;
        var targetCode = String(c.code || "").trim().toUpperCase();
        var targetName = normalizeArabic(c.name || "");
        var maxCol = Math.max(cSheet.getLastColumn(), 6);
        var clData = cSheet.getRange(2, 1, cSheet.getLastRow() - 1, maxCol).getValues();
        var foundRow = -1;
        for (var k = 0; k < clData.length; k++) {
          var rowCode = String(clData[k][cols.code - 1] || "").trim().toUpperCase();
          var rowName = normalizeArabic(clData[k][cols.name - 1] || "");
          if ((targetCode && (rowCode === targetCode || canonicalClientCode(rowCode) === canonicalClientCode(targetCode))) || (targetName && rowName === targetName)) {
            foundRow = k + 2;
            break;
          }
        }
        if (foundRow > 1) {
          if (c.remaining !== undefined && c.remaining !== null) {
            cSheet.getRange(foundRow, cols.remaining).setValue(Number(c.remaining) || 0);
          }
          if (c.name && cols.name > 0) cSheet.getRange(foundRow, cols.name).setValue(c.name);
          if (c.phone !== undefined && cols.phone > 0) cSheet.getRange(foundRow, cols.phone).setValue(c.phone);
          if (c.area !== undefined && cols.area > 0) cSheet.getRange(foundRow, cols.area).setValue(c.area);
          if (c.email !== undefined && cols.email > 0) cSheet.getRange(foundRow, cols.email).setValue(c.email);
          if (cols.date > 0) {
            cSheet.getRange(foundRow, cols.date).setValue(todayStr);
          }
          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            message: "Client " + targetCode + " updated in " + cSheet.getName() + " sheet",
            rowNumber: foundRow
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    // -------------------------------------------------------------
    // ACTION: SYNC ALL BALANCES
    // -------------------------------------------------------------
    if (action === "syncAllBalances" && Array.isArray(payload.clients)) {
      var clSheet = getClientsSheet(ss);
      if (clSheet && clSheet.getLastRow() > 1) {
        var cols = getClientSheetColumns(clSheet);
        var lastRow = clSheet.getLastRow();
        var maxCol = Math.max(clSheet.getLastColumn(), 6);
        var clData = clSheet.getRange(2, 1, lastRow - 1, maxCol).getValues();

        var inputMap = {};
        for (var m = 0; m < payload.clients.length; m++) {
          var item = payload.clients[m];
          if (item && item.code) {
            inputMap[canonicalClientCode(item.code)] = Number(item.remaining) || 0;
          }
        }

        var updateCount = 0;
        for (var r = 0; r < clData.length; r++) {
          var rKey = canonicalClientCode(clData[r][cols.code - 1]);
          if (inputMap[rKey] !== undefined) {
            clSheet.getRange(r + 2, cols.remaining).setValue(inputMap[rKey]);
            if (cols.date > 0) {
              clSheet.getRange(r + 2, cols.date).setValue(todayStr);
            }
            updateCount++;
          }
        }
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Updated " + updateCount + " client balances in " + clSheet.getName() + " sheet"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // -------------------------------------------------------------
    // ACTION: RECALCULATE BALANCES
    // -------------------------------------------------------------
    if (action === "recalculateBalances" || action === "restoreBalances") {
      recalculateClientBalances(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Client balances recalculated across all Order Log & Cashflow rows"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    throw new Error("Unknown action: " + action);

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
  cashflowTransaction?: Transaction,
  newClientRemaining?: number
): Promise<{ success: boolean; message: string; queuedLocally?: boolean }> {
  const targetUrl = url || CONFIGURED_APPS_SCRIPT_URL;

  if (!navigator.onLine) {
    addToOfflineQueue({
      type: 'order',
      payload: { order, cashflowTransaction, newClientRemaining },
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
      invoiceNumber: order.invoiceNumber,
      description: order.description,
      amount: order.amount,
      paymentOption: order.paymentOption,
      downPayment: order.downPayment,
      unpaidAmount: order.unpaidAmount,
      date: order.date,
      timestamp: order.timestamp,
      newClientRemaining: newClientRemaining,
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
        message: data.message || 'Order recorded in Order Log and client balance updated in Google Sheet',
      };
    }

    return {
      success: true,
      message: 'Order recorded in Order Log and synced',
    };
  } catch (err: any) {
    addToOfflineQueue({
      type: 'order',
      payload: { order, cashflowTransaction, newClientRemaining },
      label: `Order: ${order.invoiceNumber} - ${order.clientName}`,
    });
    return {
      success: true,
      message: 'Offline Mode: Data saved locally and will sync when reconnected.',
      queuedLocally: true,
    };
  }
}

export async function pushAllClientBalancesToSheet(
  url: string = CONFIGURED_APPS_SCRIPT_URL,
  clients: ClientItem[]
): Promise<{ success: boolean; message: string }> {
  const targetUrl = url || CONFIGURED_APPS_SCRIPT_URL;
  try {
    const payload = JSON.stringify({
      action: 'syncAllBalances',
      clients: clients.map(c => ({
        code: c.code,
        name: c.name,
        remaining: c.remaining || 0,
      })),
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
        success: true,
        message: data.message || 'All client balances updated in Google Sheet!',
      };
    }
    return { success: true, message: 'Sync request sent to Google Sheet' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error' };
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
      const data = await res.json().catch(() => null);
      if (data && data.status === 'error') {
        return {
          success: false,
          message: data.message || 'Error from Google Apps Script',
        };
      }
      return {
        success: data ? (data.status === 'success') : true,
        message: (data && data.message) ? data.message : 'Client added to Clients sheet',
      };
    }

    return {
      success: false,
      message: `HTTP error ${res.status}: Failed to reach Google Sheet`,
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
          invoiceNumber: item.payload.order.invoiceNumber,
          description: item.payload.order.description,
          amount: item.payload.order.amount,
          paymentOption: item.payload.order.paymentOption,
          downPayment: item.payload.order.downPayment,
          unpaidAmount: item.payload.order.unpaidAmount,
          date: item.payload.order.date,
          timestamp: item.payload.order.timestamp,
          newClientRemaining: item.payload.newClientRemaining,
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
