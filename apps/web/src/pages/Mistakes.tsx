import { useState } from "react";
import { Link } from "react-router-dom";
import { SUBJECTS, SUBJECT_NAMES, flowById, type MistakeDto, type Subject } from "@k408/shared";
import { useMistakeActions, useMistakes, type MistakeStatus } from "../api/hooks";
import { errorMessage } from "../api/client";
import RequireAuth from "../components/RequireAuth";
import { Html, SubjectTag } from "../components/ui";
import { fmtDate } from "../lib/format";

const LETTERS = "ABCDEFGHIJ";

function Txt({ html, text, isHtml }: { html?: string; text?: string; isHtml: boolean }) {
  return isHtml ? <Html html={html ?? text ?? ""} /> : <span>{text ?? html}</span>;
}

function Redo({ m, onClose }: { m: MistakeDto; onClose: () => void }) {
  const { redo, refresh } = useMistakeActions();
  const [order, setOrder] = useState<string[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  // 打乱选项顺序（排序题必须打乱）
  const [opts] = useState(() => {
    const idx = m.options.map((_, i) => i);
    if (m.source === "flow")
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j]!, idx[i]!];
      }
    return idx;
  });

  const submit = (answer: number | string | string[]) =>
    redo.mutate(
      { id: m.id, answer },
      {
        onSuccess: (r) => setResult(r.correct),
      },
    );

  if (result !== null)
    return (
      <div className={result ? "redo redo--ok" : "redo redo--bad"}>
        <b>{result ? "✓ 答对了，已标记为已掌握" : "✗ 还是不对，再看看解析"}</b>
        <p>
          正确答案：<Txt html={m.correctAnswer} isHtml={m.optionsAreHtml} />
        </p>
        <p>
          <Txt html={m.explanation} isHtml={m.explanationIsHtml} />
        </p>
        <div className="row">
          {!result && (
            <button
              type="button"
              className="app-btn app-btn--ghost"
              onClick={() => {
                setResult(null);
                setOrder([]);
              }}
            >
              再做一次
            </button>
          )}
          <button
            type="button"
            className="app-btn"
            onClick={() => {
              refresh();
              onClose();
            }}
          >
            完成
          </button>
        </div>
      </div>
    );

  if (m.options.length === 0)
    return (
      <div className="redo">
        <p className="muted">这道题没有记录选项，回到实验室重新闯关即可。</p>
        <Link className="app-btn" to="/lab#hero">
          去闯关
        </Link>
      </div>
    );

  if (m.stepType === "order")
    return (
      <div className="redo">
        <p className="muted">按正确顺序依次点选：{order.length ? order.join(" → ") : "（未选）"}</p>
        <div className="opts">
          {opts.map((i) => {
            const o = m.options[i]!;
            return (
              <button key={i} type="button" disabled={order.includes(o)} onClick={() => setOrder([...order, o])}>
                {o}
              </button>
            );
          })}
        </div>
        <div className="row">
          <button type="button" className="app-btn app-btn--ghost" onClick={() => setOrder([])}>
            清空
          </button>
          <button type="button" className="app-btn" disabled={order.length !== m.options.length || redo.isPending} onClick={() => submit(order)}>
            提交
          </button>
        </div>
        {redo.error && <p className="form-err">{errorMessage(redo.error)}</p>}
      </div>
    );

  return (
    <div className="redo">
      <div className="opts">
        {opts.map((i) => (
          <button key={i} type="button" disabled={redo.isPending} onClick={() => submit(m.source === "quiz" ? i : m.options[i]!)}>
            {m.source === "quiz" && <b>{LETTERS[i]}</b>}
            <Txt html={m.options[i]} isHtml={m.optionsAreHtml} />
          </button>
        ))}
      </div>
      {redo.error && <p className="form-err">{errorMessage(redo.error)}</p>}
    </div>
  );
}

function Card({ m }: { m: MistakeDto }) {
  const [showWhy, setShowWhy] = useState(false);
  const [redoing, setRedoing] = useState(false);
  const { setMastered, remove } = useMistakeActions();
  const where = m.source === "quiz" ? "自测" : `闯关 · ${flowById(m.flowId ?? "")?.title ?? m.flowId} · 第 ${(m.stepIndex ?? 0) + 1} 步`;

  return (
    <article className={m.mastered ? "panel mistake is-mastered" : "panel mistake"}>
      <header>
        <SubjectTag subject={m.subject} />
        <span className="muted">{where}</span>
        <span className="muted">
          错 {m.wrongCount} 次 · {fmtDate(m.lastWrongAt)}
        </span>
        {m.mastered && <span className="badge">已掌握</span>}
      </header>
      <h3>
        <Txt html={m.prompt} isHtml={m.promptIsHtml} />
      </h3>
      {redoing ? (
        <Redo m={m} onClose={() => setRedoing(false)} />
      ) : (
        <>
          <dl className="kv">
            <div>
              <dt>你的选择</dt>
              <dd className="is-bad">
                <Txt html={m.chosen} isHtml={m.optionsAreHtml} />
              </dd>
            </div>
            {showWhy && (
              <>
                <div>
                  <dt>正确答案</dt>
                  <dd className="is-ok">
                    <Txt html={m.correctAnswer} isHtml={m.optionsAreHtml} />
                  </dd>
                </div>
                <div>
                  <dt>解析</dt>
                  <dd>
                    <Txt html={m.explanation || "（暂无解析）"} isHtml={m.explanationIsHtml} />
                  </dd>
                </div>
              </>
            )}
          </dl>
          <div className="row">
            <button type="button" className="app-btn" onClick={() => setRedoing(true)}>
              重做
            </button>
            <button type="button" className="app-btn app-btn--ghost" onClick={() => setShowWhy(!showWhy)}>
              {showWhy ? "收起解析" : "看答案与解析"}
            </button>
            <button
              type="button"
              className="app-btn app-btn--ghost"
              disabled={setMastered.isPending}
              onClick={() => setMastered.mutate({ id: m.id, mastered: !m.mastered })}
            >
              {m.mastered ? "移回待复习" : "标记已掌握"}
            </button>
            <button
              type="button"
              className="app-btn app-btn--text"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm("确定删除这道错题？")) remove.mutate(m.id);
              }}
            >
              删除
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function MistakesInner() {
  const [subject, setSubject] = useState<Subject | undefined>();
  const [status, setStatus] = useState<MistakeStatus>("active");
  const [source, setSource] = useState<"quiz" | "flow" | undefined>();
  const q = useMistakes({ subject, status, source }, true);
  const counts = q.data?.counts;
  const total = (s?: Subject) =>
    counts ? (s ? [counts[s]] : Object.values(counts)).reduce((a, c) => a + (status === "mastered" ? c.mastered : status === "active" ? c.active : c.active + c.mastered), 0) : 0;

  return (
    <div className="page-pad">
      <header className="page-head">
        <h1>错题本</h1>
        <p className="muted">自测答错的题、闯关中走错的每一步都会自动收录。重做答对即标记为已掌握。</p>
      </header>
      <div className="filters">
        <div className="seg" role="tablist" aria-label="状态">
          {(
            [
              ["active", "待复习"],
              ["mastered", "已掌握"],
              ["all", "全部"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={status === k} onClick={() => setStatus(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="chips" aria-label="科目">
          <button type="button" aria-pressed={!subject} onClick={() => setSubject(undefined)}>
            全部科目 {total()}
          </button>
          {SUBJECTS.map((s) => (
            <button key={s} type="button" aria-pressed={subject === s} onClick={() => setSubject(s)}>
              {SUBJECT_NAMES[s]} {total(s)}
            </button>
          ))}
        </div>
        <div className="seg" aria-label="来源">
          {(
            [
              [undefined, "全部来源"],
              ["quiz", "自测"],
              ["flow", "闯关"],
            ] as const
          ).map(([k, label]) => (
            <button key={label} type="button" aria-selected={source === k} onClick={() => setSource(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {q.isLoading ? (
        <p className="muted">加载中…</p>
      ) : q.error ? (
        <p className="form-err">{errorMessage(q.error)}</p>
      ) : q.data && q.data.items.length === 0 ? (
        <div className="empty">
          <p>{status === "mastered" ? "还没有已掌握的错题。" : "这里空空的。去做自测或闯关吧，走错的地方会自动收进来。"}</p>
          <Link className="app-btn" to="/lab#quiz">
            去自测
          </Link>
        </div>
      ) : (
        <div className="mistake-list">{q.data?.items.map((m) => <Card key={m.id} m={m} />)}</div>
      )}
    </div>
  );
}

export default function MistakesPage() {
  return (
    <RequireAuth title="错题本">
      <MistakesInner />
    </RequireAuth>
  );
}
