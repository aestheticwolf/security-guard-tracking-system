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
const comprefaceBaseUrl = String(process.env.COMPREFACE_BASE_URL || "").replace(/\/+$/, "");
const comprefaceApiKey = process.env.COMPREFACE_API_KEY || "";
const comprefaceThreshold = Number(process.env.COMPREFACE_VERIFY_THRESHOLD || 0.86);
const comprefaceTimeoutMs = Number(process.env.COMPREFACE_TIMEOUT_MS || 8_000);
const comprefaceDetectionThreshold = process.env.COMPREFACE_DET_PROB_THRESHOLD || "0.8";

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

function isCompreFaceConfigured() {
  return Boolean(comprefaceBaseUrl && comprefaceApiKey);
}

function sanitizeFailureMessage(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function getReferenceCandidates(options = {}) {
  return [
    {
      label: "enrollment selfie",
      path: options.identitySelfiePath
    },
    {
      label: "registered photo",
      path: options.identityPhotoPath
    }
  ]
    .filter((entry) => entry.path)
    .filter(
      (entry, index, collection) =>
        collection.findIndex((candidate) => candidate.path === entry.path) === index
    );
}

function resolveStoredImagePath(pathname) {
  const cleanPathname = String(pathname || "").trim();

  if (!cleanPathname || /^https?:\/\//i.test(cleanPathname)) {
    return null;
  }

  const uploadRelativePath = cleanPathname
    .replace(/\\/g, "/")
    .replace(/^\/?uploads\//, "")
    .replace(/^\/+/, "");
  const uploadRoot = path.resolve(getUploadRoot());
  const absolutePath = path.resolve(uploadRoot, uploadRelativePath);

  if (!absolutePath.startsWith(uploadRoot)) {
    return null;
  }

  return absolutePath;
}

async function readImageInputAsBase64(input) {
  if (!input) {
    throw new Error("Image input is missing.");
  }

  if (input.buffer) {
    return input.buffer.toString("base64");
  }

  if (input.path) {
    return (await fs.promises.readFile(input.path)).toString("base64");
  }

  if (typeof input === "string" && /^https?:\/\//i.test(input)) {
    const remoteResponse = await fetch(input);

    if (!remoteResponse.ok) {
      throw new Error(`Could not read remote reference image (${remoteResponse.status}).`);
    }

    const imageBuffer = Buffer.from(await remoteResponse.arrayBuffer());
    return imageBuffer.toString("base64");
  }

  if (typeof input === "string") {
    const absolutePath = resolveStoredImagePath(input);

    if (!absolutePath) {
      throw new Error("Stored reference image path is not available.");
    }

    return (await fs.promises.readFile(absolutePath)).toString("base64");
  }

  throw new Error("Unsupported image input.");
}

function getBestCompreFaceMatch(payload) {
  return (payload?.result || [])
    .flatMap((entry) => entry?.face_matches || [])
    .map((match) => ({
      ...match,
      similarity: Number(match?.similarity)
    }))
    .filter((match) => Number.isFinite(match.similarity))
    .sort((left, right) => right.similarity - left.similarity)[0] || null;
}

async function verifyAgainstCompreFace(sourceFile, referencePath) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), comprefaceTimeoutMs);

  try {
    const [sourceImage, targetImage] = await Promise.all([
      readImageInputAsBase64(sourceFile),
      readImageInputAsBase64(referencePath)
    ]);
    const endpointUrl = new URL(`${comprefaceBaseUrl}/api/v1/verification/verify`);
    endpointUrl.searchParams.set("limit", "1");
    endpointUrl.searchParams.set("prediction_count", "1");
    endpointUrl.searchParams.set("det_prob_threshold", comprefaceDetectionThreshold);
    endpointUrl.searchParams.set("status", "false");

    const verificationResponse = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": comprefaceApiKey
      },
      body: JSON.stringify({
        source_image: sourceImage,
        target_image: targetImage
      }),
      signal: controller.signal
    });
    const responseText = await verificationResponse.text();
    const responsePayload = responseText ? JSON.parse(responseText) : {};

    if (!verificationResponse.ok) {
      throw new Error(
        responsePayload?.message ||
          responsePayload?.error ||
          `CompreFace returned ${verificationResponse.status}.`
      );
    }

    const bestMatch = getBestCompreFaceMatch(responsePayload);

    return {
      similarity: bestMatch?.similarity ?? 0,
      matched: Boolean(bestMatch && bestMatch.similarity >= comprefaceThreshold),
      faceDetected: Boolean(responsePayload?.result?.length),
      rawResult: responsePayload
    };
  } finally {
    clearTimeout(timeoutId);
  }
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

function buildCompreFaceReview({ fallback, result, referenceLabel }) {
  const similarityScore = Number(Math.max(0, Math.min(result.similarity || 0, 1)).toFixed(3));
  const similarityPercent = Math.round(similarityScore * 100);

  if (result.matched) {
    return {
      ...fallback,
      verified: true,
      score: similarityScore,
      identityStatus: "matched",
      identityScore: similarityScore,
      identityNotes: `CompreFace matched the live selfie with the ${referenceLabel} at ${similarityPercent}% similarity.`
    };
  }

  return {
    ...fallback,
    verified: false,
    score: similarityScore,
    identityStatus: result.faceDetected ? "mismatch" : "face_not_detected",
    identityScore: similarityScore,
    identityNotes: result.faceDetected
      ? `CompreFace could not confidently match the live selfie with the ${referenceLabel}. Similarity: ${similarityPercent}%.`
      : `CompreFace could not detect a usable face in the live selfie or ${referenceLabel}.`
  };
}

export async function verifySelfieCapture(file, options = {}) {
  const fallback = scoreSelfieCapture(file, options);
  const referenceCandidates = getReferenceCandidates(options);

  if (!referenceCandidates.length || fallback.captureSource !== "camera") {
    return fallback;
  }

  if (!isCompreFaceConfigured()) {
    return {
      ...fallback,
      identityNotes:
        "Reference image exists and the proof came from the live camera flow. Configure CompreFace to enable automatic face matching."
    };
  }

  let bestReview = null;
  let lastError = null;

  for (const reference of referenceCandidates) {
    try {
      const result = await verifyAgainstCompreFace(file, reference.path);
      const review = buildCompreFaceReview({
        fallback,
        result,
        referenceLabel: reference.label
      });

      if (review.identityStatus === "matched") {
        return review;
      }

      if (!bestReview || Number(review.identityScore) > Number(bestReview.identityScore)) {
        bestReview = review;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (bestReview) {
    return bestReview;
  }

  return {
    ...fallback,
    identityStatus: "reference_review",
    identityNotes: `CompreFace verification is unavailable, so this selfie remains ready for manual review. ${sanitizeFailureMessage(lastError?.message)}`
  };
}

export function shouldRunAutomaticFaceMatch(options = {}) {
  const fallback = scoreSelfieCapture(options.file, options);
  return Boolean(
    isCompreFaceConfigured() &&
      fallback.captureSource === "camera" &&
      getReferenceCandidates(options).length
  );
}

export function buildPendingFaceMatchReview(file, options = {}) {
  const fallback = scoreSelfieCapture(file, options);

  if (shouldRunAutomaticFaceMatch({ ...options, file })) {
    return {
      ...fallback,
      verified: false,
      identityStatus: "identity_processing",
      identityScore: 0,
      identityNotes: "Automatic face matching is processing in the background. Shift capture was saved immediately."
    };
  }

  return fallback;
}

export function verifySelfieCaptureInBackground({ file, options = {}, onComplete }) {
  if (!shouldRunAutomaticFaceMatch({ ...options, file })) {
    return;
  }

  setTimeout(async () => {
    try {
      const result = await verifySelfieCapture(file, options);
      await onComplete?.(result);
    } catch (error) {
      const fallback = scoreSelfieCapture(file, options);
      await onComplete?.({
        ...fallback,
        identityStatus: "reference_review",
        identityNotes: `Automatic face matching could not complete. Manual review is required. ${sanitizeFailureMessage(error?.message)}`
      });
    }
  }, 0);
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
