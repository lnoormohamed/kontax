import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, "src");

const resolveWithExtensions = (absolutePath) => {
  const candidates = [
    absolutePath,
    `${absolutePath}.ts`,
    `${absolutePath}.tsx`,
    `${absolutePath}.js`,
    `${absolutePath}.mjs`,
    path.join(absolutePath, "index.ts"),
    path.join(absolutePath, "index.tsx"),
    path.join(absolutePath, "index.js"),
    path.join(absolutePath, "index.mjs"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

export async function resolve(specifier, context, defaultResolve) {
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

  return defaultResolve(specifier, context, defaultResolve);
}
