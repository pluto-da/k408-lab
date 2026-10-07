import { SUBJECT_COLORS, SUBJECT_SHORT, type Subject } from "@k408/shared";

export function SubjectTag({ subject }: { subject: Subject }) {
  return (
    <span className="tag" style={{ ["--c" as string]: SUBJECT_COLORS[subject] }}>
      {SUBJECT_SHORT[subject]}
    </span>
  );
}

export function Bar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} 星`}>
      {"★★★".slice(0, n)}
      <i>{"★★★".slice(n)}</i>
    </span>
  );
}

/** 题库里的 HTML（仅含 code 等简单标签）由服务端种子提供，可信 */
export function Html({ html, as: Tag = "span", className }: { html: string; as?: "span" | "div" | "p"; className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
