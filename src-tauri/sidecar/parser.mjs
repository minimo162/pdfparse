import fs from "node:fs/promises";
import path from "node:path";
import { projectPagesToGrid } from "./node_modules/@llamaindex/liteparse/dist/src/processing/grid.js";
import { getDocument, GlobalWorkerOptions } from "./node_modules/@llamaindex/liteparse/dist/src/vendor/pdfjs/pdf.mjs";
import * as pdfWorker from "./node_modules/@llamaindex/liteparse/dist/src/vendor/pdfjs/pdf.worker.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";

const filePath = process.argv[2];
const scriptDir =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const pdfAssetDir = path.join(scriptDir, "runtime", "pdfjs");

globalThis.pdfjsWorker = pdfWorker;
GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(pdfAssetDir, "pdf.worker.mjs")).href;

if (!filePath) {
  emitError("No file path provided");
}

if (path.extname(filePath).toLowerCase() !== ".pdf") {
  emitError("Only PDF files are supported");
}

const BUGGY_FONT_MARKER_REGEX = /:->\|>_(\d+)_\d+_<\|<-:/g;
const BUGGY_FONT_MARKER_CHECK = ":->|>";
const PIPE_PATTERN_REGEX = /\s*\|([^|])\|\s*/g;
const TABULAR_FIGURES_MAPPINGS = [
  {
    17: "4",
    18: "6",
    19: "8",
    20: "5",
    21: "9",
    22: "7",
    23: "1",
    24: " ",
    25: ",",
    26: "+",
    27: "-",
    28: "3",
    29: "0",
    30: "2",
    31: ".",
    42: "*",
    150: "-"
  },
  {
    17: "+",
    18: "7",
    19: "-",
    20: "9",
    21: "6",
    22: "3",
    23: "1",
    24: " ",
    25: "8",
    26: "5",
    27: "4",
    28: "0",
    29: "2",
    30: ".",
    31: ",",
    42: "*",
    150: "-"
  }
];
const GRID_CONFIG = {
  ocrEnabled: false,
  outputFormat: "text",
  preciseBoundingBox: false
};
const CMAP_PACKED = true;

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = normalizeError(message);
  process.stderr.write(`${JSON.stringify({ error: normalized })}\n`);
  process.exit(1);
});

async function main() {
  const doc = await loadDocument(filePath);

  try {
    const parsedPages = await extractAllPages(doc);
    const renderedPages = projectPagesToGrid(parsedPages, GRID_CONFIG);
    const pages = renderedPages.map((page) => page.text?.trimEnd() ?? "");

    if (!pages.some((page) => page.trim().length > 0)) {
      emitError("No extractable text found");
    }

    process.stdout.write(
      `${JSON.stringify({
        pages,
        page_count: pages.length,
        char_count: pages.reduce((sum, page) => sum + page.length, 0)
      })}\n`
    );
  } finally {
    await doc.destroy();
  }
}

async function loadDocument(inputPath, password) {
  const data = new Uint8Array(await fs.readFile(inputPath));
  const loadingTask = getDocument({
    data,
    password,
    cMapUrl: `${path.join(pdfAssetDir, "cmaps")}${path.sep}`,
    cMapPacked: CMAP_PACKED,
    standardFontDataUrl: `${path.join(pdfAssetDir, "standard_fonts")}${path.sep}`
  });

  try {
    return await loadingTask.promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("password") || message.includes("Password")) {
      if (password) {
        throw new Error("Incorrect password for this PDF. Please check the password and try again.", {
          cause: error
        });
      }

      throw new Error(
        "This PDF is password-protected. Use --password <password> to provide the document password.",
        { cause: error }
      );
    }

    throw error;
  }
}

async function extractAllPages(doc) {
  const pages = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    pages.push(await extractPage(doc, pageNum));
  }

  return pages;
}

async function extractPage(doc, pageNum) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.0 });
  const textContent = await page.getTextContent();
  const textItems = [];

  for (const item of textContent.items) {
    if (item.height === 0 || item.width === 0) {
      continue;
    }

    const cm = multiplyMatrices(viewport.transform, item.transform);
    const ll = applyTransformation({ x: 0, y: 0 }, cm);
    const scaleX = Math.sqrt(item.transform[0] ** 2 + item.transform[1] ** 2);
    const scaleY = Math.sqrt(item.transform[2] ** 2 + item.transform[3] ** 2);
    const ur = applyTransformation({ x: item.width / scaleX, y: item.height / scaleY }, cm);
    const left = Math.min(ll.x, ur.x);
    const right = Math.max(ll.x, ur.x);
    const top = Math.min(ll.y, ur.y);
    const bottom = Math.max(ll.y, ur.y);

    if (top < 0 || left < 0 || top > viewport.height || left > viewport.width) {
      continue;
    }

    let rotation = getRotation(cm);
    if (rotation < 0) {
      rotation += 360;
    }

    let decodedStr = item.str;
    if (decodedStr.includes(BUGGY_FONT_MARKER_CHECK)) {
      const tabularDecoded = tryDecodeTabularFigures(decodedStr);
      if (tabularDecoded) {
        decodedStr = tabularDecoded;
      } else {
        BUGGY_FONT_MARKER_REGEX.lastIndex = 0;
        decodedStr = decodedStr.replace(BUGGY_FONT_MARKER_REGEX, (_, charCode) =>
          String.fromCharCode(Number.parseInt(charCode, 10))
        );
      }
    }

    if (decodedStr.includes("|")) {
      PIPE_PATTERN_REGEX.lastIndex = 0;
      const matches = [...decodedStr.matchAll(PIPE_PATTERN_REGEX)];
      if (matches.length > 0) {
        decodedStr = matches.map((match) => match[1]).join("");
      }
    }

    if (isGarbledFontOutput(decodedStr)) {
      continue;
    }

    decodedStr = stripControlChars(decodedStr);

    textItems.push({
      str: decodedStr,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      w: right - left,
      h: bottom - top,
      r: rotation,
      fontName: item.fontName,
      fontSize: Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]),
      confidence: 1
    });
  }

  await page.cleanup();

  return {
    pageNum,
    width: viewport.width,
    height: viewport.height,
    textItems,
    images: [],
    annotations: []
  };
}

function getRotation(transform) {
  return Math.atan2(transform[1], transform[0]) * (180 / Math.PI);
}

function multiplyMatrices(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

function applyTransformation(point, transform) {
  return {
    x: point.x * transform[0] + point.y * transform[2] + transform[4],
    y: point.x * transform[1] + point.y * transform[3] + transform[5]
  };
}

function canDecodeAsAscii(glyphs) {
  for (const glyph of glyphs) {
    if (!((glyph >= 32 && glyph <= 126) || glyph === 9 || glyph === 10 || glyph === 13)) {
      return false;
    }
  }

  return true;
}

function scoreNumberFormat(decoded) {
  let score = 0;
  const digitCount = (decoded.match(/[0-9]/g) || []).length;
  score += digitCount * 2;

  if (/^\d{1,3}(,\d{3})*$/.test(decoded)) {
    score += 5;
  }

  if (/^\d+\.\d+$/.test(decoded)) {
    score += 5;
  }

  if (/^[*-]?\d/.test(decoded)) {
    score += 2;
  }

  if (/^\d+$/.test(decoded)) {
    score += 3;
  }

  if (/[.,]{2,}/.test(decoded)) {
    score -= 10;
  }

  if (/^[.,+]|[.,+]$/.test(decoded)) {
    score -= 5;
  }

  if (/,(?!\d{3}(?:[,.]|$))/.test(decoded)) {
    score -= 3;
  }

  if (/\.(?![0-9])/.test(decoded) && !decoded.endsWith(".")) {
    score -= 3;
  }

  return score;
}

function tryDecodeTabularFigures(str) {
  if (!str.includes(BUGGY_FONT_MARKER_CHECK)) {
    return null;
  }

  const glyphs = [];
  let match;
  const regex = /:->\|>_(\d+)_\d+_<\|<-:/g;

  while ((match = regex.exec(str)) !== null) {
    glyphs.push(Number.parseInt(match[1], 10));
  }

  if (glyphs.length === 0 || canDecodeAsAscii(glyphs)) {
    return null;
  }

  const tabularRange = glyphs.every(
    (glyph) => (glyph >= 17 && glyph <= 31) || glyph === 42 || glyph === 150 || glyph === 8 || glyph === 9 || glyph === 10
  );

  if (!tabularRange) {
    return null;
  }

  let bestResult = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const mapping of TABULAR_FIGURES_MAPPINGS) {
    const decoded = glyphs.map((glyph) => mapping[glyph] || "").join("");
    if (glyphs.some((glyph) => !mapping[glyph])) {
      continue;
    }

    const score = scoreNumberFormat(decoded);
    if (score > bestScore) {
      bestScore = score;
      bestResult = decoded;
    }
  }

  return bestResult && bestScore > 0 ? bestResult : null;
}

function stripControlChars(str) {
  let result = "";

  for (const char of str) {
    const code = char.charCodeAt(0);
    if (
      ((code >= 0x00 && code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
        (code >= 0x80 && code <= 0x9f))
    ) {
      continue;
    }

    result += char;
  }

  return result;
}

function isGarbledFontOutput(str) {
  if (str.length < 3) {
    return false;
  }

  let privateUseCount = 0;
  let arabicCount = 0;
  let latinExtendedCount = 0;
  let basicLatinLetterCount = 0;
  let suspiciousCount = 0;
  let controlCharCount = 0;
  let normalCharCount = 0;

  for (const char of str) {
    const code = char.charCodeAt(0);

    if ((code >= 0x00 && code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) || (code >= 0x80 && code <= 0x9f)) {
      controlCharCount += 1;
    } else if (code >= 0xe000 && code <= 0xf8ff) {
      privateUseCount += 1;
    } else if ((code >= 0x600 && code <= 0x6ff) || (code >= 0x750 && code <= 0x77f) || (code >= 0x8a0 && code <= 0x8ff)) {
      arabicCount += 1;
    } else if ((code >= 0x100 && code <= 0x24f) || (code >= 0x1e00 && code <= 0x1eff)) {
      latinExtendedCount += 1;
    } else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
      basicLatinLetterCount += 1;
      normalCharCount += 1;
    } else if (
      (code >= 0x700 && code <= 0x7ff) ||
      (code >= 0x800 && code <= 0x83f) ||
      (code >= 0xfff0 && code <= 0xffff) ||
      (code >= 0x2500 && code <= 0x25ff) ||
      (code >= 0x0300 && code <= 0x036f)
    ) {
      suspiciousCount += 1;
    } else if ((code >= 0x20 && code <= 0x7e) || code === 0x09 || code === 0x0a || code === 0x0d) {
      normalCharCount += 1;
    }
  }

  const totalChars = str.length;

  if (controlCharCount > 0 && controlCharCount > normalCharCount) {
    return true;
  }

  if (privateUseCount >= 2) {
    return true;
  }

  if (arabicCount >= 2 && latinExtendedCount >= 2) {
    return true;
  }

  if (suspiciousCount >= 3 || suspiciousCount > totalChars * 0.2) {
    return true;
  }

  if (latinExtendedCount > totalChars * 0.3 && basicLatinLetterCount < totalChars * 0.2) {
    return true;
  }

  return (arabicCount >= 1 || suspiciousCount >= 1) && latinExtendedCount >= 3;
}

function normalizeError(message) {
  if (process.env.PDFPARSE_DEBUG === "1") {
    return message;
  }

  if (/password|encrypt|Incorrect Password|No password given/i.test(message)) {
    return "This PDF is password-protected";
  }

  if (/no text/i.test(message)) {
    return "No extractable text found";
  }

  return "Unable to read this file";
}

function emitError(message) {
  process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  process.exit(1);
}
