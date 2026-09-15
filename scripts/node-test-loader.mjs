import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, "src");

// A candidate that exists but is a directory (e.g. `generated/prisma`, which
// is a real directory AND has sibling files like `generated/prisma.ts` would
// not — but the bare directory itself must never be handed to the default
// loader, which will try to `readFileSync` it and blow up with EISDIR) is
// never a valid module resolution on its own — it must resolve to one of its
// `index.*` files instead. So: prefer any candidate that is a FILE, in the
// declared order, and only fall back to a directory's `index.*` if nothing
// file-shaped matched.
const isFile = (candidate) => {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
};

const resolveWithExtensions = (absolutePath) => {
  const fileCandidates = [
    absolutePath,
    `${absolutePath}.ts`,
    `${absolutePath}.tsx`,
    `${absolutePath}.js`,
    `${absolutePath}.mjs`,
  ];
  const directFile = fileCandidates.find((candidate) => isFile(candidate));
  if (directFile) return directFile;

  const indexCandidates = [
    path.join(absolutePath, "index.ts"),
    path.join(absolutePath, "index.tsx"),
    path.join(absolutePath, "index.js"),
    path.join(absolutePath, "index.mjs"),
  ];
  const indexFile = indexCandidates.find((candidate) => isFile(candidate));
  if (indexFile) return indexFile;

  // Last resort: something exists at the bare path but isn't a file and has
  // no index.* (shouldn't normally happen) — let existsSync's original
  // behaviour decide rather than silently failing to resolve.
  return existsSync(absolutePath) ? absolutePath : null;
};

// P48-13: the authz harness (tests/node/authz/) imports real server actions
// and route handlers (not reimplementations of their logic), so it runs into
// two things Next.js's own bundler papers over that plain `node --test`
// does not:
//
// 1. `server-only` / `client-only` are React's build-time markers. Next.js
//    aliases them to internal no-op stubs inside webpack/Turbopack; neither
//    package is an actual npm dependency here (confirmed: absent from
//    node_modules and package.json — Next.js needs no such install). Stub
//    both to an empty module so a plain `import "server-only"` in, say,
//    `src/server/auth/require-session.ts` resolves instead of 404ing.
// 2. `next` ships no `"exports"` map in its package.json, so Node's ESM
//    resolver — unlike Next's own bundler, and unlike CJS `require()` — will
//    not probe `cache.js` for a bare `next/cache` specifier; every extension-
//    less deep import (`next/cache`, `next/navigation`, `next/headers`, …)
//    404s under plain `node --test`. Retry once with `.js` appended before
//    giving up.
const STUB_SPECIFIERS = new Set(["server-only", "client-only"]);
const EMPTY_MODULE_URL = "data:text/javascript,export {}";

// `next/cache`'s revalidatePath/revalidateTag read Next's per-request
// AsyncLocalStorage store (the "static generation store") to know which
// request to invalidate caches for. Outside an actual Next.js request — e.g.
// a server action called directly from a test — that store doesn't exist,
// and the real implementation throws
// "Invariant: static generation store missing in revalidatePath ...".
// Cache invalidation is a side effect the authz suite (tests/node/authz/)
// has no way to observe or care about, so stub the whole module to no-ops;
// `unstable_cache`'s wrapped function still needs to run, so it's an
// identity passthrough rather than a no-op.
const NEXT_CACHE_STUB_URL =
  "data:text/javascript," +
  encodeURIComponent(
    [
      "export function revalidatePath() {}",
      "export function revalidateTag() {}",
      "export function unstable_expirePath() {}",
      "export function unstable_expireTag() {}",
      "export function unstable_noStore() {}",
      "export function unstable_cacheLife() {}",
      "export function unstable_cacheTag() {}",
      "export function unstable_cache(fn) { return fn; }",
    ].join("\n"),
  );

const resolveNextSubpathFallback = async (specifier, context, defaultResolve) => {
  if (!/^next\/[^./]+(?:\/[^./]+)*$/.test(specifier)) return null;
  try {
    return await defaultResolve(`${specifier}.js`, context, defaultResolve);
  } catch {
    return null;
  }
};

export async function resolve(specifier, context, defaultResolve) {
  if (STUB_SPECIFIERS.has(specifier)) {
    return { shortCircuit: true, url: EMPTY_MODULE_URL };
  }

  if (specifier === "next/cache") {
    return { shortCircuit: true, url: NEXT_CACHE_STUB_URL };
  }

  if (specifier.startsWith("~/")) {
    const candidate = resolveWithExtensions(
      path.join(SRC_ROOT, specifier.slice(2)),
    );
    if (candidate) {
      return {
        shortCircuit: true,
        url: pathToFileURL(candidate).href,
      };
    }
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !path.extname(specifier)
  ) {
    const parentPath = context.parentURL
      ? new URL(context.parentURL).pathname
      : ROOT;
    const candidate = resolveWithExtensions(
      path.resolve(path.dirname(parentPath), specifier),
    );
    if (candidate) {
      return {
        shortCircuit: true,
        url: pathToFileURL(candidate).href,
      };
    }
  }

  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    const fallback = await resolveNextSubpathFallback(specifier, context, defaultResolve);
    if (fallback) return fallback;
    throw error;
  }
}

// P48-13: `--experimental-strip-types` erases TYPE annotations only — it has
// no JSX transform, so any `.tsx` reached transitively from a test (e.g. the
// authz harness importing a real server action that pulls in a React Email
// template under src/emails/*.tsx) fails Node's own format detection with
// ERR_UNKNOWN_FILE_EXTENSION before strip-types even gets a look at it.
// `typescript` is already a direct devDependency (used for `npm run
// typecheck`), so reuse its synchronous, dependency-free `transpileModule` to
// both strip types AND desugar JSX to `React.createElement` calls — matching
// this codebase's emails, which import `React` explicitly rather than relying
// on the automatic runtime. Only intercepts `.tsx`/`.jsx`; every `.ts` file
// still goes through Node's own native strip-types path untouched.
const JSX_EXTENSIONS = new Set([".tsx", ".jsx"]);

export async function load(url, context, defaultLoad) {
  const ext = path.extname(new URL(url).pathname);
  if (url.startsWith("file:") && JSX_EXTENSIONS.has(ext)) {
    const filePath = fileURLToPath(url);
    const source = readFileSync(filePath, "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: filePath,
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }

  return defaultLoad(url, context, defaultLoad);
}
