import PDFDocument from "pdfkit";
import { SECTIONS } from "../../src/unpause/content.js";
import { formatValue } from "../../src/unpause/formatAnswer.js";

interface SubmissionForPdf {
  id: string;
  submittedAt: string;
  answers: Record<string, unknown>;
  analysis?: string | null;
}

export function buildSubmissionPdf(submission: SubmissionForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(18).text("The Unbrief — submission");
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#666666")
      .text(`Submitted ${new Date(submission.submittedAt).toLocaleString()}`)
      .text(submission.id)
      .fillColor("#000000");
    doc.moveDown(1.5);

    if (submission.analysis) {
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#000000").text("AI SNAPSHOT — FOR THE TEAM");
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(10).fillColor("#333333").text(submission.analysis, { lineGap: 2 });
      doc.fillColor("#000000").moveDown(1.5);
    }

    for (const section of SECTIONS) {
      if (section.condition && !section.condition(submission.answers)) continue;

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(`${section.number} — ${section.title}`);
      doc.moveDown(0.5);

      for (const question of section.questions) {
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .text(`Q${question.number}. ${question.prompt}`);

        for (const qp of question.parts) {
          const key = `${question.id}.${qp.id}`;
          const otherKey = `${key}__other`;
          const value = submission.answers[key];
          const otherValue = submission.answers[otherKey];
          const label = qp.label ? `${qp.label}: ` : "";
          const text = `${label}${formatValue(value)}${otherValue ? ` (${otherValue})` : ""}`;
          doc.font("Helvetica").fontSize(10).fillColor("#333333").text(text);
        }

        doc.fillColor("#000000").moveDown(0.6);
      }

      doc.moveDown(0.5);
    }

    doc.end();
  });
}
