import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./MarkdownPreview.module.css";

function RefSpan({
  text,
  className,
  summary,
  onClick,
}: {
  text: string;
  className: string;
  summary: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      className={`${className} ${onClick ? styles.clickableRef : ""}`}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {text}
      {hovered && summary && (
        <span className={styles.refPopover}>{summary}</span>
      )}
    </span>
  );
}

interface SiblingInfo {
  name: string;
  summary: string;
  kind: string;
}

interface MarkdownPreviewProps {
  content: string;
  siblingNames: string[];
  siblings: SiblingInfo[];
  onNavigate?: (name: string) => void;
}

type RefMap = Record<string, { summary: string; kind: string }>;

export function MarkdownPreview({
  content,
  siblingNames,
  siblings,
  onNavigate,
}: MarkdownPreviewProps) {
  const siblingPattern = useMemo(() => {
    if (siblingNames.length === 0) return null;
    const escaped = siblingNames.map((n) =>
      n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    return new RegExp(
      `@(${escaped.join("|")})(\\.[a-zA-Z_][a-zA-Z0-9_]*)?\\b`,
      "gi"
    );
  }, [siblingNames]);

  const refMap = useMemo<RefMap>(() => {
    const map: RefMap = {};
    for (const s of siblings) {
      map[s.name.toLowerCase()] = { summary: s.summary, kind: s.kind };
    }
    return map;
  }, [siblings]);

  const stripped = useMemo(() => {
    if (content.startsWith("---")) {
      const end = content.indexOf("\n---", 3);
      if (end !== -1) return content.slice(end + 4).trimStart();
    }
    return content;
  }, [content]);

  return (
    <div className={styles.preview}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={
          siblingPattern
            ? {
                p: ({ children, ...props }) => (
                  <p {...props}>
                    {highlightChildStrings(children, siblingPattern, refMap, onNavigate)}
                  </p>
                ),
                li: ({ children, ...props }) => (
                  <li {...props}>
                    {highlightChildStrings(children, siblingPattern, refMap, onNavigate)}
                  </li>
                ),
              }
            : undefined
        }
      >
        {stripped}
      </ReactMarkdown>
    </div>
  );
}

function highlightRefs(
  text: string,
  pattern: RegExp,
  refMap: RefMap,
  onNavigate?: (name: string) => void
): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const baseName = match[1];
    const info = refMap[baseName.toLowerCase()];
    const className =
      info?.kind === "sibling" ? "ref-sibling" : "ref-contained";
    parts.push(
      <RefSpan
        key={match.index}
        text={match[0]}
        className={className}
        summary={info?.summary || ""}
        onClick={onNavigate ? () => onNavigate(baseName) : undefined}
      />
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function highlightChildStrings(
  children: React.ReactNode,
  pattern: RegExp,
  refMap: RefMap,
  onNavigate?: (name: string) => void
): React.ReactNode {
  if (typeof children === "string") {
    return <>{highlightRefs(children, pattern, refMap, onNavigate)}</>;
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        return <span key={i}>{highlightRefs(child, pattern, refMap, onNavigate)}</span>;
      }
      return child;
    });
  }
  return children;
}
