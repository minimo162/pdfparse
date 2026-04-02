import { execSync, spawnSync } from "node:child_process";
import { build } from "esbuild";
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const mode = process.argv[2] ?? "current";
const cwd = process.cwd();
const legacyStageDir = join(cwd, ".pkg-stage");
const stageDir = join(cwd, `.pkg-stage-${process.pid}`);
const bundleEntry = join(stageDir, "parser.bundle.mjs");
const runtimeDir = join(stageDir, "runtime");
const runtimePdfJsDir = join(runtimeDir, "pdfjs");
const stagePackage = join(stageDir, "package.json");
const legacyBundleEntry = join(cwd, "parser.bundle.mjs");
const legacyWorkerEntry = join(cwd, "pdf.worker.mjs");
const legacyRuntimeDir = join(cwd, "runtime");
const isWindows = process.platform === "win32";
const liteparsePdfJsDir = join(
  cwd,
  "node_modules",
  "@llamaindex",
  "liteparse",
  "dist",
  "src",
  "vendor",
  "pdfjs"
);
const pkgBin = join(cwd, "node_modules", ".bin", isWindows ? "pkg.cmd" : "pkg");

const targetMap = {
  "x86_64-unknown-linux-gnu": "node22-linux-x64",
  "x86_64-apple-darwin": "node22-macos-x64",
  "aarch64-apple-darwin": "node22-macos-arm64",
  "x86_64-pc-windows-msvc": "node22-win-x64"
};

const hostTriple = execSync("rustc -vV", { encoding: "utf8" })
  .split("\n")
  .find((line) => line.startsWith("host: "))
  ?.replace("host: ", "")
  .trim();

if (!hostTriple) {
  throw new Error("Failed to determine current Rust target triple");
}

const targets =
  mode === "all"
    ? Object.entries(targetMap)
    : [[hostTriple, targetMap[hostTriple]]];

if (!targets[0]?.[0] || !targets[0]?.[1]) {
  throw new Error(`Unsupported host target triple: ${hostTriple}`);
}

cleanupDir(stageDir);
cleanupDir(legacyStageDir);
cleanupFile(legacyBundleEntry);
cleanupFile(legacyWorkerEntry);
cleanupDir(legacyRuntimeDir);

cpSync(liteparsePdfJsDir, runtimePdfJsDir, { recursive: true });
writeFileSync(
  stagePackage,
  JSON.stringify(
    {
      name: "pdfparse-sidecar-bundle",
      private: true,
      type: "module",
      bin: "parser.bundle.mjs",
      pkg: {
        assets: ["runtime/pdfjs/**/*"]
      }
    },
    null,
    2
  )
);

await build({
  entryPoints: [join(cwd, "parser.mjs")],
  outfile: bundleEntry,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "none"
});

let failed = false;

for (const [outputTarget, pkgTarget] of targets) {
  const outputSuffix = outputTarget.endsWith(".exe") ? outputTarget : outputTarget;
  const output = join(cwd, `pdfparse-parser-${outputSuffix}`);
  const result = spawnSync(
    pkgBin,
    [
      stagePackage,
      "--targets",
      pkgTarget,
      "--output",
      output,
      "--no-bytecode",
      "--public",
      "--public-packages",
      "*"
    ],
    {
      cwd,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    failed = true;
    process.exit(result.status ?? 1);
  }
}

if (!failed) {
  cleanupDir(stageDir);
}

function cleanupDir(targetPath) {
  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }
}

function cleanupFile(targetPath) {
  if (existsSync(targetPath)) {
    rmSync(targetPath, { force: true });
  }
}
