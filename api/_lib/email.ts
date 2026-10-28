import { Resend } from "resend";

interface SubmissionForEmail {
  id: string;
  submittedAt: string;
  answers: Record<string, unknown>;
}

function getApplicantName(answers: Record<string, unknown>): string {
  const main = answers["q1.main"] as Record<string, unknown> | undefined;
  const name = main?.["name"];
  return typeof name === "string" && name.trim() ? name.trim() : "a new submission";
}

export async function sendSubmissionNotification(submission: SubmissionForEmail, pdfBuffer: Buffer): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL_TO;
  const from = process.env.NOTIFICATION_EMAIL_FROM;

  if (!apiKey || !to || !from) {
    console.warn(
      "sendSubmissionNotification: skipped — missing RESEND_API_KEY, NOTIFICATION_EMAIL_TO, or NOTIFICATION_EMAIL_FROM",
    );
    return;
  }

  const resend = new Resend(apiKey);
  const applicantName = getApplicantName(submission.answers);

  await resend.emails.send({
    from,
    to,
    subject: `New Unbrief submission — ${applicantName}`,
    text: `A new intake form was submitted.\n\nSubmission ID: ${submission.id}\nSubmitted at: ${new Date(submission.submittedAt).toLocaleString()}\n\nThe full transcript is attached as a PDF.`,
    attachments: [
      {
        filename: `unbrief-${submission.id}.pdf`,
        content: pdfBuffer,
      },
    ],
  });
}
