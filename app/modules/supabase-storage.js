(function initAppSupabaseStorage(globalScope) {
  const STORAGE_KEY = "supabase-demo-config";
  const FALLBACK_BUCKET = "";
  let supabaseClient = null;

  function safeJsonParse(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function loadSavedConfig() {
    const saved = safeJsonParse(globalScope.localStorage?.getItem?.(STORAGE_KEY));
    const runtime = typeof globalScope.__supabaseStorageConfig === "object" && globalScope.__supabaseStorageConfig
      ? globalScope.__supabaseStorageConfig
      : {};
    return normalizeConfig({
      ...(saved || {}),
      ...runtime,
    });
  }

  function normalizeConfig(raw = {}) {
    return {
      supabaseUrl: String(raw.supabaseUrl || "").trim(),
      supabaseKey: String(raw.supabaseKey || "").trim(),
      bucketName: String(raw.bucketName || FALLBACK_BUCKET).trim(),
      folderPath: String(raw.folderPath || "").trim().replace(/^\/+|\/+$/g, ""),
    };
  }

  function saveConfig(config = {}) {
    const next = normalizeConfig(config);
    globalScope.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(next));
    supabaseClient = null;
    return next;
  }

  function isConfigured(config = loadSavedConfig()) {
    return !!(config.supabaseUrl && config.supabaseKey && config.bucketName);
  }

  function getClient() {
    const config = loadSavedConfig();
    if (!isConfigured(config)) {
      throw new Error("Supabase storage is not configured. Save supabase-demo-config in localStorage first.");
    }
    if (!globalScope.supabase?.createClient) {
      throw new Error("Supabase client library is not loaded.");
    }
    if (
      !supabaseClient
      || supabaseClient.__appUrl !== config.supabaseUrl
      || supabaseClient.__appKey !== config.supabaseKey
    ) {
      supabaseClient = globalScope.supabase.createClient(config.supabaseUrl, config.supabaseKey);
      supabaseClient.__appUrl = config.supabaseUrl;
      supabaseClient.__appKey = config.supabaseKey;
    }
    return supabaseClient;
  }

  function sanitizePathSegment(value = "", fallback = "item") {
    const safe = String(value || "")
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    return safe || fallback;
  }

  function joinPath(...parts) {
    return parts
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join("/")
      .replace(/\/+/g, "/")
      .replace(/^\/+|\/+$/g, "");
  }

  function buildScopedFolder({ kind = "", userId = "", itemId = "" } = {}) {
    const config = loadSavedConfig();
    return joinPath(
      config.folderPath,
      sanitizePathSegment(kind || "misc", "misc"),
      sanitizePathSegment(userId || "guest", "guest"),
      sanitizePathSegment(itemId || "item", "item")
    );
  }

  function inferMimeType(dataUrl = "", fallback = "application/octet-stream") {
    const match = String(dataUrl || "").match(/^data:([^;]+);base64,/i);
    return String(match?.[1] || fallback).trim() || fallback;
  }

  function dataUrlToBlob(dataUrl = "") {
    const raw = String(dataUrl || "");
    const parts = raw.split(",");
    if (parts.length < 2) return null;
    const meta = parts[0] || "";
    const mime = inferMimeType(raw);
    const payload = parts.slice(1).join(",");
    try {
      const binary = globalScope.atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime || meta || "application/octet-stream" });
    } catch {
      return null;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      if (!blob) {
        reject(new Error("Missing blob"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  }

  async function uploadDataUrl({
    userId = "",
    itemId = "",
    kind = "",
    dataUrl = "",
    mimeType = "",
    objectName = "payload",
    onProgress = null,
  } = {}) {
    const config = loadSavedConfig();
    const client = getClient();
    const bucket = config.bucketName;
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) {
      throw new Error("Could not decode data for upload.");
    }
    const contentType = String(mimeType || inferMimeType(dataUrl, blob.type || "application/octet-stream")).trim();
    const objectPath = joinPath(buildScopedFolder({ kind, userId, itemId }), sanitizePathSegment(objectName, "payload"));
    if (typeof onProgress === "function") onProgress(12);
    const { error } = await client.storage.from(bucket).upload(objectPath, blob, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    if (typeof onProgress === "function") onProgress(96);
    const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
    if (typeof onProgress === "function") onProgress(100);
    return {
      provider: "supabase",
      bucketName: bucket,
      path: objectPath,
      publicUrl: String(data?.publicUrl || "").trim(),
      sizeBytes: Number(blob.size || 0) || 0,
      objectName: sanitizePathSegment(objectName, "payload"),
      contentType,
    };
  }

  async function downloadDataUrl(pointer = {}, onProgress = null) {
    const bucketName = String(pointer?.bucketName || "").trim();
    const path = String(pointer?.path || "").trim();
    if (!bucketName || !path) return "";
    const client = getClient();
    if (typeof onProgress === "function") onProgress(15);
    const { data, error } = await client.storage.from(bucketName).download(path);
    if (error) throw error;
    if (!data) return "";
    if (typeof onProgress === "function") onProgress(85);
    const dataUrl = await blobToDataUrl(data);
    if (typeof onProgress === "function") onProgress(100);
    return dataUrl;
  }

  async function deleteObject(pointer = {}) {
    const bucketName = String(pointer?.bucketName || "").trim();
    const path = String(pointer?.path || "").trim();
    if (!bucketName || !path) return false;
    const client = getClient();
    const { error } = await client.storage.from(bucketName).remove([path]);
    if (error && !/not found/i.test(String(error.message || ""))) {
      throw error;
    }
    return true;
  }

  async function listFiles({
    userId = "",
    kind = "",
    itemId = "",
    limit = 100,
  } = {}) {
    const config = loadSavedConfig();
    const client = getClient();
    const folder = itemId
      ? buildScopedFolder({ kind, userId, itemId })
      : joinPath(config.folderPath, sanitizePathSegment(kind || "misc", "misc"), sanitizePathSegment(userId || "guest", "guest"));
    const { data, error } = await client.storage.from(config.bucketName).list(folder, {
      limit: Math.max(1, Math.min(500, Number(limit) || 100)),
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  globalScope.AppSupabaseStorage = {
    STORAGE_KEY,
    loadSavedConfig,
    saveConfig,
    isConfigured,
    getClient,
    uploadDataUrl,
    downloadDataUrl,
    deleteObject,
    listFiles,
    buildScopedFolder,
  };
})(globalThis);
