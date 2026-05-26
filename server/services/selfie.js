import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultUploadDirectory = path.join(__dirname, "..", "uploads", "selfies");
const uploadDirectory = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : defaultUploadDirectory;
const cloudinaryFolder = process.env.CLOUDINARY_FOLDER || "sentinel-grid/selfies";
const hasCloudinaryConfig = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

fs.mkdirSync(uploadDirectory, { recursive: true });

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

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

function normalizeCaptureSource(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["camera", "live-camera", "admin-camera"].includes(normalized)) {
    return "camera";
  }

  if (["upload", "file", "admin-upload"].includes(normalized)) {
    return "upload";
  }

  return "unknown";
}

function buildIdentityReview({ hasReference, captureSource, qualityScore }) {
  if (!hasReference) {
    return {
      identityStatus: "no_reference",
      identityScore: 0,
      identityNotes: "No registered reference image is enrolled for this guard."
    };
  }

  if (captureSource !== "camera") {
    return {
      identityStatus: "upload_review",
      identityScore: Number(Math.min(qualityScore, 0.68).toFixed(2)),
      identityNotes: "Reference image exists, but this proof was not captured through the live camera flow."
    };
  }

  return {
    identityStatus: "reference_review",
    identityScore: Number(Math.min(qualityScore, 0.82).toFixed(2)),
    identityNotes: "Reference image exists and the proof came from the live camera flow. Manual face review is available in admin."
  };
}

export const selfieUpload = multer({
  storage: hasCloudinaryConfig ? multer.memoryStorage() : storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    callback(null, isImage(file));
  }
});

export function getUploadRoot() {
  return path.dirname(uploadDirectory);
}

export function scoreSelfieCapture(file, options = {}) {
  const captureSource = normalizeCaptureSource(options.captureSource);
  const hasReference = Boolean(options.identityPhotoPath || options.identitySelfiePath);

  if (!file || !isImage(file)) {
    return {
      verified: false,
      score: 0,
      captureSource,
      ...buildIdentityReview({ hasReference, captureSource, qualityScore: 0 })
    };
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

  const qualityScore = Number(Math.min(score, 0.99).toFixed(2));

  return {
    verified: qualityScore >= selfieVerificationThreshold,
    score: qualityScore,
    captureSource,
    ...buildIdentityReview({ hasReference, captureSource, qualityScore })
  };
}

export function toPublicSelfiePath(file) {
  return `/uploads/selfies/${path.basename(file.path)}`;
}

function uploadBufferToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: cloudinaryFolder,
        resource_type: "image"
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result.secure_url);
      }
    );

    stream.end(file.buffer);
  });
}

export async function storeSelfieFile(file) {
  if (!file) {
    return null;
  }

  if (hasCloudinaryConfig) {
    return uploadBufferToCloudinary(file);
  }

  return toPublicSelfiePath(file);
}

function getCloudinaryPublicId(imageUrl) {
  try {
    const parsedUrl = new URL(imageUrl);
    const uploadIndex = parsedUrl.pathname.indexOf("/upload/");

    if (uploadIndex === -1) {
      return null;
    }

    const afterUpload = parsedUrl.pathname.slice(uploadIndex + "/upload/".length);
    const withoutVersion = afterUpload.replace(/^v\d+\//, "");
    const withoutExtension = withoutVersion.replace(/\.[^/.]+$/, "");

    return decodeURIComponent(withoutExtension.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

export async function deleteStoredSelfies(paths = []) {
  await Promise.all(
    paths
      .filter(Boolean)
      .map(async (pathname) => {
        if (/^https?:\/\//i.test(pathname) && hasCloudinaryConfig) {
          const publicId = getCloudinaryPublicId(pathname);

          if (publicId) {
            await cloudinary.uploader.destroy(publicId).catch(() => undefined);
          }

          return;
        }

        await fs.promises.rm(path.join(uploadDirectory, path.basename(pathname)), { force: true });
      })
  ).catch(() => undefined);
}
