import { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle,
  Download,
  ChevronRight,
  Clock,
  AlertCircle,
  Loader2,
  FileCheck,
  Eye,
  LayoutDashboard,
  History,
  Settings,
  LogOut,
  ChevronDown,
  ChevronUp,
  X,
  BarChart2,
  Cpu,
  Shield,
  Info,
  ArrowRight,
  Plus,
  FolderOpen,
  CheckCircle2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Page =
  | "home"
  | "upload"
  | "confirm"
  | "progress"
  | "result"
  | "history";

type ReportStatus = "completed" | "processing" | "pending" | "error";

interface Report {
  id: string;
  name: string;
  town: string;
  period: string;
  status: ReportStatus;
  size: string;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOWNS = ["北陡镇", "白沙镇", "大江镇", "赤溪镇", "广海镇", "沙堆镇", "古井镇", "潮连镇", "新会区", "双水镇", "崖门镇", "司前镇", "大泽镇", "三江镇", "罗坑镇", "田头镇", "睦洲镇"];

const HISTORY_REPORTS: Report[] = [
  { id: "1", name: "北陡镇2023年下半年度村级设施考核报告（正文）", town: "北陡镇", period: "2023年下半年度", status: "completed", size: "1.2 MB", createdAt: "2024-01-15 14:32" },
  { id: "2", name: "白沙镇2023年下半年度村级设施考核报告（正文）", town: "白沙镇", period: "2023年下半年度", status: "completed", size: "1.1 MB", createdAt: "2024-01-15 14:32" },
  { id: "3", name: "大江镇2023年下半年度村级设施考核报告（正文）", town: "大江镇", period: "2023年下半年度", status: "completed", size: "1.3 MB", createdAt: "2024-01-15 14:32" },
  { id: "4", name: "赤溪镇2023年下半年度村级设施考核报告（正文）", town: "赤溪镇", period: "2023年下半年度", status: "completed", size: "0.9 MB", createdAt: "2024-01-15 14:32" },
  { id: "5", name: "汇总报告：2023年下半年度绩效考核综合报告", town: "全区汇总", period: "2023年下半年度", status: "completed", size: "4.8 MB", createdAt: "2024-01-15 15:05" },
  { id: "6", name: "北陡镇2023年上半年度村级设施考核报告（正文）", town: "北陡镇", period: "2023年上半年度", status: "completed", size: "1.1 MB", createdAt: "2023-08-10 09:14" },
];

const PROGRESS_STEPS = [
  { id: 1, label: "读取资料包", desc: "解压并索引全部附件" },
  { id: 2, label: "识别镇街和附件", desc: "按镇街归档原始附件" },
  { id: 3, label: "抽取考核数据", desc: "识别运营记录与考核指标" },
  { id: 4, label: "核算金额", desc: "使用默认金额计算方法" },
  { id: 5, label: "生成正文", desc: "按模板逐镇生成报告正文" },
  { id: 6, label: "检查报告", desc: "格式校验与数据核对" },
  { id: 7, label: "输出成品报告", desc: "打包 DOCX 文件" },
];

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReportStatus }) {
  const map: Record<ReportStatus, { label: string; cls: string }> = {
    completed: { label: "已完成", cls: "bg-[var(--status-success-bg)] text-[var(--status-success)]" },
    processing: { label: "生成中", cls: "bg-blue-50 text-blue-700" },
    pending: { label: "等待中", cls: "bg-[var(--status-pending-bg)] text-[var(--status-pending)]" },
    error: { label: "异常", cls: "bg-[var(--status-error-bg)] text-[var(--status-error)]" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${cls}`}>
      {label}
    </span>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ current, onNav }: { current: Page; onNav: (p: Page) => void }) {
  const items = [
    { id: "home" as Page, icon: LayoutDashboard, label: "生成报告" },
    { id: "history" as Page, icon: History, label: "历史报告" },
  ];
  return (
    <aside className="w-56 shrink-0 flex flex-col" style={{ background: "var(--sidebar)", color: "var(--sidebar-foreground)" }}>
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="text-xs font-mono opacity-50 mb-1 tracking-widest uppercase">PPP绩效</div>
        <div className="text-sm font-semibold leading-snug" style={{ color: "var(--sidebar-primary)" }}>
          农村污水<br />考核报告系统
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(({ id, icon: Icon, label }) => {
          const active = current === id || (id === "home" && ["upload", "confirm", "progress", "result"].includes(current));
          return (
            <button
              key={id}
              onClick={() => onNav(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors text-left ${active ? "font-medium" : "opacity-70 hover:opacity-100"}`}
              style={active ? { background: "var(--sidebar-accent)", color: "var(--sidebar-primary)", fontWeight: 600 } : {}}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t space-y-0.5" style={{ borderColor: "var(--sidebar-border)" }}>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm opacity-50 hover:opacity-80 transition-colors">
          <Settings size={16} />
          系统设置
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm opacity-50 hover:opacity-80 transition-colors">
          <LogOut size={16} />
          退出登录
        </button>
      </div>
    </aside>
  );
}

// ─── TopBar ──────────────────────────────────────────────────────────────────

function TopBar({ title, subtitle, breadcrumbs }: { title: string; subtitle?: string; breadcrumbs?: string[] }) {
  return (
    <div className="bg-card border-b border-border px-8 py-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 font-mono">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} />}
              <span className={i === breadcrumbs.length - 1 ? "text-foreground" : ""}>{b}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  );
}

// ─── Page 1: Home ─────────────────────────────────────────────────────────────

function HomePage({ onNav }: { onNav: (p: Page) => void }) {
  const recent = HISTORY_REPORTS.slice(0, 4);
  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="生成绩效考核报告" breadcrumbs={["生成报告"]} />
      <div className="px-8 py-6 max-w-5xl space-y-6">

        {/* Hero card */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-5 flex items-start gap-5">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground mb-1.5">自动生成正式绩效考核报告</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                上传资料包，系统自动完成资料识别、金额核算、正文生成和格式校验，输出可直接使用的 DOCX 成品报告。
              </p>
              <button
                onClick={() => onNav("upload")}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                style={{ background: "var(--primary)" }}
              >
                <UploadCloud size={16} />
                上传资料包生成报告
              </button>
            </div>
            <div className="hidden md:flex flex-col gap-2 shrink-0">
              {[
                { icon: FolderOpen, color: "text-blue-600", label: "必填", desc: "资料包文件" },
                { icon: Plus, color: "text-muted-foreground", label: "选填", desc: "金额计算方法" },
                { icon: FileText, color: "text-[var(--accent)]", label: "输出", desc: "成品 DOCX 报告" },
              ].map(({ icon: Icon, color, label, desc }) => (
                <div key={label} className="flex items-center gap-3 bg-muted rounded px-3 py-2">
                  <Icon size={15} className={color} />
                  <span className="text-xs font-mono text-muted-foreground w-7">{label}</span>
                  <span className="text-xs text-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "累计生成报告", value: "142", unit: "份", icon: FileCheck },
            { label: "覆盖镇街", value: "17", unit: "个", icon: BarChart2 },
            { label: "最近生成", value: "2024-01-15", unit: "", icon: Clock },
          ].map(({ label, value, unit, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-lg px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: "var(--secondary)" }}>
                <Icon size={18} className="text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-xl font-semibold text-foreground font-mono">
                  {value}<span className="text-sm font-normal ml-0.5">{unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent reports */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">最近报告</h3>
            <button onClick={() => onNav("history")} className="text-xs text-primary hover:underline flex items-center gap-1">
              查看全部 <ChevronRight size={12} />
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground font-mono">
                <th className="text-left px-6 py-3 font-medium">报告名称</th>
                <th className="text-left px-4 py-3 font-medium">镇街</th>
                <th className="text-left px-4 py-3 font-medium">周期</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-left px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={r.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : ""}`}>
                  <td className="px-6 py-3 text-foreground max-w-xs">
                    <span className="truncate block text-xs">{r.name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{r.town}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{r.period}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Download size={12} /> 下载
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Page 2: Upload ───────────────────────────────────────────────────────────

function UploadPage({ onNav }: { onNav: (p: Page) => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [methodText, setMethodText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    setUploaded(true);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="上传资料包" breadcrumbs={["生成报告", "上传资料包"]} />
      <div className="px-8 py-6 max-w-3xl space-y-5">

        {/* Upload zone */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">资料包 <span className="text-[var(--status-error)] text-xs ml-1">必填</span></h3>
          </div>
          <div className="p-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-14 cursor-pointer transition-colors ${dragging ? "border-primary bg-blue-50" : uploaded ? "border-[var(--status-success)] bg-[var(--status-success-bg)]" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
            >
              <input ref={fileRef} type="file" className="hidden" multiple onChange={() => setUploaded(true)} />
              {uploaded ? (
                <>
                  <CheckCircle2 size={40} className="text-[var(--status-success)] mb-3" />
                  <p className="text-sm font-medium text-foreground">资料收集.zip</p>
                  <p className="text-xs text-muted-foreground mt-1">已识别到 17 个镇街 · 点击可重新选择</p>
                </>
              ) : (
                <>
                  <UploadCloud size={40} className="text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">拖入资料包文件夹，或点击选择文件</p>
                  <p className="text-xs text-muted-foreground mt-1.5">支持一个或多个镇街资料包 · ZIP / 文件夹均可</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Optional: calculation method */}
        <div className="bg-card border border-border rounded-lg">
          <button
            onClick={() => setMethodOpen(!methodOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-left"
          >
            <div>
              <span className="text-sm font-semibold text-foreground">新的金额计算方法</span>
              <span className="ml-2 text-xs text-muted-foreground">选填</span>
            </div>
            {methodOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>
          {methodOpen && (
            <div className="px-6 pb-6 border-t border-border pt-4 space-y-4">
              <div className="flex items-start gap-2 bg-[var(--status-warning-bg)] border border-yellow-200 rounded px-3 py-2.5">
                <Info size={14} className="text-[var(--status-warning)] mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  未填写时，系统将使用<strong className="text-foreground">默认金额计算方法</strong>继续生成报告，不影响主流程。
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">上传合同或补充协议（可选）</label>
                <div
                  className="border border-dashed border-border rounded p-4 flex items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  onClick={() => {}}
                >
                  <UploadCloud size={16} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">上传合同、补充协议或金额计算表</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">或填写说明（可选）</label>
                <textarea
                  rows={3}
                  value={methodText}
                  onChange={(e) => setMethodText(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  style={{ background: "var(--input-background)" }}
                  placeholder="例如：本期按合同单价下浮 5% 结算，超期罚款按每日 0.05% 扣减……"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => onNav("home")}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onNav("confirm")}
            disabled={!uploaded}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold transition-opacity ${uploaded ? "text-primary-foreground hover:opacity-90" : "opacity-40 cursor-not-allowed text-primary-foreground"}`}
            style={{ background: "var(--primary)" }}
          >
            下一步：确认生成
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page 3: Confirm ──────────────────────────────────────────────────────────

function ConfirmPage({ onNav }: { onNav: (p: Page) => void }) {
  const detectedTowns = ["北陡镇", "白沙镇", "大江镇", "赤溪镇"];

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="确认生成" breadcrumbs={["生成报告", "上传资料包", "确认生成"]} />
      <div className="px-8 py-6 max-w-3xl space-y-5">

        {/* Summary card */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">系统已识别以下信息</h3>
          </div>
          <div className="px-6 py-5 space-y-4">
            <Row label="资料包名称" value="资料收集" mono />
            <Row label="已识别镇街" value={`${detectedTowns.length} 个`} mono extra={
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {detectedTowns.map(t => (
                  <span key={t} className="inline-flex px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs font-mono">{t}</span>
                ))}
              </div>
            } />
            <Row label="报告周期" value="2023年下半年度" mono />
            <div className="h-px bg-border" />
            <Row label="新的金额计算方法" value="未提供" valueClass="text-muted-foreground" />
            <div className="flex items-start gap-2 bg-[var(--status-warning-bg)] border border-yellow-200 rounded px-3 py-2.5">
              <AlertCircle size={14} className="text-[var(--status-warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                未提供新的金额计算方法，系统将<strong className="text-foreground">使用默认金额计算方法</strong>继续生成报告。
              </p>
            </div>
          </div>
        </div>

        {/* Output options */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">推荐输出方式</h3>
          </div>
          <div className="px-6 py-5 space-y-3">
            {[
              { id: "separate", label: "按镇分别生成", desc: "每个镇街单独输出一份 DOCX 报告", checked: true },
              { id: "summary", label: "同时生成汇总报告", desc: "额外生成一份涵盖全部镇街的综合考核报告", checked: true },
            ].map(opt => (
              <label key={opt.id} className="flex items-start gap-3 cursor-pointer group">
                <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${opt.checked ? "border-primary bg-primary" : "border-border"}`}>
                  {opt.checked && <CheckCircle2 size={10} className="text-white" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Expected output */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">预期输出</h3>
          </div>
          <div className="px-6 py-4 space-y-2">
            {detectedTowns.map(town => (
              <div key={town} className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                <FileText size={13} className="text-primary shrink-0" />
                {town}2023年下半年度村级设施考核报告（正文）.docx
              </div>
            ))}
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <FileText size={13} className="text-[var(--accent)] shrink-0" />
              2023年下半年度村级设施绩效考核综合报告（汇总）.docx
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => onNav("upload")} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            返回修改
          </button>
          <button
            onClick={() => onNav("progress")}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            style={{ background: "var(--primary)" }}
          >
            确认并开始生成
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono, valueClass, extra }: { label: string; value: string; mono?: boolean; valueClass?: string; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
        <span className={`text-sm flex-1 text-right ${mono ? "font-mono" : ""} ${valueClass ?? "text-foreground"}`}>{value}</span>
      </div>
      {extra}
    </div>
  );
}

// ─── Page 4: Progress ─────────────────────────────────────────────────────────

function ProgressPage({ onNav }: { onNav: (p: Page) => void }) {
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    "任务初始化完成",
    "未提供新的金额计算方法，已使用默认金额计算方法。",
  ]);

  useEffect(() => {
    if (step >= PROGRESS_STEPS.length) return;
    const timer = setTimeout(() => {
      setStep(s => s + 1);
      setLogs(prev => {
        const msgs: Record<number, string> = {
          0: "正在解压资料包…",
          1: "已识别 4 个镇街附件",
          2: "考核数据抽取完成，共 48 项指标",
          3: "金额核算完成，使用默认计算方法",
          4: "正在生成正式报告…",
          5: "报告校验通过",
          6: "成品报告已输出，共 5 份文件",
        };
        return [...prev, msgs[step] ?? ""];
      });
    }, 1400);
    return () => clearTimeout(timer);
  }, [step]);

  const done = step >= PROGRESS_STEPS.length;

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => onNav("result"), 1000);
      return () => clearTimeout(t);
    }
  }, [done, onNav]);

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="自动生成进度" breadcrumbs={["生成报告", "自动生成进度"]} />
      <div className="px-8 py-6">
        <div className="grid grid-cols-[1fr_300px] gap-5 max-w-5xl">

          {/* Steps */}
          <div className="bg-card border border-border rounded-lg">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">处理步骤</h3>
            </div>
            <div className="px-6 py-5 space-y-1">
              {PROGRESS_STEPS.map((s, i) => {
                const isActive = i === step;
                const isDone = i < step;
                return (
                  <div key={s.id} className="flex items-start gap-4 py-3 border-b border-border last:border-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${isDone ? "bg-[var(--status-success)] text-white" : isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                      {isDone ? <CheckCircle2 size={14} /> : isActive ? <Loader2 size={14} className="animate-spin" /> : <span className="text-xs font-mono">{s.id}</span>}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isDone || isActive ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                    <div className="text-xs font-mono">
                      {isDone && <span className="text-[var(--status-success)]">完成</span>}
                      {isActive && <span className="text-primary animate-pulse">处理中…</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Progress bar */}
            <div className="px-6 pb-5">
              <div className="flex justify-between text-xs text-muted-foreground font-mono mb-1.5">
                <span>整体进度</span>
                <span>{Math.round((step / PROGRESS_STEPS.length) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(step / PROGRESS_STEPS.length) * 100}%`, background: "var(--primary)" }}
                />
              </div>
            </div>
          </div>

          {/* Right panel: agent status */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Cpu size={14} className="text-primary" />
                <h3 className="text-xs font-semibold text-foreground">处理助手状态</h3>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">当前 Agent</p>
                  <p className="text-sm font-mono font-medium text-foreground">ReportGeneratorAgent</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">当前动作</p>
                  <p className="text-sm text-foreground">{done ? "任务完成" : PROGRESS_STEPS[step]?.label ?? "等待"}</p>
                </div>
                <div className="h-px bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">系统提示</p>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info size={12} className="mt-0.5 shrink-0 text-[var(--status-warning)]" />
                      未提供新的金额计算方法，已使用默认金额计算方法。
                    </div>
                    {step >= 4 && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Info size={12} className="mt-0.5 shrink-0 text-primary" />
                        正在生成正式报告。
                      </div>
                    )}
                    {step >= 6 && (
                      <div className="flex items-start gap-2 text-xs text-[var(--status-success)]">
                        <CheckCircle size={12} className="mt-0.5 shrink-0" />
                        报告校验通过。
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">异常状态</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--status-success)]">
                    <Shield size={12} />
                    无异常
                  </div>
                </div>
              </div>
            </div>

            {/* Logs */}
            <div className="bg-card border border-border rounded-lg">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-xs font-semibold text-foreground">系统日志</h3>
              </div>
              <div className="px-4 py-3 space-y-1 max-h-40 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="text-xs font-mono text-muted-foreground flex gap-2">
                    <span className="opacity-40 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page 5: Result ───────────────────────────────────────────────────────────

function ResultPage({ onNav }: { onNav: (p: Page) => void }) {
  const reports: Report[] = [
    { id: "r1", name: "北陡镇2023年下半年度村级设施考核报告（正文）", town: "北陡镇", period: "2023年下半年度", status: "completed", size: "1.2 MB", createdAt: "2024-01-15 15:32" },
    { id: "r2", name: "白沙镇2023年下半年度村级设施考核报告（正文）", town: "白沙镇", period: "2023年下半年度", status: "completed", size: "1.1 MB", createdAt: "2024-01-15 15:32" },
    { id: "r3", name: "大江镇2023年下半年度村级设施考核报告（正文）", town: "大江镇", period: "2023年下半年度", status: "completed", size: "1.3 MB", createdAt: "2024-01-15 15:32" },
    { id: "r4", name: "赤溪镇2023年下半年度村级设施考核报告（正文）", town: "赤溪镇", period: "2023年下半年度", status: "completed", size: "0.9 MB", createdAt: "2024-01-15 15:32" },
    { id: "r5", name: "2023年下半年度村级设施绩效考核综合报告（汇总）", town: "全区汇总", period: "2023年下半年度", status: "completed", size: "4.8 MB", createdAt: "2024-01-15 15:33" },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="报告已生成" breadcrumbs={["生成报告", "成品报告结果"]} />
      <div className="px-8 py-6">
        <div className="grid grid-cols-[1fr_260px] gap-5 max-w-5xl">

          {/* Main */}
          <div className="space-y-5">
            {/* Success banner */}
            <div className="bg-[var(--status-success-bg)] border border-green-200 rounded-lg px-5 py-4 flex items-center gap-4">
              <CheckCircle size={24} className="text-[var(--status-success)] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">全部报告生成完毕</p>
                <p className="text-xs text-muted-foreground mt-0.5">共生成 5 份报告 · 耗时约 2 分 14 秒</p>
              </div>
              <button className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: "var(--status-success)" }}>
                <Download size={15} />
                下载全部
              </button>
            </div>

            {/* Report list */}
            <div className="bg-card border border-border rounded-lg">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">成品报告</h3>
                <span className="text-xs text-muted-foreground font-mono">{reports.length} 份文件</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground font-mono">
                    <th className="text-left px-5 py-3 font-medium w-8">#</th>
                    <th className="text-left px-3 py-3 font-medium">报告名称</th>
                    <th className="text-left px-3 py-3 font-medium">镇街</th>
                    <th className="text-left px-3 py-3 font-medium">状态</th>
                    <th className="text-left px-3 py-3 font-medium">大小</th>
                    <th className="text-left px-3 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r, i) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className={r.town === "全区汇总" ? "text-[var(--accent)]" : "text-primary"} />
                          <span className="text-xs text-foreground leading-snug">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{r.town}</td>
                      <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{r.size}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <button className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Download size={12} /> 下载
                          </button>
                          <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <Eye size={12} /> 详情
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => onNav("home")}
                className="px-4 py-2 text-sm border border-border rounded hover:bg-muted/40 transition-colors text-foreground"
              >
                返回首页
              </button>
              <button
                onClick={() => onNav("upload")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                style={{ background: "var(--primary)" }}
              >
                <Plus size={15} />
                继续生成新报告
              </button>
            </div>
          </div>

          {/* Right summary */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-xs font-semibold text-foreground">生成摘要</h3>
              </div>
              <div className="px-4 py-4 space-y-3">
                {[
                  { icon: CheckCircle2, color: "text-[var(--status-success)]", text: "资料包已处理" },
                  { icon: CheckCircle2, color: "text-[var(--status-success)]", text: "金额核算完成" },
                  { icon: CheckCircle2, color: "text-[var(--status-success)]", text: "报告校验通过" },
                  { icon: Info, color: "text-[var(--status-warning)]", text: "使用默认金额计算方法" },
                ].map(({ icon: Icon, color, text }) => (
                  <div key={text} className={`flex items-center gap-2 text-xs ${color}`}>
                    <Icon size={13} className="shrink-0" />
                    <span className="text-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg px-4 py-4 space-y-2">
              <p className="text-xs text-muted-foreground font-mono">生成时间</p>
              <p className="text-xs text-foreground font-mono">2024-01-15 15:33:48</p>
              <div className="h-px bg-border" />
              <p className="text-xs text-muted-foreground font-mono">报告周期</p>
              <p className="text-xs text-foreground font-mono">2023年下半年度</p>
              <div className="h-px bg-border" />
              <p className="text-xs text-muted-foreground font-mono">资料包</p>
              <p className="text-xs text-foreground font-mono">资料收集</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page 6: History ─────────────────────────────────────────────────────────

function HistoryPage({ onNav }: { onNav: (p: Page) => void }) {
  const [filter, setFilter] = useState<"all" | "completed" | "processing">("all");
  const filtered = HISTORY_REPORTS.filter(r => filter === "all" || r.status === filter);

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="历史报告" subtitle="全部生成记录" breadcrumbs={["历史报告"]} />
      <div className="px-8 py-6 max-w-5xl space-y-4">

        {/* Filters */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 p-1 bg-card border border-border rounded-lg">
            {(["all", "completed", "processing"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f === "all" ? "全部" : f === "completed" ? "已完成" : "生成中"}
              </button>
            ))}
          </div>
          <button
            onClick={() => onNav("upload")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            style={{ background: "var(--primary)" }}
          >
            <Plus size={15} />
            生成新报告
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground font-mono">
                <th className="text-left px-5 py-3 font-medium w-8">#</th>
                <th className="text-left px-3 py-3 font-medium">报告名称</th>
                <th className="text-left px-3 py-3 font-medium">镇街</th>
                <th className="text-left px-3 py-3 font-medium">周期</th>
                <th className="text-left px-3 py-3 font-medium">状态</th>
                <th className="text-left px-3 py-3 font-medium">生成时间</th>
                <th className="text-left px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-primary shrink-0" />
                      <span className="text-xs text-foreground leading-snug max-w-xs truncate">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{r.town}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{r.period}</td>
                  <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{r.createdAt}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <button className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Download size={12} /> 下载
                      </button>
                      <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <Eye size={12} /> 详情
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("home");

  function renderPage() {
    switch (page) {
      case "home": return <HomePage onNav={setPage} />;
      case "upload": return <UploadPage onNav={setPage} />;
      case "confirm": return <ConfirmPage onNav={setPage} />;
      case "progress": return <ProgressPage onNav={setPage} />;
      case "result": return <ResultPage onNav={setPage} />;
      case "history": return <HistoryPage onNav={setPage} />;
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ fontFamily: "var(--font-sans)" }}>
      <Sidebar current={page} onNav={setPage} />
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {renderPage()}
      </main>
    </div>
  );
}
