import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.join(__dirname, "..", "uploads", "selfies");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname) || ".jpg";
    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${base}${extension}`);
  }
});

const selfieVerificationThreshold = 0.75;

function isImage(file) {
  return file.mimetype.startsWith("image/");
}

export const selfieUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    callback(null, isImage(file));
  }
});

export function scoreSelfieCapture(file) {
  if (!file || !isImage(file)) {
    return { verified: false, score: 0 };
  }

  let score = 0.72;

  if (file.size > 40_000) {
    score += 0.12;
  }

  if (file.size > 120_000) {
    score += 0.1;
  }

  if (file.mimetype.includes("jpeg") || file.mimetype.includes("png")) {
    score += 0.06;
  }

  return {
    verified: score >= selfieVerificationThreshold,
    score: Number(Math.min(score, 0.99).toFixed(2))
  };
}

export function toPublicSelfiePath(file) {
  return `/uploads/selfies/${path.basename(file.path)}`;
}

export async function deleteStoredSelfies(paths = []) {
  await Promise.all(
    paths
      .filter(Boolean)
      .map((pathname) =>
        fs.promises.rm(path.join(uploadDirectory, path.basename(pathname)), { force: true })
      )
  ).catch(() => undefined);
}
