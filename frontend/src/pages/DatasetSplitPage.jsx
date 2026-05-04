import React, { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const partStyle = `
  .tp-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 38px 6px 70px;
    background: #ffffff;
    color: #111827;
  }

  .tp-back {
    height: 38px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #4b5563;
    font-size: 13px;
    font-weight: 800;
    margin-bottom: 44px;
    cursor: pointer;
  }

  .tp-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 18px;
    margin-bottom: 22px;
  }

  .tp-part {
    margin: 0 0 18px;
    color: #ef0016;
    font-size: 12px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: .08em;
  }

  .tp-header h1 {
    margin: 0;
    font-size: 30px;
    line-height: 1.25;
    letter-spacing: -0.7px;
  }

  .tp-desc {
    max-width: 920px;
    margin: 18px 0;
    font-size: 15px;
    line-height: 1.75;
    color: #5f6b7a;
  }

  .tp-badge {
    height: 34px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid #ffb8bf;
    background: #fff2f3;
    color: #ef0016;
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 900;
  }

  .tp-status-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tp-status {
    height: 28px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid #9af0b8;
    background: #ebfff2;
    color: #10a34a;
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    font-weight: 900;
  }

  .tp-kpis {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 18px 0 28px;
  }

  .tp-kpi {
    width: 90px;
    min-height: 64px;
    padding: 14px 16px;
    border-radius: 9px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .tp-kpi span {
    display: block;
    margin-bottom: 6px;
    color: #6b7280;
    font-size: 11px;
    font-weight: 900;
  }

  .tp-kpi strong {
    display: block;
    font-size: 19px;
    line-height: 1.1;
    letter-spacing: -0.4px;
  }

  .tp-tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 0 0 26px;
  }

  .tp-tab {
    height: 66px;
    padding: 14px 16px;
    border-radius: 9px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    cursor: pointer;
    text-align: left;
  }

  .tp-tab.active {
    background: #ef0016;
    border-color: #ef0016;
    color: #fff;
  }

  .tp-tab span {
    display: block;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
    color: #777;
    margin-bottom: 6px;
  }

  .tp-tab.active span {
    color: rgba(255,255,255,.85);
  }

  .tp-tab strong {
    display: block;
    font-size: 14px;
    line-height: 1.25;
  }

  .tp-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 326px;
    gap: 22px;
    align-items: start;
  }

  .tp-main,
  .tp-side {
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #fff;
  }

  .tp-main {
    min-height: 590px;
    padding: 48px 30px 34px;
  }

  .tp-side {
    min-height: 590px;
    padding: 26px;
    position: sticky;
    top: 84px;
  }

  .tp-section-label {
    margin: 0 0 100px;
    color: #6b7280;
    font-size: 12px;
    font-weight: 900;
  }

  .tp-info {
    padding: 24px;
    border: 1px solid #e5e7eb;
    border-radius: 9px;
    background: #fff;
    margin-bottom: 20px;
  }

  .tp-chip {
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    background: #fff2f3;
    border: 1px solid #ffb8bf;
    color: #ef0016;
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 900;
  }

  .tp-info h2,
  .tp-final h2 {
    margin: 16px 0 12px;
    font-size: 22px;
    line-height: 1.35;
    letter-spacing: -0.4px;
  }

  .tp-info p,
  .tp-small p,
  .tp-side p,
  .tp-side li,
  .tp-chart-head p {
    font-size: 15px;
    line-height: 1.7;
    color: #5b6472;
  }

  .tp-chart {
    padding: 24px;
    border: 1px solid #e5e7eb;
    border-radius: 9px;
    background: #fff;
    margin-bottom: 20px;
  }

  .tp-chart-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .tp-chart-head h3 {
    margin: 0;
    font-size: 17px;
  }

  .tp-grid-2,
  .tp-grid-3 {
    display: grid;
    gap: 18px;
  }

  .tp-grid-2 {
    grid-template-columns: repeat(2, 1fr);
  }

  .tp-grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }

  .tp-small {
    min-height: 190px;
    padding: 26px;
    border: 1px solid #e5e7eb;
    border-radius: 9px;
    background: #fff;
  }

  .tp-small h3 {
    margin: 22px 0 14px;
    font-size: 22px;
    line-height: 1.35;
  }

  .tp-final {
    border-radius: 14px;
    padding: 30px;
    background: #ef0016;
    color: #fff;
    margin-bottom: 18px;
  }

  .tp-final p {
    color: rgba(255,255,255,.92);
    font-size: 16px;
    line-height: 1.7;
    font-weight: 800;
  }

  .tp-side-top {
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .tp-side-top span {
    height: 28px;
    padding: 0 12px;
    border-radius: 999px;
    background: #fff2f3;
    border: 1px solid #ffb8bf;
    color: #ef0016;
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 900;
  }

  .tp-side-top b {
    font-size: 13px;
    color: #6b7280;
  }

  .tp-side h2 {
    margin: 36px 0 46px;
    font-size: 18px;
    line-height: 1.35;
  }

  .tp-side-sub {
    margin: 0 0 50px;
    font-size: 12px !important;
    color: #777 !important;
  }

  .tp-side ol {
    padding-left: 24px;
    margin: 0 0 52px;
  }

  .tp-side li + li {
    margin-top: 14px;
  }

  .tp-note {
    border-left: 2px solid #ef0016;
    background: #fafafa;
    border-radius: 9px;
    padding: 16px;
    margin-bottom: 18px;
  }

  .tp-note b {
    color: #ef0016;
    font-size: 10px;
    letter-spacing: .08em;
  }

  .tp-note p {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.5;
  }

  .tp-nav {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .tp-nav button {
    height: 38px;
    padding: 0 14px;
    border-radius: 9px;
    border: 1px solid #e5e7eb;
    background: #fff;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
  }

  .tp-nav button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .chart-red { fill: #ef0016; }
  .chart-gray { fill: #d1d5db; }
  .line-red { stroke: #ef0016; }
  .line-dark { stroke: #111827; }
  .line-gray { stroke: #9ca3af; }

  @media (max-width: 980px) {
    .tp-page {
      padding: 28px 16px 56px;
    }

    .tp-layout {
      grid-template-columns: 1fr;
    }

    .tp-side {
      position: static;
      min-height: auto;
    }

    .tp-tabs {
      grid-template-columns: repeat(2, 1fr);
    }

    .tp-main {
      min-height: auto;
    }

    .tp-section-label {
      margin-bottom: 32px;
    }
  }

  @media (max-width: 680px) {
    .tp-header h1 {
      font-size: 28px;
    }

    .tp-header {
      display: block;
    }

    .tp-badge {
      margin-top: 12px;
    }

    .tp-kpi {
      width: calc(50% - 6px);
    }

    .tp-tabs,
    .tp-grid-2,
    .tp-grid-3 {
      grid-template-columns: 1fr;
    }

    .tp-main,
    .tp-side {
      padding: 22px;
    }
  }
`;

const steps = [
  { key: "category", label: "CATEGORY", title: "카테고리 비교", side: "카테고리별 비교", note: "카테고리별 데이터 분포와 예측 난이도를 비교합니다." },
  { key: "split", label: "SPLIT", title: "데이터 분리", side: "데이터 분리 전략", note: "Train/Validation/Test를 명확히 분리합니다." },
  { key: "group", label: "GROUP", title: "GroupSplit", side: "누수 방지", note: "동일 영상이 다른 세트에 섞이지 않게 합니다." },
  { key: "time", label: "TIME", title: "시간 기준", side: "시간 기반 검증", note: "과거 데이터로 미래 데이터를 예측합니다." },
  { key: "feature", label: "FEATURE", title: "T0 / 24h", side: "입력 시점 설계", note: "예측 시점별 입력 정보를 분리합니다." },
];

const categoryData = [
  { category: "Music", count: 1280, rmse: 0.51 },
  { category: "Entertainment", count: 1130, rmse: 0.56 },
  { category: "Gaming", count: 940, rmse: 0.59 },
  { category: "Sports", count: 720, rmse: 0.62 },
  { category: "News", count: 610, rmse: 0.68 },
];

const splitData = [
  { name: "Train", count: 70 },
  { name: "Validation", count: 15 },
  { name: "Test", count: 15 },
];

export default function DatasetSplitPage() {
  const [active, setActive] = useState(0);
  const step = steps[active];

  const goBack = () => {
    if (window.location.hash) window.location.hash = "/analysis";
    else window.location.href = "/analysis";
  };

  return (
    <main className="tp-page">
      <style>{partStyle}</style>
      <button className="tp-back" onClick={goBack}>← 목록으로</button>

      <section className="tp-header">
        <div>
          <p className="tp-part">PART 6</p>
          <h1>데이터 분리와 카테고리 비교</h1>
          <p className="tp-desc">카테고리별 데이터 특성을 비교하고, 데이터 누수를 방지하는 분리 전략을 설계합니다.</p>
          <div className="tp-status-row"><span className="tp-status">● 카테고리 비교</span><span className="tp-status">● GroupSplit 적용</span><span className="tp-status">● 누수 방지</span></div>
        </div>
        <span className="tp-badge">Dataset Design</span>
      </section>

      <section className="tp-kpis">
        <Kpi label="Top Category" value="Music" />
        <Kpi label="Best RMSE" value="0.51" />
        <Kpi label="Train" value="70%" />
        <Kpi label="Leakage" value="방지" />
      </section>

      <section className="tp-tabs">
        {steps.map((s, i) => <button key={s.key} className={`tp-tab ${i === active ? "active" : ""}`} onClick={() => setActive(i)}><span>{s.label}</span><strong>{s.title}</strong></button>)}
      </section>

      <section className="tp-layout">
        <article className="tp-main">
          {step.key === "category" && <Category />}
          {step.key === "split" && <Split />}
          {step.key === "group" && <Cards label="GroupSplit" title="같은 영상이 다른 세트에 섞이지 않게 방지" items={[["01","영상 ID 기준","video_id로 그룹을 만듭니다."],["02","세트 분리","같은 영상은 한 세트에만 포함됩니다."],["03","공정 평가","처음 보는 영상의 일반화 성능을 확인합니다."]]} />}
          {step.key === "time" && <Cards label="Temporal Validation" title="과거 데이터로 미래 데이터를 예측" items={[["PAST","과거 데이터","학습에 사용합니다."],["NOW","검증 구간","튜닝에 사용합니다."],["FUTURE","미래 데이터","최종 테스트로 남깁니다."]]} />}
          {step.key === "feature" && <Cards label="T0 / 24h Feature Window" title="예측 시점별 입력 정보를 분리" items={[["T0","초기 예측","업로드 직후 신호를 사용합니다."],["24H","성장 반영","24시간 증가량과 반응률을 추가합니다."],["TARGET","예측 목표","지속성/트렌딩 가능성을 예측합니다."]]} />}
        </article>
        <Side step={step} active={active} setActive={setActive} total={steps.length} />
      </section>
    </main>
  );
}

function Kpi({ label, value }) { return <div className="tp-kpi"><span>{label}</span><strong>{value}</strong></div>; }

function Category() {
  return (
    <>
      <p className="tp-section-label">Category Comparison</p>
      <div className="tp-info"><span className="tp-chip">CATEGORY</span><h2>카테고리별 데이터 양과 예측 난이도 비교</h2><p>카테고리마다 트렌딩 패턴이 다르므로 분포와 오차를 함께 확인합니다.</p></div>
      <Chart title="카테고리별 데이터 수" desc="학습 데이터 규모를 비교합니다.">
        <BarChart data={categoryData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="category" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip />
          <Bar dataKey="count" radius={[10,10,0,0]}>{categoryData.map((d,i)=><Cell key={d.category} className={i===0?"chart-red":"chart-gray"} />)}</Bar>
        </BarChart>
      </Chart>
      <Chart title="카테고리별 RMSE" desc="낮을수록 예측이 안정적입니다.">
        <BarChart data={categoryData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="category" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} domain={[0,1]} /><Tooltip />
          <Bar dataKey="rmse" radius={[10,10,0,0]}>{categoryData.map((d,i)=><Cell key={d.category} className={i===0?"chart-red":"chart-gray"} />)}</Bar>
        </BarChart>
      </Chart>
    </>
  );
}

function Split() {
  return (
    <>
      <p className="tp-section-label">Train / Validation / Test</p>
      <div className="tp-info"><span className="tp-chip">SPLIT</span><h2>학습·검증·평가 데이터를 명확히 분리</h2><p>모델이 학습한 데이터로 평가하지 않도록 분리합니다.</p></div>
      <Chart title="데이터 분리 비율" desc="최종 평가는 Test Set에서만 수행합니다.">
        <BarChart data={splitData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} domain={[0,100]} /><Tooltip />
          <Bar dataKey="count" radius={[10,10,0,0]}>{splitData.map((d,i)=><Cell key={d.name} className={i===0?"chart-red":"chart-gray"} />)}</Bar>
        </BarChart>
      </Chart>
    </>
  );
}

function Cards({ label, title, items }) {
  return <><p className="tp-section-label">{label}</p><div className="tp-info"><span className="tp-chip">{label}</span><h2>{title}</h2><p>데이터 설계를 명확히 하여 모델 성능의 신뢰도를 높입니다.</p></div><div className="tp-grid-3">{items.map(([tag,t,x])=><Small key={tag} tag={tag} title={t} text={x}/>)}</div></>;
}

function Chart({ title, desc, children }) { return <div className="tp-chart"><div className="tp-chart-head"><h3>{title}</h3><p>{desc}</p></div><ResponsiveContainer width="100%" height={250}>{children}</ResponsiveContainer></div>; }
function Small({ tag, title, text }) { return <div className="tp-small"><span className="tp-chip">{tag}</span><h3>{title}</h3><p>{text}</p></div>; }
function Side({ step, active, setActive, total }) { return <aside className="tp-side"><div className="tp-side-top"><span>{step.label}</span><b>{active+1} / {total}</b></div><h2>{step.side}</h2><p className="tp-side-sub">발표 포인트</p><ol><li>{step.note}</li><li>데이터 설계는 모델 평가 신뢰도를 결정합니다.</li><li>카테고리 비교는 데이터 특성을 한눈에 보여줍니다.</li></ol><div className="tp-note"><b>{step.label}</b><p>{step.note}</p></div><div className="tp-nav"><button onClick={()=>setActive(Math.max(0,active-1))} disabled={active===0}>← 이전</button><button onClick={()=>setActive(Math.min(total-1,active+1))} disabled={active===total-1}>다음 →</button></div></aside>; }
