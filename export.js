// ============================================================
//  export.js  —  DOCX + Excel export funksiyaları
//  CDN: docx (browser build) + SheetJS (xlsx)
// ============================================================

// ─── KÖMƏKÇI: Tarix formatı ────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  return d;
}

// ─── KÖMƏKÇI: Məbləğ formatı ───────────────────────────────
function fmtNum(n) {
  if (n === undefined || n === null || n === "") return "0.00";
  return parseFloat(n).toFixed(2);
}

// ============================================================
//  MÜŞTƏRİ SİYAHISI — DOCX
// ============================================================
window.exportCustomersDocx = async function () {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, WidthType, BorderStyle, ShadingType, HeadingLevel,
    PageOrientation
  } = window.docx;

  const regionFilter = document.getElementById("exportRegionFilter")?.value || "";
  const brandFilter  = document.getElementById("exportBrandFilter")?.value  || "";

  let customers = [...(window._customers || [])];
  if (regionFilter) customers = customers.filter(c => c.region === regionFilter);

  // Markaya görə qruplaşdırma
  let grouped = {};
  if (brandFilter) {
    grouped[brandFilter] = customers;
  } else {
    // Son sifarişdəki markaya görə qruplaşdır
    customers.forEach(c => {
      const brand = c.lastBrand || "Digər";
      if (!grouped[brand]) grouped[brand] = [];
      grouped[brand].push(c);
    });
  }

  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "2E75B6" };
  const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

  // A4: 11906 DXA, 1" margin hər tərəfdən → content: 9026
  const TW = 9026;
  // Sütun genişlikləri: Müştəri(3200), Rayon(1200), Gəlir(1200), Ödənilən(1200), Qalıq(1226)
  const COLS = [3200, 1200, 1200, 1200, 1226];

  function headerCell(text) {
    return new TableCell({
      borders: headerBorders,
      width: { size: COLS[["Müştəri / Obyekt","Rayon","Gəlir (₼)","Ödənilən (₼)","Qalıq (₼)"].indexOf(text)], type: WidthType.DXA },
      shading: { fill: "2E75B6", type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18, font: "Arial" })]
      })]
    });
  }

  function dataCell(text, opts = {}) {
    return new TableCell({
      borders,
      width: { size: opts.colWidth || 1200, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        children: [new TextRun({
          text: String(text || "—"),
          size: 18,
          font: "Arial",
          bold: opts.bold || false,
          color: opts.color || "000000"
        })]
      })]
    });
  }

  const allChildren = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Müştəri Siyahısı", bold: true, size: 28, font: "Arial" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({
        text: `Tarix: ${new Date().toLocaleDateString("az-AZ")}${regionFilter ? " | Rayon: " + regionFilter : ""}`,
        size: 18, font: "Arial", color: "666666"
      })]
    })
  ];

  let grandGelir = 0, grandOdenilen = 0, grandQaliq = 0;

  for (const [brand, list] of Object.entries(grouped)) {
    if (list.length === 0) continue;

    // Marka başlığı
    allChildren.push(new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: brand, bold: true, size: 22, font: "Arial", color: "1F4E79" })]
    }));

    // Cədvəl başlığı
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        headerCell("Müştəri / Obyekt"),
        headerCell("Rayon"),
        headerCell("Gəlir (₼)"),
        headerCell("Ödənilən (₼)"),
        headerCell("Qalıq (₼)")
      ]
    });

    let subGelir = 0, subOdenilen = 0;

    const dataRows = list.map(c => {
      const gelir    = (c.totalSales || 0);
      const odenilen = (c.totalPaid  || 0);
      const qaliq    = gelir - odenilen;
      subGelir    += gelir;
      subOdenilen += odenilen;
      const isNegative = qaliq < 0;

      return new TableRow({
        children: [
          dataCell(`${c.name} ${c.surname || ""} ${c.business ? "(" + c.business + ")" : ""}`, { colWidth: COLS[0], bold: false }),
          dataCell(c.region || "—", { colWidth: COLS[1] }),
          dataCell(fmtNum(gelir), { colWidth: COLS[2], align: AlignmentType.RIGHT }),
          dataCell(fmtNum(odenilen), { colWidth: COLS[3], align: AlignmentType.RIGHT }),
          dataCell(fmtNum(qaliq), {
            colWidth: COLS[4],
            align: AlignmentType.RIGHT,
            bold: true,
            color: isNegative ? "C00000" : (qaliq === 0 ? "375623" : "C55A11")
          })
        ]
      });
    });

    const subQaliq = subGelir - subOdenilen;
    grandGelir    += subGelir;
    grandOdenilen += subOdenilen;
    grandQaliq    += subQaliq;

    // Alt cəm sətri
    const subtotalRow = new TableRow({
      children: [
        new TableCell({
          borders,
          width: { size: COLS[0], type: WidthType.DXA },
          shading: { fill: "E2EFDA", type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: `${brand} — CƏM`, bold: true, size: 18, font: "Arial" })] })]
        }),
        new TableCell({
          borders,
          width: { size: COLS[1], type: WidthType.DXA },
          shading: { fill: "E2EFDA", type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: "", size: 18, font: "Arial" })] })]
        }),
        new TableCell({
          borders,
          width: { size: COLS[2], type: WidthType.DXA },
          shading: { fill: "E2EFDA", type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtNum(subGelir), bold: true, size: 18, font: "Arial" })] })]
        }),
        new TableCell({
          borders,
          width: { size: COLS[3], type: WidthType.DXA },
          shading: { fill: "E2EFDA", type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtNum(subOdenilen), bold: true, size: 18, font: "Arial" })] })]
        }),
        new TableCell({
          borders,
          width: { size: COLS[4], type: WidthType.DXA },
          shading: { fill: "E2EFDA", type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtNum(subQaliq), bold: true, size: 18, font: "Arial", color: subQaliq < 0 ? "C00000" : "375623" })] })]
        })
      ]
    });

    allChildren.push(new Table({
      width: { size: TW, type: WidthType.DXA },
      columnWidths: COLS,
      rows: [headerRow, ...dataRows, subtotalRow]
    }));

    allChildren.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
  }

  // Ümumi cəm
  allChildren.push(new Paragraph({
    spacing: { before: 120, after: 80 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "2E75B6", space: 1 } },
    children: [new TextRun({ text: "", size: 18, font: "Arial" })]
  }));

  const grandCols = [3200, 1200, 1200, 1200, 1226];
  allChildren.push(new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: grandCols,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: headerBorders,
            width: { size: grandCols[0], type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "ÜMUMİ CƏM", bold: true, size: 20, font: "Arial", color: "FFFFFF" })] })]
          }),
          new TableCell({
            borders: headerBorders,
            width: { size: grandCols[1], type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            borders: headerBorders,
            width: { size: grandCols[2], type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtNum(grandGelir), bold: true, size: 20, font: "Arial", color: "FFFFFF" })] })]
          }),
          new TableCell({
            borders: headerBorders,
            width: { size: grandCols[3], type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtNum(grandOdenilen), bold: true, size: 20, font: "Arial", color: "FFFFFF" })] })]
          }),
          new TableCell({
            borders: headerBorders,
            width: { size: grandCols[4], type: WidthType.DXA },
            shading: { fill: "1F4E79", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtNum(grandQaliq), bold: true, size: 20, font: "Arial", color: grandQaliq < 0 ? "FF9999" : "90EE90" })] })]
          })
        ]
      })
    ]
  }));

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      children: allChildren
    }]
  });

  const blob = await Packer.toBlob(doc);
  _downloadBlob(blob, `mustari-siyahisi-${_todayStr()}.docx`);
};

// ============================================================
//  BORC HESABATI — DOCX
// ============================================================
window.exportDebtsDocx = async function () {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, WidthType, BorderStyle, ShadingType
  } = window.docx;

  const regionFilter = document.getElementById("exportRegionFilter")?.value || "";
  let customers = [...(window._customers || [])].filter(c => (c.debt || 0) > 0 || (c.deposit || 0) > 0);
  if (regionFilter) customers = customers.filter(c => c.region === regionFilter);
  customers.sort((a, b) => (b.debt || 0) - (a.debt || 0));

  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const hBorder = { style: BorderStyle.SINGLE, size: 1, color: "C00000" };
  const hBorders = { top: hBorder, bottom: hBorder, left: hBorder, right: hBorder };

  const TW = 9026;
  const COLS = [3200, 1200, 1200, 1200, 1300, 926];

  function hCell(text, colIdx) {
    return new TableCell({
      borders: hBorders,
      width: { size: COLS[colIdx], type: WidthType.DXA },
      shading: { fill: "C00000", type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18, font: "Arial" })]
      })]
    });
  }

  function dCell(text, colIdx, opts = {}) {
    return new TableCell({
      borders,
      width: { size: COLS[colIdx], type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        children: [new TextRun({ text: String(text ?? "—"), size: 18, font: "Arial", bold: opts.bold || false, color: opts.color || "000000" })]
      })]
    });
  }

  let totalDebt = 0, totalDeposit = 0;
  const dataRows = customers.map(c => {
    const debt    = c.debt    || 0;
    const deposit = c.deposit || 0;
    const balance = deposit - debt;
    totalDebt    += debt;
    totalDeposit += deposit;
    return new TableRow({
      children: [
        dCell(`${c.name} ${c.surname || ""} ${c.business ? "(" + c.business + ")" : ""}`, 0),
        dCell(c.region || "—", 1),
        dCell(c.phone  || "—", 2),
        dCell(fmtNum(debt),    3, { align: AlignmentType.RIGHT, bold: true, color: debt > 0 ? "C00000" : "000000" }),
        dCell(fmtNum(deposit), 4, { align: AlignmentType.RIGHT, color: "375623" }),
        dCell(fmtNum(balance), 5, { align: AlignmentType.RIGHT, bold: true, color: balance < 0 ? "C00000" : "375623" })
      ]
    });
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: "Borc Hesabatı", bold: true, size: 28, font: "Arial" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [new TextRun({ text: `Tarix: ${new Date().toLocaleDateString("az-AZ")}${regionFilter ? " | Rayon: " + regionFilter : ""}`, size: 18, font: "Arial", color: "666666" })]
        }),
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: COLS,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                hCell("Müştəri / Obyekt", 0),
                hCell("Rayon", 1),
                hCell("Telefon", 2),
                hCell("Borc (₼)", 3),
                hCell("Depozit (₼)", 4),
                hCell("Balans (₼)", 5)
              ]
            }),
            ...dataRows,
            new TableRow({
              children: [
                new TableCell({
                  borders: hBorders, width: { size: COLS[0], type: WidthType.DXA },
                  shading: { fill: "FFE0E0", type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: "ÜMUMİ CƏM", bold: true, size: 18, font: "Arial" })] })]
                }),
                new TableCell({ borders, width: { size: COLS[1], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, shading: { fill: "FFE0E0", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "", size: 18, font: "Arial" })] })] }),
                new TableCell({ borders, width: { size: COLS[2], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, shading: { fill: "FFE0E0", type: ShadingType.CLEAR }, children: [new Paragraph({ children: [new TextRun({ text: "", size: 18, font: "Arial" })] })] }),
                new TableCell({
                  borders: hBorders, width: { size: COLS[3], type: WidthType.DXA },
                  shading: { fill: "FFE0E0", type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtNum(totalDebt), bold: true, size: 18, font: "Arial", color: "C00000" })] })]
                }),
                new TableCell({
                  borders: hBorders, width: { size: COLS[4], type: WidthType.DXA },
                  shading: { fill: "FFE0E0", type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtNum(totalDeposit), bold: true, size: 18, font: "Arial", color: "375623" })] })]
                }),
                new TableCell({
                  borders: hBorders, width: { size: COLS[5], type: WidthType.DXA },
                  shading: { fill: "FFE0E0", type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtNum(totalDeposit - totalDebt), bold: true, size: 18, font: "Arial", color: (totalDeposit - totalDebt) < 0 ? "C00000" : "375623" })] })]
                })
              ]
            })
          ]
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  _downloadBlob(blob, `borc-hesabati-${_todayStr()}.docx`);
};

// ============================================================
//  MÜŞTƏRİ SİYAHISI — EXCEL
// ============================================================
window.exportCustomersExcel = function () {
  const regionFilter = document.getElementById("exportRegionFilter")?.value || "";
  const brandFilter  = document.getElementById("exportBrandFilter")?.value  || "";

  let customers = [...(window._customers || [])];
  if (regionFilter) customers = customers.filter(c => c.region === regionFilter);
  if (brandFilter)  customers = customers.filter(c => (c.lastBrand || "Digər") === brandFilter);

  const wb = XLSX.utils.book_new();

  const rows = [
    ["Müştəri Adı", "Soyad", "Obyekt", "Rayon", "Telefon", "Marka", "Gəlir (₼)", "Ödənilən (₼)", "Qalıq (₼)", "Son Sifariş"]
  ];

  customers.forEach(c => {
    const gelir    = c.totalSales || 0;
    const odenilen = c.totalPaid  || 0;
    rows.push([
      c.name || "",
      c.surname  || "",
      c.business || "",
      c.region   || "",
      c.phone    || "",
      c.lastBrand || "",
      parseFloat(fmtNum(gelir)),
      parseFloat(fmtNum(odenilen)),
      parseFloat(fmtNum(gelir - odenilen)),
      c.lastOrderDate || ""
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [20,15,20,15,15,15,12,12,12,14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Müştərilər");
  XLSX.writeFile(wb, `mustari-siyahisi-${_todayStr()}.xlsx`);
};

// ============================================================
//  BORC HESABATI — EXCEL
// ============================================================
window.exportDebtsExcel = function () {
  const regionFilter = document.getElementById("exportRegionFilter")?.value || "";
  let customers = [...(window._customers || [])].filter(c => (c.debt || 0) > 0 || (c.deposit || 0) > 0);
  if (regionFilter) customers = customers.filter(c => c.region === regionFilter);
  customers.sort((a, b) => (b.debt || 0) - (a.debt || 0));

  const rows = [
    ["Müştəri Adı", "Soyad", "Obyekt", "Rayon", "Telefon", "Borc (₼)", "Depozit (₼)", "Balans (₼)"]
  ];

  customers.forEach(c => {
    const debt    = c.debt    || 0;
    const deposit = c.deposit || 0;
    rows.push([
      c.name    || "",
      c.surname || "",
      c.business || "",
      c.region  || "",
      c.phone   || "",
      parseFloat(fmtNum(debt)),
      parseFloat(fmtNum(deposit)),
      parseFloat(fmtNum(deposit - debt))
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [20,15,20,15,15,12,12,12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Borclar");
  XLSX.writeFile(wb, `borc-hesabati-${_todayStr()}.xlsx`);
};

// ============================================================
//  SİFARİŞ HESABATI — EXCEL
// ============================================================
window.exportOrdersExcel = function () {
  const from   = document.getElementById("reportDateFrom")?.value || "";
  const to     = document.getElementById("reportDateTo")?.value   || "";
  const status = document.getElementById("reportStatusFilter")?.value || "";
  const region = document.getElementById("reportRegionFilter")?.value || "";
  const brand  = document.getElementById("reportBrandFilter")?.value  || "";

  let orders = [...(window._orders || [])];

  if (from)   orders = orders.filter(o => o.date >= from);
  if (to)     orders = orders.filter(o => o.date <= to);
  if (status) orders = orders.filter(o => o.status === status);
  if (region) orders = orders.filter(o => o.customerRegion === region);
  if (brand)  orders = orders.filter(o => (o.items || []).some(i => (i.productBrand || "").toLowerCase().includes(brand.toLowerCase())));

  const rows = [
    ["Tarix", "Müştəri", "Rayon", "Məhsul", "Miqdar (L)", "Məbləğ (₼)", "Status", "Dövriyyə", "Qeyd"]
  ];

  const statusMap = { pending: "Alındı", delivered: "Çatdırıldı", debt: "Borcludur" };
  const speedMap  = { fast: "Sürətli", medium: "Orta", slow: "Yavaş" };

  orders.forEach(o => {
    rows.push([
      o.date         || "",
      o.customerName || "",
      o.customerRegion || "",
      o.itemsSummary || "",
      parseFloat(fmtNum(o.totalQty)),
      parseFloat(fmtNum(o.total)),
      statusMap[o.status] || o.status || "",
      speedMap[o.speed]   || o.speed  || "",
      o.note         || ""
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [12,20,15,30,12,12,12,12,20].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Sifarişlər");
  XLSX.writeFile(wb, `sifaris-hesabati-${_todayStr()}.xlsx`);
};

// ============================================================
//  AĞILLI SİYAHI — EXCEL
// ============================================================
window.exportSmartListExcel = function () {
  const smartRows = [];
  const tbody = document.querySelector("#smart-table tbody");
  if (!tbody) return;

  // window._smartList istifadə et əgər varsa
  const list = window._smartList || [];

  const rows = [
    ["Müştəri", "Rayon", "Telefon", "Son Məhsul", "Son Sifariş Tarixi", "Keçən gün", "Dövriyyə", "Ehtimal (%)"]
  ];

  const speedMap = { fast: "Sürətli", medium: "Orta", slow: "Yavaş" };

  list.forEach(c => {
    const speed  = c.lastOrderSpeed || "medium";
    const thresh = { fast: 7, medium: 14, slow: 21 }[speed];
    const pct    = Math.min(100, Math.round((c.daysSinceOrder / thresh) * 100));
    rows.push([
      `${c.name} ${c.surname || ""}`,
      c.region || "",
      c.phone  || "",
      c.lastProduct || "",
      c.lastOrderDate || "",
      c.daysSinceOrder || 0,
      speedMap[speed] || "Orta",
      pct
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [22,15,15,25,14,10,12,12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Ağıllı Siyahı");
  XLSX.writeFile(wb, `agilli-siyahi-${_todayStr()}.xlsx`);
};

// ============================================================
//  KÖMƏKÇI FUNKSİYALAR
// ============================================================
function _todayStr() {
  return new Date().toISOString().split("T")[0];
}

function _downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
