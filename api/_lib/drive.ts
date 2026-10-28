import { google } from "googleapis";
import { Readable } from "node:stream";

interface SubmissionForDrive {
  id: string;
  submittedAt: string;
  answers: Record<string, unknown>;
}

function getApplicantName(answers: Record<string, unknown>): string {
  const main = answers["q1.main"] as Record<string, unknown> | undefined;
  const name = main?.["name"];
  return typeof name === "string" && name.trim() ? name.trim() : "a new submission";
}

export async function uploadSubmissionPdfToDrive(submission: SubmissionForDrive, pdfBuffer: Buffer): Promise<void> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const notifyEmail = process.env.NOTIFICATION_EMAIL_TO;

  if (!clientId || !clientSecret || !refreshToken || !folderId || !notifyEmail) {
    console.warn(
      "uploadSubmissionPdfToDrive: skipped — missing GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID, or NOTIFICATION_EMAIL_TO",
    );
    return;
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: "v3", auth });
  const applicantName = getApplicantName(submission.answers);

  const file = await drive.files.create({
    requestBody: {
      name: `unbrief-${applicantName}-${submission.id}.pdf`,
      parents: [folderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(pdfBuffer),
    },
    fields: "id",
  });

  const fileId = file.data.id;
  if (!fileId) {
    throw new Error("uploadSubmissionPdfToDrive: Drive did not return a file id");
  }

  await drive.permissions.create({
    fileId,
    sendNotificationEmail: true,
    requestBody: {
      type: "user",
      role: "reader",
      emailAddress: notifyEmail,
    },
    emailMessage: `New Unbrief submission — ${applicantName}\n\nSubmission ID: ${submission.id}\nSubmitted at: ${new Date(submission.submittedAt).toLocaleString()}`,
  });
}
