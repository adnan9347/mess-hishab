import { loadScript, download } from '../core/util.js';

const HTML_TO_IMAGE = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';
const JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

/** Turns a settlement card into a shareable PNG, a PDF statement or a CSV file. */
export class StatementExporter {
  constructor(i18n) {
    this.i18n = i18n;
  }

  async toPngDataUrl(element) {
    await loadScript(HTML_TO_IMAGE);
    const bg = getComputedStyle(document.body).backgroundColor;
    // Cross-origin stylesheets (Google Fonts, CDN) can't be inlined; the page fonts are already loaded locally.
    return window.htmlToImage.toPng(element, { pixelRatio: 2, backgroundColor: bg, cacheBust: true, skipFonts: false });
  }

  async sharePng(element, filename, title) {
    const dataUrl = await this.toPngDataUrl(element);
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return 'shared';
      } catch (err) {
        if (err.name === 'AbortError') return 'cancelled';
      }
    }
    download(filename, blob);
    return 'downloaded';
  }

  /** Image-based PDF: Bangla text renders exactly as on screen, no font embedding needed. */
  async downloadPdf(element, filename) {
    const [dataUrl] = await Promise.all([this.toPngDataUrl(element), loadScript(JSPDF)]);
    const img = await loadImage(dataUrl);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 40;
    const w = Math.min(pageW - margin * 2, 420);
    const h = (img.height / img.width) * w;
    pdf.addImage(dataUrl, 'PNG', (pageW - w) / 2, margin, w, h);
    pdf.save(filename);
  }

  /**
   * CSV of one member's month: daily meals, then the summary.
   * Plain digits and a UTF-8 BOM so Excel and Google Sheets open it cleanly.
   */
  downloadCsv({ filename, meals, result, messName, memberName }) {
    const t = (k) => this.i18n.t(k);
    const rows = [
      [messName, memberName, result.monthId],
      [],
      [t('csv.date'), t('meal.breakfast'), t('meal.lunch'), t('meal.dinner'), t('today.guests'), t('common.meals')]
    ];
    for (const m of meals) {
      const count = (m.breakfast ? 1 : 0) + (m.lunch ? 1 : 0) + (m.dinner ? 1 : 0) + (m.guests || 0);
      rows.push([m.date, m.breakfast ? 1 : 0, m.lunch ? 1 : 0, m.dinner ? 1 : 0, m.guests || 0, count]);
    }
    rows.push([]);
    rows.push([t('hishab.meals'), result.meals]);
    rows.push([t('hishab.mealRate'), result.mealRate]);
    rows.push([t('hishab.mealCost'), result.mealCost]);
    rows.push([t('hishab.fixedShare'), result.fixedShare]);
    rows.push([t('hishab.paid'), result.paid]);
    rows.push([t('hishab.balance'), result.balance]);
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    download(filename, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  }

  downloadJson(filename, data) {
    download(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  }
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
