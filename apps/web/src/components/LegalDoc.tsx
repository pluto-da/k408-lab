import type { ReactNode } from "react";
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
  return (
    <div className="page-pad">
      <article className="legal">
        <header className="legal__head">
          <p className="eyebrow">{SITE_NAME}</p>
          <h1>{title}</h1>
          <p className="muted small">更新日期：{LEGAL_UPDATED} · 生效日期：{LEGAL_UPDATED}</p>
        </header>
        <div className="legal__intro">{intro}</div>
        {children}
        <footer className="legal__foot muted small">
          另见{other === "terms" ? <Link to="/terms">《用户协议》</Link> : <Link to="/privacy">《隐私政策》</Link>}。
        </footer>
      </article>
    </div>
  );
}
