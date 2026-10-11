import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { CONTACT_EMAIL, LEGAL_UPDATED } from "../lib/site";
import { SITE_NAME } from "../lib/seo";

export function Contact() {
  return CONTACT_EMAIL ? (
    <>
      发送邮件至 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </>
  ) : (
    <>通过本站公布的联系方式</>
  );
}

export default function LegalDoc({ title, intro, children, other }: { title: string; intro: ReactNode; children: ReactNode; other: "terms" | "privacy" }) {
  const ref = useRef<HTMLElement>(null);
  const [toc, setToc] = useState<{ id: string; t: string }[]>([]);
  // 目录：平板以上默认展开，手机上默认折叠
  const [tocOpen, setTocOpen] = useState(() => typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches);
  // 目录从正文各节标题生成，章节增删后不用手动同步
  useEffect(() => {
    const secs = ref.current?.querySelectorAll<HTMLElement>("section[id] > h2") ?? [];
    setToc(Array.from(secs, (h) => ({ id: h.parentElement!.id, t: h.textContent ?? "" })));
  }, []);
  return (
    <div className="page-pad">
      <article className="legal" ref={ref}>
        <header className="legal__head">
          <p className="eyebrow">{SITE_NAME}</p>
          <h1>{title}</h1>
          <p className="muted small">更新日期：{LEGAL_UPDATED} · 生效日期：{LEGAL_UPDATED}</p>
        </header>
        <div className="legal__intro">{intro}</div>
        {toc.length > 0 && (
          <details className="legal__toc" open={tocOpen} onToggle={(e) => setTocOpen(e.currentTarget.open)}>
            <summary>目录</summary>
            <nav aria-label="目录">
              <ol>
                {toc.map((x) => (
                  <li key={x.id}>
                    <a href={`#${x.id}`}>{x.t.replace(/^[一二三四五六七八九十]+、/, "")}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </details>
        )}
        {children}
        <footer className="legal__foot muted small">
          另见{other === "terms" ? <Link to="/terms">《用户协议》</Link> : <Link to="/privacy">《隐私政策》</Link>}。
        </footer>
      </article>
    </div>
  );
}
