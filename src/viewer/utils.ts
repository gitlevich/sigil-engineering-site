import type { Context } from "./types";

export function findContext(root: Context, path: string[]): Context {
  let current = root;
  for (const seg of path) {
    const child = current.children.find((c) => c.name === seg);
    if (!child) return current;
    current = child;
  }
  return current;
}

export function buildBreadcrumb(
  root: Context,
  path: string[]
): { name: string; path: string[] }[] {
  // Skip the root — its children are the real top-level entries
  const crumbs: { name: string; path: string[] }[] = [];
  let current = root;
  for (let i = 0; i < path.length; i++) {
    const child = current.children.find((c) => c.name === path[i]);
    if (!child) break;
    crumbs.push({ name: child.name, path: path.slice(0, i + 1) });
    current = child;
  }
  return crumbs;
}

/** Flatten the tree into a list of paths in visible (depth-first) order. */
export function flattenPaths(
  context: Context,
  path: string[]
): string[][] {
  const result: string[][] = [path];
  for (const child of context.children) {
    result.push(...flattenPaths(child, [...path, child.name]));
  }
  return result;
}

/** Find path from root to a context by name (DFS). */
export function buildPath(
  ctx: Context,
  targetName: string,
  path: string[]
): string[] | null {
  for (const child of ctx.children) {
    const childPath = [...path, child.name];
    if (child.name.toLowerCase() === targetName.toLowerCase()) return childPath;
    const found = buildPath(child, targetName, childPath);
    if (found) return found;
  }
  return null;
}

export interface Ref {
  name: string;
  prefix: "@" | "#" | "!";
  summary: string;
  navigable: boolean;
}

/** Build the full lexical scope for the current path: contexts (@), affordances (#), invariants (!). */
export function buildLexicalScope(
  root: Context,
  currentPath: string[]
): Ref[] {
  const refs: Ref[] = [];
  const seen = new Set<string>();
  const currentCtx = findContext(root, currentPath);

  const addContext = (name: string, ctx: Context) => {
    const key = `@${name}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ name, prefix: "@", summary: makeSummary(ctx), navigable: true });
    }
  };

  // Children of current context
  for (const c of currentCtx.children) {
    addContext(c.name, c);
  }

  // Walk up ancestry
  for (let depth = currentPath.length; depth > 0; depth--) {
    const levelPath = currentPath.slice(0, depth);
    const levelCtx = findContext(root, levelPath);
    const parentPath = levelPath.slice(0, -1);
    const parentCtx = findContext(root, parentPath);

    addContext(levelCtx.name, levelCtx);

    for (const c of parentCtx.children) {
      if (c.name !== levelCtx.name) {
        addContext(c.name, c);
      }
    }
  }

  addContext(root.name, root);

  // Flatten ontology refs
  const ontologiesSigil = root.children.find((c) => c.name === "Libs");
  if (ontologiesSigil) {
    for (const ontology of ontologiesSigil.children) {
      flattenOntologyRefs(ontology, seen, refs);
    }
  }

  // Affordances and invariants of current context
  for (const a of currentCtx.affordances) {
    const key = `#${a.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ name: a.name, prefix: "#", summary: a.content, navigable: false });
    }
  }
  for (const inv of currentCtx.invariants) {
    const key = `!${inv.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ name: inv.name, prefix: "!", summary: inv.content, navigable: false });
    }
  }

  return refs;
}

function makeSummary(ctx: Context): string {
  let text = ctx.domain_language || "";
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) text = text.slice(end + 4);
  }
  return text
    .split("\n")
    .filter((l) => l.trim() && !l.trimStart().startsWith("#"))
    .slice(0, 3)
    .join("\n");
}

function flattenOntologyRefs(
  ctx: Context,
  seen: Set<string>,
  refs: Ref[]
) {
  for (const child of ctx.children) {
    const key = `@${child.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ name: child.name, prefix: "@", summary: makeSummary(child), navigable: true });
    }
    flattenOntologyRefs(child, seen, refs);
  }
}
