import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export const COMPANY_NAME_AR = 'شركة أستاذ بيرام';
export const COMPANY_NAME_EN = 'Ostath Biram Company';

export interface PDFExportOptions {
  filename: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Returns formatted standard filename: [Report_Name]_[YYYY-MM-DD].pdf
 * e.g. All_Transactions_2026-11-09.pdf
 */
function getLocalTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatPdfFilename(reportName: string, dateStr?: string): string {
  const cleanName = reportName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '');
  const date = dateStr || getLocalTodayStr();
  return `${cleanName}_${date}.pdf`;
}

interface PageSlice {
  startY: number;
  endY: number;
  needsRepeatedThead: boolean;
}

/**
 * Creates a cloned, compact print stylesheet scoped to `.pdf-print-clone-root`.
 */
function buildPrintStyleElement(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = `
    .pdf-print-clone-root,
    .pdf-print-clone-root * {
      letter-spacing: normal !important;
      box-sizing: border-box !important;
    }

    .pdf-print-clone-root {
      background-color: #ffffff !important;
      color: #0f172a !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    .pdf-print-clone-root svg {
      display: none !important;
    }

    .pdf-print-clone-root .overflow-x-auto,
    .pdf-print-clone-root .overflow-hidden {
      overflow: visible !important;
    }

    .pdf-print-clone-root [class*="min-w-"] {
      min-width: 0 !important;
    }

    .pdf-print-clone-root .pdf-report-header {
      padding-bottom: 6px !important;
      margin-bottom: 8px !important;
      border-bottom: 1px solid #cbd5e1 !important;
    }

    .pdf-print-clone-root .pdf-summary-grid,
    .pdf-print-clone-root .grid {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 8px !important;
      margin-top: 6px !important;
      margin-bottom: 8px !important;
    }

    .pdf-print-clone-root .pdf-summary-grid > div,
    .pdf-print-clone-root .grid > div {
      padding: 6px 10px !important;
      border-radius: 8px !important;
    }

    .pdf-print-clone-root .pdf-summary-grid p,
    .pdf-print-clone-root .grid p {
      font-size: 14px !important;
      line-height: 1.25 !important;
      margin-top: 2px !important;
    }

    .pdf-print-clone-root h1,
    .pdf-print-clone-root h2,
    .pdf-print-clone-root h3 {
      font-size: 15px !important;
      line-height: 1.3 !important;
    }

    .pdf-print-clone-root table,
    table.pdf-repeated-thead-table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 11px !important;
      line-height: 1.3 !important;
      margin: 0 !important;
    }

    .pdf-print-clone-root table th,
    .pdf-print-clone-root table td,
    table.pdf-repeated-thead-table th {
      padding: 3px 8px !important;
      line-height: 1.3 !important;
      font-size: 11px !important;
      white-space: normal !important;
      word-break: break-word !important;
      overflow: visible !important;
      text-overflow: clip !important;
      vertical-align: middle !important;
    }

    .pdf-print-clone-root table thead th,
    table.pdf-repeated-thead-table thead th {
      background-color: #284742 !important;
      color: #ffffff !important;
      border-color: rgba(255, 255, 255, 0.22) !important;
      font-weight: 700 !important;
      padding: 5px 8px !important;
      font-size: 10.5px !important;
      line-height: 1.3 !important;
    }

    .pdf-print-clone-root table thead tr,
    table.pdf-repeated-thead-table thead tr {
      background-color: #284742 !important;
      color: #ffffff !important;
      border-bottom: 1px solid #1e3632 !important;
    }

    .pdf-print-clone-root table tbody tr:nth-child(odd) {
      background-color: #ffffff !important;
    }

    .pdf-print-clone-root table tbody tr:nth-child(even) {
      background-color: #f8fafc !important;
    }

    .pdf-print-clone-root table td span {
      padding-top: 1px !important;
      padding-bottom: 1px !important;
    }

    .pdf-print-clone-root table tfoot tr {
      background-color: #e6f0ee !important;
      border-top: 2px solid #284742 !important;
      color: #0f172a !important;
      font-weight: 800 !important;
    }
  `;
  return style;
}

/**
 * Delivers the generated PDF blob via Web Share API on mobile when supported,
 * otherwise triggers an <a download> click (with a new-tab fallback on mobile).
 */
async function deliverPdfBlob(
  pdfBlob: Blob,
  filename: string,
  title?: string
): Promise<void> {
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  if (
    isMobile &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    try {
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
      if (
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        await navigator.share({
          files: [pdfFile],
          title: title || filename,
        });
        return;
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // Fall through to <a download>
    }
  }

  const blobUrl = URL.createObjectURL(pdfBlob);
  const downloadLink = document.createElement('a');
  downloadLink.href = blobUrl;
  downloadLink.download = filename;
  downloadLink.rel = 'noopener';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  if (isMobile) {
    try {
      const tabLink = document.createElement('a');
      tabLink.href = blobUrl;
      tabLink.target = '_blank';
      tabLink.rel = 'noopener noreferrer';
      document.body.appendChild(tabLink);
      tabLink.click();
      document.body.removeChild(tabLink);
    } catch {
      // ignore fallback errors
    }
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/**
 * Non-blocking, asynchronous PDF export using html2canvas-pro and jsPDF.
 * - Clones target element into an off-screen container with fixed desktop width.
 * - Applies compact print styling only inside the clone (table 11px, 3px 8px padding, normal letter-spacing).
 * - Paginates strictly on table-row boundaries and repeats table headers on every page.
 * - Captures page by page using a clipped window div (no html2canvas x/y crop options).
 */
export async function exportElementToPDF(
  element: HTMLElement,
  options: PDFExportOptions
): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 60));

  let finalFilename = options.filename;
  if (!finalFilename.toLowerCase().endsWith('.pdf')) {
    finalFilename = `${finalFilename}.pdf`;
  }

  const orientation = options.orientation || 'portrait';
  const fixedWidthPx = orientation === 'landscape' ? 1120 : 780;
  const marginMm = 8;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const usableWidthMm = pageWidthMm - marginMm * 2;
  const usableHeightMm = pageHeightMm - marginMm * 2;

  const pageCssHeight = Math.floor(
    fixedWidthPx * (usableHeightMm / usableWidthMm)
  );
  const footerHeightPx = 30;
  const maxBodyHeightPx = pageCssHeight - footerHeightPx;

  // Off-screen fixed-width sandbox
  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '-12000px';
  sandbox.style.top = '0';
  sandbox.style.width = `${fixedWidthPx}px`;
  sandbox.style.backgroundColor = '#ffffff';
  sandbox.style.pointerEvents = 'none';
  sandbox.style.zIndex = '-1';

  const styleEl = buildPrintStyleElement();
  sandbox.appendChild(styleEl);

  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.add('pdf-print-clone-root');
  clone.style.width = `${fixedWidthPx}px`;
  clone.style.maxWidth = `${fixedWidthPx}px`;

  // Remove ignored elements and static footers (replaced by unified per-page footer)
  clone
    .querySelectorAll('[data-html2canvas-ignore], [data-pdf-static-footer="true"]')
    .forEach(node => node.remove());

  // Ensure a clean company header with date exists if report lacks one
  if (!clone.querySelector('.pdf-company-header')) {
    const fallbackHeader = document.createElement('div');
    fallbackHeader.className = 'pdf-company-header pdf-report-header';
    fallbackHeader.setAttribute('dir', 'rtl');
    fallbackHeader.style.display = 'flex';
    fallbackHeader.style.alignItems = 'center';
    fallbackHeader.style.justifyContent = 'space-between';
    fallbackHeader.style.fontSize = '11px';
    fallbackHeader.style.color = '#334155';
    fallbackHeader.innerHTML = `
      <div style="font-weight:800;color:#284742;font-size:13px;">${COMPANY_NAME_AR} &bull; ${COMPANY_NAME_EN}</div>
      <div style="font-family:monospace;color:#64748b;">${getLocalTodayStr()}</div>
    `;
    clone.insertBefore(fallbackHeader, clone.firstChild);
  }

  sandbox.appendChild(clone);
  document.body.appendChild(sandbox);

  try {
    // Allow layout & fonts to settle
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

    // Find primary table & lock column widths FIRST before measuring height & row bands,
    // because switching to table-layout: fixed can reflow wrapped text and increase total height.
    const primaryTable = clone.querySelector('table') as HTMLTableElement | null;
    const thead = primaryTable?.querySelector('thead') as HTMLTableSectionElement | null;
    let theadColumnWidths: number[] = [];

    if (primaryTable && thead) {
      const initialTableRect = primaryTable.getBoundingClientRect();
      const thList = Array.from(thead.querySelectorAll('th'));
      theadColumnWidths = thList.map(th => th.getBoundingClientRect().width);

      // Lock column widths on table & th elements before measuring final heights
      primaryTable.style.tableLayout = 'fixed';
      primaryTable.style.width = `${Math.round(initialTableRect.width)}px`;
      thList.forEach((th, idx) => {
        const w = theadColumnWidths[idx];
        if (w > 0) {
          th.style.width = `${w}px`;
        }
      });

      // Force reflow and wait one animation frame so row heights & clone.scrollHeight reflect fixed layout
      void clone.offsetHeight;
      await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
    }

    const cloneRect = clone.getBoundingClientRect();
    let totalContentHeight = Math.max(
      Math.ceil(clone.scrollHeight),
      Math.ceil(cloneRect.height)
    );

    let theadTop = 0;
    let theadBottom = 0;
    let theadHeight = 0;
    let tableBottom = totalContentHeight;

    interface RowBand {
      top: number;
      bottom: number;
    }
    const rowBands: RowBand[] = [];

    if (primaryTable) {
      const tableRect = primaryTable.getBoundingClientRect();
      tableBottom = Math.ceil(tableRect.bottom - cloneRect.top);
      totalContentHeight = Math.max(totalContentHeight, tableBottom);

      if (thead) {
        const thList = Array.from(thead.querySelectorAll('th'));
        theadColumnWidths = thList.map(th => th.getBoundingClientRect().width);
        const theadRect = thead.getBoundingClientRect();
        theadTop = Math.floor(theadRect.top - cloneRect.top);
        theadBottom = Math.ceil(theadRect.bottom - cloneRect.top);
        theadHeight = Math.max(0, theadBottom - theadTop);
      }

      const allRows = Array.from(
        primaryTable.querySelectorAll('tbody tr, tfoot tr')
      );
      for (const tr of allRows) {
        const r = tr.getBoundingClientRect();
        const bandTop = Math.floor(r.top - cloneRect.top);
        const bandBottom = Math.ceil(r.bottom - cloneRect.top);
        rowBands.push({ top: bandTop, bottom: bandBottom });
        if (bandBottom > totalContentHeight) {
          totalContentHeight = bandBottom;
        }
      }
    }

    // Build page slices strictly on row boundaries
    const slices: PageSlice[] = [];
    let startY = 0;

    while (startY < totalContentHeight - 2) {
      const needsRepeatedThead = Boolean(
        primaryTable &&
          thead &&
          theadHeight > 0 &&
          startY >= theadBottom - 1 &&
          startY < tableBottom - 2
      );

      const budget = needsRepeatedThead
        ? Math.max(120, maxBodyHeightPx - theadHeight)
        : maxBodyHeightPx;

      let endY = Math.min(totalContentHeight, startY + budget);

      if (endY < totalContentHeight) {
        // Never slice through thead
        if (thead && theadTop < endY && theadBottom > endY && theadTop > startY + 10) {
          endY = theadTop;
        } else {
          // Never slice through any tbody/tfoot row
          for (const band of rowBands) {
            if (band.top < endY && band.bottom > endY) {
              if (band.top > startY + 10) {
                endY = band.top;
              }
              break;
            }
          }
        }
      }

      // Guard against non-advancing loop on unusually tall single elements
      if (endY <= startY) {
        endY = Math.min(totalContentHeight, startY + budget);
      }

      // Absorb negligible trailing 1-3px slivers onto current page
      if (totalContentHeight - endY <= 3) {
        endY = totalContentHeight;
      }

      slices.push({ startY, endY, needsRepeatedThead });
      startY = endY;
    }

    if (slices.length === 0) {
      slices.push({
        startY: 0,
        endY: Math.max(1, totalContentHeight),
        needsRepeatedThead: false,
      });
    }

    const totalPages = slices.length;
    const todayStr = getLocalTodayStr();

    for (let i = 0; i < totalPages; i++) {
      const slice = slices[i];
      const windowHeight = Math.max(1, Math.ceil(slice.endY - slice.startY));

      // Page composition container inside sandbox
      const pageHost = document.createElement('div');
      pageHost.style.width = `${fixedWidthPx}px`;
      pageHost.style.minHeight = `${pageCssHeight}px`;
      pageHost.style.backgroundColor = '#ffffff';
      pageHost.style.display = 'flex';
      pageHost.style.flexDirection = 'column';
      pageHost.style.justifyContent = 'space-between';
      pageHost.style.letterSpacing = 'normal';

      const bodyGroup = document.createElement('div');
      bodyGroup.style.width = `${fixedWidthPx}px`;
      bodyGroup.style.backgroundColor = '#ffffff';

      // Repeated table header on continuation pages
      if (slice.needsRepeatedThead && primaryTable && thead) {
        const tableWrapper = document.createElement('div');
        tableWrapper.style.width = `${fixedWidthPx}px`;
        const tableRect = primaryTable.getBoundingClientRect();
        const leftOffset = Math.max(0, tableRect.left - cloneRect.left);
        if (leftOffset > 0) {
          tableWrapper.style.paddingLeft = `${leftOffset}px`;
          tableWrapper.style.paddingRight = `${leftOffset}px`;
        }

        const headerTable = document.createElement('table');
        headerTable.className = 'pdf-repeated-thead-table';
        if (primaryTable.getAttribute('dir')) {
          headerTable.setAttribute('dir', primaryTable.getAttribute('dir')!);
        } else if (clone.getAttribute('dir')) {
          headerTable.setAttribute('dir', clone.getAttribute('dir')!);
        }
        headerTable.style.tableLayout = 'fixed';
        headerTable.style.width = `${Math.round(tableRect.width)}px`;

        const clonedThead = thead.cloneNode(true) as HTMLTableSectionElement;
        const clonedThs = Array.from(clonedThead.querySelectorAll('th'));
        clonedThs.forEach((th, idx) => {
          const w = theadColumnWidths[idx];
          if (w > 0) {
            th.style.width = `${w}px`;
          }
        });

        headerTable.appendChild(clonedThead);
        tableWrapper.appendChild(headerTable);
        bodyGroup.appendChild(tableWrapper);
      }

      // Clipped window viewport shifting `clone` upward without margin-collapsing drift
      const viewport = document.createElement('div');
      viewport.style.width = `${fixedWidthPx}px`;
      viewport.style.height = `${windowHeight}px`;
      viewport.style.overflow = 'hidden';
      viewport.style.position = 'relative';
      viewport.style.backgroundColor = '#ffffff';

      clone.style.position = 'absolute';
      clone.style.top = `${-slice.startY}px`;
      clone.style.left = '0';
      clone.style.marginTop = '0';
      viewport.appendChild(clone);
      bodyGroup.appendChild(viewport);
      pageHost.appendChild(bodyGroup);

      // Clean professional footer with company name & Page X / Y
      const footerEl = document.createElement('div');
      footerEl.style.width = `${fixedWidthPx}px`;
      footerEl.style.height = `${footerHeightPx}px`;
      footerEl.style.borderTop = '1px solid #cbd5e1';
      footerEl.style.paddingTop = '6px';
      footerEl.style.display = 'flex';
      footerEl.style.alignItems = 'center';
      footerEl.style.justifyContent = 'space-between';
      footerEl.style.fontSize = '10px';
      footerEl.style.color = '#64748b';
      footerEl.style.letterSpacing = 'normal';
      footerEl.innerHTML = `
        <span dir="rtl" style="font-weight:700;color:#284742;letter-spacing:normal;">${COMPANY_NAME_AR} &bull; ${COMPANY_NAME_EN}</span>
        <span style="font-family:monospace;letter-spacing:normal;">${todayStr} &nbsp;|&nbsp; Page ${i + 1} / ${totalPages}</span>
      `;
      pageHost.appendChild(footerEl);

      sandbox.appendChild(pageHost);

      const pageCanvas = await html2canvas(pageHost, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: fixedWidthPx,
        windowWidth: fixedWidthPx,
        scrollX: 0,
        scrollY: 0,
      });

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.9);
      const renderedHeightMm =
        (pageCanvas.height * usableWidthMm) / pageCanvas.width;

      if (i > 0) {
        pdf.addPage('a4', orientation);
      }

      pdf.addImage(
        imgData,
        'JPEG',
        marginMm,
        marginMm,
        usableWidthMm,
        Math.min(usableHeightMm, renderedHeightMm),
        undefined,
        'FAST'
      );

      // Re-attach clone cleanly to sandbox before removing temporary pageHost
      clone.style.position = 'static';
      clone.style.top = '';
      clone.style.left = '';
      clone.style.marginTop = '0';
      sandbox.appendChild(clone);
      pageHost.remove();
    }

    const pdfBlob = pdf.output('blob');
    await deliverPdfBlob(pdfBlob, finalFilename, options.title);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    if (sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox);
    }
  }
}

/**
 * Triggers direct browser printing for an element.
 */
export function printElementDirectly(
  _element: HTMLElement,
  title?: string
): void {
  if (typeof window === 'undefined') return;
  const originalTitle = document.title;
  if (title) {
    document.title = title;
  }
  try {
    window.print();
  } catch (error) {
    console.error('Error printing element directly:', error);
  } finally {
    if (title) {
      document.title = originalTitle;
    }
  }
}
