  // ---------------------------------------------------------------- render
  if (phase === "pick") {
    return (
      <div className="rd-root">
        <div className="rd-pick" role="dialog" aria-modal="true" aria-labelledby="rd-pick-h">
          <h2 id="rd-pick-h">化身数据</h2>
          <p>变成一段数据，钻进电脑里亲自走一遍。选一条路线：</p>
          <ul>
            {ROUTES.map((r) => (
              <li key={r.id}>
                <button type="button" disabled={!r.ready} onClick={() => void startRide(params, true)}>
                  <b>{r.title}</b>
                  <small>{r.brief}</small>
                  {!r.ready && <em>即将开放</em>}
                </button>
              </li>
            ))}
          </ul>
          <div className="rd-pick__foot">
            <button type="button" className="rd-btn" onClick={onExit}>
              返回整机
            </button>
          </div>
        </div>
      </div>
    );
  }

  const forkNow = !!st?.fork && arrived && phase === "ride";
  const ans = answers[idx];
  const canNext = arrived ? revealed : true;
  const showResult = !!st?.result && arrived && (judge ? !!ans || !st.fork : cueDone.has(idx));
  const style = { ["--rd-cap" as string]: String(capSize) } as CSSProperties;
  const judged = Object.values(answers);

  const flight = st?.cue.kind === "bus";
  const wideL = layout === "wide";
  const tallL = layout === "tall";
  const shortL = layout === "short";
  const minimized = tallL && flight && !flightOpen;
  const drawerMin = tallL && (minimized || drawer === "min");
  const nextLabel = arrived && idx === N - 1 ? "看小结" : arrived ? "下一站" : "到站";
  const note = shellNote(st, arrived);
  const vis = stationVisual(st, arrived, showResult);
  const viewName = VIEWS.find((v) => v.id === view)!.label;
  const openPanel = (p: Panel) => {
    setMenu(null);
    setPanel(panel === p ? null : p);
  };
  const rootCls = ["rd-root", `rd-L--${layout}`, immersive ? "is-imm" : "", tallL ? `is-drawer-${drawerMin ? "min" : drawer}` : "", touch ? "is-touch" : "", reduced ? "is-reduced" : ""].filter(Boolean).join(" ");

  // ---------------- 更多菜单：视图 / 设置，每项左图标右文字，开关统一样式
  const sw = (label: string, on: boolean, set: (v: boolean) => void, icon: string) => (
    <button type="button" role="menuitemcheckbox" aria-checked={on} className="rd-mi" onClick={() => set(!on)}>
      <Icon d={icon} />
      <span>{label}</span>
      <i className="rd-sw" aria-hidden="true" />
    </button>
  );
  const viewItems = VIEWS.map((v) => (
    <button key={v.id} type="button" role="menuitemradio" aria-checked={view === v.id} className="rd-mi" onClick={() => (setView(v.id), setMenu(null))}>
      <Icon d={VIEW_ICON[v.id]} />
      <span>{v.label}</span>
      {view === v.id && <Icon d={I.check} className="rd-mi__check" />}
    </button>
  ));
  const moreMenu = menu === "more" && (
    <div className={tallL ? "rd-menu rd-menu--up" : "rd-menu"} role="menu" aria-label="更多">
      <h4>视图</h4>
      {!wideL && viewItems}
      {sw("小地图", showMap, setShowMap, I.map)}
      <button type="button" role="menuitem" className="rd-mi" onClick={() => openPanel("text")}>
        <Icon d={I.list} />
        <span>文字版路线</span>
      </button>
      {!wideL && (
        <div className="rd-mi__row" role="group" aria-label="前进方式">
          <Icon d={I.route} />
          <span>前进方式</span>
          <span className="rd-seg">
            <button type="button" aria-pressed={mode === "auto"} onClick={() => setMode("auto")}>
              自动巡航
            </button>
            <button type="button" aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>
              手动游走
            </button>
          </span>
        </div>
      )}
      <hr />
      <h4>设置</h4>
      <button type="button" role="menuitem" className="rd-mi" onClick={() => openPanel("params")}>
        <Icon d={I.sliders} />
        <span>参数</span>
      </button>
      {sw("岔路口由我来判断", judge, setJudge, I.fork)}
      {sw("讲完自动继续", autoNext, setAutoNext, I.auto)}
      {sw("减少动态效果", reduced, setReduced, I.motion)}
      <div className="rd-mi__row" role="group" aria-label="字幕大小">
        <Icon d={I.type} />
        <span>字幕大小</span>
        <span className="rd-seg">
          {[0.9, 1, 1.18].map((v, i) => (
            <button key={v} type="button" aria-pressed={capSize === v} onClick={() => setCapSize(v)}>
              {["小", "中", "大"][i]}
            </button>
          ))}
        </span>
      </div>
      {wideL && <p className="rd-menu__keys">键盘：← / → 上一站 / 下一站，空格暂停，W / S 前进后退，Q / E 减速 / 加速，V 切换视角，H 只看画面，Esc 返回。</p>}
    </div>
  );
  const moreBtn = (
    <span className="rd-more">
      <button type="button" className={`rd-btn rd-btn--icon${tallL ? "" : " rd-glass"}${menu === "more" ? " is-on" : ""}`} onClick={() => setMenu((m) => (m === "more" ? null : "more"))} aria-expanded={menu === "more"} aria-haspopup="menu" aria-label="更多" title="更多">
        <Icon d={I.more} w={2.6} />
      </button>
      {moreMenu}
    </span>
  );

  // ---------------- 画面左上：返回 + 路线名 + 当前部件；右上：视角、沉浸、更多
  const topLeft = (
    <div className="rd-tl rd-ov">
      <button type="button" className={wideL ? "rd-btn rd-glass rd-back" : "rd-btn rd-glass rd-btn--icon rd-back"} onClick={exit} aria-label="返回整机拆解（Esc）" title="返回整机拆解（Esc）">
        <Icon d={I.back} />
        {wideL && <span>返回整机拆解</span>}
      </button>
      <div className="rd-loc rd-glass" role="status" aria-live="polite">
        {!tallL && <b>{plan.title}</b>}
        {!tallL && <i aria-hidden="true" />}
        <span className="rd-loc__part">{st?.loc ?? "CPU"}</span>
        <span className="rd-loc__clock" title="累计真实时间">{fmtNs(clockNs)}</span>
      </div>
    </div>
  );
  const topRight = (
    <div ref={trRef} className="rd-tr rd-ov" role="toolbar" aria-label="视图">
      {wideL && (
        <span className="rd-more">
          <button type="button" className={`rd-btn rd-glass rd-view-btn${menu === "view" ? " is-on" : ""}`} onClick={() => setMenu((m) => (m === "view" ? null : "view"))} aria-expanded={menu === "view"} aria-haspopup="menu" aria-label={`视角：${viewName}（V 切换）`}>
            <Icon d={VIEW_ICON[view]} />
            <span>{viewName}</span>
            <Icon d={I.down} s={16} />
          </button>
          {menu === "view" && (
            <div className="rd-menu rd-menu--narrow" role="menu" aria-label="视角">
              {viewItems}
            </div>
          )}
        </span>
      )}
      <button type="button" className="rd-btn rd-glass rd-btn--icon" onClick={() => (setMenu(null), setImmersive(true))} aria-label="只看画面（H）" title="只看画面（H）">
        <Icon d={I.expand} />
      </button>
      {!tallL && moreBtn}
    </div>
  );

  // ---------------- 站点头：站号徽章 + 站名 + 本站耗时；下方分段进度（可点跳站）
  const stepsLabel = st ? `第 ${idx + 1} 站，共 ${N} 站，${st.title}` : "";
  const steps = (
    <div
      className="rd-steps"
      role="slider"
      tabIndex={0}
      aria-label="路线进度"
      aria-valuemin={1}
      aria-valuemax={N}
      aria-valuenow={idx + 1}
      aria-valuetext={stepsLabel}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        goTo(clampI(Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * N), 0, N - 1));
      }}
      onKeyDown={(e) => {
        const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          e.stopPropagation();
          goTo(e.key === "Home" ? 0 : N - 1);
        } else if (d) {
          e.preventDefault();
          e.stopPropagation();
          goTo(clampI(idx + d, 0, N - 1));
        }
      }}
    >
      {plan.stations.map((s, i) => (
        <span key={s.id} className={i === idx ? "is-on" : i < idx ? "is-done" : undefined} title={`${String(i + 1).padStart(2, "0")} ${s.title}`} />
      ))}
    </div>
  );
  const headInner = st && (
    <>
      <span className="rd-badge">
        {String(idx + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
      </span>
      <h2>{st.title}</h2>
      {st.cost > 0 && arrived && <span className="rd-cost">+{fmtNs(st.cost)}</span>}
      {tallL && <Icon d={I.down} s={18} className={drawerMin ? "rd-chev is-up" : drawer === "full" ? "rd-chev" : "rd-chev is-up"} />}
    </>
  );
  const toggleDrawer = () => {
    if (minimized) setFlightOpen(true);
    else setDrawer((d) => (d === "peek" ? "full" : "peek"));
  };
  const grip = tallL && (
    <div
      className="rd-grip"
      aria-hidden="true"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        gripRef.current = e.clientY;
      }}
      onPointerUp={(e) => {
        const y0 = gripRef.current;
        gripRef.current = null;
        if (y0 === null) return;
        const dy = e.clientY - y0;
        if (Math.abs(dy) < 8) return toggleDrawer();
        if (dy < 0) {
          if (minimized) setFlightOpen(true);
          setDrawer((d) => (d === "min" ? "peek" : "full"));
        } else setDrawer((d) => (d === "full" ? "peek" : "min"));
      }}
      onPointerCancel={() => (gripRef.current = null)}
    />
  );
  const head = st && (
    <header className="rd-head">
      {grip}
      {tallL ? (
        <button type="button" className="rd-head__t" onClick={() => (drawerMin ? (minimized ? setFlightOpen(true) : setDrawer("peek")) : toggleDrawer())} aria-expanded={!drawerMin && drawer === "full"} aria-label={`${st.title}：${drawerMin ? "展开讲解" : drawer === "full" ? "收起讲解" : "展开讲解"}`}>
          {headInner}
        </button>
      ) : (
        <div className="rd-head__t">{headInner}</div>
      )}
      {steps}
    </header>
  );

  // ---------------- 岔路：自动判断时一张判断结果卡片；「我来判断」时两个大选项卡片
  const fork =
    forkNow && st?.fork ? (
      <div className="rd-fork" role="group" aria-label={st.fork.question}>
        <div className="rd-fork__q">{st.fork.question}</div>
        {!judge ? (
          cueDone.has(idx) ? (
            (() => {
              const right = st.fork.options.find((o) => o.id === st.fork!.answer)!;
              const other = st.fork.options.find((o) => o.id !== st.fork!.answer);
              return (
                <div className={`rd-verdict ${BAD_IDS.has(right.id) ? "is-bad" : "is-ok"}`}>
                  <span className="rd-verdict__k">判断结果</span>
                  <b>{right.label}</b>
                  {other && <small>（若{other.label.replace(" → ", "：")}）</small>}
                </div>
              );
            })()
          ) : (
            <div className="rd-verdict is-wait">
              <span className="rd-verdict__k">判断结果</span>
              <b>正在比较…</b>
            </div>
          )
        ) : (
          <>
            <div className="rd-opts">
              {st.fork.options.map((o) => {
                const chosen = ans?.pick === o.id;
                const correct = !!ans && o.id === st.fork!.answer;
                const cls = correct ? " is-ok" : chosen && !ans?.ok ? " is-bad" : ans ? " is-mute" : "";
                return (
                  <button key={o.id} type="button" className={`rd-opt${cls}`} disabled={!!ans} onClick={() => answer(o.id)}>
                    <span>{o.label}</span>
                    {correct && <Icon d={I.check} />}
                    {chosen && !ans?.ok && <Icon d={I.x} />}
                  </button>
                );
              })}
            </div>
            {ans ? <p className={ans.ok ? "rd-fork__why is-ok" : "rd-fork__why is-bad"}>{ans.ok ? `判断正确：${st.fork.why}` : `不对。${st.fork.wrong}`}</p> : <p className="rd-fork__why">你来判断：选一条通道</p>}
          </>
        )}
      </div>
    ) : null;

  // ---------------- 讲解区：地址条 → 正文 → 结论卡片 → 相关考点 → 展开看
  const scroll = st && !drawerMin && (
    <div className="rd-scroll" ref={scrollRef}>
      <Addr shell={shell} note={note} active={vis.active} full={vis.full} />
      <div className="rd-body">
        <p>{st.caption}</p>
      </div>
      {(showResult || vis.formula) && (
        <div className={`rd-concl is-${showResult ? vis.tone : "neutral"}`}>
          {showResult && vis.tone !== "neutral" && (
            <span className="rd-concl__k">
              <Icon d={vis.tone === "ok" ? I.check : I.x} s={14} />
              {vis.tone === "ok" ? "结论 · 命中" : "结论 · 缺失"}
            </span>
          )}
          {showResult && <p>{st.result}</p>}
          {vis.formula && (
            <>
              {!showResult && <span className="rd-concl__k">表项地址 = 基址 + 索引 × 4</span>}
              <code>{vis.formula}</code>
            </>
          )}
        </div>
      )}
      {!wideL && fork}
      <section className="rd-rel" aria-label="相关考点">
        <h3>相关考点</h3>
        <p className="rd-rel__tags">
          {st.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </p>
        <ul>
          {st.labs.map((l) => (
            <li key={l.to}>
              <Link to={l.to}>
                {l.label}
                <Icon d={I.out} s={14} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <details className="rd-what" key={st.id}>
        <summary>
          <Icon d={I.right} s={16} />
          展开看：{st.what.title}
        </summary>
        <p>{st.what.body}</p>
      </details>
    </div>
  );

  // ---------------- 操作区：上一站、播放 / 暂停（手动时为按住前进 / 后退）、下一站主按钮
  const holdBtns = (
    <>
      <button type="button" className="rd-btn rd-btn--icon rd-hold" aria-label="按住后退（S）" title="按住后退" {...hold(-1)}>
        <Icon d={I.downArrow} />
      </button>
      <button type="button" className="rd-btn rd-btn--icon rd-hold" aria-label="按住前进（W）" title="按住前进" {...hold(1)}>
        <Icon d={I.upArrow} />
      </button>
    </>
  );
  const modeSwitch = (
    <button type="button" className="rd-mode" onClick={() => setMode((m) => (m === "auto" ? "manual" : "auto"))} aria-pressed={mode === "manual"} aria-label={mode === "auto" ? "前进方式：自动巡航，点按切换为手动游走" : "前进方式：手动游走，点按切换为自动巡航"} title="切换前进方式">
      <span className={mode === "auto" ? "is-on" : undefined}>巡航</span>
      <span className={mode === "manual" ? "is-on" : undefined}>手动</span>
    </button>
  );
  const ctl = (
    <div className="rd-ctl" role="toolbar" aria-label="控制">
      <button type="button" className="rd-btn rd-btn--icon" onClick={prev} disabled={idx === 0 && !arrived} aria-label="上一站（←）" title="上一站（←）">
        <Icon d={I.prev} />
      </button>
      {mode === "manual" && !wideL ? (
        holdBtns
      ) : mode === "manual" ? (
        holdBtns
      ) : (
        <button type="button" className="rd-btn rd-btn--icon" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? "继续播放（空格）" : "暂停（空格）"} title={paused ? "继续播放（空格）" : "暂停（空格）"}>
          {paused ? <Icon d={I.play} fill /> : <Icon d={I.pause} />}
        </button>
      )}
      <button type="button" className="rd-btn rd-next" onClick={next} disabled={!canNext} aria-label={`${nextLabel}（→）`}>
        <span>{nextLabel}</span>
        <Icon d={I.right} s={18} />
      </button>
      {tallL && moreBtn}
    </div>
  );
  const foot = (
    <div className="rd-foot">
      {wideL && fork}
      {wideL && (
        <div className="rd-ctl__sub">
          {modeSwitch}
          {speed !== 1 && <span className="rd-speed">{speed}×</span>}
        </div>
      )}
      {ctl}
    </div>
  );

  return (
    <div ref={rootRef} className={rootCls} style={style}>
      <div ref={stageRef} className="rd-stage">
        <div ref={viewRef} className="rd-view">
          <div className="rd-look" onPointerDown={onPDown} onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp} aria-hidden="true" />
          <div ref={labelRef} className="rd-labels" aria-hidden="true" />
          <div ref={fxRef} className="rd-fx" aria-hidden="true" />
        </div>
        {phase === "loading" && (
          <div className="rd-toast rd-glass" role="status">
            正在缩小成一段数据…
          </div>
        )}
        {immersive ? (
          <button type="button" className="rd-btn rd-glass rd-restore rd-ov" onClick={() => setImmersive(false)} aria-label="显示讲解和按钮（H）" title="显示讲解（H）">
            <Icon d={I.shrink} />
            <span>显示讲解</span>
          </button>
        ) : (
          <>
            {topLeft}
            {topRight}
            {showMap && (
              <div className="rd-mapfloat rd-glass rd-ov">
                <MiniMap world={pos.world} place={plan.stations[pos.i]?.place ?? "core"} u={pos.u} visited={visited} />
              </div>
            )}
          </>
        )}
      </div>

      {!immersive && st && (
        <section className={minimized ? "rd-panel is-min" : "rd-panel"} aria-label="讲解">
          {head}
          {scroll}
          {foot}
        </section>
      )}

      {panel === "params" && <ParamsPanel value={params} onApply={applyParams} onClose={() => setPanel(null)} />}

      {panel === "text" && (
        <aside className="rd-card rd-card--text" role="dialog" aria-label="文字版路线">
          <header>
            <h3>文字版路线 · {plan.title}</h3>
            <button type="button" className="rd-x" onClick={() => setPanel(null)} aria-label="关闭">
              <Icon d={I.x} />
            </button>
          </header>
          <ol className="rd-textroute">
            {plan.stations.map((s, i) => (
              <li key={s.id} className={i === idx ? "is-on" : undefined}>
                <button type="button" onClick={() => goTo(i)}>
                  <b>{s.title}</b>
                  <small>
                    {s.loc}
                    {s.cost > 0 ? ` · +${fmtNs(s.cost)}` : ""} · 累计 {fmtNs(s.clock)}
                  </small>
                </button>
                <p>
                  {s.caption} {s.result}
                </p>
              </li>
            ))}
          </ol>
          <p className="rd-total">
            本次访问时间：<b>{plan.summary.formula}</b>
          </p>
        </aside>
      )}

      {summary && (
        <div className="rd-sum" role="dialog" aria-modal="true" aria-labelledby="rd-sum-h">
          <div className="rd-sum__card" ref={sumRef}>
            <header>
              <div>
                <p className="rd-sum__eyebrow">旅程小结</p>
                <h2 id="rd-sum-h">{plan.title}</h2>
              </div>
              <button type="button" className="rd-x" onClick={() => setSummary(false)} aria-label="关闭">
                <Icon d={I.x} />
              </button>
            </header>
            <div className="rd-sum__total">
              <b>{fmtNs(plan.summary.totalNs)}</b>
            </div>
            <p className="rd-sum__formula">{plan.summary.formula}</p>
            <CostBars plan={plan} />
            <h3>每一关的结果</h3>
            <ul className="rd-sum__rows">
              {plan.summary.rows.map((r) => (
                <li key={r.label} className={r.bad ? "is-bad" : /命中/.test(r.value) ? "is-ok" : undefined}>
                  <span>{r.label}</span>
                  <b>{r.value}</b>
                </li>
              ))}
              {judged.length > 0 && (
                <li className={judged.every((a) => a.ok) ? "is-ok" : "is-bad"}>
                  <span>判断</span>
                  <b>
                    {judged.filter((a) => a.ok).length}/{judged.length} 正确
                  </b>
                </li>
              )}
            </ul>
            <p className="rd-sum__parts">经过：{plan.summary.parts.join(" → ")}</p>
            <h3>公式与代入</h3>
            {plan.summary.formulas.map((f) => (
              <div key={f.title} className="rd-sum__f">
                <h4>{f.title}</h4>
                {f.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            ))}
            <p className="rd-sum__note">时间按示意数量级给出，题目给出的数值以题目为准。</p>
            <h3>换个参数再走一遍</h3>
            <div className="rd-retry">
              {plan.summary.retry.map((r) => (
                <button key={r.label} type="button" onClick={() => applyParams({ ...params, ...(r.patch as Partial<AccessParams>) })}>
                  <b>{r.label}</b>
                  <small>{r.hint}</small>
                </button>
              ))}
            </div>
            <h3 ref={topicsRef} tabIndex={-1}>
              本次涉及的考点
            </h3>
            <div className="rd-links">
              {plan.summary.topics.map((l) => (
                <Link key={l.to} to={l.to}>
                  {l.label}
                  <Icon d={I.out} s={14} />
                </Link>
              ))}
            </div>
            <div className="rd-sum__foot">
              <button type="button" className="rd-btn rd-primary" onClick={() => applyParams(params)}>
                再走一次
              </button>
              <button type="button" className="rd-btn" onClick={() => (setSummary(false), setPanel("params"))}>
                换个参数
              </button>
              <button type="button" className="rd-btn" onClick={() => topicsRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" })}>
                查看考点
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 失败 / 缺失一侧的岔路选项 */
const BAD_IDS = new Set(["miss", "v0"]);

/**
 * 逐站视觉状态（集中配置）：地址条哪些字段亮起、结论卡片用什么语义色、是否在结论卡片里写出表项地址算式。
 * 只读取站点里已有的数据，不改讲解文字。
 */
function stationVisual(st: RideStation | undefined, arrived: boolean, showResult: boolean): { active: Tone[] | null; full: string | null; tone: "ok" | "bad" | "neutral"; formula: string | null } {
  const none = { active: null, full: null, tone: "neutral" as const, formula: null };
  if (!st) return none;
  const c = st.cue;
  const tone: "ok" | "bad" | "neutral" = st.fork ? (BAD_IDS.has(st.fork.answer) ? "bad" : "ok") : "neutral";
  switch (c.kind) {
    case "core":
      // 第 1 站：字段全部为灰，只有完整地址亮起
      return c.phase === "issue" ? { ...none, active: [], full: c.value } : none;
    case "tlb":
      return { ...none, active: ["tag", "set"], tone };
    case "pt": {
      const leaf = c.floor === c.floors - 1;
      const active: Tone[] = c.floors === 1 ? ["vpn", "frame"] : c.floor === 0 ? ["dir"] : ["tbl", "frame"];
      return { active, full: null, tone: leaf ? tone : "neutral", formula: arrived ? c.addr : null };
    }
    case "mmu":
      return { ...none, active: ["frame", "off"] };
    case "cache":
      return c.phase === "lookup" ? { ...none, active: ["tag", "set"], tone } : { ...none, active: ["set"] };
    case "lower":
      return { ...none, active: ["tag", "set"], tone: showResult ? tone : "neutral" };
    default:
      return none;
  }
}

/** 地址条：一条按字段分段的地址，字段用语义色，字段名写在每段下方；本站用到的字段高亮，其余降为次文字色 */
function Addr({ shell, note, active, full }: { shell: ShellState; note: string | null; active: Tone[] | null; full: string | null }) {
  return (
    <div className="rd-addr" aria-label={`我现在是：${shell.kind}`}>
      <div className="rd-addr__kind">
        <span>我现在是</span>
        <b>{shell.kind}</b>
        {full && <span className="rd-addr__full">{full}</span>}
      </div>
      <div className="rd-addr__bar">
        {shell.segs.map((s) => {
          const on = active === null || active.includes(s.tone);
          return (
            <span key={s.label + s.value} className={on ? "rd-af is-on is-new" : "rd-af is-new"} style={{ ["--c" as string]: TONE[s.tone] ?? "#e8eaf0", ["--g" as string]: String(Math.max(1, s.bits ?? 4)) }}>
              <b>{s.value}</b>
              <small>
                {s.label}
                {s.bits ? <i> {s.bits} 位</i> : null}
              </small>
            </span>
          );
        })}
      </div>
      {note && <p className="rd-addr__note">{note}</p>}
    </div>
  );
}

/** 结算卡的分项耗时条：按站点所在位置归类（只读站点里已有的耗时） */
const COST_GROUPS: { label: string; c: string; places: string[] }[] = [
  { label: "TLB", c: "var(--ride-set)", places: ["tlb"] },
  { label: "页表", c: "var(--ride-frame)", places: ["ptDir", "ptTbl", "ptOne"] },
  { label: "缺页调页", c: "var(--ride-bad)", places: ["fault"] },
  { label: "Cache", c: "var(--ride-tag)", places: ["l1", "l2", "l3", "fill"] },
  { label: "主存", c: "var(--ride-off)", places: ["busMem", "dram", "busMemBack"] },
];
function CostBars({ plan }: { plan: RidePlan }) {
  const rows = COST_GROUPS.map((g) => ({ ...g, ns: plan.stations.filter((s) => g.places.includes(s.place)).reduce((a, s) => a + s.cost, 0) })).filter((g) => g.ns > 0);
  const total = rows.reduce((a, g) => a + g.ns, 0) || 1;
  return (
    <>
      <div className="rd-bars" role="img" aria-label={rows.map((g) => `${g.label} ${fmtNs(g.ns)}`).join("，")}>
        {rows.map((g) => (
          <i key={g.label} style={{ ["--c" as string]: g.c, flexGrow: g.ns / total, flexBasis: 0 }} />
        ))}
      </div>
      <ul className="rd-legend">
        {rows.map((g) => (
          <li key={g.label} style={{ ["--c" as string]: g.c }}>
            {g.label}
            <b>{fmtNs(g.ns)}</b>
          </li>
        ))}
      </ul>
    </>
  );
}

/** 外壳下的一行补充：第 1 站写出地址加法，查快表时写出组号从哪几位来（只用站点里已有的数据推出） */
function shellNote(st: RideStation | undefined, arrived: boolean): string | null {
  if (!st || !arrived) return null;
  const c = st.cue;
  if (c.kind === "core" && c.phase === "issue") {
    const base = parseHexAddr(c.base);
    const va = parseHexAddr(c.value);
    if (base === null || va === null) return null;
    return `基址 ${c.reg} = ${c.base}，加偏移 ${va - base} 得到 ${c.value}`;
  }
  if (c.kind === "tlb") {
    const set = st.shell.segs.find((x) => x.tone === "set");
    if (!set) return null;
    return `虚页号的低 ${set.bits ?? 0} 位 = ${set.value}，作为 TLB 组号；其余高位是标记`;
  }
  return null;
}

/** 内联图标（24 × 24 描边） */
const I = {
  back: "M19 12H5M11 18l-6-6 6-6",
  prev: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  play: "M8 5.5v13l10.5-6.5z",
  pause: "M8.5 5v14M15.5 5v14",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  shrink: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  down: "M6 9l6 6 6-6",
  upArrow: "M6 15l6-6 6 6",
  downArrow: "M6 9l6 6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  out: "M8 16L16 8M10 8h6v6",
  map: "M9 4.5L3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2zM9 4.5v13M15 6.5v13",
  list: "M5 7h14M5 12h14M5 17h9",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  fork: "M7 4v9a5 5 0 005 5h0M7 9a5 5 0 005 5h5M15 11l3 3-3 3",
  auto: "M4 12a8 8 0 0113.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 01-13.7 5.6L4 15M4 20v-5h5",
  motion: "M3 12h4l2.5-6 5 12 2.5-6h4",
  type: "M4 18L9 6l5 12M5.8 14h6.4M15 18l3-7 3 7M15.9 16h4.2",
  route: "M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM6 15V9a4 4 0 014-4h6M18 9v6a4 4 0 01-4 4H8",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  follow: "M12 4l7 15-7-4-7 4z",
  globe: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10",
};
const VIEW_ICON: Record<RideView, string> = { first: I.eye, follow: I.follow, map: I.globe };

function Icon({ d, fill, s = 20, w = 2, className }: { d: string; fill?: boolean; s?: number; w?: number; className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true" focusable="false" className={className}>
      <path d={d} fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 小地图：整台电脑的简化俯视图，标出自己的位置和走过的路 */
function MiniMap({ world, place, u, visited }: { world: World; place: string; u: number; visited: Set<string> }) {
  const cpu = { x: 64, y: 30, w: 34, h: 34 };
  const ram = { x: 112, y: 22, w: 14, h: 50 };
  const a = { x: cpu.x + cpu.w, y: cpu.y + cpu.h / 2 };
  const b = { x: ram.x, y: ram.y + ram.h / 2 };
  const back = place === "busBack" || place === "busMemBack";
  let dot = { x: cpu.x + cpu.w / 2, y: cpu.y + cpu.h / 2 };
  const inCpu: Record<string, [number, number]> = { core: [0.3, 0.75], reg: [0.3, 0.75], tlb: [0.5, 0.55], mmu: [0.6, 0.5], l1: [0.55, 0.35], fill: [0.55, 0.35], l2: [0.75, 0.3], l3: [0.85, 0.2] };
  if (world === "pc" && u >= 0) {
    const k = back ? 1 - u : u;
    dot = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  } else if (world === "mem") dot = { x: ram.x + ram.w / 2, y: ram.y + ram.h / 2 };
  else if (inCpu[place]) dot = { x: cpu.x + cpu.w * inCpu[place]![0], y: cpu.y + cpu.h * inCpu[place]![1] };
  const box = (r: { x: number; y: number; w: number; h: number }, label: string, on: boolean, c: string) => (
    <g>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={3} fill={on ? c : "rgba(255,255,255,0.04)"} fillOpacity={on ? 0.2 : 1} stroke={on ? c : "rgba(255,255,255,0.22)"} />
      <text x={r.x + r.w / 2} y={r.y + r.h + 9} textAnchor="middle">
        {label}
      </text>
    </g>
  );
  return (
    <div className="rd-map" aria-label="小地图">
      <svg viewBox="0 0 160 118" role="img" aria-label={`当前位置：${world === "pc" ? "内存总线" : world === "mem" ? "内存条" : "CPU 内部"}`}>
        {box({ x: 14, y: 82, w: 92, h: 10 }, "显卡", false, "#5aa9e6")}
        {box({ x: 112, y: 86, w: 20, h: 14 }, "", false, "#3fb5a0")}
        <text x={122} y={110} textAnchor="middle">
          芯片组
        </text>
        {box({ x: 14, y: 24, w: 30, h: 22 }, "电源", false, "#e0a43a")}
        {box(cpu, "CPU", visited.has("cpu"), "#5b7cff")}
        {box(ram, "内存", visited.has("ram"), "#9b8cff")}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9b8cff" strokeWidth={visited.has("bus") ? 2.2 : 1.2} strokeOpacity={visited.has("bus") ? 1 : 0.4} />
        <line x1={cpu.x + cpu.w / 2} y1={cpu.y + cpu.h} x2={60} y2={82} stroke="rgba(255,255,255,0.2)" />
        <line x1={cpu.x + cpu.w} y1={cpu.y + cpu.h - 4} x2={122} y2={86} stroke="rgba(255,255,255,0.2)" />
        <circle cx={dot.x} cy={dot.y} r={6} fill="#fff" fillOpacity={0.18} className="rd-map__pulse" />
        <circle cx={dot.x} cy={dot.y} r={3} fill="#fff" />
      </svg>
    </div>
  );
}

