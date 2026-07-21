// Shared truncation + tooltip component.
// Usage (plain text): <Truncate text={someLongString} maxLength={24} className="session-title" />
// Usage (clickable):  <Truncate text={filename} maxLength={22} className="source-tag" href={url} />
//
// If text fits within maxLength, renders plain (no tooltip machinery, no extra DOM).
// If it's longer, shows the truncated label and a custom hover tooltip with the full text
// (not relying on native browser `title=` tooltips, which are slow/inconsistent/unstyled).
// If `href` is provided, wraps everything in a link that opens in a new tab.
export default function Truncate({ text, maxLength = 24, className = "", href }) {
  if (!text) return null;

  const isTruncated = text.length > maxLength;
  const display = isTruncated ? text.slice(0, maxLength - 1).trimEnd() + "…" : text;

  const inner = isTruncated ? (
    <span className="tt-wrap">
      <span className="tt-label">{display}</span>
      <span className="tt-bubble" role="tooltip">{text}</span>
    </span>
  ) : (
    text
  );

  const linkClassName = className + " tt-link";
  const linkTitle = "Open " + text;

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={linkClassName} title={linkTitle}>{inner}</a>;
  }

  return <span className={className}>{inner}</span>;
}