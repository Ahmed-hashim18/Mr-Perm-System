import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export const COMPANY_NAME_AR = 'شركة أستاذ يبرم';
export const COMPANY_NAME_EN = 'Ostath Yabrom Company';

export interface PDFExportOptions {
  filename: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Returns formatted standard filename: [Report_Name]_[YYYY-MM-DD].pdf
 * e.g. All_Transactions_2026-11-09.pdf
 */
export function formatPdfFilename(reportName: string, dateStr?: string): string {
  const cleanName = reportName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '');
  const date = dateStr || new Date().toISOString().split('T')[0];
  return `${cleanName}_${date}.pdf`;
}

/**
 * Non-blocking, asynchronous PDF export using html2canvas-pro and jsPDF.
 * - Supports modern Tailwind CSS colors (oklch, rgb, hsl, hex).
 * - Yields control to the main UI thread first so React can show loading spinners without freezing.
 * - Preserves Arabic typography, RTL direction, exact colors, and table layout.
 * - Handles multi-page splitting cleanly with standard A4 margins.
 */
export async function exportElementToPDF(
  element: HTMLElement,
  options: PDFExportOptions
): Promise<void> {
  // Yield to UI thread first so any pending render (e.g. spinner) updates immediately
  await new Promise(resolve => setTimeout(resolve, 80));

  let finalFilename = options.filename;
  if (!finalFilename.toLowerCase().endsWith('.pdf')) {
    finalFilename = `${finalFilename}.pdf`;
  }

  const orientation = options.orientation || 'portrait';

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
    });

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // 8mm margin on all sides
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    if (imgHeight <= usableHeight) {
      // Fits on a single page
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', margin, margin, usableWidth, imgHeight);
    } else {
      // Split across multiple pages
      const pageCanvasHeight = (usableHeight * canvas.width) / usableWidth;
      let currentY = 0;
      let pageIndex = 0;

      while (currentY < canvas.height) {
        const sliceHeight = Math.min(pageCanvasHeight, canvas.height - currentY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            currentY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight
          );
        }

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.98);
        const slicePdfHeight = (sliceHeight * usableWidth) / canvas.width;

        if (pageIndex > 0) {
          pdf.addPage('a4', orientation);
        }

        pdf.addImage(pageImgData, 'JPEG', margin, margin, usableWidth, slicePdfHeight);
        currentY += sliceHeight;
        pageIndex++;
      }
    }

    pdf.save(finalFilename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

/**
 * Triggers direct browser printing for an element.
 */
export function printElementDirectly(element: HTMLElement, title?: string): void {
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
