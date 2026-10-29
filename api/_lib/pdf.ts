import PDFDocument from "pdfkit";
import { SECTIONS } from "../../src/unpause/content.js";
import { getActiveSections } from "../../src/unpause/flow.js";
import { formatValue } from "../../src/unpause/formatAnswer.js";

interface SubmissionForPdf {
  id: string;
  submittedAt: string;
  answers: Record<string, unknown>;
  analysis?: string | null;
}

const INK = "#01213B";
const BRAND = "#004ac7";
const MUTED = "#6b7280";
const BODY = "#333333";
const RULE = "#e3ded3";

const SECTION_ACCENTS = [
  "#004ac7", // 01 Hello, you.
  "#b5542c", // 02 The people on the other side.
  "#4b6b3c", // 03 Your world, your rules.
  "#7a4b8f", // 04 Let's talk about the logo.
  "#1f6e6e", // 05 What we're working with.
  "#9c6b1f", // 06 Making it real.
  "#a13b5c", // 07 One last thing.
];

const PAGE_MARGIN = 56;

function field(obj: Record<string, unknown> | undefined, key: string): string {
  const value = obj?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

function titleCaseKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatLeaf(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function isUploadOrText(obj: Record<string, unknown>): boolean {
  return "files" in obj || "text" in obj;
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (isUploadOrText(obj)) {
      const text = (obj.text as string) ?? "";
      const files = (obj.files as Array<{ name: string }>) ?? [];
      return !text.trim() && files.length === 0;
    }
    return Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined && v !== null).length === 0;
  }
  return false;
}

function parseAnalysisSections(analysis: string): Array<{ heading: string; body: string }> {
  const headerRe = /^[A-Z][A-Z &/'-]{2,48}$/;
  const blocks: Array<{ heading: string; body: string[] }> = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const raw of analysis.split("\n")) {
    const line = raw.trim();
    if (line && headerRe.test(line)) {
      current = { heading: line, body: [] };
      blocks.push(current);
    } else if (current) {
      current.body.push(raw);
    }
  }

  return blocks
    .map((b) => ({ heading: b.heading, body: b.body.join("\n").trim() }))
    .filter((b) => b.body);
}

export function buildSubmissionPdf(submission: SubmissionForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - PAGE_MARGIN * 2;

    const sectionsToRender = getActiveSections(submission.answers)
      .map((section) => {
        const idx = SECTIONS.findIndex((s) => s.id === section.id);
        const renderableQuestions = section.questions
          .map((question) => {
            const parts = question.parts.filter((qp) => {
              const value = submission.answers[`${question.id}.${qp.id}`];
              const otherValue = submission.answers[`${question.id}.${qp.id}__other`];
              return !isEmptyValue(value) || (typeof otherValue === "string" && otherValue.trim());
            });
            return { question, parts };
          })
          .filter((q) => q.parts.length > 0);
        return { section, idx, renderableQuestions };
      })
      .filter((s) => s.renderableQuestions.length > 0);

    let currentPageNumber = 1;
    function addPage() {
      doc.addPage();
      currentPageNumber++;
    }

    function ensureSpace(needed: number) {
      const bottom = doc.page.height - PAGE_MARGIN;
      if (doc.y + needed > bottom) {
        addPage();
      }
    }

    function resetX() {
      doc.x = PAGE_MARGIN;
    }

    function renderAccentHeader(label: string, color: string, size = 14) {
      ensureSpace(50);
      const barY = doc.y;
      doc.rect(PAGE_MARGIN, barY, 4, 26).fill(color);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(size).text(label, PAGE_MARGIN + 16, barY + 2, {
        width: contentWidth - 16,
      });
      doc.y = Math.max(doc.y, barY + 30);
      resetX();
    }

    function renderDivider() {
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
        .strokeColor(RULE)
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.6);
      resetX();
    }

    function renderFieldsObject(obj: Record<string, unknown>) {
      const entries = Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined && v !== null);
      for (const [key, value] of entries) {
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(MUTED)
          .text(`${titleCaseKey(key).toUpperCase()}  `, PAGE_MARGIN, doc.y, { continued: true, width: contentWidth });
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(formatLeaf(value));
      }
    }

    function renderScalePairs(pairs: Array<[string, string]>, value: Record<number, number>) {
      pairs.forEach((pair, i) => {
        if (value[i] === undefined) return;
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(MUTED)
          .text(`${pair[0]} <-> ${pair[1]}:  `, PAGE_MARGIN, doc.y, { continued: true, width: contentWidth });
        doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(String(value[i]));
      });
    }

    // ---------- COVER PAGE ----------
    doc.rect(0, 0, doc.page.width, 8).fill(BRAND);

    doc.circle(PAGE_MARGIN + 7, 64, 7).fill(BRAND);
    doc
      .fillColor(BRAND)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("UNPAUSE", PAGE_MARGIN + 24, 59, { characterSpacing: 2 });

    doc.y = 104;
    resetX();
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(32).text("The Unbrief");

    const who = submission.answers["q1.main"] as Record<string, unknown> | undefined;
    const brandNameFields = submission.answers["q15.main"] as Record<string, unknown> | undefined;
    const clientName = field(who, "name");
    const brandName = field(who, "brand") !== "—" ? field(who, "brand") : field(brandNameFields, "brandName");

    doc.moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(14)
      .fillColor(MUTED)
      .text(brandName !== "—" ? `${clientName} · ${brandName}` : clientName);

    doc.moveDown(0.3);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Submitted ${new Date(submission.submittedAt).toLocaleString()}  ·  ${submission.id}`);

    doc.moveDown(1.2);
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
      .strokeColor(RULE)
      .lineWidth(1)
      .stroke();
    doc.moveDown(1);
    resetX();

    const facts: Array<[string, string]> = [
      ["Name", field(who, "name")],
      ["Email", field(who, "email")],
      ["Role", field(who, "role")],
      ["Location", field(who, "location")],
      ["Brand / business", brandName],
      ["Website", field(who, "website")],
    ];

    const colWidth = contentWidth / 2;
    const rowY = doc.y;
    const rowHeight = 46;
    facts.forEach(([label, value], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = PAGE_MARGIN + col * colWidth;
      const y = rowY + row * rowHeight;
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(MUTED)
        .text(label.toUpperCase(), x, y, { width: colWidth - 20, characterSpacing: 0.5 });
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(INK)
        .text(value, x, y + 13, { width: colWidth - 20 });
    });
    doc.y = rowY + Math.ceil(facts.length / 2) * rowHeight + 6;
    resetX();

    doc.moveDown(1.4);
    doc
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
      .strokeColor(RULE)
      .lineWidth(1)
      .stroke();
    doc.moveDown(1);
    resetX();

    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("IN THIS DOCUMENT", { characterSpacing: 0.5 });
    doc.moveDown(0.6);
    resetX();

    const contentsRowHeight = 22;
    const tocPageNumWidth = 28;
    const tocRows: Array<{ y: number }> = [];
    if (submission.analysis) {
      const rowY = doc.y;
      doc.circle(PAGE_MARGIN + 3, rowY + 5, 3).fill(BRAND);
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(INK)
        .text("AI Snapshot — for the team", PAGE_MARGIN + 14, rowY - 1, { width: contentWidth - 14 - tocPageNumWidth });
      tocRows.push({ y: rowY - 1 });
      doc.y = rowY + (contentsRowHeight - 11);
      resetX();
    }
    sectionsToRender.forEach(({ section, idx }) => {
      const color = SECTION_ACCENTS[idx % SECTION_ACCENTS.length];
      const rowY = doc.y;
      doc.circle(PAGE_MARGIN + 3, rowY + 5, 3).fill(color);
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(INK)
        .text(`${section.number} — ${section.title}`, PAGE_MARGIN + 14, rowY - 1, { width: contentWidth - 14 - tocPageNumWidth });
      tocRows.push({ y: rowY - 1 });
      doc.y = rowY + (contentsRowHeight - 11);
      resetX();
    });

    // ---------- AI SNAPSHOT ----------
    let aiSnapshotPageNumber: number | null = null;
    if (submission.analysis) {
      addPage();
      aiSnapshotPageNumber = currentPageNumber;
      renderAccentHeader("AI Snapshot — for the team", BRAND, 15);
      doc.moveDown(0.3);

      const blocks = parseAnalysisSections(submission.analysis);
      if (blocks.length === 0) {
        doc.font("Helvetica").fontSize(10).fillColor(BODY).text(submission.analysis, { lineGap: 3 });
      } else {
        for (const block of blocks) {
          ensureSpace(50);
          doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND).text(block.heading, { characterSpacing: 0.5 });
          doc.moveDown(0.2);
          doc.font("Helvetica").fontSize(10).fillColor(BODY).text(block.body, { lineGap: 3 });
          doc.moveDown(0.9);
          resetX();
        }
      }
    }

    // ---------- FORM SECTIONS ----------
    const sectionPageNumbers: number[] = [];
    sectionsToRender.forEach(({ section, idx: sectionIdx, renderableQuestions }, i) => {
      if (i === 0) {
        addPage();
      } else {
        ensureSpace(90);
        doc.moveDown(0.8);
        resetX();
      }
      sectionPageNumbers.push(currentPageNumber);
      const color = SECTION_ACCENTS[sectionIdx % SECTION_ACCENTS.length];
      renderAccentHeader(`${section.number} — ${section.title}`, color, 15);
      doc.moveDown(0.4);

      renderableQuestions.forEach(({ question, parts }, idx) => {
        ensureSpace(60);
        doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(`Q${question.number}. ${question.prompt}`);
        doc.moveDown(0.3);
        resetX();

        parts.forEach((qp) => {
          const key = `${question.id}.${qp.id}`;
          const value = submission.answers[key];
          const otherValue = submission.answers[`${key}__other`];

          if (qp.label) {
            doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(qp.label.toUpperCase(), { characterSpacing: 0.4 });
            doc.moveDown(0.1);
          }

          if (qp.part.kind === "scale-pairs" && value && typeof value === "object") {
            renderScalePairs(qp.part.pairs, value as Record<number, number>);
          } else if (value && typeof value === "object" && !Array.isArray(value) && !isUploadOrText(value as Record<string, unknown>)) {
            renderFieldsObject(value as Record<string, unknown>);
          } else {
            let text = formatValue(value);
            if (typeof otherValue === "string" && otherValue.trim()) text += ` (${otherValue.trim()})`;
            doc.font("Helvetica").fontSize(10).fillColor(BODY).text(text, { lineGap: 2 });
          }
          doc.moveDown(0.4);
          resetX();
        });

        if (idx < renderableQuestions.length - 1) {
          renderDivider();
        }
      });

      doc.moveDown(0.5);
    });

    // ---------- TOC PAGE NUMBERS (back-fill on cover) ----------
    doc.switchToPage(0);
    let tocRowIdx = 0;
    if (aiSnapshotPageNumber !== null) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(MUTED)
        .text(String(aiSnapshotPageNumber), doc.page.width - PAGE_MARGIN - tocPageNumWidth, tocRows[tocRowIdx].y, {
          width: tocPageNumWidth,
          align: "right",
        });
      tocRowIdx++;
    }
    sectionPageNumbers.forEach((pageNum) => {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(MUTED)
        .text(String(pageNum), doc.page.width - PAGE_MARGIN - tocPageNumWidth, tocRows[tocRowIdx].y, {
          width: tocPageNumWidth,
          align: "right",
        });
      tocRowIdx++;
    });

    // ---------- FOOTER (page numbers) ----------
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const pageNum = i - range.start + 1;
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text("Unpause · Confidential", PAGE_MARGIN, doc.page.height - 36, {
          width: contentWidth / 2,
          align: "left",
          lineBreak: false,
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(`Page ${pageNum} of ${range.count}`, PAGE_MARGIN + contentWidth / 2, doc.page.height - 36, {
          width: contentWidth / 2,
          align: "right",
          lineBreak: false,
        });
      doc.page.margins.bottom = bottomMargin;
    }

    doc.end();
  });
}
