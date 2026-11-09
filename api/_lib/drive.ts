import { google } from "googleapis";
import { Readable } from "node:stream";

interface SubmissionForDrive {
  id: string;
  submittedAt: string;
  answers: Record<string, unknown>;
}

interface UploadedFileRef {
  name: string;
  size: number;
  path: string;
}

function getApplicantName(answers: Record<string, unknown>): string {
  const main = answers["q1.main"] as Record<string, unknown> | undefined;
  const name = main?.["name"];
  return typeof name === "string" && name.trim() ? name.trim() : "a new submission";
}

function collectUploadedFiles(answers: Record<string, unknown>): UploadedFileRef[] {
  const files: UploadedFileRef[] = [];
  for (const value of Object.values(answers)) {
    if (!value || typeof value !== "object") continue;
    const fileList = (value as { files?: unknown }).files;
    if (!Array.isArray(fileList)) continue;
    for (const f of fileList) {
      if (f && typeof f === "object" && typeof (f as UploadedFileRef).name === "string" && typeof (f as UploadedFileRef).path === "string") {
        files.push(f as UploadedFileRef);
      }
    }
  }
  return files;
}

function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
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

  const submissionFolder = await drive.files.create({
    requestBody: {
      name: `Unbrief — ${applicantName} — ${submission.id}`,
      mimeType: "application/vnd.google-apps.folder",
      parents: [folderId],
    },
    fields: "id",
  });

  const submissionFolderId = submissionFolder.data.id;
  if (!submissionFolderId) {
    throw new Error("uploadSubmissionPdfToDrive: Drive did not return a folder id");
  }

  await drive.files.create({
    requestBody: {
      name: `unbrief-${applicantName}-${submission.id}.pdf`,
      parents: [submissionFolderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(pdfBuffer),
    },
    fields: "id",
  });

  for (const uploadedFile of collectUploadedFiles(submission.answers)) {
    try {
      const res = await fetch(uploadedFile.path);
      if (!res.ok) {
        console.error(`uploadSubmissionPdfToDrive: failed to fetch attachment ${uploadedFile.name} (${res.status})`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const mimeType = res.headers.get("content-type") || guessMimeType(uploadedFile.name);
      await drive.files.create({
        requestBody: {
          name: uploadedFile.name,
          parents: [submissionFolderId],
        },
        media: {
          mimeType,
          body: Readable.from(buffer),
        },
        fields: "id",
      });
    } catch (err) {
      console.error(`uploadSubmissionPdfToDrive: failed to copy attachment ${uploadedFile.name}`, err);
    }
  }

  await drive.permissions.create({
    fileId: submissionFolderId,
    sendNotificationEmail: true,
    requestBody: {
      type: "user",
      role: "reader",
      emailAddress: notifyEmail,
    },
    emailMessage: `New Unbrief submission — ${applicantName}\n\nSubmission ID: ${submission.id}\nSubmitted at: ${new Date(submission.submittedAt).toLocaleString()}\n\nThis folder contains the generated PDF and any files they attached.`,
  });
}
