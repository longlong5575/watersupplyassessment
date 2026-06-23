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
  Smartphone,
  MapPin,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { NETWORK_STANDARDS, TREATMENT_STANDARDS } from "./assessmentStandards";

// ─── Types ──────────────────────────────────────────────────────────────────

type Page =
  | "home"
  | "dashboard"
  | "towndetail"
  | "dataupload"
  | "upload"
  | "mobile"
  | "confirm"
  | "progress"
  | "result"
  | "history";

type TownSurveyStatus = "completed" | "inprogress" | "pending";

interface TownSurvey {
  name: string;
  status: TownSurveyStatus;
  facilityType?: "treatment" | "network";
  surveys: { label: string; done: number; total: number }[];
}

const SURVEY_LABELS = ["污水处理设施", "管网设施", "调查问卷", "水质抽检情况"];

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

interface ScoreItem {
  name: string;
  fullScore: number;
  score: number;
  deduction: number;
  reason: string;
  category?: string;
  itemType?: string;
  evaluationStandard?: string;
  scoringMethod?: string;
  dataSource?: string;
  calculationMethod?: string;
}

interface SurveyScoreGroup {
  id: string;
  section: string;
  label: string;
  items: ScoreItem[];
}

type AssessmentStandardItem = {
  id: string;
  name: string;
  maxScore: number;
  description?: string;
  evaluationStandard?: string;
  scoringMethod?: string;
  dataSource?: string;
  calculationMethod?: string;
};

type AssessmentStandardGroup = {
  name: string;
  children: { name: string; items: AssessmentStandardItem[] }[];
};

function isQuestionnaireStandardItem(group: AssessmentStandardGroup, child: { name: string }, item: AssessmentStandardItem): boolean {
  const text = `${group.name} ${child.name} ${item.name} ${item.scoringMethod ?? ""} ${item.dataSource ?? ""}`;
  return (
    text.includes("问卷调查") ||
    child.name.includes("满意度") ||
    item.name === "污水收集" ||
    item.name === "整体效果" ||
    item.name.includes("满意度")
  );
}

function isWaterQualityStandardItem(_group: AssessmentStandardGroup, _child: { name: string }, item: AssessmentStandardItem): boolean {
  return item.name === "污水处理质量";
}

const TREATMENT_MERGE_RULES: Record<string, { targetId: string; name?: string; maxScore: number }> = {
  treatment_09: { targetId: "treatment_08", name: "稳定塘/生化工艺及其他处理工艺", maxScore: 15 },
  treatment_12: { targetId: "treatment_11", name: "污水收集管渠", maxScore: 8 },
  treatment_15: { targetId: "treatment_14", name: "机电设备、管路及附件", maxScore: 5 },
};

function joinUnique(parts: Array<string | undefined>, separator = "\n"): string {
  return Array.from(new Set(parts.filter((part): part is string => Boolean(part?.trim())))).join(separator);
}

function mergeTreatmentItems(groups: readonly AssessmentStandardGroup[]): AssessmentStandardGroup[] {
  return groups.map(group => ({
    ...group,
    children: group.children.map(child => {
      const items: AssessmentStandardItem[] = [];
      for (const item of child.items) {
        const rule = TREATMENT_MERGE_RULES[item.id];
        if (!rule) {
          items.push({ ...item });
          continue;
        }
        const target = items.find(existing => existing.id === rule.targetId);
        if (!target) {
          items.push({ ...item, id: rule.targetId, name: rule.name ?? item.name, maxScore: rule.maxScore });
          continue;
        }
        target.name = rule.name ?? target.name;
        target.maxScore = rule.maxScore;
        target.description = joinUnique([target.description, item.description], "；");
        target.evaluationStandard = joinUnique([target.evaluationStandard, item.evaluationStandard]);
        target.scoringMethod = joinUnique([target.scoringMethod, item.scoringMethod], "、");
        target.dataSource = joinUnique([target.dataSource, item.dataSource], "、");
      }
      return { ...child, items };
    }),
  }));
}

function buildScoreGroups(
  section: string,
  standards: readonly AssessmentStandardGroup[],
  includeItem: (group: AssessmentStandardGroup, child: { name: string }, item: AssessmentStandardItem) => boolean,
): SurveyScoreGroup[] {
  return standards
    .map((group, groupIndex) => ({
      id: `${section}-${groupIndex}-${group.name}`,
      section,
      label: group.name,
      items: group.children.flatMap(child => child.items.filter(item => includeItem(group, child, item)).map(item => ({
        name: item.name,
        fullScore: item.maxScore,
        score: item.maxScore,
        deduction: 0,
        reason: "",
        category: group.name,
        itemType: child.name,
        evaluationStandard: item.evaluationStandard || item.description || "",
        scoringMethod: item.scoringMethod || "",
        dataSource: item.dataSource || "",
        calculationMethod: item.calculationMethod || "",
      }))),
    }))
    .filter(group => group.items.length > 0);
}

const SCORE_TEMPLATES: SurveyScoreGroup[] = [
  ...buildScoreGroups("污水处理设施", mergeTreatmentItems(TREATMENT_STANDARDS as unknown as AssessmentStandardGroup[]), () => true),
  ...buildScoreGroups("管网设施", NETWORK_STANDARDS as unknown as AssessmentStandardGroup[], () => true),
];

const DETAIL_SCORE_TEMPLATES: SurveyScoreGroup[] = SCORE_TEMPLATES;

const DATA_COLLECTION_SECTION_NOTES: Record<string, { summary: string; details: string[] }> = {
  "调查问卷": {
    summary: "问卷数据回填至正式评分指标，不另行重复计分",
    details: [
      "污水收集效果评分：按村民、镇街政府代表和考核小组的加权结果回填“污水收集”指标。",
      "整体效果评分：按村民、镇街政府代表和考核小组的加权结果回填“整体效果”指标。",
      "满意度评分：分别回填实施机构满意度、镇街满意度和公众满意度指标。",
    ],
  },
  "水质抽检情况": {
    summary: "抽检数据用于核对“污水处理质量”正式评分指标，不另行重复计分",
    details: ["填写出水水质抽检结果，并依据达标情况回填“污水处理质量”指标。"],
  },
};

function countScoreItemsByLabel(label: string): number {
  return SCORE_TEMPLATES
    .filter(group => group.section === label)
    .reduce((sum, group) => sum + group.items.length, 0);
}

const DASHBOARD_SURVEY_TOTALS = SURVEY_LABELS.map(label => ({
  label,
  total: label === "水质抽检情况" ? 1 : label === "调查问卷" ? 3 : countScoreItemsByLabel(label),
}));

function makeDashboardSurveys(progress: number | number[]): TownSurvey["surveys"] {
  return DASHBOARD_SURVEY_TOTALS.map(({ label, total }, index) => {
    const ratio = Array.isArray(progress) ? progress[index] ?? 0 : progress;
    const done = Math.min(total, Math.max(0, Math.round(total * ratio)));
    return { label, done, total };
  });
}

function isWaterQualitySurvey(label: string): boolean {
  return label === "水质抽检情况";
}

function surveyDisplayValue(s: TownSurvey["surveys"][number]): string {
  return isWaterQualitySurvey(s.label) ? (s.done > 0 ? "已完成" : "未完成") : `${s.done}/${s.total}`;
}

const DASHBOARD_TOWNS: TownSurvey[] = [
  { name: "北陡镇", status: "completed", surveys: makeDashboardSurveys(1) },
  { name: "白沙镇", status: "completed", surveys: makeDashboardSurveys(1) },
  { name: "大江镇", status: "completed", surveys: makeDashboardSurveys(1) },
  { name: "赤溪镇", status: "inprogress", surveys: makeDashboardSurveys([0.7, 0.5, 0.6]) },
  { name: "广海镇", status: "inprogress", surveys: makeDashboardSurveys([0.3, 0.2, 0.4]) },
  { name: "沙堆镇", status: "pending", surveys: makeDashboardSurveys(0) },
  { name: "古井镇", status: "pending", surveys: makeDashboardSurveys(0) },
  { name: "潮连镇", status: "pending", surveys: makeDashboardSurveys(0) },
  { name: "双水镇", status: "pending", surveys: makeDashboardSurveys(0) },
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

// ─── DefaultMethodModal ───────────────────────────────────────────────────────

function DefaultMethodModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="text-sm font-semibold text-foreground">默认金额计算方法</h2>
            <p className="text-xs text-muted-foreground mt-0.5">系统内置计算规则 · 如需调整请在下方上传新方法</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5 text-sm">

          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest font-mono">一、考核基准金额</h3>
            <div className="bg-muted rounded px-4 py-3 space-y-1.5 text-xs text-foreground leading-relaxed">
              <p>年度合同服务费按合同约定的固定单价计算，基准公式如下：</p>
              <div className="font-mono bg-card border border-border rounded px-3 py-2 text-xs mt-2">
                基准金额 = 合同单价 × 核定处理水量（吨）
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest font-mono">二、绩效扣减规则</h3>
            <table className="w-full text-xs border border-border rounded overflow-hidden">
              <thead>
                <tr className="bg-muted text-muted-foreground font-mono">
                  <th className="text-left px-3 py-2 font-medium border-b border-border">考核项目</th>
                  <th className="text-left px-3 py-2 font-medium border-b border-border">扣减标准</th>
                  <th className="text-left px-3 py-2 font-medium border-b border-border">上限</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["设施运行率不达标", "每降低 1%，扣减月服务费 2%", "当月扣减上限 20%"],
                  ["出水水质超标", "每次扣减月服务费 5%", "每月最多计 3 次"],
                  ["运维记录缺失", "每缺 1 份扣减月服务费 1%", "当月扣减上限 10%"],
                  ["应急响应超时", "每次扣减月服务费 3%", "不设上限"],
                  ["设备故障未及时报告", "每次扣减月服务费 2%", "当月扣减上限 10%"],
                ].map(([item, rule, cap]) => (
                  <tr key={item} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 text-foreground">{item}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono">{rule}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono">{cap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest font-mono">三、奖励条款</h3>
            <div className="bg-muted rounded px-4 py-3 text-xs text-foreground leading-relaxed space-y-1.5">
              <p>连续 6 个月考核达标（扣减率 &lt; 5%）可申请季度奖励金，奖励额度不超过季度服务费的 <strong>3%</strong>。</p>
              <p>全年零超标记录额外奖励年服务费的 <strong>1%</strong>。</p>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest font-mono">四、最终结算公式</h3>
            <div className="font-mono bg-muted border border-border rounded px-4 py-3 text-xs leading-loose">
              <p>实付金额 = 基准金额</p>
              <p className="pl-4">− Σ 各项扣减金额</p>
              <p className="pl-4">+ 奖励金额（如适用）</p>
            </div>
          </section>

          <div className="flex items-start gap-2 bg-[var(--status-warning-bg)] border border-yellow-200 rounded px-3 py-2.5 text-xs text-muted-foreground">
            <Info size={13} className="text-[var(--status-warning)] mt-0.5 shrink-0" />
            以上为系统默认规则。如本期合同有补充协议或特殊约定，请在上传页面提供新的金额计算方法，系统将优先采用。
          </div>
        </div>
      </div>
    </div>
  );
}

function DefaultMethodLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-75 transition-opacity font-normal"
        style={{ fontSize: "inherit" }}
      >
        默认金额计算方法
        <Eye size={11} className="ml-0.5 opacity-70" />
      </button>
      {open && <DefaultMethodModal onClose={() => setOpen(false)} />}
    </>
  );
}

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
    { id: "dashboard" as Page, icon: BarChart2, label: "数据看板", group: ["dashboard"] },
    { id: "dataupload" as Page, icon: UploadCloud, label: "生成报告", group: ["dataupload", "home", "upload", "mobile", "confirm", "progress", "result"] },
    { id: "history" as Page, icon: History, label: "历史报告", group: ["history"] },
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
        {items.map(({ id, icon: Icon, label, group }) => {
          const active = group.includes(current);
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

function HomePage({ onNav, reports }: { onNav: (p: Page) => void; reports: Report[] }) {
  const recent = reports.slice(0, 4);
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
                onClick={() => onNav("dataupload")}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                style={{ background: "var(--primary)" }}
              >
                <UploadCloud size={16} />
                上传数据生成报告
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

function UploadPage({ onNav, packageFiles, setPackageFiles, selectedTowns, setSelectedTowns, methodFiles, setMethodFiles, methodText, setMethodText, reportPeriod, setReportPeriod }: {
  onNav: (p: Page) => void;
  packageFiles: File[];
  setPackageFiles: React.Dispatch<React.SetStateAction<File[]>>;
  selectedTowns: string[];
  setSelectedTowns: React.Dispatch<React.SetStateAction<string[]>>;
  methodFiles: File[];
  setMethodFiles: React.Dispatch<React.SetStateAction<File[]>>;
  methodText: string;
  setMethodText: React.Dispatch<React.SetStateAction<string>>;
  reportPeriod: string;
  setReportPeriod: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [dragging, setDragging] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [customTownInput, setCustomTownInput] = useState("");
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const methodFileRef = useRef<HTMLInputElement>(null);
  const townInputRef = useRef<HTMLInputElement>(null);

  const uploaded = packageFiles.length > 0;

  // Extract town/street names from filenames by matching xx镇 / xx街道 patterns
  function detectTownsFromFiles(files: File[]): string[] {
    const seen = new Set<string>();
    const results: string[] = [];
    for (const f of files) {
      const matches = f.name.match(/[一-龥]+(?:镇|街道)/g) ?? [];
      for (const m of matches) {
        if (!seen.has(m)) { seen.add(m); results.push(m); }
      }
    }
    return results;
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    setPackageFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      const next = [...prev, ...arr.filter(f => !existing.has(f.name))];
      // Re-detect towns from updated file list, preserve any manually added ones
      const detected = detectTownsFromFiles(next);
      setSelectedTowns(prev2 => {
        const knownSet = new Set(TOWNS);
        const manual = prev2.filter(t => !knownSet.has(t));
        return [...new Set([...detected, ...manual])];
      });
      return next;
    });
  }

  function removePackageFile(i: number) {
    setPackageFiles(prev => {
      const next = prev.filter((_, j) => j !== i);
      const detected = detectTownsFromFiles(next);
      setSelectedTowns(prev2 => {
        const knownSet = new Set(TOWNS);
        const manual = prev2.filter(t => !knownSet.has(t));
        return [...new Set([...detected, ...manual])];
      });
      return next;
    });
  }

  function toggleTown(town: string) {
    setSelectedTowns(prev =>
      prev.includes(town) ? prev.filter(t => t !== town) : [...prev, town]
    );
  }

  function replaceFile(i: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    const newFile = files[0];
    setPackageFiles(prev => {
      const next = prev.map((f, j) => j === i ? newFile : f);
      const detected = detectTownsFromFiles(next);
      setSelectedTowns(prev2 => {
        const knownDetected = new Set(detected);
        const manual = prev2.filter(t => !TOWNS.includes(t) && !detectedFromFiles.includes(t));
        return [...new Set([...detected, ...manual])];
      });
      return next;
    });
    setReplaceIndex(null);
  }

  function addCustomTown() {
    const name = customTownInput.trim();
    if (!name || selectedTowns.includes(name)) { setCustomTownInput(""); return; }
    setSelectedTowns(prev => [...prev, name]);
    setCustomTownInput("");
  }

  const detectedFromFiles = detectTownsFromFiles(packageFiles);
  const allDisplayTowns = [...new Set([...detectedFromFiles, ...selectedTowns])];

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="资料包上传" breadcrumbs={["数据上传", "资料包上传"]} />
      <div className="px-8 py-6 max-w-3xl space-y-5">

        {/* Upload zone */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">资料包 <span className="text-[var(--status-error)] text-xs ml-1">必填</span></h3>
          </div>
          <div className="p-6 space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-10 cursor-pointer transition-colors ${dragging ? "border-primary bg-blue-50" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
            >
              <input ref={fileRef} type="file" className="hidden" multiple onChange={(e) => addFiles(e.target.files)} />
              <UploadCloud size={32} className="text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">拖入资料包，或点击选择文件</p>
              <p className="text-xs text-muted-foreground mt-1">支持多个资料包同时上传 · ZIP / 文件夹均可</p>
              <p className="text-xs text-[var(--status-warning)] mt-2 flex items-center gap-1">
                <Info size={11} />
                请按每个镇街单独打包上传，系统将读取文件名识别镇街名称
              </p>
            </div>

            {/* File list */}
            {uploaded && (
              <div className="space-y-1.5">
                <input
                  ref={replaceFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => replaceIndex !== null && replaceFile(replaceIndex, e.target.files)}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>已添加 {packageFiles.length} 个资料包</span>
                  <button onClick={() => fileRef.current?.click()} className="text-primary hover:underline">继续添加</button>
                </div>
                {packageFiles.map((f, i) => {
                  // Match by auto-detection OR any selected town name appearing in filename
                  const autoTowns = detectTownsFromFiles([f]);
                  const manualMatch = selectedTowns.filter(t => !autoTowns.includes(t) && f.name.includes(t));
                  const matchedTowns = [...autoTowns, ...manualMatch];
                  const matched = matchedTowns.length > 0;
                  const wasManuallyResolved = autoTowns.length === 0 && manualMatch.length > 0;
                  return (
                    <div key={i} className={`rounded border px-3 py-2 transition-colors ${matched ? wasManuallyResolved ? "bg-[var(--status-success-bg)] border-green-200" : "bg-muted border-transparent" : "bg-[var(--status-error-bg)] border-red-200"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderOpen size={13} className={`shrink-0 ${matched ? "text-primary" : "text-[var(--status-error)]"}`} />
                          <span className="text-xs text-foreground font-mono truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {matched ? (
                            <span className={`text-xs font-mono flex items-center gap-1 ${wasManuallyResolved ? "text-[var(--status-success)]" : "text-[var(--status-success)]"}`}>
                              <CheckCircle2 size={11} />
                              {matchedTowns.join("、")}
                              {wasManuallyResolved && <span className="opacity-60">（手动匹配）</span>}
                            </span>
                          ) : (
                            <button
                              onClick={() => { setReplaceIndex(i); replaceFileRef.current?.click(); }}
                              className="text-xs text-[var(--status-error)] hover:underline flex items-center gap-1"
                            >
                              <UploadCloud size={11} /> 重新上传
                            </button>
                          )}
                          <button onClick={() => removePackageFile(i)} className="text-muted-foreground hover:text-foreground">
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                      {!matched && (
                        <p className="text-xs text-[var(--status-error)] mt-1.5 flex items-center gap-1">
                          <AlertCircle size={11} className="shrink-0" />
                          未能识别镇街——可在下方"确认涉及镇街"手动补充，或重新上传文件名含"xx镇"/"xx街道"的文件
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Report period */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">报告周期 <span className="text-[var(--status-error)] text-xs ml-1">必填</span></h3>
          </div>
          <div className="px-6 py-4">
            <input
              type="text"
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value)}
              placeholder="例如：2023年下半年度、2024年第一季度"
              className="w-full border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ background: "var(--input-background)" }}
            />
          </div>
        </div>

        {/* Town confirmation */}
        {uploaded && (
          <div className="bg-card border border-border rounded-lg">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">确认涉及镇街</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {detectedFromFiles.length > 0
                    ? `从文件名识别到 ${detectedFromFiles.length} 个镇街，可手动调整`
                    : "未能从文件名识别镇街，请手动添加"}
                </p>
              </div>
              <span className="font-mono text-xs text-foreground">已选 {selectedTowns.length} 个</span>
            </div>
            <div className="px-6 py-4 space-y-3">
              {/* Detected / selected tags */}
              {allDisplayTowns.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allDisplayTowns.map(town => {
                    const checked = selectedTowns.includes(town);
                    const autoDetected = detectedFromFiles.includes(town);
                    const hasFile = packageFiles.some(f => f.name.includes(town));
                    return (
                      <div key={town} className="flex flex-col items-start gap-0.5">
                        <div
                          onClick={() => toggleTown(town)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-colors text-xs select-none ${
                            !checked
                              ? "border-border text-muted-foreground line-through hover:border-primary/40"
                              : hasFile
                                ? "border-[var(--status-success)] bg-[var(--status-success-bg)] text-[var(--status-success)] font-medium"
                                : "border-orange-300 bg-orange-50 text-orange-700 font-medium"
                          }`}
                        >
                          {checked
                            ? hasFile ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />
                            : <X size={11} />}
                          {town}
                          {autoDetected && checked && (
                            <span className="opacity-50 font-normal font-mono">自动</span>
                          )}
                        </div>
                        {checked && !hasFile && (
                          <span className="text-xs text-orange-600 pl-1 flex items-center gap-1">
                            <AlertCircle size={10} className="shrink-0" />
                            未找到匹配文件
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Manual input */}
              <div className="flex gap-2">
                <input
                  ref={townInputRef}
                  type="text"
                  value={customTownInput}
                  onChange={(e) => setCustomTownInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomTown()}
                  placeholder="手动添加镇街名称…"
                  className="flex-1 border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ background: "var(--input-background)" }}
                />
                <button
                  onClick={addCustomTown}
                  disabled={!customTownInput.trim()}
                  className="px-3 py-1.5 rounded text-xs font-medium text-primary-foreground disabled:opacity-40 transition-opacity hover:opacity-90"
                  style={{ background: "var(--primary)" }}
                >
                  添加
                </button>
              </div>

              {selectedTowns.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-[var(--status-error)]">
                  <AlertCircle size={13} className="shrink-0" />
                  请至少确认一个镇街
                </div>
              )}
            </div>
          </div>
        )}

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
                  未填写时，系统将使用<strong className="text-foreground font-semibold"> <DefaultMethodLink /> </strong>继续生成报告，不影响主流程。
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">上传合同或补充协议（可选）</label>
                <input
                  ref={methodFileRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setMethodFiles(prev => [...prev, ...files]);
                  }}
                />
                <div
                  className="border border-dashed border-border rounded p-4 flex items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  onClick={() => methodFileRef.current?.click()}
                >
                  <UploadCloud size={16} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">上传合同、补充协议或金额计算表</span>
                </div>
                {methodFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {methodFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted rounded px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <FileText size={12} className="text-primary shrink-0" />
                          <span className="text-xs text-foreground truncate max-w-xs">{f.name}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMethodFiles(prev => prev.filter((_, j) => j !== i)); }}
                          className="text-muted-foreground hover:text-foreground ml-2"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
            onClick={() => onNav("dataupload")}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            返回选择
          </button>
          <button
            onClick={() => onNav("confirm")}
            disabled={!uploaded || selectedTowns.length === 0 || !reportPeriod.trim()}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold transition-opacity ${uploaded && selectedTowns.length > 0 && reportPeriod.trim() ? "text-primary-foreground hover:opacity-90" : "opacity-40 cursor-not-allowed text-primary-foreground"}`}
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

// ─── OutputOptions ────────────────────────────────────────────────────────────

const OUTPUT_OPTIONS = [
  { id: "separate", label: "按镇分别生成", desc: "每个镇街单独输出一份 DOCX 报告" },
  { id: "summary", label: "生成汇总报告", desc: "额外生成一份涵盖全部镇街的综合考核报告" },
] as const;

function OutputOptions({ selected, onToggle }: { selected: Set<string>; onToggle: (id: string) => void }) {
  const noneSelected = selected.size === 0;

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">推荐输出方式</h3>
      </div>
      <div className="px-6 py-5 space-y-3">
        {OUTPUT_OPTIONS.map(opt => {
          const active = selected.has(opt.id);
          return (
            <div key={opt.id} className="flex items-start gap-3 cursor-pointer group" onClick={() => onToggle(opt.id)}>
              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${active ? "border-primary" : "border-border group-hover:border-primary/50"}`}>
                {active && <div className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />}
              </div>
              <div>
                <p className={`text-sm font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
            </div>
          );
        })}
        {noneSelected && (
          <div className="flex items-center gap-2 text-xs text-[var(--status-error)]">
            <AlertCircle size={13} className="shrink-0" />
            请至少选择一项输出方式
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page 3: Confirm ──────────────────────────────────────────────────────────

function ConfirmPage({ onNav, dataSource, packageFiles, selectedTowns, methodFiles, methodText, outputSelected, onToggleOutput, reportPeriod }: {
  onNav: (p: Page) => void;
  dataSource: "upload" | "mobile";
  packageFiles: File[];
  selectedTowns: string[];
  methodFiles: File[];
  methodText: string;
  outputSelected: Set<string>;
  onToggleOutput: (id: string) => void;
  reportPeriod: string;
}) {
  const hasMethod = methodFiles.length > 0 || methodText.trim().length > 0;
  const packageNames = packageFiles.map(f => f.name).join("、");


  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="确认生成" breadcrumbs={dataSource === "mobile" ? ["生成报告", "使用数据看板数据", "确认生成"] : ["生成报告", "资料包上传", "确认生成"]} />
      <div className="px-8 py-6 max-w-3xl space-y-5">

        {/* Summary card */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">系统已识别以下信息</h3>
          </div>
          <div className="px-6 py-5 space-y-4">
            {dataSource === "upload" && (
              <Row label="资料包" value={`${packageFiles.length} 个文件`} mono extra={
                <div className="flex flex-col gap-1 mt-1.5">
                  {packageFiles.map((f, i) => (
                    <span key={i} className="text-xs text-muted-foreground font-mono truncate">{f.name}</span>
                  ))}
                </div>
              } />
            )}
            {dataSource === "mobile" && (
              <Row label="数据来源" value="数据看板（已完成镇街）" />
            )}
            <Row label="已识别镇街" value={`${selectedTowns.length} 个`} mono extra={
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedTowns.map(t => (
                  <span key={t} className="inline-flex px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs font-mono">{t}</span>
                ))}
              </div>
            } />
            <Row label="报告周期" value={reportPeriod} mono />
            <div className="h-px bg-border" />
            <Row
              label="新的金额计算方法"
              value={hasMethod ? "已提供" : "未提供"}
              valueClass={hasMethod ? "text-[var(--status-success)]" : "text-muted-foreground"}
            />
            {hasMethod ? (
              <div className="space-y-1">
                {methodFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                    <FileText size={12} className="text-primary shrink-0" />
                    {f.name}
                  </div>
                ))}
                {methodText.trim() && (
                  <div className="text-xs text-muted-foreground bg-muted rounded px-3 py-2 leading-relaxed">
                    {methodText.trim()}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 bg-[var(--status-warning-bg)] border border-yellow-200 rounded px-3 py-2.5">
                <AlertCircle size={14} className="text-[var(--status-warning)] mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  未提供新的金额计算方法，系统将使用 <DefaultMethodLink /> 继续生成报告。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Output options */}
        <OutputOptions selected={outputSelected} onToggle={onToggleOutput} />

        {/* Expected output */}
        {outputSelected.size > 0 && (
          <div className="bg-card border border-border rounded-lg">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">预期输出</h3>
              <span className="text-xs text-muted-foreground font-mono">
                {(outputSelected.has("separate") ? selectedTowns.length : 0) + (outputSelected.has("summary") ? 1 : 0)} 份文件
              </span>
            </div>
            <div className="px-6 py-4 space-y-2">
              {outputSelected.has("separate") && selectedTowns.map(town => (
                <div key={town} className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                  <FileText size={13} className="text-primary shrink-0" />
                  {town}{reportPeriod}村级设施考核报告（正文）.docx
                </div>
              ))}
              {outputSelected.has("summary") && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                  <FileText size={13} className="text-[var(--accent)] shrink-0" />
                  {reportPeriod}村级设施绩效考核综合报告（汇总）.docx
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => onNav(dataSource === "mobile" ? "mobile" : "upload")} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
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

function ProgressPage({ onNav, onStart, dataSource, methodFiles, methodText, selectedTowns, outputSelected }: {
  onNav: (p: Page) => void;
  onStart: () => void;
  dataSource: "upload" | "mobile";
  methodFiles: File[];
  methodText: string;
  selectedTowns: string[];
  outputSelected: Set<string>;
}) {
  const hasMethod = methodFiles.length > 0 || methodText.trim().length > 0;
  const calcMethodLabel = hasMethod ? "已使用提供的金额计算方法" : "已使用默认金额计算方法";
  const isMobile = dataSource === "mobile";

  const steps = PROGRESS_STEPS.map(s => s.id === 1
    ? { ...s, label: isMobile ? "读取数据看板数据" : "读取资料包", desc: isMobile ? "载入看板已完成调研数据" : "解压并索引全部附件" }
    : s
  );

  const [step, setStep] = useState(0);
  useEffect(() => { onStart(); }, []);
  const [logs, setLogs] = useState<string[]>(() => [
    "任务初始化完成",
    hasMethod
      ? "已读取提供的金额计算方法。"
      : "未提供新的金额计算方法，已使用默认金额计算方法。",
  ]);

  useEffect(() => {
    if (step >= steps.length) return;
    const timer = setTimeout(() => {
      setStep(s => s + 1);
      setLogs(prev => {
        const msgs: Record<number, string> = {
          0: isMobile ? "正在读取数据看板数据…" : "正在解压资料包…",
          1: `已识别 ${selectedTowns.length} 个镇街附件`,
          2: `考核数据抽取完成，共 ${selectedTowns.length * 12} 项指标`,
          3: `金额核算完成，${calcMethodLabel}`,
          4: "正在生成正式报告…",
          5: "报告校验通过",
          6: `成品报告已输出，共 ${(outputSelected.has("separate") ? selectedTowns.length : 0) + (outputSelected.has("summary") ? 1 : 0)} 份文件`,
        };
        return [...prev, msgs[step] ?? ""];
      });
    }, 1400);
    return () => clearTimeout(timer);
  }, [step]);

  const done = step >= steps.length;

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
              {steps.map((s, i) => {
                const isActive = i === step;
                const isDone = i < step;
                return (
                  <div key={s.id} className="flex items-start gap-4 py-3 border-b border-border last:border-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${isDone ? "bg-[var(--status-success)] text-white" : isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                      {isDone ? <CheckCircle2 size={14} /> : isActive ? <Loader2 size={14} className="animate-spin" /> : <span className="text-xs font-mono">{s.id}</span>}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isDone || isActive ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.id === 4 ? (hasMethod ? "使用提供的金额计算方法" : "使用默认金额计算方法") : s.desc}
                      </p>
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
                <span>{Math.round((step / steps.length) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(step / steps.length) * 100}%`, background: "var(--primary)" }}
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
                  <p className="text-sm text-foreground">{done ? "任务完成" : steps[step]?.label ?? "等待"}</p>
                </div>
                <div className="h-px bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">系统提示</p>
                  <div className="space-y-1.5">
                    <div className={`flex items-start gap-2 text-xs ${hasMethod ? "text-[var(--status-success)]" : "text-muted-foreground"}`}>
                      <Info size={12} className={`mt-0.5 shrink-0 ${hasMethod ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"}`} />
                      {hasMethod ? "已读取提供的金额计算方法。" : "未提供新的金额计算方法，已使用默认金额计算方法。"}
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

const TOWN_REPORTS: Report[] = [
  { id: "r1", name: "北陡镇2023年下半年度村级设施考核报告（正文）", town: "北陡镇", period: "2023年下半年度", status: "completed", size: "1.2 MB", createdAt: "2024-01-15 15:32" },
  { id: "r2", name: "白沙镇2023年下半年度村级设施考核报告（正文）", town: "白沙镇", period: "2023年下半年度", status: "completed", size: "1.1 MB", createdAt: "2024-01-15 15:32" },
  { id: "r3", name: "大江镇2023年下半年度村级设施考核报告（正文）", town: "大江镇", period: "2023年下半年度", status: "completed", size: "1.3 MB", createdAt: "2024-01-15 15:32" },
  { id: "r4", name: "赤溪镇2023年下半年度村级设施考核报告（正文）", town: "赤溪镇", period: "2023年下半年度", status: "completed", size: "0.9 MB", createdAt: "2024-01-15 15:32" },
];
const SUMMARY_REPORT: Report = { id: "r5", name: "2023年下半年度村级设施绩效考核综合报告（汇总）", town: "全区汇总", period: "2023年下半年度", status: "completed", size: "4.8 MB", createdAt: "2024-01-15 15:33" };

function formatElapsed(s: number): string {
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60), r = s % 60;
  return r > 0 ? `${m} 分 ${r} 秒` : `${m} 分钟`;
}

function ResultPage({ onNav, packageFiles, methodFiles, methodText, outputSelected, selectedTowns, elapsedSeconds, generatedAt, reportPeriod }: {
  onNav: (p: Page) => void;
  packageFiles: File[];
  methodFiles: File[];
  methodText: string;
  outputSelected: Set<string>;
  selectedTowns: string[];
  elapsedSeconds: number | null;
  generatedAt: string | null;
  reportPeriod: string;
}) {
  const hasMethod = methodFiles.length > 0 || methodText.trim().length > 0;

  const nowStr = generatedAt ?? new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-");
  const townReports: Report[] = selectedTowns.map((town, i) => ({
    id: `r${i + 1}`,
    name: `${town}${reportPeriod}村级设施考核报告（正文）`,
    town,
    period: reportPeriod,
    status: "completed" as ReportStatus,
    size: `${((i * 137 % 8 + 8) / 10).toFixed(1)} MB`,
    createdAt: nowStr,
  }));

  const summaryReport: Report = { id: "r-summary", name: `${reportPeriod}村级设施绩效考核综合报告（汇总）`, town: "全区汇总", period: reportPeriod, status: "completed", size: "4.8 MB", createdAt: nowStr };
  const reports: Report[] = [
    ...(outputSelected.has("separate") ? townReports : []),
    ...(outputSelected.has("summary") ? [summaryReport] : []),
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
                <p className="text-xs text-muted-foreground mt-0.5">共生成 {reports.length} 份报告 · 耗时 {elapsedSeconds !== null ? formatElapsed(elapsedSeconds) : "—"}</p>
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
                onClick={() => onNav("dataupload")}
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
                  hasMethod
                    ? { icon: CheckCircle2, color: "text-[var(--status-success)]", text: "使用提供的金额计算方法" }
                    : { icon: Info, color: "text-[var(--status-warning)]", text: "使用默认金额计算方法" },
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
              <p className="text-xs text-foreground font-mono">{nowStr}</p>
              <div className="h-px bg-border" />
              <p className="text-xs text-muted-foreground font-mono">报告周期</p>
              <p className="text-xs text-foreground font-mono">{reportPeriod}</p>
              <div className="h-px bg-border" />
              <p className="text-xs text-muted-foreground font-mono">资料包</p>
              {packageFiles.map((f, i) => (
                <p key={i} className="text-xs text-foreground font-mono truncate">{f.name}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page 6: History ─────────────────────────────────────────────────────────

function HistoryPage({ onNav, reports }: { onNav: (p: Page) => void; reports: Report[] }) {
  const [filter, setFilter] = useState<"all" | "completed" | "processing">("all");
  const filtered = reports.filter(r => filter === "all" || r.status === filter);

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

// ─── Page: DataDashboard ─────────────────────────────────────────────────────

const PIE_COLORS = ["#1a3a5c", "#e8edf3"];

function TownPieCard({ town }: { town: TownSurvey }) {
  const totalDone = town.surveys.reduce((s, x) => s + x.done, 0);
  const totalAll = town.surveys.reduce((s, x) => s + x.total, 0);
  const pieData = [
    { name: "已完成", value: totalDone },
    { name: "未完成", value: totalAll - totalDone },
  ];
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={14} className="text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground">{town.name}</span>
        <span className="ml-auto text-xs font-mono text-muted-foreground">{totalDone}/{totalAll}</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" strokeWidth={0}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => [`${v} 项`, ""]} contentStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5 mt-1">
        {town.surveys.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">{s.label}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%`, background: "var(--primary)" }} />
            </div>
            <span className="text-xs font-mono text-muted-foreground w-12 text-right">{surveyDisplayValue(s)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_SURVEYS = () => makeDashboardSurveys(0);

function DataDashboardPage({ onNav, onViewTown, towns, setTowns }: {
  onNav: (p: Page) => void;
  onViewTown: (t: TownSurvey) => void;
  towns: TownSurvey[];
  setTowns: React.Dispatch<React.SetStateAction<TownSurvey[]>>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TownSurvey | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState<TownSurvey>({ name: "", status: "pending", surveys: DEFAULT_SURVEYS() });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const completed = towns.filter(t => t.status === "completed");
  const inprogress = towns.filter(t => t.status === "inprogress");
  const pending = towns.filter(t => t.status === "pending");

  function startEdit(t: TownSurvey) {
    setEditingId(t.name);
    setEditDraft({ ...t, surveys: t.surveys.map(s => ({ ...s })) });
  }

  function saveEdit() {
    if (!editDraft) return;
    setTowns(prev => prev.map(t => t.name === editingId ? editDraft : t));
    setEditingId(null);
    setEditDraft(null);
  }

  function deleteRow(name: string) {
    setTowns(prev => prev.filter(t => t.name !== name));
    setDeleteConfirm(null);
  }

  function saveNew() {
    if (!newDraft.name.trim()) return;
    setTowns(prev => [...prev, { ...newDraft }]);
    setAddingNew(false);
    setNewDraft({ name: "", status: "pending", surveys: DEFAULT_SURVEYS() });
  }

  function SurveyInputs({ surveys, onChange }: { surveys: TownSurvey["surveys"]; onChange: (s: TownSurvey["surveys"]) => void }) {
    return (
      <div className="flex gap-3">
        {surveys.map((s, i) => (
          <div key={s.label} className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{s.label}</span>
            {isWaterQualitySurvey(s.label) ? (
              <select
                value={s.done > 0 ? "done" : "pending"}
                onChange={e => {
                  const next = surveys.map((x, j) => j === i ? { ...x, done: e.target.value === "done" ? 1 : 0, total: 1 } : x);
                  onChange(next);
                }}
                className="border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none"
                style={{ background: "var(--input-background)" }}
              >
                <option value="done">已完成</option>
                <option value="pending">未完成</option>
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <input type="number" min={0} value={s.done}
                  onChange={e => { const next = surveys.map((x, j) => j === i ? { ...x, done: Math.min(Number(e.target.value), x.total) } : x); onChange(next); }}
                  className="w-12 border border-border rounded px-1.5 py-0.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                  style={{ background: "var(--input-background)" }}
                />
                <span className="text-xs text-muted-foreground">/</span>
                <input type="number" min={0} value={s.total}
                  onChange={e => { const next = surveys.map((x, j) => j === i ? { ...x, total: Number(e.target.value), done: Math.min(x.done, Number(e.target.value)) } : x); onChange(next); }}
                  className="w-12 border border-border rounded px-1.5 py-0.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                  style={{ background: "var(--input-background)" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="数据看板" subtitle="调研进度总览" breadcrumbs={["数据看板"]} />
      <div className="px-8 py-6 space-y-6 max-w-5xl">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "已完成镇街", value: completed.length, color: "text-[var(--status-success)]", bg: "bg-[var(--status-success-bg)]" },
            { label: "进行中镇街", value: inprogress.length, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "未开始镇街", value: pending.length, color: "text-muted-foreground", bg: "bg-muted" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} border border-border rounded-lg px-5 py-4`}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-semibold font-mono mt-1 ${color}`}>{value} <span className="text-sm font-normal">个</span></p>
            </div>
          ))}
        </div>

        {/* In Progress — center, most prominent */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h3 className="text-sm font-semibold text-foreground">正在进行</h3>
            <span className="text-xs text-muted-foreground font-mono">{inprogress.length} 个镇街</span>
          </div>
          {inprogress.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {inprogress.map(t => <TownPieCard key={t.name} town={t} />)}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg px-6 py-8 text-center text-sm text-muted-foreground">暂无进行中的镇街</div>
          )}
        </div>

        {/* Completed */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-[var(--status-success)]" />
            <h3 className="text-sm font-semibold text-foreground">已完成</h3>
            <span className="text-xs text-muted-foreground font-mono">{completed.length} 个镇街</span>
          </div>
          {completed.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {completed.map(t => (
                <div key={t.name} className="flex items-center gap-2 bg-[var(--status-success-bg)] border border-green-200 rounded-full px-3 py-1.5">
                  <CheckCircle2 size={13} className="text-[var(--status-success)]" />
                  <span className="text-xs font-medium text-foreground">{t.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">暂无已完成镇街</p>
          )}
        </div>

        {/* Pending */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-muted-foreground opacity-40" />
            <h3 className="text-sm font-semibold text-foreground">未开始</h3>
            <span className="text-xs text-muted-foreground font-mono">{pending.length} 个镇街</span>
          </div>
          {pending.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pending.map(t => (
                <div key={t.name} className="flex items-center gap-2 bg-muted border border-border rounded-full px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full border border-muted-foreground opacity-40" />
                  <span className="text-xs text-muted-foreground">{t.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">全部镇街已开始</p>
          )}
        </div>

        {/* Data preview table */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">数据预览</h3>
              <p className="text-xs text-muted-foreground mt-0.5">可直接修改各镇街调研数据，支持增加与删除</p>
            </div>
            <button
              onClick={() => setAddingNew(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              style={{ background: "var(--primary)" }}
            >
              <Plus size={13} /> 新增镇街
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground font-mono">
                  <th className="text-left px-5 py-3 font-medium w-24">镇街名称</th>
                  <th className="text-left px-3 py-3 font-medium w-24">状态</th>
                  {SURVEY_LABELS.map(l => (
                    <th key={l} className="text-left px-3 py-3 font-medium whitespace-nowrap">
                      {l} <span className="opacity-50">{isWaterQualitySurvey(l) ? "是否完成" : "完成/总量"}</span>
                    </th>
                  ))}
                  <th className="text-left px-3 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {towns.map(t => {
                  const isEditing = editingId === t.name;
                  const draft = isEditing ? editDraft! : t;
                  return (
                    <tr key={t.name} className={`border-b border-border last:border-0 ${isEditing ? "bg-blue-50" : "hover:bg-muted/20"}`}>
                      <td className="px-5 py-2.5">
                        {isEditing ? (
                          <input value={draft.name} onChange={e => setEditDraft(d => d ? { ...d, name: e.target.value } : d)}
                            className="w-20 border border-border rounded px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/40"
                            style={{ background: "var(--input-background)" }} />
                        ) : (
                          <span className="text-xs font-medium text-foreground">{t.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <select value={draft.status} onChange={e => setEditDraft(d => d ? { ...d, status: e.target.value as TownSurveyStatus } : d)}
                            className="border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none"
                            style={{ background: "var(--input-background)" }}>
                            <option value="completed">已完成</option>
                            <option value="inprogress">进行中</option>
                            <option value="pending">未开始</option>
                          </select>
                        ) : (
                          <StatusBadge status={t.status === "completed" ? "completed" : t.status === "inprogress" ? "processing" : "pending"} />
                        )}
                      </td>
                      {isEditing ? (
                        <td colSpan={SURVEY_LABELS.length} className="px-3 py-2.5">
                          <SurveyInputs surveys={draft.surveys} onChange={s => setEditDraft(d => d ? { ...d, surveys: s } : d)} />
                        </td>
                      ) : (
                        t.surveys.map(s => (
                          <td key={s.label} className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                            {isWaterQualitySurvey(s.label) ? (
                              <span className={s.done > 0 ? "text-[var(--status-success)]" : "text-muted-foreground"}>
                                {surveyDisplayValue(s)}
                              </span>
                            ) : (
                              <>
                                <span className={s.done === s.total && s.total > 0 ? "text-[var(--status-success)]" : ""}>{s.done}</span>/{s.total}
                              </>
                            )}
                          </td>
                        ))
                      )}
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button onClick={saveEdit} className="text-xs text-[var(--status-success)] hover:underline font-medium">保存</button>
                            <button onClick={() => { setEditingId(null); setEditDraft(null); }} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
                          </div>
                        ) : deleteConfirm === t.name ? (
                          <div className="flex gap-2 items-center">
                            <span className="text-xs text-[var(--status-error)]">确认删除？</span>
                            <button onClick={() => deleteRow(t.name)} className="text-xs text-[var(--status-error)] hover:underline font-medium">删除</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
                          </div>
                        ) : (
                          <div className="flex gap-3">
                            <button onClick={() => onViewTown(t)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><ChevronRight size={11} />详情</button>
                            <button onClick={() => setDeleteConfirm(t.name)} className="text-xs text-[var(--status-error)] hover:underline">删除</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {addingNew && (
                  <tr className="border-b border-border bg-[var(--status-success-bg)]">
                    <td className="px-5 py-2.5">
                      <input value={newDraft.name} onChange={e => setNewDraft(d => ({ ...d, name: e.target.value }))}
                        placeholder="镇街名称"
                        className="w-20 border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                        style={{ background: "var(--input-background)" }} />
                    </td>
                    <td className="px-3 py-2.5">
                      <select value={newDraft.status} onChange={e => setNewDraft(d => ({ ...d, status: e.target.value as TownSurveyStatus }))}
                        className="border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none"
                        style={{ background: "var(--input-background)" }}>
                        <option value="completed">已完成</option>
                        <option value="inprogress">进行中</option>
                        <option value="pending">未开始</option>
                      </select>
                    </td>
                    <td colSpan={SURVEY_LABELS.length} className="px-3 py-2.5">
                      <SurveyInputs surveys={newDraft.surveys} onChange={s => setNewDraft(d => ({ ...d, surveys: s }))} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2">
                        <button onClick={saveNew} disabled={!newDraft.name.trim()} className="text-xs text-[var(--status-success)] hover:underline font-medium disabled:opacity-40">添加</button>
                        <button onClick={() => { setAddingNew(false); setNewDraft({ name: "", status: "pending", surveys: DEFAULT_SURVEYS() }); }} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}

// ─── Page: TownDetail ────────────────────────────────────────────────────────

function TownDetailPage({ town, onNav }: { town: TownSurvey | null; onNav: (p: Page) => void }) {
  if (!town) { onNav("dashboard"); return null; }

  const [groups, setGroups] = useState<SurveyScoreGroup[]>(
    DETAIL_SCORE_TEMPLATES.map(g => ({ ...g, items: g.items.map(i => ({ ...i })) }))
  );
  const [editingKey, setEditingKey] = useState<string | null>(null); // "groupLabel|itemName"
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openL1, setOpenL1] = useState<Set<string>>(new Set());
  const [openRules, setOpenRules] = useState<Set<string>>(new Set());

  function updateItem(groupId: string, iName: string, field: keyof ScoreItem, raw: string) {
    setGroups(prev => prev.map(g => g.id !== groupId ? g : {
      ...g,
      items: g.items.map(item => {
        if (item.name !== iName) return item;
        if (field === "reason") return { ...item, reason: raw };
        const num = Math.max(0, Number(raw) || 0);
        const score = field === "score" ? Math.min(num, item.fullScore) : item.score;
        const fullScore = field === "fullScore" ? num : item.fullScore;
        const deduction = (field === "fullScore" ? num : item.fullScore) - (field === "score" ? Math.min(num, item.fullScore) : item.score);
        return { ...item, [field]: field === "score" ? Math.min(num, item.fullScore) : field === "fullScore" ? num : num, score, fullScore, deduction: Math.max(0, deduction) };
      }),
    }));
  }

  function toggleL1(id: string) {
    setOpenL1(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleRules(id: string) {
    setOpenRules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedFacilityLabel = town.facilityType === "network"
    ? "管网设施"
    : town.facilityType === "treatment"
      ? "污水处理设施"
      : null;
  const visibleLabels = selectedFacilityLabel
    ? [selectedFacilityLabel, "调查问卷", "水质抽检情况"]
    : ["调查问卷", "水质抽检情况"];
  const visibleGroups = groups.filter(group => visibleLabels.includes(group.section));
  const totalFull = visibleGroups.flatMap(g => g.items).reduce((s, i) => s + i.fullScore, 0);
  const totalScore = visibleGroups.flatMap(g => g.items).reduce((s, i) => s + i.score, 0);
  const totalDeduction = totalFull - totalScore;
  const sections = visibleLabels.map(label => {
    const sectionGroups = visibleGroups.filter(group => group.section === label);
    const items = sectionGroups.flatMap(group => group.items);
    const full = items.reduce((s, i) => s + i.fullScore, 0);
    const score = items.reduce((s, i) => s + i.score, 0);
    const dataCollection = DATA_COLLECTION_SECTION_NOTES[label];
    return { label, groups: sectionGroups, full, score, deduction: full - score, dataCollection };
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar
        title={`${town.name} — 调研评分详情`}
        breadcrumbs={["数据看板", "评分详情"]}
        subtitle="报告周期：2023年下半年度"
      />
      <div className="px-8 py-6 max-w-5xl space-y-5">

        {!selectedFacilityLabel && (
          <div className="rounded-lg border border-yellow-200 bg-[var(--status-warning-bg)] px-5 py-3">
            <p className="text-sm font-medium text-foreground">尚未读取到移动端选择的设施类型</p>
            <p className="text-xs text-muted-foreground mt-1">请接入移动端数据包，此处项目为“污水处理设施”或“管网设施”其中一项。</p>
          </div>
        )}

        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "满分", value: totalFull, color: "text-foreground" },
            { label: "实得分", value: totalScore, color: "text-primary" },
            { label: "合计扣分", value: totalDeduction, color: totalDeduction > 0 ? "text-[var(--status-error)]" : "text-[var(--status-success)]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-lg px-5 py-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-semibold font-mono mt-1 ${color}`}>{value} <span className="text-sm font-normal">分</span></p>
            </div>
          ))}
        </div>

        {sections.map(section => {
          const sectionOpen = openSection === section.label;
          return (
            <div key={section.label} className="bg-card border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenSection(sectionOpen ? null : section.label)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/20 transition-colors"
              >
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{section.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {section.dataCollection?.summary ?? `${section.groups.length} 个一级指标，${section.groups.flatMap(g => g.items).length} 个扣分项目`}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  {section.dataCollection ? (
                    <span className="text-muted-foreground">资料录入</span>
                  ) : (
                    <>
                      <span className="text-muted-foreground">满分 {section.full}</span>
                      <span className="text-primary font-medium">得分 {section.score}</span>
                      <span className={section.deduction > 0 ? "text-[var(--status-error)] font-medium" : "text-[var(--status-success)]"}>
                        {section.deduction > 0 ? `扣分 -${section.deduction}` : "无扣分"}
                      </span>
                    </>
                  )}
                  {sectionOpen ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
                </div>
              </button>

              {sectionOpen && (
                <div className="border-t border-border bg-muted/10 px-5 py-4 space-y-4">
                  {section.dataCollection ? (
                    <div className="rounded-lg border border-border bg-card px-5 py-4 space-y-2">
                      {section.dataCollection.details.map(detail => (
                        <p key={detail} className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
                      ))}
                    </div>
                  ) : section.groups.map(group => {
                    const groupOpen = openL1.has(group.id);
                    const groupFull = group.items.reduce((s, i) => s + i.fullScore, 0);
                    const groupScore = group.items.reduce((s, i) => s + i.score, 0);
                    const groupDeduction = groupFull - groupScore;
                    return (
                      <div key={group.id} className="bg-card border border-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleL1(group.id)}
                          className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-muted/20 transition-colors"
                        >
                          <div>
                            <div className="text-sm font-semibold text-foreground">{group.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{group.items.length} 个扣分项目</div>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-mono">
                            <span className="text-muted-foreground">满分 {groupFull}</span>
                            <span className="text-primary">得分 {groupScore}</span>
                            <span className={groupDeduction > 0 ? "text-[var(--status-error)]" : "text-[var(--status-success)]"}>
                              {groupDeduction > 0 ? `−${groupDeduction}` : "无扣分"}
                            </span>
                            {groupOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                          </div>
                        </button>

                        {groupOpen && (
                          <div className="border-t border-border">
                            {Array.from(new Set(group.items.map(item => item.itemType || "未分类"))).map(itemType => {
                              const typeItems = group.items.filter(item => (item.itemType || "未分类") === itemType);
                              return (
                                <div key={itemType} className="border-b border-border last:border-b-0">
                                  <div className="px-5 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">{itemType}</div>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border text-xs text-muted-foreground font-mono">
                                        <th className="text-left px-5 py-3 font-medium">三级指标</th>
                                        <th className="text-right px-4 py-3 font-medium w-20">满分</th>
                                        <th className="text-right px-4 py-3 font-medium w-20">得分</th>
                                        <th className="text-right px-4 py-3 font-medium w-20">扣分</th>
                                        <th className="text-left px-4 py-3 font-medium">扣分原因</th>
                                        <th className="text-left px-4 py-3 font-medium w-20">操作</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {typeItems.map(item => {
                                        const key = `${group.id}|${item.name}`;
                                        const isEditing = editingKey === key;
                                        const rulesOpen = openRules.has(key);
                                        return (
                                          <tr key={item.name} className={`border-b border-border last:border-0 ${isEditing ? "bg-blue-50" : "hover:bg-muted/20"}`}>
                                            <td className="px-5 py-3 text-xs text-foreground align-top">
                                              <div className="font-medium">{item.name}</div>
                                              {(item.evaluationStandard || item.scoringMethod || item.dataSource) && (
                                                <div className="mt-2">
                                                  <button
                                                    onClick={() => toggleRules(key)}
                                                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                                  >
                                                    {rulesOpen ? "收起评分细则" : "展开评分细则"}
                                                    {rulesOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                  </button>
                                                  {rulesOpen && (
                                                    <div className="mt-2 rounded border border-border bg-muted/20 px-3 py-2">
                                                      {item.evaluationStandard && (
                                                        <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">
                                                          {item.evaluationStandard}
                                                        </p>
                                                      )}
                                                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                                                        {item.scoringMethod && <span>评分方法：{item.scoringMethod}</span>}
                                                        {item.dataSource && <span>数据来源：{item.dataSource}</span>}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                              {isEditing ? (
                                                <input type="number" min={0} value={item.fullScore}
                                                  onChange={e => updateItem(group.id, item.name, "fullScore", e.target.value)}
                                                  className="w-14 border border-border rounded px-1.5 py-0.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                  style={{ background: "var(--input-background)" }} />
                                              ) : (
                                                <span className="text-xs font-mono text-muted-foreground">{item.fullScore}</span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                              {isEditing ? (
                                                <input type="number" min={0} max={item.fullScore} value={item.score}
                                                  onChange={e => updateItem(group.id, item.name, "score", e.target.value)}
                                                  className="w-14 border border-border rounded px-1.5 py-0.5 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                  style={{ background: "var(--input-background)" }} />
                                              ) : (
                                                <span className={`text-xs font-mono ${item.score < item.fullScore ? "text-[var(--status-error)]" : "text-[var(--status-success)]"}`}>
                                                  {item.score}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-mono text-right">
                                              {item.deduction > 0
                                                ? <span className="text-[var(--status-error)] font-medium">−{item.deduction}</span>
                                                : <span className="text-[var(--status-success)]">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5">
                                              {isEditing ? (
                                                <input type="text" value={item.reason}
                                                  onChange={e => updateItem(group.id, item.name, "reason", e.target.value)}
                                                  placeholder="填写扣分原因…"
                                                  className="w-full border border-border rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                  style={{ background: "var(--input-background)" }} />
                                              ) : (
                                                <span className="text-xs text-muted-foreground">
                                                  {item.reason || <span className="text-[var(--status-success)]">达标</span>}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                              {isEditing ? (
                                                <button onClick={() => setEditingKey(null)} className="text-xs text-[var(--status-success)] hover:underline font-medium">保存</button>
                                              ) : (
                                                <button onClick={() => setEditingKey(key)} className="text-xs text-primary hover:underline">编辑</button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })}
                            <div className="px-5 py-2.5 bg-muted/30 flex items-center justify-end gap-5 text-xs font-mono font-medium">
                              <span className="text-muted-foreground">小计满分 {groupFull}</span>
                              <span className="text-primary">得分 {groupScore}</span>
                              <span className={groupDeduction > 0 ? "text-[var(--status-error)]" : "text-[var(--status-success)]"}>
                                {groupDeduction > 0 ? `扣分 −${groupDeduction}` : "无扣分"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-1">
          <button onClick={() => onNav("dashboard")} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ChevronRight size={14} className="rotate-180" /> 返回数据看板
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page: DataUploadSelect ───────────────────────────────────────────────────

function DataUploadSelectPage({ onNav }: { onNav: (p: Page) => void }) {
  const [selected, setSelected] = useState<"upload" | "mobile" | null>(null);

  const options = [
    {
      id: "upload" as const,
      icon: FolderOpen,
      label: "资料包上传",
      desc: "上传已整理的镇街资料包，系统自动识别镇街并生成考核报告",
    },
    {
      id: "mobile" as const,
      icon: BarChart2,
      label: "使用数据看板数据",
      desc: "直接使用数据看板中已采集的调研数据，自动读取各镇街调研结果生成报告",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="数据上传" breadcrumbs={["数据上传"]} />
      <div className="px-8 py-10 max-w-2xl">
        <p className="text-sm text-muted-foreground mb-6">请选择本次数据来源方式</p>
        <div className="space-y-4">
          {options.map(opt => {
            const active = selected === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`flex items-start gap-5 p-5 rounded-lg border-2 cursor-pointer transition-colors ${active ? "border-primary bg-blue-50" : "border-border bg-card hover:border-primary/40 hover:bg-muted/20"}`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${active ? "border-primary" : "border-border"}`}>
                  {active && <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--primary)" }} />}
                </div>
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-primary" : "bg-muted"}`}>
                    <opt.icon size={20} className={active ? "text-white" : "text-muted-foreground"} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end mt-8">
          <button
            onClick={() => selected && onNav(selected)}
            disabled={!selected}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold transition-opacity ${selected ? "text-primary-foreground hover:opacity-90" : "opacity-40 cursor-not-allowed text-primary-foreground"}`}
            style={{ background: "var(--primary)" }}
          >
            下一步
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page: MobileData ─────────────────────────────────────────────────────────

function MobileDataPage({ onNav, towns, setSelectedTowns, methodFiles, setMethodFiles, methodText, setMethodText, reportPeriod, setReportPeriod }: {
  onNav: (p: Page) => void;
  towns: TownSurvey[];
  setSelectedTowns: React.Dispatch<React.SetStateAction<string[]>>;
  methodFiles: File[];
  setMethodFiles: React.Dispatch<React.SetStateAction<File[]>>;
  methodText: string;
  setMethodText: React.Dispatch<React.SetStateAction<string>>;
  reportPeriod: string;
  setReportPeriod: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [methodOpen, setMethodOpen] = useState(false);
  const [removedTowns, setRemovedTowns] = useState<Set<string>>(new Set());
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const methodFileRef = useRef<HTMLInputElement>(null);

  const visibleTowns = towns.filter(t => t.status === "completed" && !removedTowns.has(t.name));
  const canProceed = visibleTowns.length > 0 && reportPeriod.trim().length > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <TopBar title="使用数据看板数据" breadcrumbs={["生成报告", "使用数据看板数据"]} />
      <div className="px-8 py-6 max-w-3xl space-y-5">

        {/* Data overview */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">当前看板数据概览</h3>
              <p className="text-xs text-muted-foreground mt-0.5">以下为数据看板中已完成镇街采集数据{removedTowns.size > 0 && `，本次生成已排除 ${removedTowns.size} 个镇街`}</p>
            </div>
            {removedTowns.size > 0 && (
              <button onClick={() => setRemovedTowns(new Set())} className="text-xs text-primary hover:underline">恢复本次生成名单</button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground font-mono">
                <th className="text-left px-5 py-3 font-medium">镇街</th>
                {SURVEY_LABELS.map(l => (
                  <th key={l} className="text-left px-3 py-3 font-medium">
                    {l} <span className="opacity-50">{isWaterQualitySurvey(l) ? "是否完成" : "完成/总量"}</span>
                  </th>
                ))}
                <th className="text-left px-3 py-3 font-medium">状态</th>
                <th className="text-left px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleTowns.map(t => (
                <tr key={t.name} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 text-xs font-medium text-foreground">{t.name}</td>
                  {t.surveys.map(s => (
                    <td key={s.label} className="px-3 py-3 text-xs font-mono text-muted-foreground">
                      {isWaterQualitySurvey(s.label) ? (
                        <span className={s.done > 0 ? "text-[var(--status-success)]" : "text-muted-foreground"}>
                          {surveyDisplayValue(s)}
                        </span>
                      ) : (
                        surveyDisplayValue(s)
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <StatusBadge status="completed" />
                  </td>
                  <td className="px-3 py-3">
                    {removeConfirm === t.name ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setRemovedTowns(prev => new Set([...prev, t.name])); setRemoveConfirm(null); }} className="text-xs text-[var(--status-error)] hover:underline font-medium">确认移除</button>
                        <button onClick={() => setRemoveConfirm(null)} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
                      </div>
                    ) : (
                      <button onClick={() => setRemoveConfirm(t.name)} className="text-xs text-[var(--status-error)] hover:underline">点击取消本街镇的本次生成</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Report period */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">报告周期 <span className="text-[var(--status-error)] text-xs ml-1">必填</span></h3>
          </div>
          <div className="px-6 py-4">
            <input
              type="text"
              value={reportPeriod}
              onChange={e => setReportPeriod(e.target.value)}
              placeholder="例如：2023年下半年度、2024年第一季度"
              className="w-full border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ background: "var(--input-background)" }}
            />
          </div>
        </div>

        {/* Method — same style as upload page */}
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
                  未填写时，系统将使用 <DefaultMethodLink /> 继续生成报告，不影响主流程。
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">上传合同或补充协议（可选）</label>
                <input ref={methodFileRef} type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) setMethodFiles(prev => [...prev, ...files]); }} />
                <div
                  className="border border-dashed border-border rounded p-4 flex items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  onClick={() => methodFileRef.current?.click()}
                >
                  <UploadCloud size={16} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">上传合同、补充协议或金额计算表</span>
                </div>
                {methodFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {methodFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted rounded px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <FileText size={12} className="text-primary shrink-0" />
                          <span className="text-xs text-foreground truncate max-w-xs">{f.name}</span>
                        </div>
                        <button onClick={() => setMethodFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground ml-2">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">或填写说明（可选）</label>
                <textarea rows={3} value={methodText} onChange={e => setMethodText(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  style={{ background: "var(--input-background)" }}
                  placeholder="例如：本期按合同单价下浮 5% 结算，超期罚款按每日 0.05% 扣减……" />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => onNav("dataupload")} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">返回选择</button>
          <div className="flex items-center gap-3">
            <button
              disabled={!canProceed}
              onClick={() => {
                setSelectedTowns(visibleTowns.map(t => t.name));
                onNav("confirm");
              }}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm font-semibold transition-opacity ${canProceed ? "text-primary-foreground hover:opacity-90" : "opacity-40 cursor-not-allowed text-primary-foreground"}`}
              style={{ background: "var(--primary)" }}
            >
              下一步：确认生成 <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [detailTown, setDetailTown] = useState<TownSurvey | null>(null);
  const [towns, setTowns] = useState<TownSurvey[]>(DASHBOARD_TOWNS.map(t => ({ ...t, surveys: t.surveys.map(s => ({ ...s })) })));
  const [dataSource, setDataSource] = useState<"upload" | "mobile">("upload");
  const [packageFiles, setPackageFiles] = useState<File[]>([]);
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [methodFiles, setMethodFiles] = useState<File[]>([]);
  const [methodText, setMethodText] = useState("");
  const [outputSelected, setOutputSelected] = useState<Set<string>>(new Set(["separate", "summary"]));
  const [confirmedTowns, setConfirmedTowns] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [reportPeriod, setReportPeriod] = useState("");
  const [historyReports, setHistoryReports] = useState<Report[]>(HISTORY_REPORTS);
  const progressStartRef = useRef<number | null>(null);

  function toggleOutput(id: string) {
    setOutputSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function renderPage() {
    switch (page) {
      case "home": return <HomePage onNav={setPage} reports={historyReports} />;
      case "dashboard": return <DataDashboardPage onNav={setPage} onViewTown={(t) => { setDetailTown(t); setPage("towndetail"); }} towns={towns} setTowns={setTowns} />;
      case "towndetail": return <TownDetailPage town={detailTown} onNav={setPage} />;
      case "dataupload": return <DataUploadSelectPage onNav={setPage} />;
      case "mobile": return (
        <MobileDataPage
          onNav={(p) => { if (p === "confirm") setDataSource("mobile"); setPage(p); }}
          towns={towns}
          setSelectedTowns={setSelectedTowns}
          methodFiles={methodFiles}
          setMethodFiles={setMethodFiles}
          methodText={methodText}
          setMethodText={setMethodText}
          reportPeriod={reportPeriod}
          setReportPeriod={setReportPeriod}
        />
      );
      case "upload": return (
        <UploadPage
          onNav={(p) => { if (p === "confirm") setDataSource("upload"); setPage(p); }}
          packageFiles={packageFiles}
          setPackageFiles={setPackageFiles}
          selectedTowns={selectedTowns}
          setSelectedTowns={setSelectedTowns}
          methodFiles={methodFiles}
          setMethodFiles={setMethodFiles}
          methodText={methodText}
          setMethodText={setMethodText}
          reportPeriod={reportPeriod}
          setReportPeriod={setReportPeriod}
        />
      );
      case "confirm": {
        const confirmTowns = selectedTowns;
        return (
          <ConfirmPage
            onNav={(p) => {
              if (p === "progress") setConfirmedTowns(confirmTowns);
              setPage(p);
            }}
            dataSource={dataSource}
            packageFiles={packageFiles}
            selectedTowns={confirmTowns}
            methodFiles={methodFiles}
            methodText={methodText}
            outputSelected={outputSelected}
            onToggleOutput={toggleOutput}
            reportPeriod={reportPeriod}
          />
        );
      }
      case "progress": return (
        <ProgressPage
          onNav={(p) => {
            if (p === "result" && progressStartRef.current !== null) {
              const elapsed = Math.round((Date.now() - progressStartRef.current) / 1000);
              setElapsedSeconds(elapsed);
              const now = new Date();
              const nowStr = now.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(/\//g, "-");
              setGeneratedAt(nowStr);
              // Add to history
              const newReports: Report[] = [
                ...(outputSelected.has("separate") ? confirmedTowns.map((town, i) => ({
                  id: `gen-${Date.now()}-${i}`,
                  name: `${town}${reportPeriod}村级设施考核报告（正文）`,
                  town,
                  period: reportPeriod,
                  status: "completed" as ReportStatus,
                  size: `${((i * 137 % 8 + 8) / 10).toFixed(1)} MB`,
                  createdAt: nowStr,
                })) : []),
                ...(outputSelected.has("summary") ? [{
                  id: `gen-${Date.now()}-summary`,
                  name: `${reportPeriod}村级设施绩效考核综合报告（汇总）`,
                  town: "全区汇总",
                  period: reportPeriod,
                  status: "completed" as ReportStatus,
                  size: "4.8 MB",
                  createdAt: nowStr,
                }] : []),
              ];
              setHistoryReports(prev => [...newReports, ...prev]);
            }
            setPage(p);
          }}
          onStart={() => { progressStartRef.current = Date.now(); }}
          dataSource={dataSource}
          methodFiles={methodFiles}
          methodText={methodText}
          selectedTowns={confirmedTowns}
          outputSelected={outputSelected}
        />
      );
      case "result": return (
        <ResultPage
          onNav={setPage}
          packageFiles={packageFiles}
          methodFiles={methodFiles}
          methodText={methodText}
          outputSelected={outputSelected}
          selectedTowns={confirmedTowns}
          elapsedSeconds={elapsedSeconds}
          generatedAt={generatedAt}
          reportPeriod={reportPeriod}
        />
      );
      case "history": return <HistoryPage onNav={setPage} reports={historyReports} />;
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
