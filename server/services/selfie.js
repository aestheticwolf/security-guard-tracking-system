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
const comprefaceThreshold = readScore(process.env.COMPREFACE_VERIFY_THRESHOLD, 0.78);
const comprefaceReviewThreshold = readScore(process.env.COMPREFACE_REVIEW_THRESHOLD, 0.65);
const comprefaceTimeoutMs = readDurationMs(process.env.COMPREFACE_TIMEOUT_MS, 8_000);
const comprefaceInlineTimeoutMs = readDurationMs(process.env.COMPREFACE_INLINE_TIMEOUT_MS, 2_500);
const comprefaceDetectionThreshold = process.env.COMPREFACE_DET_PROB_THRESHOLD || "0.8";

function isHostedRuntime() {
  return Boolean(
    process.env.RENDER ||
      process.env.RENDER_SERVICE_ID ||
      process.env.VERCEL ||
      process.env.CF_PAGES ||
      process.env.NODE_ENV === "production"
  );
}

function isLocalhostUrl(value) {
  try {
    const parsedUrl = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);
  } catch {
    return false;
  }
}

function readDurationMs(value, fallback) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 ? duration : fallback;
}

function readScore(value, fallback) {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 1 ? score : fallback;
}

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
  if (!comprefaceBaseUrl || !comprefaceApiKey) {
    return false;
  }

  if (isHostedRuntime() && isLocalhostUrl(comprefaceBaseUrl)) {
    return process.env.COMPREFACE_ALLOW_LOCALHOST === "true";
  }

  return true;
}

function getImageMimeType(filename = "", fallback = "image/jpeg") {
  const extension = path.extname(filename).toLowerCase();

  switch (extension) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".bmp":
      return "image/bmp";
    case ".gif":
      return "image/gif";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return fallback;
  }
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

async function readImageInputAsUpload(input, fallbackFilename = "selfie.jpg") {
  if (!input) {
    throw new Error("Image input is missing.");
  }

  if (input.buffer) {
    return {
      buffer: Buffer.from(input.buffer),
      filename: input.originalname || fallbackFilename,
      mimeType: input.mimetype || getImageMimeType(input.originalname || fallbackFilename)
    };
  }

  if (input.path) {
    return {
      buffer: await fs.promises.readFile(input.path),
      filename: input.originalname || path.basename(input.path) || fallbackFilename,
      mimeType: input.mimetype || getImageMimeType(input.path)
    };
  }

  if (typeof input === "string" && /^https?:\/\//i.test(input)) {
    const remoteResponse = await fetch(input);

    if (!remoteResponse.ok) {
      throw new Error(`Could not read remote reference image (${remoteResponse.status}).`);
    }

    const imageBuffer = Buffer.from(await remoteResponse.arrayBuffer());
    const contentType = remoteResponse.headers.get("content-type") || "";

    return {
      buffer: imageBuffer,
      filename: path.basename(new URL(input).pathname) || fallbackFilename,
      mimeType: contentType.startsWith("image/")
        ? contentType.split(";")[0]
        : getImageMimeType(input)
    };
  }

  if (typeof input === "string") {
    const absolutePath = resolveStoredImagePath(input);

    if (!absolutePath) {
      throw new Error("Stored reference image path is not available.");
    }

    return {
      buffer: await fs.promises.readFile(absolutePath),
      filename: path.basename(absolutePath) || fallbackFilename,
      mimeType: getImageMimeType(absolutePath)
    };
  }

  throw new Error("Unsupported image input.");
}

function appendImageUpload(formData, fieldName, image) {
  formData.append(
    fieldName,
    new Blob([image.buffer], { type: image.mimeType }),
    image.filename
  );
}

function parseJsonResponse(text) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function isFaceNotFoundMessage(value) {
  return /no face|face.*not found|no.*faces/i.test(String(value || ""));
}

function getCompreFaceLogContext(referenceLabel) {
  let matcherHost = "not configured";

  try {
    matcherHost = new URL(comprefaceBaseUrl).host;
  } catch {
    matcherHost = comprefaceBaseUrl || "not configured";
  }

  return {
    matcherHost,
    referenceLabel
  };
}

function normalizeSimilarityScore(value) {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return 0;
  }

  if (score > 1 && score <= 100) {
    return score / 100;
  }

  return Math.max(0, Math.min(score, 1));
}

function getBestCompreFaceMatch(payload) {
  return (payload?.result || [])
    .flatMap((entry) => entry?.face_matches || [])
    .map((match) => ({
      ...match,
      similarity: normalizeSimilarityScore(match?.similarity)
    }))
    .filter((match) => Number.isFinite(match.similarity))
    .sort((left, right) => right.similarity - left.similarity)[0] || null;
}

async function verifyAgainstCompreFace(sourceFile, referencePath) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), comprefaceTimeoutMs);

  try {
    const [sourceImage, targetImage] = await Promise.all([
      readImageInputAsUpload(sourceFile, "shift-selfie.jpg"),
      readImageInputAsUpload(referencePath, "identity-reference.jpg")
    ]);
    const endpointUrl = new URL(`${comprefaceBaseUrl}/api/v1/verification/verify`);
    endpointUrl.searchParams.set("limit", "1");
    endpointUrl.searchParams.set("prediction_count", "1");
    endpointUrl.searchParams.set("det_prob_threshold", comprefaceDetectionThreshold);
    endpointUrl.searchParams.set("status", "false");

    const formData = new FormData();
    appendImageUpload(formData, "source_image", sourceImage);
    appendImageUpload(formData, "target_image", targetImage);

    const verificationResponse = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "x-api-key": comprefaceApiKey,
        "ngrok-skip-browser-warning": "true"
      },
      body: formData,
      signal: controller.signal
    });
    const responseText = await verificationResponse.text();
    const responsePayload = parseJsonResponse(responseText);

    if (!verificationResponse.ok) {
      const responseMessage =
        responsePayload?.message ||
        responsePayload?.error ||
        responsePayload?.detail ||
        responseText;

      if (isFaceNotFoundMessage(responseMessage)) {
        return {
          similarity: 0,
          matched: false,
          needsReview: false,
          faceDetected: false,
          rawResult: responsePayload
        };
      }

      throw new Error(
        responseMessage || `CompreFace returned ${verificationResponse.status}.`
      );
    }

    const bestMatch = getBestCompreFaceMatch(responsePayload);

    return {
      similarity: bestMatch?.similarity ?? 0,
      matched: Boolean(bestMatch && bestMatch.similarity >= comprefaceThreshold),
      needsReview: Boolean(
        bestMatch &&
          bestMatch.similarity >= comprefaceReviewThreshold &&
          bestMatch.similarity < comprefaceThreshold
      ),
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
      identityNotes: `Live selfie matched the ${referenceLabel} with ${similarityPercent}% similarity.`
    };
  }

  if (result.needsReview) {
    return {
      ...fallback,
      verified: false,
      score: similarityScore,
      identityStatus: "possible_match",
      identityScore: similarityScore,
      identityNotes: `Similarity is ${similarityPercent}%, which is close but below automatic approval. Review both images before accepting.`
    };
  }

  return {
    ...fallback,
    verified: false,
    score: similarityScore,
    identityStatus: result.faceDetected ? "mismatch" : "face_not_detected",
    identityScore: similarityScore,
    identityNotes: result.faceDetected
      ? `The live selfie did not confidently match the ${referenceLabel}. Similarity: ${similarityPercent}%.`
      : "A usable face was not detected. Ask the guard to retake a clear, front-facing selfie."
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
      verified: false,
      identityStatus: "match_not_configured",
      identityScore: 0,
      identityNotes:
        "Automatic face matching is not enabled for this workspace. Review both images manually."
    };
  }

  let bestReview = null;

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
      console.warn("CompreFace verification failed.", {
        ...getCompreFaceLogContext(reference.label),
        message: error?.message || "Unknown matcher error"
      });
      // Try the next enrolled reference before falling back to manual review.
    }
  }

  if (bestReview) {
    return bestReview;
  }

  return {
    ...fallback,
    verified: false,
    identityStatus: "match_unavailable",
    identityScore: 0,
    identityNotes:
      "Automatic face match could not be completed for this capture. Review both images manually or ask the guard to retake a clearer selfie."
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
  const hasReference = Boolean(getReferenceCandidates(options).length);

  if (fallback.captureSource === "camera" && hasReference && !isCompreFaceConfigured()) {
    return {
      ...fallback,
      verified: false,
      identityStatus: "match_not_configured",
      identityScore: 0,
      identityNotes:
        "Automatic face matching is not enabled for this workspace. Review both images manually."
    };
  }

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
        verified: false,
        identityStatus: "match_unavailable",
        identityScore: 0,
        identityNotes:
          "Automatic face match could not be completed for this capture. Review both images manually or ask the guard to retake a clearer selfie."
      });
    }
  }, 0);
}

function completeBackgroundVerification(verificationPromise, onBackgroundComplete) {
  verificationPromise
    .then((result) => onBackgroundComplete?.(result))
    .catch(() => undefined);
}

export async function resolveSelfieCaptureWithQuickMatch({
  file,
  options = {},
  onBackgroundComplete
}) {
  const initialReview = buildPendingFaceMatchReview(file, options);

  if (!shouldRunAutomaticFaceMatch({ ...options, file })) {
    return initialReview;
  }

  const verificationPromise = verifySelfieCapture(file, options).catch((error) => {
    const fallback = scoreSelfieCapture(file, options);

    return {
      ...fallback,
      verified: false,
      identityStatus: "match_unavailable",
      identityScore: 0,
      identityNotes:
        "Automatic face match could not be completed for this capture. Review both images manually or ask the guard to retake a clearer selfie."
    };
  });

  if (comprefaceInlineTimeoutMs <= 0) {
    completeBackgroundVerification(verificationPromise, onBackgroundComplete);
    return initialReview;
  }

  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), comprefaceInlineTimeoutMs);
  });
  const quickResult = await Promise.race([verificationPromise, timeoutPromise]);
  clearTimeout(timeoutId);

  if (quickResult) {
    return quickResult;
  }

  completeBackgroundVerification(verificationPromise, onBackgroundComplete);
  return initialReview;
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
