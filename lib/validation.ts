const QUESTION_MAX = 500;
const ZIP_MAX_BYTES = 15 * 1024 * 1024;

export function validateQuestion(input: string): string {
  const question = input.trim();
  if (!question) {
    throw new Error("Question is required");
  }
  if (question.length > QUESTION_MAX) {
    throw new Error(`Question too long. Max ${QUESTION_MAX} chars.`);
  }
  return question;
}

export function validateGitHubUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (!/^https?:\/\/github\.com\//i.test(value)) {
    throw new Error("Use a valid public GitHub URL");
  }
  return value;
}

export function validateZipUpload(file: unknown): File | null {
  if (!file) return null;
  if (!(file instanceof File)) {
    throw new Error("Invalid upload");
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("Only .zip file is supported");
  }
  if (file.size > ZIP_MAX_BYTES) {
    throw new Error(`Zip too large. Max ${(ZIP_MAX_BYTES / (1024 * 1024)).toFixed(0)}MB.`);
  }
  return file;
}
