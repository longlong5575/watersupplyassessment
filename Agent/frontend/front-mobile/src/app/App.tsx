import { useState, useRef } from "react";
import { useEffect } from "react";
import {
  ChevronRight, ChevronLeft, Search, Camera, X, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp, Save, Send,
  Plus, Minus, MapPin, Building2, BarChart3,
  AlertTriangle, Info, Check, Package, Smartphone,
} from "lucide-react";
import { NETWORK_STANDARDS, TREATMENT_STANDARDS } from "./assessmentStandards";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";
const DRAFT_STORAGE_KEY = "assessment-mobile-draft-v1";
const SUBMITTED_STORAGE_KEY = "assessment-mobile-submitted-v1";
const AUTH_STORAGE_KEY = "assessment-mobile-auth-v1";
const SYNC_QUEUE_STORAGE_KEY = "assessment-mobile-sync-queue-v1";

// ==================== TYPES ====================

type FacilityType = "treatment" | "network" | "survey" | "water_quality";
type DeductionType = "fixed" | "range" | "severity";
type EntryStatus = "pending" | "no_deduction" | "has_deduction" | "incomplete";
type SelectionType = "no_deduction" | "standard" | "custom";

type CityOption = { id?: string; name: string; sub: string };
type CycleOption = { id: string; name: string; status: string; backendId?: string };
type AssessmentObjectInfo = { sectionCode?: string; title?: string; description?: string };
type TownOption = {
  id: string;
  name: string;
  chapterCode?: string;
  assessmentTargets: PrimaryFacilityType[];
  assessmentObject: Partial<Record<PrimaryFacilityType, AssessmentObjectInfo>>;
};
type VillageOption = { id: string; name: string; administrativeVillage?: string; chapterCode?: string; assessmentObject?: AssessmentObjectInfo };

type AuthState = {
  token: string;
  user: { id: string; name: string; role: string };
};

interface DeductionOption {
  id: string;
  reason: string;
  type: DeductionType;
  value?: number;
  min?: number;
  max?: number;
  unit?: string;
  maxInstances?: number;
  sourceText?: string;
}

interface L3Item {
  id: string;
  name: string;
  maxScore: number;
  description: string;
  evaluationStandard?: string;
  standardText?: string;
  scoringMethod?: string;
  dataSource?: string;
  calculationMethod?: string;
  options: DeductionOption[];
}

interface L2Group {
  id: string;
  name: string;
  items: L3Item[];
}

interface L1Group {
  id: string;
  name: string;
  icon: string;
  children: L2Group[];
}

interface Photo {
  id: string;
  dataUrl: string;
}

interface OptionEntry {
  optionId: string;
  selection: SelectionType;
  instances: number;
  rangeValue: number;
  severity: "normal" | "severe";
  customScore: number;
  customNote: string;
  adjustedScore: number | null;
  adjustNote: string;
  photos: Photo[];
  note: string;
  open: boolean;
}

interface ItemEntry {
  itemId: string;
  options: OptionEntry[];
  generalNote: string;
  done: boolean;
}

interface TypeScore {
  maxScore: number;
  currentScore: number;
  deductedScore: number;
}

interface WaterQualityEntry {
  sampleTime: string;
  dischargeStandard: string;
  processType: string;
  designScale: string;
  hasTpLimit: boolean;
  codValue: string;
  codLimit: string;
  nh3nValue: string;
  nh3nLimit: string;
  tpValue: string;
  tpLimit: string;
  conclusion: "pending" | "qualified" | "unqualified";
  note: string;
  completed: boolean;
}

interface VillageRecord {
  village: string;
  facilityType: string;
  primaryFacilityType?: PrimaryFacilityType;
  standardFacilityType?: FacilityType;
  submittedAt: string;
  maxScore: number;
  deductedScore: number;
  currentScore: number;
  entries: Record<string, ItemEntry>;
  surveyEntries?: Record<string, SurveyFormEntry>;
  waterQuality?: WaterQualityEntry;
}

interface TownPackage {
  schemaVersion: "1.0";
  exportedAt: string;
  cityId?: string;
  cycleId?: string;
  city: string;
  period: string;
  town: string;
  villages: VillageRecord[];
}

interface SyncQueueItem {
  localId: string;
  town: string;
  pkg: TownPackage;
  syncStatus: "pending_sync" | "synced" | "sync_failed";
  createdAt: string;
  syncedAt?: string;
  lastError?: string;
}

function makeLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function submitTownPackageToBackend(pkg: TownPackage, token: string) {
  const createResponse = await fetch(`${API_BASE_URL}/mobile/assessment-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(pkg),
  });
  if (!createResponse.ok) throw new Error(`Create record failed: ${createResponse.status}`);

  const record = await createResponse.json();
  const recordIds = Array.isArray(record.recordIds) && record.recordIds.length ? record.recordIds : [record.id];
  const submitted = [];
  for (const recordId of recordIds) {
    const submitResponse = await fetch(`${API_BASE_URL}/mobile/assessment-records/${recordId}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!submitResponse.ok) throw new Error(`Submit record failed: ${submitResponse.status}`);
    submitted.push(await submitResponse.json());
  }
  return submitted;
}

function triggerDownload(pkg: TownPackage) {
  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pkg.town}_考核数据包_${pkg.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function calcSurveyTypeScore(surveyEntries: Record<string, SurveyFormEntry>): TypeScore {
  // 问卷是正式三级指标的数据来源，不作为独立评分大项重复计分。
  return { maxScore: 0, currentScore: 0, deductedScore: 0 };
}

// ==================== SCORING DATA ====================

const TREATMENT_MERGE_RULES: Record<string, { targetId: string; name?: string; maxScore: number }> = {
  treatment_09: { targetId: "treatment_08", name: "稳定塘/生化工艺及其他处理工艺", maxScore: 15 },
  treatment_12: { targetId: "treatment_11", name: "污水收集管渠", maxScore: 8 },
  treatment_15: { targetId: "treatment_14", name: "机电设备、管路及附件", maxScore: 5 },
};

function joinUnique(parts: Array<string | undefined>, separator = "\n") {
  return Array.from(new Set(parts.filter((part): part is string => Boolean(part?.trim())))).join(separator);
}

function cleanStandardText(...parts: Array<string | undefined>) {
  const clean = parts.find(part => part?.trim() && !part.includes("???"));
  if (clean) return clean;
  return (parts.find(part => part?.trim()) ?? "").replace(/\?+/g, "").trim();
}

function cleanDeductionOption(option: DeductionOption): DeductionOption {
  return {
    ...option,
    reason: cleanStandardText(option.reason, option.sourceText) || "扣分项",
    sourceText: cleanStandardText(option.sourceText, option.reason),
  };
}

function mergeStandardItems(groups: L1Group[], rules: Record<string, { targetId: string; name?: string; maxScore: number }>): L1Group[] {
  return groups.map(l1 => ({
    ...l1,
    children: l1.children.map(l2 => {
      const items: L3Item[] = [];
      for (const item of l2.items) {
        const rule = rules[item.id];
        if (!rule) {
          items.push({
            ...item,
            calculationMethod: cleanStandardText(item.calculationMethod, item.scoringMethod, item.evaluationStandard),
            options: item.options.map(cleanDeductionOption),
          });
          continue;
        }
        const target = items.find(existing => existing.id === rule.targetId);
        if (!target) {
          items.push({
            ...item,
            id: rule.targetId,
            name: rule.name ?? item.name,
            maxScore: rule.maxScore,
            calculationMethod: cleanStandardText(item.calculationMethod, item.scoringMethod, item.evaluationStandard),
            options: item.options.map(cleanDeductionOption),
          });
          continue;
        }
        target.name = rule.name ?? target.name;
        target.maxScore = rule.maxScore;
        target.description = joinUnique([target.description, item.description], "；");
        target.evaluationStandard = joinUnique([target.evaluationStandard, item.evaluationStandard]);
        target.standardText = joinUnique([target.standardText, item.standardText]);
        target.scoringMethod = joinUnique([target.scoringMethod, item.scoringMethod], "、");
        target.dataSource = joinUnique([target.dataSource, item.dataSource], "、");
        target.options = [...target.options, ...item.options.map(cleanDeductionOption)];
      }
      return { ...l2, items };
    }),
  }));
}

let TREATMENT: L1Group[] = mergeStandardItems(TREATMENT_STANDARDS as unknown as L1Group[], TREATMENT_MERGE_RULES);
let NETWORK: L1Group[] = NETWORK_STANDARDS as unknown as L1Group[];

function applyBackendStandards(type: "treatment" | "network", items: Array<{ id: string; parentId: string | null; name: string; level: number; fullScore: number; facilityType?: string | null; deductionOptions?: Array<{ id: string; name: string; deduction: number; type?: DeductionType; unit?: string; maxInstances?: number }> }>) {
  const l1 = items.filter(item => item.level === 1);
  const l2 = items.filter(item => item.level === 2);
  const l3 = items.filter(item => item.level === 3);
  const groups: L1Group[] = l1.map(group => ({
    id: group.id,
    name: group.name,
    icon: "●",
    children: l2.filter(child => child.parentId === group.id).map(child => ({
      id: child.id,
      name: child.name,
      items: l3.filter(item => item.parentId === child.id).map(item => ({
        id: item.id,
        name: item.name,
        maxScore: item.fullScore,
        description: "以已发布考核标准为准",
        options: (item.deductionOptions ?? []).map(option => ({
          id: option.id,
          name: option.name,
          reason: option.name,
          type: option.type === "range" ? "range" as const : "fixed" as const,
          value: option.deduction,
          min: option.type === "range" ? 0 : undefined,
          max: option.type === "range" ? option.deduction : undefined,
          unit: option.unit || undefined,
          maxInstances: option.maxInstances || undefined,
        })),
      })),
    })),
  })).filter(group => group.children.some(child => child.items.length));
  if (!groups.length) return;
  if (type === "treatment") TREATMENT = groups;
  if (type === "network") NETWORK = groups;
}

// ==================== HELPERS ====================

function getAllItems(groups: L1Group[]): L3Item[] {
  return groups.flatMap(l1 => l1.children.flatMap(l2 => l2.items));
}

function findItem(groups: L1Group[], id: string): L3Item | undefined {
  return getAllItems(groups).find(i => i.id === id);
}

function findL1(groups: L1Group[], id: string): L1Group | undefined {
  return groups.find(l1 => l1.children.some(l2 => l2.items.some(i => i.id === id)));
}

function findL2(groups: L1Group[], id: string): L2Group | undefined {
  for (const l1 of groups) {
    const found = l1.children.find(l2 => l2.items.some(i => i.id === id));
    if (found) return found;
  }
  return undefined;
}

function calcOptionScore(oe: OptionEntry, opt: DeductionOption): number {
  if (oe.selection === "no_deduction") return 0;
  if (oe.selection === "custom") return oe.customScore;
  if (oe.adjustedScore !== null) return oe.adjustedScore;
  if (opt.type === "fixed") return opt.value! * Math.min(oe.instances, opt.maxInstances ?? 999);
  if (opt.type === "range") return oe.rangeValue;
  if (opt.type === "severity") return oe.severity === "severe" ? opt.value! + 5 : opt.value!;
  return 0;
}

function makeScoreChoices(min: number, max: number): number[] {
  const values: number[] = [];
  for (let value = min; value <= max + 0.0001; value += 0.1) {
    values.push(Number(value.toFixed(1)));
  }
  return values;
}

function calcItemRaw(entry: ItemEntry, item: L3Item): number {
  return entry.options.reduce((sum, oe) => {
    const opt = item.options.find(o => o.id === oe.optionId);
    return sum + (opt ? calcOptionScore(oe, opt) : 0);
  }, 0);
}

type SurveyDerivedKind = "sewage_collection" | "overall_effect" | "satisfaction_org" | "satisfaction_town" | "satisfaction_public";

interface SurveyDerivedScore {
  kind: SurveyDerivedKind;
  currentScore: number;
  deductedScore: number;
  completed: boolean;
}

function getSurveyDerivedKind(item: L3Item, l2?: L2Group): SurveyDerivedKind | null {
  const text = `${l2?.name ?? ""} ${item.name} ${item.scoringMethod ?? ""} ${item.dataSource ?? ""}`;
  if (text.includes("问卷调查") && item.name === "污水收集") return "sewage_collection";
  if (text.includes("问卷调查") && item.name === "整体效果") return "overall_effect";
  if (l2?.name.includes("满意度") && item.name === "实施机构满意度") return "satisfaction_org";
  if (l2?.name.includes("满意度") && item.name === "镇街满意度") return "satisfaction_town";
  if (l2?.name.includes("满意度") && item.name === "公众满意度") return "satisfaction_public";
  return null;
}

function completedScore(surveyEntries: Record<string, SurveyFormEntry>, cat: SurveyCategory, res: SurveyRespondent): number | null {
  const entry = surveyEntries[surveyKey(cat, res)];
  return entry?.completed && entry.score > 0 ? entry.score : null;
}

function average(values: Array<number | null>): number | null {
  const scores = values.filter((v): v is number => v !== null);
  if (scores.length !== values.length || scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function scaleSurveyScore(score5: number | null, maxScore: number): { currentScore: number; completed: boolean } {
  if (score5 === null) return { currentScore: 0, completed: false };
  return { currentScore: Number(((score5 / 5) * maxScore).toFixed(1)), completed: true };
}

function calcSurveyDerivedScore(item: L3Item, l2: L2Group | undefined, surveyEntries: Record<string, SurveyFormEntry>): SurveyDerivedScore | null {
  const kind = getSurveyDerivedKind(item, l2);
  if (!kind) return null;

  let scaled: { currentScore: number; completed: boolean };
  if (kind === "sewage_collection" || kind === "overall_effect") {
    const cat: SurveyCategory = kind === "sewage_collection" ? "sewage_collection" : "overall_effect";
    const a = average([completedScore(surveyEntries, cat, "villager1"), completedScore(surveyEntries, cat, "villager2")]);
    const b = completedScore(surveyEntries, cat, "gov_rep");
    const c = completedScore(surveyEntries, cat, "assessment_team");
    const weighted = a !== null && b !== null && c !== null ? 0.3 * a + 0.3 * b + 0.4 * c : null;
    scaled = scaleSurveyScore(weighted, item.maxScore);
  } else if (kind === "satisfaction_org") {
    scaled = scaleSurveyScore(completedScore(surveyEntries, "satisfaction", "implementation_org"), item.maxScore);
  } else if (kind === "satisfaction_town") {
    scaled = scaleSurveyScore(completedScore(surveyEntries, "satisfaction", "gov_rep"), item.maxScore);
  } else {
    scaled = scaleSurveyScore(average([
      completedScore(surveyEntries, "satisfaction", "villager1"),
      completedScore(surveyEntries, "satisfaction", "villager2"),
    ]), item.maxScore);
  }

  return {
    kind,
    currentScore: scaled.currentScore,
    deductedScore: Number((item.maxScore - scaled.currentScore).toFixed(1)),
    completed: scaled.completed,
  };
}

function calcEntryDeduction(
  entries: Record<string, ItemEntry>,
  groups: L1Group[],
  itemId: string,
  surveyEntries?: Record<string, SurveyFormEntry>
): number {
  const entry = entries[itemId];
  const item = findItem(groups, itemId);
  if (!item) return 0;
  const derived = surveyEntries ? calcSurveyDerivedScore(item, findL2(groups, itemId), surveyEntries) : null;
  if (derived) return derived.deductedScore;
  if (!entry) return 0;
  return Math.min(calcItemRaw(entry, item), item.maxScore);
}

function totalMaxScore(groups: L1Group[]): number {
  return getAllItems(groups).reduce((s, i) => s + i.maxScore, 0);
}

function makeOptionEntry(optionId: string): OptionEntry {
  return {
    optionId,
    selection: "no_deduction",
    instances: 1,
    rangeValue: 0,
    severity: "normal",
    customScore: 0,
    customNote: "",
    adjustedScore: null,
    adjustNote: "",
    photos: [],
    note: "",
    open: false,
  };
}

function getStatus(entry: ItemEntry | undefined): EntryStatus {
  if (!entry) return "pending";
  if (!entry.done) return "incomplete";
  const hasDeduction = entry.options.some(o => o.selection !== "no_deduction" && o.selection !== undefined);
  const rawScore = entry.options.reduce((s, oe) => {
    return s + (oe.selection === "no_deduction" ? 0 : oe.selection === "custom" ? oe.customScore : oe.rangeValue + (oe.adjustedScore ?? 0));
  }, 0);
  return rawScore > 0 || hasDeduction ? "has_deduction" : "no_deduction";
}

// ==================== SHARED COMPONENTS ====================

function StatusTag({ status }: { status: EntryStatus }) {
  const map: Record<EntryStatus, { text: string; cls: string; dot: string }> = {
    pending: { text: "未录入", cls: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
    incomplete: { text: "待补充", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
    no_deduction: { text: "无扣分", cls: "bg-green-50 text-green-700", dot: "bg-green-500" },
    has_deduction: { text: "有扣分", cls: "bg-red-50 text-red-700", dot: "bg-red-500" },
  };
  const { text, cls, dot } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {text}
    </span>
  );
}

// ==================== PAGE 0: CITY ====================

function MobileLoginPage({ onLogin }: { onLogin: (auth: AuthState) => void }) {
  const [username, setUsername] = useState("inspector");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim()) {
      setError("请输入员工账号");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!response.ok) throw new Error("login failed");
      const auth = await response.json();
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
      onLogin(auth);
    } catch {
      setError("账号不存在，请使用 inspector 或 admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-8 shrink-0">
        <div className="flex items-center gap-1.5 mb-1 mt-1">
          <Smartphone className="w-3.5 h-3.5 text-primary-foreground/55" />
          <span className="text-xs text-primary-foreground/55 tracking-wide">农村污水PPP现场考核</span>
        </div>
        <h1 className="text-xl font-semibold text-primary-foreground">员工登录</h1>
      </div>
      <div className="flex-1 px-4 py-6">
        <label className="block text-sm font-medium text-foreground mb-2">员工账号</label>
        <input
          value={username}
          onChange={event => { setUsername(event.target.value); setError(""); }}
          placeholder="inspector / admin"
          className="w-full px-3 py-3 bg-white border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </div>
    </div>
  );
}

function P0City({ onNext }: { onNext: (c: CityOption) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [cities, setCities] = useState<CityOption[]>([
    { id: "yunan", name: "郁南项目", sub: "郁南考核标准" },
    { id: "maonan", name: "茂南项目", sub: "茂南考核标准" },
  ]);
  useEffect(() => {
    fetch(`${API_BASE_URL}/mobile/projects`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (Array.isArray(data?.items) && data.items.length) {
          setCities(data.items.map((item: { id: string; name: string; standardScope?: string }) => ({ id: item.id, name: item.name, sub: item.standardScope ?? "已配置" })));
        }
      })
      .catch(() => undefined);
  }, []);
  const selected = cities.find(city => city.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <div className="flex items-center gap-1.5 mb-1 mt-1">
          <MapPin className="w-3.5 h-3.5 text-primary-foreground/55" />
          <span className="text-xs text-primary-foreground/55 tracking-wide">农村污水PPP现场考核</span>
        </div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择项目</h1>
        <p className="text-xs text-primary-foreground/55 mt-1">郁南和茂南分别使用各自的考核标准</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">当前项目</p>
          <div className="grid grid-cols-2 gap-2">
              {cities.map(c => (
                <button
                  key={c.id ?? c.name}
                  onClick={() => setSelectedId(c.id ?? c.name)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors text-left ${
                    selectedId === (c.id ?? c.name) ? "bg-primary/5 border-primary" : "bg-white border-border"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selectedId === (c.id ?? c.name) ? "bg-primary" : "bg-muted"}`}>
                    <MapPin className={`w-4 h-4 ${selectedId === (c.id ?? c.name) ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${selectedId === (c.id ?? c.name) ? "text-primary" : "text-foreground"}`}>{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.sub}</div>
                  </div>
                  {selectedId === (c.id ?? c.name) && <Check className="w-4 h-4 text-primary shrink-0 ml-auto" />}
                </button>
              ))}
            </div>
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 0.5: CYCLE ====================

function formatCycleName(name: string): string {
  const legacyAnnual = name.match(/^(\d{4})年度考核$/);
  return legacyAnnual ? `${legacyAnnual[1]}年第2季度` : name;
}

function fixedCycleOptions(): CycleOption[] {
  return [2024, 2025, 2026, 2027, 2028, 2029, 2030].flatMap(itemYear => [
    { id: `fixed-${itemYear}-q1`, name: `${itemYear}年第1季度`, status: "固定选项" },
    { id: `fixed-${itemYear}-q2`, name: `${itemYear}年第2季度`, status: "固定选项" },
    { id: `fixed-${itemYear}-q3`, name: `${itemYear}年第3季度`, status: "固定选项" },
    { id: `fixed-${itemYear}-q4`, name: `${itemYear}年第4季度`, status: "固定选项" },
    { id: `fixed-${itemYear}-h1`, name: `${itemYear}年上半年度`, status: "固定选项" },
    { id: `fixed-${itemYear}-h2`, name: `${itemYear}年下半年度`, status: "固定选项" },
  ]);
}

const CYCLE_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
const CYCLE_PERIODS = [
  { id: "q1", label: "第1季度", suffix: "第1季度" },
  { id: "q2", label: "第2季度", suffix: "第2季度" },
  { id: "q3", label: "第3季度", suffix: "第3季度" },
  { id: "q4", label: "第4季度", suffix: "第4季度" },
  { id: "h1", label: "上半年度", suffix: "上半年度" },
  { id: "h2", label: "下半年度", suffix: "下半年度" },
];

function cycleNameFromParts(year: number, periodId: string): string {
  const period = CYCLE_PERIODS.find(item => item.id === periodId) ?? CYCLE_PERIODS[1];
  return `${year}年${period.suffix}`;
}

function parseCycleNameParts(name: string): { year: number; periodId: string } | null {
  const matched = name.match(/^(202[4-9]|2030)年(第[1-4]季度|上半年度|下半年度)$/);
  if (!matched) return null;
  const period = CYCLE_PERIODS.find(item => item.suffix === matched[2]);
  return period ? { year: Number(matched[1]), periodId: period.id } : null;
}

function P0Cycle({ cityId, cityName, onBack, onNext }: {
  cityId?: string;
  cityName: string;
  onBack: () => void;
  onNext: (cycle: CycleOption) => void;
}) {
  const defaultCycles = fixedCycleOptions();
  const [cycles, setCycles] = useState<CycleOption[]>(defaultCycles);
  const initialYear = CYCLE_YEARS.includes(new Date().getFullYear()) ? new Date().getFullYear() : 2026;
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedPeriodId, setSelectedPeriodId] = useState("q2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = cityId ? `?city_id=${encodeURIComponent(cityId)}` : "";
    setLoading(true);
    setError("");
    fetch(`${API_BASE_URL}/mobile/assessment-cycles${params}`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const items: Array<{ id: string; name: string; status: string }> = Array.isArray(data?.items) ? data.items : [];
        const backendByName = new Map(items.map((item: { id: string; name: string; status: string }) => [formatCycleName(item.name), item]));
        const mapped = fixedCycleOptions().map(item => {
          const backend = backendByName.get(item.name);
          return backend
            ? { ...item, status: backend.status === "active" ? "active" : backend.status, backendId: backend.id }
            : item;
        });
        setCycles(mapped);
        const active = mapped.find(item => item.status === "active");
        const target = active ?? mapped.find(item => item.name === `${initialYear}年第2季度`) ?? mapped[0];
        const parsed = target ? parseCycleNameParts(target.name) : null;
        if (parsed) {
          setSelectedYear(parsed.year);
          setSelectedPeriodId(parsed.periodId);
        }
      })
      .catch(() => {
        const fallback = fixedCycleOptions();
        setError("后端暂时未连接，仍可先选择固定批次");
        setCycles(fallback);
        setSelectedYear(initialYear);
        setSelectedPeriodId("q2");
      })
      .finally(() => setLoading(false));
  }, [cityId, initialYear]);

  const selectedName = cycleNameFromParts(selectedYear, selectedPeriodId);
  const selected = cycles.find(item => item.name === selectedName) ?? {
    id: `fixed-${selectedYear}-${selectedPeriodId}`,
    name: selectedName,
    status: "固定选项",
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="text-xs text-primary-foreground/55 mb-1">{cityName}</div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择考核季度</h1>
        <p className="text-xs text-primary-foreground/55 mt-1">选择年份季度或上/下半年度</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {loading && <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted-foreground">正在同步后台批次...</div>}
        {!loading && error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">年度</p>
          <div className="grid grid-cols-4 gap-2">
            {CYCLE_YEARS.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`h-11 rounded-lg border text-sm font-semibold ${
                  selectedYear === year ? "bg-primary/5 border-primary text-primary" : "bg-white border-border text-foreground"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">季度</p>
          <div className="grid grid-cols-2 gap-2">
            {CYCLE_PERIODS.map(period => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriodId(period.id)}
                className={`h-12 rounded-lg border text-sm font-semibold ${
                  selectedPeriodId === period.id ? "bg-primary/5 border-primary text-primary" : "bg-white border-border text-foreground"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">{selected.name}</div>
            <div className="text-xs text-muted-foreground mt-1">{selected.backendId ? `后台批次：${selected.status}` : selected.status}</div>
          </div>
          <CheckCircle className="w-5 h-5 text-primary" />
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 1: TOWN ====================

function P1Town({ cityId, projectName, onBack, onNext, submittedData, onViewSubmitted }: {
  cityId?: string;
  projectName: string;
  onBack: () => void;
  onNext: (t: TownOption) => void;
  submittedData: Record<string, VillageRecord[]>;
  onViewSubmitted: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [towns, setTowns] = useState<TownOption[]>([]);

  useEffect(() => {
    const params = cityId ? `?city_id=${encodeURIComponent(cityId)}` : "";
    fetch(`${API_BASE_URL}/mobile/towns${params}`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (Array.isArray(data?.items)) setTowns(data.items);
      })
      .catch(() => undefined);
  }, [cityId]);
  const selected = towns.find(town => town.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="flex items-center gap-1.5 mb-1 mt-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-primary-foreground/55 shrink-0" />
            <span className="text-xs text-primary-foreground/55 tracking-wide truncate">{projectName}</span>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择考核镇街</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">项目镇街清单</p>
          <div className="space-y-2">
            {towns.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  selectedId === t.id ? "bg-primary/5 border-primary" : "bg-white border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedId === t.id ? "bg-primary" : "bg-muted"}`}>
                    <MapPin className={`w-4 h-4 ${selectedId === t.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <span className={`text-sm font-medium ${selectedId === t.id ? "text-primary" : "text-foreground"}`}>{t.name}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.assessmentTargets.length}类考核对象</div>
                  </div>
                </div>
                {selectedId === t.id && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0 space-y-2">
        <button
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onViewSubmitted}
          className="w-full py-3 border border-border text-muted-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          查看已提交镇街数据
          {Object.keys(submittedData).length > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {Object.keys(submittedData).length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 2: VILLAGE ====================

function P2Village({ town, cityId, onBack, onNext }: {
  town: string;
  cityId?: string;
  onBack: () => void;
  onNext: (v: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [villages, setVillages] = useState<VillageOption[]>([]);

  useEffect(() => {
    const params = cityId ? `?city_id=${encodeURIComponent(cityId)}` : "";
    fetch(`${API_BASE_URL}/mobile/towns/${encodeURIComponent(town)}/villages${params}`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (Array.isArray(data?.items)) setVillages(data.items);
      })
      .catch(() => undefined);
  }, [town, cityId]);
  const selected = villages.find(village => village.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="flex items-center gap-1.5 mb-1">
          <Building2 className="w-3.5 h-3.5 text-primary-foreground/55" />
          <span className="text-xs text-primary-foreground/55">{town}</span>
        </div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择考核村点</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">设施点清单</p>
          <div className="space-y-2">
            {villages.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  selectedId === v.id ? "bg-primary/5 border-primary" : "bg-white border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedId === v.id ? "bg-primary" : "bg-muted"}`}>
                    <Building2 className={`w-4 h-4 ${selectedId === v.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <span className={`text-sm font-medium ${selectedId === v.id ? "text-primary" : "text-foreground"}`}>{v.name}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">{v.administrativeVillage || "行政村待核"}</div>
                  </div>
                </div>
                {selectedId === v.id && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={() => selected && onNext(selected.name)}
          disabled={!selected}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 2b: FACILITY TYPE ====================

type PrimaryFacilityType = "town_plant" | "town_network" | "rural_treatment";

const PRIMARY_FACILITY_TYPES: PrimaryFacilityType[] = ["town_plant", "town_network", "rural_treatment"];

function standardTypeForPrimary(type: PrimaryFacilityType): "treatment" | "network" {
  return type === "town_network" ? "network" : "treatment";
}

const FACILITY_TYPE_INFO: Record<FacilityType, { label: string; sub: string; icon: string }> = {
  treatment: { label: "污水处理设施", sub: "含处理设备及附属构筑物", icon: "🏭" },
  network:   { label: "纳厂/管网设施", sub: "接入已建处理设施",       icon: "🔧" },
  survey:    { label: "调查问卷",      sub: "多方满意度问卷调查",      icon: "📋" },
  water_quality: { label: "水质抽检情况", sub: "填写出水抽检指标及结论", icon: "💧" },
};

const PRIMARY_FACILITY_TYPE_INFO: Record<PrimaryFacilityType, { label: string; sub: string; icon: string }> = {
  town_plant: { label: "镇街污水厂", sub: "镇街污水处理厂考核", icon: "🏭" },
  town_network: { label: "镇街污水收集管网", sub: "镇街收集管网考核", icon: "🔧" },
  rural_treatment: { label: "农村污水处理设施", sub: "进入后继续选择村点", icon: "🏘️" },
};

function P2bFacilityChoice({ town, allowedTargets, onBack, onSelect }: {
  town: string;
  allowedTargets: PrimaryFacilityType[];
  onBack: () => void;
  onSelect: (type: PrimaryFacilityType) => void;
}) {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="text-xs text-primary-foreground/55 mb-1">{town}</div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择考核对象</h1>
      </div>

      <div className="flex-1 px-4 py-5 space-y-3">
        {PRIMARY_FACILITY_TYPES.filter(type => allowedTargets.includes(type)).map(type => {
          const info = PRIMARY_FACILITY_TYPE_INFO[type];
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="w-full text-left rounded-xl border-2 border-border bg-white p-5 transition-colors active:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">{info.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-foreground">{info.label}</div>
                  <p className="text-xs text-muted-foreground mt-1">{info.sub}</p>
                  <p className="text-xs text-primary font-medium mt-2">{type === "rural_treatment" ? "下一步选择村" : "进入镇街填报"}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function P2bFacilityType({ town, village, primaryFacilityType, typeProgress, onBack, onEnter, onSubmitVillage }: {
  town: string; village: string;
  primaryFacilityType: PrimaryFacilityType;
  typeProgress: Partial<Record<FacilityType, boolean>>;
  onBack: () => void;
  onEnter: (t: FacilityType) => void;
  onSubmitVillage: () => void;
}) {
  const mainFacilityType = standardTypeForPrimary(primaryFacilityType);
  const primaryInfo = PRIMARY_FACILITY_TYPE_INFO[primaryFacilityType];
  const availableTypes: FacilityType[] = primaryFacilityType === "rural_treatment"
    ? [mainFacilityType, "survey", "water_quality"]
    : [mainFacilityType, "water_quality"];
  const doneCount = availableTypes.filter(t => typeProgress[t]).length;
  const allDone = doneCount === availableTypes.length;
  const scopeText = primaryFacilityType === "rural_treatment" ? `${town} · ${village}` : `${town} · ${primaryInfo.label}`;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="flex items-center gap-1.5 mb-1">
          <Building2 className="w-3.5 h-3.5 text-primary-foreground/55" />
          <span className="text-xs text-primary-foreground/55">{scopeText}</span>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-xl font-semibold text-primary-foreground">{primaryInfo.label}</h1>
          <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${allDone ? "bg-green-500/20 text-green-200" : "bg-white/15 text-primary-foreground/80"}`}>
            {doneCount}/{availableTypes.length} 已完成
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {availableTypes.map((t, i) => {
          const info = FACILITY_TYPE_INFO[t];
          const done = !!typeProgress[t];
          return (
            <button
              key={t}
              onClick={() => onEnter(t)}
              className="w-full text-left rounded-xl border-2 p-4 bg-white transition-colors active:bg-gray-50 border-border"
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${done ? "bg-green-100" : "bg-muted"}`}>
                  {done ? <CheckCircle className="w-5 h-5 text-green-600" /> : info.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{info.label}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${done ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {done ? "已完成" : "待完成"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{info.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={onSubmitVillage}
          disabled={!allDone}
          className={`w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
            allDone
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Send className="w-4 h-4" />
          {allDone ? "提交本项考核" : `还差 ${availableTypes.length - doneCount} 项未完成`}
        </button>
      </div>
    </div>
  );
}

// ==================== SURVEY DATA ====================

type SurveyCategory = "sewage_collection" | "overall_effect" | "satisfaction";
type SurveyRespondent = "villager1" | "villager2" | "gov_rep" | "assessment_team" | "implementation_org";

interface SurveyFormEntry {
  score: number; // 0 = unanswered, 1–5
  comment: string;
  completed: boolean;
}

const SURVEY_CATEGORIES: SurveyCategory[] = ["sewage_collection", "overall_effect", "satisfaction"];

const CATEGORY_LABEL: Record<SurveyCategory, string> = {
  sewage_collection: "污水收集效果评分",
  overall_effect: "整体效果评分",
  satisfaction: "满意度评分",
};

const CATEGORY_RESPONDENTS: Record<SurveyCategory, SurveyRespondent[]> = {
  sewage_collection: ["villager1", "villager2", "gov_rep", "assessment_team"],
  overall_effect: ["villager1", "villager2", "gov_rep", "assessment_team"],
  satisfaction: ["villager1", "villager2", "gov_rep", "implementation_org"],
};

const RESPONDENT_LABEL: Record<SurveyRespondent, string> = {
  villager1: "村民 1",
  villager2: "村民 2",
  gov_rep: "镇街政府代表",
  assessment_team: "考核小组",
  implementation_org: "实施机构",
};

function questionnaireStandardItems() {
  return [
    ...TREATMENT.map(group => ({ source: "污水处理设施", group })),
    ...NETWORK.map(group => ({ source: "纳厂或接入已建设施的管网设施", group })),
  ].flatMap(({ source, group }) =>
    group.children.flatMap(child =>
      child.items
        .filter(item => {
          const text = `${group.name} ${child.name} ${item.name} ${item.scoringMethod ?? ""} ${item.dataSource ?? ""}`;
          return (
            text.includes("问卷调查") ||
            child.name.includes("满意度") ||
            item.name.includes("污水收集") ||
            item.name.includes("整体效果") ||
            item.name.includes("满意度")
          );
        })
        .map(item => ({ source, l1: group.name, l2: child.name, l3: item.name, score: item.maxScore }))
    )
  );
}

const RATING_LABELS = ["", "很差", "较差", "一般", "较好", "很好"];
const RATING_COLORS = ["", "bg-red-500", "bg-orange-400", "bg-amber-400", "bg-blue-500", "bg-green-500"];

function surveyKey(cat: SurveyCategory, res: SurveyRespondent) { return `${cat}_${res}`; }

function emptySurveyForm(): SurveyFormEntry {
  return { score: 0, comment: "", completed: false };
}

const WATER_QUALITY_LIMITS: Record<PrimaryFacilityType, Pick<WaterQualityEntry, "dischargeStandard" | "hasTpLimit" | "codLimit" | "nh3nLimit" | "tpLimit">> = {
  town_plant: {
    dischargeStandard: "城镇污水处理厂污染物排放标准一级A及广东省水污染物排放限值较严值",
    hasTpLimit: true,
    codLimit: "40",
    nh3nLimit: "5（8）",
    tpLimit: "0.5",
  },
  town_network: {
    dischargeStandard: "城镇污水处理厂污染物排放标准一级A及广东省水污染物排放限值较严值",
    hasTpLimit: true,
    codLimit: "40",
    nh3nLimit: "5（8）",
    tpLimit: "0.5",
  },
  rural_treatment: {
    dischargeStandard: "广东省《农村生活污水处理排放标准》（DB44/2208-2019）一级标准",
    hasTpLimit: true,
    codLimit: "60",
    nh3nLimit: "8（15）",
    tpLimit: "1",
  },
};

function applyFixedWaterQualityLimits(entry: WaterQualityEntry, primaryFacilityType: PrimaryFacilityType): WaterQualityEntry {
  return { ...entry, ...WATER_QUALITY_LIMITS[primaryFacilityType] };
}

function emptyWaterQualityEntry(primaryFacilityType: PrimaryFacilityType = "rural_treatment"): WaterQualityEntry {
  return {
    sampleTime: "",
    processType: "",
    designScale: "",
    codValue: "",
    nh3nValue: "",
    tpValue: "",
    conclusion: "pending",
    note: "",
    completed: false,
    ...WATER_QUALITY_LIMITS[primaryFacilityType],
  };
}

// ==================== PAGE S1: SURVEY LIST ====================

function PSurveyList({ town, village, surveyEntries, onBack, onOpen, onSummary }: {
  town: string; village: string;
  surveyEntries: Record<string, SurveyFormEntry>;
  onBack: () => void;
  onOpen: (cat: SurveyCategory, res: SurveyRespondent) => void;
  onSummary: () => void;
}) {
  const totalForms = SURVEY_CATEGORIES.reduce((s, c) => s + CATEGORY_RESPONDENTS[c].length, 0);
  const completedForms = Object.values(surveyEntries).filter(e => e.completed).length;

  const scoreLabel = (entry: SurveyFormEntry) => entry.score > 0 ? entry.score : null;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="text-xs text-primary-foreground/55 mb-0.5">{town} · {village}</div>
        <h1 className="text-lg font-semibold text-primary-foreground mb-3">调查问卷</h1>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-primary-foreground">{completedForms}/{totalForms}</div>
            <div className="text-[10px] text-primary-foreground/55">已完成</div>
          </div>
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-primary-foreground">{totalForms - completedForms}</div>
            <div className="text-[10px] text-primary-foreground/55">待填写</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {SURVEY_CATEGORIES.map(cat => (
          <div key={cat} className="mt-4 mx-4">
            <div className="px-4 py-2.5 rounded-t-lg bg-[#1a3a52] flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{CATEGORY_LABEL[cat]}</span>
              <span className="text-xs text-white/60">
                {CATEGORY_RESPONDENTS[cat].filter(r => surveyEntries[surveyKey(cat, r)]?.completed).length}/{CATEGORY_RESPONDENTS[cat].length} 份
              </span>
            </div>
            <div className="bg-white border border-t-0 border-border rounded-b-lg overflow-hidden">
              {CATEGORY_RESPONDENTS[cat].map((res, i) => {
                const entry = surveyEntries[surveyKey(cat, res)];
                const done = entry?.completed;
                const score = entry ? scoreLabel(entry) : null;
                return (
                  <button
                    key={res}
                    onClick={() => onOpen(cat, res)}
                    className={`w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-gray-50 ${i < CATEGORY_RESPONDENTS[cat].length - 1 ? "border-b border-border" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {done ? <Check className="w-4 h-4" /> : (i + 1)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{RESPONDENT_LABEL[res]}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {done ? "已完成" : "待填写"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {score && <span className="text-sm font-bold text-primary">{score}分</span>}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="h-4" />
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button onClick={onSummary} className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2">
          <BarChart3 className="w-4 h-4" />查看汇总
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE S2: SURVEY FORM ====================

function PSurveyForm({ category, respondent, entry, onBack, onSave }: {
  category: SurveyCategory;
  respondent: SurveyRespondent;
  entry: SurveyFormEntry;
  onBack: () => void;
  onSave: (e: SurveyFormEntry) => void;
}) {
  const [form, setForm] = useState<SurveyFormEntry>({ ...entry });
  const save = (done: boolean) => { onSave({ ...form, completed: done }); onBack(); };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="text-[10px] text-primary-foreground/55 mb-1">{CATEGORY_LABEL[category]}</div>
        <h1 className="text-base font-semibold text-primary-foreground">{RESPONDENT_LABEL[respondent]}</h1>
      </div>

      <div className="flex-1 flex flex-col px-4 py-8 space-y-8">
        {/* Score picker */}
        <div className="bg-white rounded-2xl border border-border p-6">
          <p className="text-sm font-medium text-foreground mb-6 text-center">请选择评分</p>
          <div className="flex gap-3 justify-center">
            {[1, 2, 3, 4, 5].map(v => (
              <button
                key={v}
                onClick={() => setForm(prev => ({ ...prev, score: v }))}
                className={`w-14 h-14 rounded-2xl text-2xl font-bold border-2 transition-all ${
                  form.score === v
                    ? `${RATING_COLORS[v]} text-white border-transparent scale-110 shadow-md`
                    : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-3 px-1">
            <span className="text-xs text-muted-foreground">很差</span>
            <span className="text-xs text-muted-foreground">很好</span>
          </div>
          {form.score > 0 && (
            <div className={`mt-5 text-center text-sm font-semibold text-white py-2 rounded-xl ${RATING_COLORS[form.score]}`}>
              {RATING_LABELS[form.score]}
            </div>
          )}
        </div>

        {/* Comment */}
        <div className="bg-white rounded-2xl border border-border p-4">
          <label className="text-xs font-medium text-muted-foreground block mb-2">补充意见（选填）</label>
          <textarea
            value={form.comment}
            onChange={e => setForm(prev => ({ ...prev, comment: e.target.value }))}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none resize-none"
            rows={3}
            placeholder="可填写具体意见或建议"
          />
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white grid grid-cols-2 gap-2 shrink-0">
        <button onClick={() => save(false)} className="py-3 border border-primary text-primary rounded-xl font-medium text-sm flex items-center justify-center gap-1.5">
          <Save className="w-4 h-4" />保存草稿
        </button>
        <button
          onClick={() => save(true)}
          disabled={form.score === 0}
          className={`py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-1.5 ${
            form.score > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <CheckCircle className="w-4 h-4" />完成本份
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE W1: WATER QUALITY ====================

function PWaterQualityForm({ town, village, primaryFacilityType, entry, onBack, onSave }: {
  town: string;
  village: string;
  primaryFacilityType: PrimaryFacilityType;
  entry: WaterQualityEntry;
  onBack: () => void;
  onSave: (entry: WaterQualityEntry) => void;
}) {
  const [form, setForm] = useState<WaterQualityEntry>(() => applyFixedWaterQualityLimits(entry, primaryFacilityType));
  useEffect(() => {
    setForm(prev => applyFixedWaterQualityLimits(prev, primaryFacilityType));
  }, [primaryFacilityType]);
  const update = (patch: Partial<WaterQualityEntry>) => setForm(prev => ({ ...prev, ...patch }));
  const canComplete = !!form.sampleTime && !!form.dischargeStandard && !!form.processType && !!form.designScale && form.conclusion !== "pending";

  const Field = ({ label, value, placeholder, onChange }: {
    label: string;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
  }) => (
    <label className="block">
      <span className="text-xs text-muted-foreground block mb-1.5">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        style={{ background: "var(--input-background)" }}
      />
    </label>
  );

  const FixedField = ({ label, value }: { label: string; value: string }) => (
    <div>
      <span className="text-xs text-muted-foreground block mb-1.5">{label}</span>
      <div className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/45 text-foreground min-h-[38px] flex items-center">
        {value}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="text-xs text-primary-foreground/55 mb-0.5">{town} · {village}</div>
        <h1 className="text-lg font-semibold text-primary-foreground">水质抽检情况</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 flex gap-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            排放标准和限值已按项目报告附录固定带出，现场只需填写抽检实测数据。
          </p>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 space-y-3">
          <Field label="取样时间" value={form.sampleTime} placeholder="如：2023-12-10 09:30" onChange={sampleTime => update({ sampleTime })} />
          <FixedField label="排放标准" value={form.dischargeStandard} />
          <Field label="工艺类型" value={form.processType} placeholder="如：A/O + 人工湿地" onChange={processType => update({ processType })} />
          <Field label="规模（m3/d）" value={form.designScale} placeholder="如：50" onChange={designScale => update({ designScale })} />
        </div>

        <div className="bg-white border border-border rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="CODCr 实测值" value={form.codValue} placeholder="mg/L" onChange={codValue => update({ codValue })} />
            <FixedField label="CODCr 限值（mg/L）" value={form.codLimit} />
            <Field label="NH3-N 实测值" value={form.nh3nValue} placeholder="mg/L" onChange={nh3nValue => update({ nh3nValue })} />
            <FixedField label="NH3-N 限值（mg/L）" value={form.nh3nLimit} />
            {form.hasTpLimit && (
              <>
                <Field label="TP 实测值" value={form.tpValue} placeholder="mg/L" onChange={tpValue => update({ tpValue })} />
                <FixedField label="TP 限值（mg/L）" value={form.tpLimit} />
              </>
            )}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 space-y-3">
          <div className="text-xs text-muted-foreground">抽检结论</div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "qualified" as const, label: "达标" },
              { value: "unqualified" as const, label: "不达标" },
            ]).map(item => (
              <button
                key={item.value}
                onClick={() => update({ conclusion: item.value })}
                className={`py-3 rounded-lg border text-sm font-medium ${
                  form.conclusion === item.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-foreground border-border"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-xs text-muted-foreground block mb-1.5">备注</span>
            <textarea
              value={form.note}
              onChange={e => update({ note: e.target.value })}
              placeholder="填写超标指标、检测机构、报告编号等"
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ background: "var(--input-background)" }}
            />
          </label>
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={() => { onSave({ ...form, completed: canComplete }); onBack(); }}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />保存水质抽检情况
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 3: CRITERIA LIST ====================

function P3Criteria({ town, village, ftype, groups, entries, surveyEntries, standardVersionName, onBack, onSelect, onSummary }: {
  town: string; village: string; ftype: FacilityType;
  groups: L1Group[];
  entries: Record<string, ItemEntry>;
  surveyEntries: Record<string, SurveyFormEntry>;
  standardVersionName?: string;
  onBack: () => void;
  onSelect: (id: string) => void;
  onSummary: () => void;
}) {
  const allItems = getAllItems(groups);
  const total = totalMaxScore(groups);
  const deducted = allItems.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id, surveyEntries), 0);
  const current = total - deducted;
  const doneCount = allItems.filter(i => {
    const derived = calcSurveyDerivedScore(i, findL2(groups, i.id), surveyEntries);
    return derived ? derived.completed : entries[i.id]?.done;
  }).length;

  const l1BgColors = ["bg-[#1a3a52]", "bg-[#1a4a38]", "bg-[#3a1a52]"];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-primary-foreground/55 mb-0.5">{town} · {village}</div>
            <h1 className="text-lg font-semibold text-primary-foreground">评分标准</h1>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-primary-foreground/55 mb-0.5">进度</div>
            <div className="text-base font-bold text-primary-foreground">{doneCount}/{allItems.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-primary-foreground">{total}</div>
            <div className="text-[10px] text-primary-foreground/55">总分</div>
          </div>
          <div className="bg-red-500/20 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-red-200">-{deducted}</div>
            <div className="text-[10px] text-red-200/70">已扣分</div>
          </div>
          <div className="bg-green-500/20 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-green-200">{current}</div>
            <div className="text-[10px] text-green-200/70">当前得分</div>
          </div>
        </div>

        <span className="inline-block px-2.5 py-1 bg-white/10 rounded-full text-[10px] text-primary-foreground/75">
          {ftype === "treatment" ? "污水处理设施绩效评价标准" : "纳厂/接入已建设施管网绩效评价标准"}
        </span>
        {standardVersionName && (
          <span className="ml-2 inline-block px-2.5 py-1 bg-white/10 rounded-full text-[10px] text-primary-foreground/75">
            {standardVersionName}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {groups.map((l1, li) => {
          const l1Items = l1.children.flatMap(l2 => l2.items);
          const l1Total = l1Items.reduce((s, i) => s + i.maxScore, 0);
          const l1Ded = l1Items.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id, surveyEntries), 0);

          return (
            <div key={l1.id} className="mt-4 mx-4">
              <div className={`px-4 py-2.5 rounded-t-lg flex items-center justify-between ${l1BgColors[li] ?? "bg-gray-800"}`}>
                <span className="text-sm font-semibold text-white">{l1.icon} {l1.name}</span>
                <span className="text-xs text-white/65">{l1Total - l1Ded}/{l1Total}分</span>
              </div>

              {l1.children.map(l2 => (
                <div key={l2.id} className="bg-white border border-t-0 border-border last:rounded-b-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">{l2.name}</span>
                  </div>
                  {l2.items.map((item, ii) => {
                    const derived = calcSurveyDerivedScore(item, l2, surveyEntries);
                    const ded = derived?.deductedScore ?? calcEntryDeduction(entries, groups, item.id, surveyEntries);
                    const status = derived ? null : getStatus(entries[item.id]);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        className={`w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-gray-50 ${ii < l2.items.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm font-medium text-foreground mb-1">{item.name}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {derived ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${derived.completed ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                                {derived.completed ? "问卷已回填" : "待问卷回填"}
                              </span>
                            ) : (
                              <StatusTag status={status} />
                            )}
                            {ded > 0 && <span className="text-xs text-red-600 font-medium">-{ded}分</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground">{item.maxScore - ded}</div>
                            <div className="text-xs text-muted-foreground">/{item.maxScore}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
        <div className="h-4" />
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white grid grid-cols-2 gap-2 shrink-0">
        <button className="py-3 border border-primary text-primary rounded-xl font-medium text-sm flex items-center justify-center gap-1.5">
          <Save className="w-4 h-4" />保存草稿
        </button>
        <button onClick={onSummary} className="py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-1.5">
          <BarChart3 className="w-4 h-4" />查看汇总
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 4: DEDUCTION DETAIL ====================

function P4Detail({ itemId, groups, entries, surveyEntries, onBack, onSave }: {
  itemId: string;
  groups: L1Group[];
  entries: Record<string, ItemEntry>;
  surveyEntries: Record<string, SurveyFormEntry>;
  onBack: () => void;
  onSave: (e: ItemEntry) => void;
}) {
  const item = findItem(groups, itemId)!;
  const l1 = findL1(groups, itemId);
  const l2 = findL2(groups, itemId);
  const derived = calcSurveyDerivedScore(item, l2, surveyEntries);

  const [entry, setEntry] = useState<ItemEntry>(() => {
    const ex = entries[itemId];
    if (ex) return JSON.parse(JSON.stringify(ex)) as ItemEntry;
    return { itemId, options: item.options.map(o => makeOptionEntry(o.id)), generalNote: "", done: false };
  });

  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustIdx, setAdjustIdx] = useState(0);
  const [adjVal, setAdjVal] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoIdx, setPhotoIdx] = useState(0);

  const rawTotal = derived ? derived.deductedScore : entry.options.reduce((sum, oe, i) => {
    const opt = item.options[i];
    return sum + (opt ? calcOptionScore(oe, opt) : 0);
  }, 0);
  const capped = Math.min(rawTotal, item.maxScore);
  const current = derived ? derived.currentScore : item.maxScore - capped;
  const overLimit = rawTotal > item.maxScore;

  const updateOpt = (i: number, patch: Partial<OptionEntry>) => {
    setEntry(prev => ({
      ...prev,
      options: prev.options.map((o, idx) => idx === i ? { ...o, ...patch } : o),
    }));
  };

  const triggerPhoto = (i: number) => {
    setPhotoIdx(i);
    if (fileRef.current) { fileRef.current.value = ""; fileRef.current.click(); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const photo: Photo = { id: `${Date.now()}_${Math.random()}`, dataUrl: ev.target?.result as string };
        setEntry(prev => ({
          ...prev,
          options: prev.options.map((o, i) => i === photoIdx ? { ...o, photos: [...o.photos, photo] } : o),
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const save = (done: boolean) => { onSave({ ...entry, done }); onBack(); };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="bg-primary px-4 pt-12 pb-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="text-[10px] text-primary-foreground/55 mb-1">{l1?.name} · {l2?.name}</div>
        <h1 className="text-base font-semibold text-primary-foreground mb-3">{item.name}</h1>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-primary-foreground">{item.maxScore}</div>
            <div className="text-[10px] text-primary-foreground/55">指标分值</div>
          </div>
          <div className={`rounded-lg p-2 text-center ${capped > 0 ? "bg-red-500/25" : "bg-white/10"}`}>
            <div className={`text-base font-bold ${capped > 0 ? "text-red-200" : "text-primary-foreground"}`}>-{capped}</div>
            <div className={`text-[10px] ${capped > 0 ? "text-red-200/65" : "text-primary-foreground/55"}`}>已扣分</div>
          </div>
          <div className={`rounded-lg p-2 text-center ${capped > 0 ? "bg-amber-400/20" : "bg-green-500/20"}`}>
            <div className={`text-base font-bold ${capped > 0 ? "text-amber-200" : "text-green-200"}`}>{current}</div>
            <div className={`text-[10px] ${capped > 0 ? "text-amber-200/65" : "text-green-200/65"}`}>当前得分</div>
          </div>
        </div>
        {overLimit && (
          <div className="mt-2 flex items-center gap-1.5 bg-red-500/20 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0" />
            <span className="text-[11px] text-red-200">扣分已达本项上限（{item.maxScore}分），超出部分不计入</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-20">
        {/* Description */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 flex gap-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">{item.description}</p>
        </div>

        {(item.evaluationStandard || item.scoringMethod || item.dataSource) && (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-xs font-semibold text-foreground">考核依据</div>
            <div className="divide-y divide-border">
              {item.evaluationStandard && (
                <div className="px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1">评价标准</div>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">{item.evaluationStandard}</p>
                </div>
              )}
              {item.scoringMethod && (
                <div className="px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1">评分方法</div>
                  <p className="text-xs text-foreground leading-relaxed">{item.scoringMethod}</p>
                </div>
              )}
              {item.dataSource && (
                <div className="px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground mb-1">数据来源</div>
                  <p className="text-xs text-foreground leading-relaxed">{item.dataSource}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {derived && (
          <div className={`rounded-xl border p-4 ${derived.completed ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-start gap-2">
              <Info className={`w-4 h-4 shrink-0 mt-0.5 ${derived.completed ? "text-blue-600" : "text-amber-600"}`} />
              <div>
                <p className={`text-sm font-semibold ${derived.completed ? "text-blue-800" : "text-amber-800"}`}>
                  {derived.completed ? "已由调查问卷自动回填" : "等待调查问卷回填"}
                </p>
                <p className={`text-xs leading-relaxed mt-1 ${derived.completed ? "text-blue-700" : "text-amber-700"}`}>
                  本项结果来源于调查问卷填写结果，不在此处开放手动扣分。请到“调查问卷”模块录入或修改相关评分。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deduction options */}
        {!derived && item.options.map((opt, oi) => {
          const oe = entry.options[oi];
          if (!oe) return null;
          const score = calcOptionScore(oe, opt);

          return (
            <div key={opt.id} className="bg-white rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => updateOpt(oi, { open: !oe.open })}
                className="w-full px-4 py-3.5 flex items-start justify-between text-left"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-sm text-foreground leading-snug">{opt.reason}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {oe.selection === "no_deduction" && (
                      <span className="text-xs text-green-600 font-medium">✓ 无扣分</span>
                    )}
                    {oe.selection === "standard" && score > 0 && (
                      <span className="text-xs text-red-600 font-medium">扣 {score} 分</span>
                    )}
                    {oe.selection === "standard" && score === 0 && (
                      <span className="text-xs text-muted-foreground">请选择扣分值</span>
                    )}
                    {oe.selection === "custom" && (
                      <span className="text-xs text-amber-600 font-medium">其他：扣 {oe.customScore} 分</span>
                    )}
                    {oe.photos.length > 0 && (
                      <span className="text-[11px] text-blue-500">📷 {oe.photos.length}张</span>
                    )}
                  </div>
                </div>
                {oe.open
                  ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
              </button>

              {oe.open && (
                <div className="border-t border-border px-4 py-4 space-y-4">
                  {/* Radio selection */}
                  <div className="space-y-2.5">
                    <p className="text-xs font-medium text-muted-foreground">扣分原因选择</p>
                    {([
                      { sel: "standard" as SelectionType, label: opt.reason, color: "#1a3a52" },
                      { sel: "no_deduction" as SelectionType, label: "不扣分", color: "#16a34a" },
                      { sel: "custom" as SelectionType, label: "其他原因", color: "#d97706" },
                    ]).map(row => (
                      <label key={row.sel} className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          className="mt-0.5 shrink-0"
                          style={{ accentColor: row.color }}
                          checked={oe.selection === row.sel}
                          onChange={() => updateOpt(oi, { selection: row.sel })}
                        />
                        <span className="text-sm text-foreground">{row.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Standard controls */}
                  {oe.selection === "standard" && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                      <p className="text-xs font-semibold text-slate-600">建议扣分方案</p>

                      {opt.type === "fixed" && opt.unit && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">
                            每{opt.unit}扣 {opt.value} 分{opt.maxInstances ? `，最多扣 ${opt.maxInstances * opt.value!} 分` : ""}
                          </p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => updateOpt(oi, { instances: Math.max(1, oe.instances - 1) })}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                            <span className="text-xl font-bold text-slate-800 w-8 text-center">{oe.instances}</span>
                            <button
                              onClick={() => updateOpt(oi, { instances: Math.min(oe.instances + 1, opt.maxInstances ?? 999) })}
                              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                            <span className="text-xs text-slate-500">{opt.unit}</span>
                          </div>
                          <div className="bg-white rounded-lg px-3 py-2 border border-slate-200">
                            <span className="text-xs text-slate-500">建议扣分：</span>
                            <span className="text-sm font-bold text-primary ml-1">
                              {opt.value! * Math.min(oe.instances, opt.maxInstances ?? 999)} 分
                            </span>
                          </div>
                        </div>
                      )}

                      {opt.type === "fixed" && !opt.unit && (
                        <div className="bg-white rounded-lg px-3 py-2 border border-slate-200">
                          <span className="text-xs text-slate-500">建议扣分（固定）：</span>
                          <span className="text-sm font-bold text-primary ml-1">{opt.value} 分</span>
                        </div>
                      )}

                      {opt.type === "range" && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">扣分范围 {opt.min}～{opt.max} 分，请选择：</p>
                          <div className="flex gap-2 flex-wrap">
                            {makeScoreChoices(opt.min!, opt.max!).map(v => (
                              <button
                                key={v}
                                onClick={() => updateOpt(oi, { rangeValue: v })}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                  oe.rangeValue === v
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-white border-slate-200 text-slate-700"
                                }`}
                              >
                                {v}分
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {opt.type === "severity" && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">选择情况程度：</p>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { v: "normal" as const, label: "一般", s: opt.value! },
                              { v: "severe" as const, label: "情况严重", s: opt.value! + 5 },
                            ]).map(sv => (
                              <button
                                key={sv.v}
                                onClick={() => updateOpt(oi, { severity: sv.v })}
                                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                                  oe.severity === sv.v
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-white border-slate-200 text-slate-700"
                                }`}
                              >
                                {sv.label} <span className="text-xs opacity-70">(扣{sv.s}分)</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {oe.adjustedScore !== null && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 flex items-start justify-between gap-2">
                          <p className="text-xs text-amber-700">已调整为 {oe.adjustedScore} 分：{oe.adjustNote}</p>
                          <button onClick={() => updateOpt(oi, { adjustedScore: null, adjustNote: "" })} className="text-xs text-amber-600 underline shrink-0">撤销</button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setAdjustIdx(oi);
                          setAdjVal(oe.adjustedScore !== null ? String(oe.adjustedScore) : String(score));
                          setAdjNote(oe.adjustNote);
                          setShowAdjust(true);
                        }}
                        className="text-xs text-primary underline"
                      >
                        人工调整扣分 →
                      </button>
                    </div>
                  )}

                  {/* Custom reason */}
                  {oe.selection === "custom" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">其他原因不在标准扣分项内，请填写扣分依据</p>
                      </div>
                      <div>
                        <label className="text-xs text-amber-600 block mb-1.5">扣分值（分）</label>
                        <input
                          type="number" min="0" max={item.maxScore}
                          value={oe.customScore || ""}
                          onChange={e => updateOpt(oi, { customScore: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:outline-none"
                          placeholder="请输入扣分值"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-amber-600 block mb-1.5">扣分依据（必填）</label>
                        <textarea
                          value={oe.customNote}
                          onChange={e => updateOpt(oi, { customNote: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:outline-none resize-none"
                          rows={2}
                          placeholder="请填写具体扣分依据"
                        />
                      </div>
                    </div>
                  )}

                  {/* Photo upload */}
                  {oe.selection !== "no_deduction" && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        现场照片{oe.selection === "standard"
                          ? <span className="text-red-500 ml-0.5">*</span>
                          : <span className="text-muted-foreground ml-1">（选填）</span>}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {oe.photos.map(ph => (
                          <div key={ph.id} className="relative w-[68px] h-[68px] rounded-lg overflow-hidden border border-border shrink-0">
                            <img src={ph.dataUrl} alt="现场照片" className="w-full h-full object-cover" />
                            <button
                              onClick={() => updateOpt(oi, { photos: oe.photos.filter(p => p.id !== ph.id) })}
                              className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/55 rounded-full flex items-center justify-center"
                            >
                              <X className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => triggerPhoto(oi)}
                          className="w-[68px] h-[68px] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground shrink-0 active:bg-muted"
                        >
                          <Camera className="w-5 h-5" />
                          <span className="text-[10px]">拍照/上传</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">备注（选填）</label>
                    <textarea
                      value={oe.note}
                      onChange={e => updateOpt(oi, { note: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/25 resize-none"
                      rows={2}
                      placeholder="补充说明"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!derived && (
          <div className="bg-white rounded-xl border border-border p-4">
            <label className="text-xs font-medium text-muted-foreground block mb-2">本项综合备注</label>
            <textarea
              value={entry.generalNote}
              onChange={e => setEntry(prev => ({ ...prev, generalNote: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none resize-none"
              rows={3}
              placeholder="输入综合备注（选填）"
            />
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />

      {derived ? (
        <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
          <button onClick={onBack} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-1.5">
            <ChevronLeft className="w-4 h-4" />返回评分标准
          </button>
        </div>
      ) : (
        <div className="px-4 pb-10 pt-3 border-t border-border bg-white grid grid-cols-2 gap-2 shrink-0">
          <button onClick={() => save(false)} className="py-3 border border-primary text-primary rounded-xl font-medium text-sm flex items-center justify-center gap-1.5">
            <Save className="w-4 h-4" />保存草稿
          </button>
          <button onClick={() => save(true)} className="py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-1.5">
            <CheckCircle className="w-4 h-4" />完成本项
          </button>
        </div>
      )}

      {/* Adjust modal */}
      {showAdjust && (
        <div className="absolute inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-2xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-foreground">人工调整扣分</h3>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">调整后扣分值（分）</label>
              <input
                type="number" min="0"
                value={adjVal}
                onChange={e => setAdjVal(e.target.value)}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">调整说明（必填）</label>
              <textarea
                value={adjNote}
                onChange={e => setAdjNote(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none resize-none"
                rows={2}
                placeholder="请填写调整原因"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowAdjust(false)} className="py-3 border border-border text-muted-foreground rounded-xl text-sm font-medium">
                取消
              </button>
              <button
                onClick={() => {
                  if (!adjNote.trim()) return;
                  updateOpt(adjustIdx, { adjustedScore: Number(adjVal), adjustNote: adjNote });
                  setShowAdjust(false);
                }}
                className="py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
              >
                确认调整
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PAGE 5: SUMMARY ====================

function P5Summary({ town, village, ftype, groups, entries, surveyEntries, onBack, onSubmit, onEditItem, onEditSurvey }: {
  town: string; village: string; ftype: FacilityType;
  groups: L1Group[];
  entries: Record<string, ItemEntry>;
  surveyEntries: Record<string, SurveyFormEntry>;
  onBack: () => void;
  onSubmit: () => void;
  onEditItem: (itemId: string) => void;
  onEditSurvey: (cat: SurveyCategory, res: SurveyRespondent) => void;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const [showPhotoWarn, setShowPhotoWarn] = useState(false);

  const isSurvey = ftype === "survey";
  const allItems = getAllItems(groups);
  const total = totalMaxScore(groups);
  const deducted = allItems.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id, surveyEntries), 0);
  const current = total - deducted;
  const doneCount = allItems.filter(i => {
    const derived = calcSurveyDerivedScore(i, findL2(groups, i.id), surveyEntries);
    return derived ? derived.completed : entries[i.id]?.done;
  }).length;
  const pendingCount = allItems.filter(i => {
    const derived = calcSurveyDerivedScore(i, findL2(groups, i.id), surveyEntries);
    return derived ? !derived.completed : !entries[i.id]?.done;
  }).length;
  const hasDeductCount = allItems.filter(i => calcEntryDeduction(entries, groups, i.id, surveyEntries) > 0).length;
  const totalPhotos = allItems.reduce((s, i) => {
    const e = entries[i.id];
    return s + (e ? e.options.reduce((ps, o) => ps + o.photos.length, 0) : 0);
  }, 0);

  // Survey helpers
  const surveyCompleted = isSurvey
    ? SURVEY_CATEGORIES.every(cat => CATEGORY_RESPONDENTS[cat].every(res => surveyEntries[surveyKey(cat, res)]?.completed))
    : true;
  const catAvg = (cat: SurveyCategory) => {
    const scores = CATEGORY_RESPONDENTS[cat].map(r => surveyEntries[surveyKey(cat, r)]?.score ?? 0).filter(s => s > 0);
    return scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null;
  };

  const validate = () => {
    if (isSurvey) { onSubmit(); return; }
    const errs: string[] = [];
    allItems.forEach(item => {
      if (calcSurveyDerivedScore(item, findL2(groups, item.id), surveyEntries)) return;
      const e = entries[item.id];
      if (!e) return;
      e.options.forEach(oe => {
        if (oe.selection === "custom" && !oe.customNote.trim())
          errs.push(`"${item.name}"：选择了其他原因但未填写扣分依据`);
        if (oe.adjustedScore !== null && !oe.adjustNote.trim())
          errs.push(`"${item.name}"：有人工调整扣分但未填写调整说明`);
      });
    });
    if (errs.length > 0) { setErrors(errs); return; }
    const hasDeductNoPhoto = allItems.some(item => {
      if (calcSurveyDerivedScore(item, findL2(groups, item.id), surveyEntries)) return false;
      const e = entries[item.id];
      if (!e) return false;
      return e.options.some(oe => {
        if (oe.selection !== "standard") return false;
        const opt = item.options.find(o => o.id === oe.optionId);
        return opt ? calcOptionScore(oe, opt) > 0 && oe.photos.length === 0 : false;
      });
    });
    if (hasDeductNoPhoto) { setShowPhotoWarn(true); return; }
    onSubmit();
  };

  const l1Colors = [
    { text: "text-blue-800", bg: "bg-blue-50 border-blue-200", hdr: "bg-[#1a3a52]" },
    { text: "text-emerald-800", bg: "bg-emerald-50 border-emerald-200", hdr: "bg-[#1a4a38]" },
    { text: "text-violet-800", bg: "bg-violet-50 border-violet-200", hdr: "bg-[#3a1a52]" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <h1 className="text-lg font-semibold text-primary-foreground mb-1">本村考核汇总</h1>
        <div className="text-xs text-primary-foreground/55">{town} · {village}</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-2">

        {/* ---- SURVEY MODE ---- */}
        {isSurvey && (
          <>
            {/* Overall survey progress */}
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">调查问卷汇总</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${surveyCompleted ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {surveyCompleted ? "全部完成" : "未全部完成"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {SURVEY_CATEGORIES.map(cat => {
                  const avg = catAvg(cat);
                  const done = CATEGORY_RESPONDENTS[cat].filter(r => surveyEntries[surveyKey(cat, r)]?.completed).length;
                  return (
                    <div key={cat} className="bg-muted rounded-lg p-2.5">
                      <div className={`text-lg font-bold ${avg ? "text-primary" : "text-muted-foreground"}`}>{avg ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{CATEGORY_LABEL[cat]}</div>
                      <div className="text-[10px] text-muted-foreground">{done}/{CATEGORY_RESPONDENTS[cat].length}份</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-category detail with edit buttons */}
            {SURVEY_CATEGORIES.map((cat, ci) => {
              const ac = l1Colors[ci] ?? l1Colors[0];
              const respondents = CATEGORY_RESPONDENTS[cat];
              return (
                <div key={cat} className="overflow-hidden rounded-xl border border-border">
                  <div className={`px-4 py-2.5 flex items-center justify-between ${ac.hdr}`}>
                    <span className="text-sm font-semibold text-white">{CATEGORY_LABEL[cat]}</span>
                    <span className="text-xs text-white/60">{respondents.filter(r => surveyEntries[surveyKey(cat, r)]?.completed).length}/{respondents.length}</span>
                  </div>
                  <div className="bg-white divide-y divide-border">
                    {respondents.map(res => {
                      const e = surveyEntries[surveyKey(cat, res)];
                      const done = e?.completed;
                      return (
                        <div key={res} className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-green-100" : "bg-muted"}`}>
                              {done ? <Check className="w-3.5 h-3.5 text-green-600" /> : <span className="text-[10px] text-muted-foreground">—</span>}
                            </div>
                            <span className="text-sm text-foreground">{RESPONDENT_LABEL[res]}</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            {e?.score ? (
                              <span className={`text-sm font-bold text-white px-2 py-0.5 rounded-lg ${RATING_COLORS[e.score]}`}>{e.score}分</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">未填</span>
                            )}
                            <button
                              onClick={() => onEditSurvey(cat, res)}
                              className="text-xs text-primary border border-primary px-2 py-0.5 rounded-lg"
                            >
                              {done ? "修改" : "填写"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ---- SCORING MODE ---- */}
        {!isSurvey && (
          <>
            <div className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">总体评分</span>
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {ftype === "treatment" ? "污水处理设施" : "纳厂/管网设施"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">{total}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">总分</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">-{deducted}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">已扣分</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{current}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">当前得分</div>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${total > 0 ? (current / total) * 100 : 0}%` }} />
              </div>
              <div className="text-right text-xs text-muted-foreground mt-1">{total > 0 ? Math.round((current / total) * 100) : 0}%</div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "已检查指标", val: `${doneCount}/${allItems.length}`, color: "text-blue-600" },
                { label: "有扣分指标", val: String(hasDeductCount), color: hasDeductCount > 0 ? "text-red-600" : "text-green-600" },
                { label: "已上传照片", val: String(totalPhotos), color: "text-blue-600" },
                { label: "待补充项目", val: String(pendingCount), color: pendingCount > 0 ? "text-amber-600" : "text-green-600" },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-xl border border-border p-3.5">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* L1 breakdown with per-item edit buttons */}
            <div className="space-y-3">
              {groups.map((l1, li) => {
                const ac = l1Colors[li] ?? l1Colors[0];
                const l1Items = l1.children.flatMap(l2 => l2.items);
                const l1Total = l1Items.reduce((s, i) => s + i.maxScore, 0);
                const l1Ded = l1Items.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id, surveyEntries), 0);
                return (
                  <div key={l1.id} className="overflow-hidden rounded-xl border border-border">
                    <div className={`px-4 py-2.5 flex items-center justify-between ${ac.hdr}`}>
                      <span className="text-sm font-semibold text-white">{l1.icon} {l1.name}</span>
                      <span className="text-xs text-white/65">{l1Total - l1Ded}/{l1Total}分</span>
                    </div>
                    <div className="bg-white divide-y divide-border">
                      {l1.children.flatMap(l2 => l2.items.map(item => ({ item, l2 }))).map(({ item, l2 }) => {
                        const derived = calcSurveyDerivedScore(item, l2, surveyEntries);
                        const ded = derived?.deductedScore ?? calcEntryDeduction(entries, groups, item.id, surveyEntries);
                        const done = derived ? derived.completed : entries[item.id]?.done;
                        const score = item.maxScore - ded;
                        return (
                          <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {derived && !done && <span className="text-[10px] text-amber-600">待问卷回填</span>}
                                {derived && done && <span className="text-[10px] text-blue-600">问卷已回填</span>}
                                {!derived && !done && <span className="text-[10px] text-amber-600">待录入</span>}
                                {!derived && done && ded > 0 && <span className="text-[10px] text-red-600">扣{ded}分</span>}
                                {!derived && done && ded === 0 && <span className="text-[10px] text-green-600">无扣分</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold text-foreground">{score}<span className="text-xs font-normal text-muted-foreground">/{item.maxScore}</span></span>
                              <button
                                onClick={() => onEditItem(item.id)}
                                className="text-xs text-primary border border-primary px-2 py-0.5 rounded-lg shrink-0"
                              >
                                {derived ? "查看" : done ? "修改" : "填写"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700">提交前请修正以下问题</span>
            </div>
            {errors.map((e, i) => <p key={i} className="text-xs text-red-600 ml-6">• {e}</p>)}
          </div>
        )}
        <div className="h-2" />
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button onClick={validate} className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" />完成此项，返回考核项目
        </button>
      </div>

      {showPhotoWarn && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center px-6 z-50">
          <div className="bg-white rounded-2xl p-5 w-full space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-semibold text-foreground">照片未上传</h3>
            </div>
            <p className="text-sm text-muted-foreground">存在有扣分但尚未上传照片的项目，是否仍然提交？</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowPhotoWarn(false)} className="py-3 border border-border text-foreground rounded-xl text-sm font-medium">
                返回补充
              </button>
              <button onClick={() => { setShowPhotoWarn(false); onSubmit(); }} className="py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== SUCCESS ====================

function PSuccess({ town, village, primaryFacilityType, scoreByType, completedVillages, onNextVillage, onTownComplete, onBack }: {
  town: string; village: string;
  primaryFacilityType: PrimaryFacilityType;
  scoreByType: Partial<Record<FacilityType, TypeScore>>;
  completedVillages: VillageRecord[];
  onNextVillage: () => void;
  onTownComplete: () => void;
  onBack: () => void;
}) {
  const isRural = primaryFacilityType === "rural_treatment";
  const scores = Object.values(scoreByType);
  const combinedMax = scores.reduce((s, v) => s + v.maxScore, 0);
  const combinedCurrent = scores.reduce((s, v) => s + v.currentScore, 0);
  const pct = combinedMax > 0 ? Math.round(combinedCurrent / combinedMax * 100) : 0;
  const grade = pct >= 90 ? "优秀" : pct >= 75 ? "良好" : pct >= 60 ? "合格" : "待改进";
  const gradeColor = pct >= 90 ? "text-green-600" : pct >= 75 ? "text-blue-600" : pct >= 60 ? "text-amber-600" : "text-red-600";

  const typeRows: { type: FacilityType; label: string; icon: string }[] = [
    { type: "treatment", label: "污水处理设施", icon: "🏭" },
    { type: "network",   label: "纳厂/管网设施", icon: "🔧" },
    { type: "survey",    label: "调查问卷",      icon: "📋" },
  ];

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="flex-1 px-5 pt-14 pb-6 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-1">提交成功</h2>
        <p className="text-xs text-muted-foreground mb-5">{town} · {village}</p>

        {/* Combined score */}
        <div className="bg-white rounded-2xl border border-border p-4 w-full mb-3">
          <div className="text-xs text-muted-foreground mb-1">综合得分</div>
          <div className="text-3xl font-bold text-foreground">
            {combinedCurrent}<span className="text-base font-normal text-muted-foreground">/{combinedMax}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden my-2.5">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{pct}%</span>
            <span className={`text-xs font-bold ${gradeColor}`}>{grade}</span>
          </div>
        </div>

        {/* Per-type breakdown */}
        <div className="bg-white rounded-2xl border border-border p-4 w-full mb-3 text-left">
          <div className="text-xs font-medium text-muted-foreground mb-3">各项得分明细</div>
          <div className="space-y-3">
            {typeRows.map(({ type, label, icon }) => {
              const s = scoreByType[type];
              if (!s) return null;
              if (s.maxScore === 0) {
                return (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-xs text-foreground">{icon} {label}</span>
                    <span className="text-xs font-semibold text-green-600">已采集</span>
                  </div>
                );
              }
              const p = s.maxScore > 0 ? Math.round(s.currentScore / s.maxScore * 100) : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{icon} {label}</span>
                    <span className="text-xs font-semibold text-foreground">{s.currentScore}/{s.maxScore}</span>
                  </div>
                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Town progress */}
        {completedVillages.length > 0 && (
          <div className="bg-white rounded-2xl border border-border p-4 w-full mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">全镇考核进度</span>
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                已完成 {completedVillages.length} 项
              </span>
            </div>
            <div className="space-y-2">
              {completedVillages.map((r, i) => {
                const p = r.maxScore > 0 ? Math.round(r.currentScore / r.maxScore * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-foreground truncate">{r.village}</span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{r.currentScore}/{r.maxScore}</span>
                      </div>
                      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-10 space-y-2.5 shrink-0">
        <button onClick={onTownComplete} className="w-full py-3.5 bg-[#1a4a38] text-white rounded-xl font-semibold flex items-center justify-center gap-2">
          <Package className="w-4 h-4" />已完成全镇考核
        </button>
        <button onClick={onNextVillage} className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2">
          {isRural ? "继续录入下一村点" : "继续录入其他考核对象"} <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={onBack} className="w-full py-3 border border-border text-muted-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-1.5">
          <ChevronLeft className="w-4 h-4" />返回修改
        </button>
      </div>
    </div>
  );
}

// ==================== TOWN COMPLETE ====================

function PTownComplete({ town, completedVillages, onBack, onSubmit, submitting, error }: {
  town: string;
  completedVillages: VillageRecord[];
  onBack: () => void;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  error?: string;
}) {

  const totalDeducted = completedVillages.reduce((s, v) => s + v.deductedScore, 0);
  const avgPct = completedVillages.length > 0
    ? Math.round(completedVillages.reduce((s, v) => s + (v.maxScore > 0 ? v.currentScore / v.maxScore * 100 : 0), 0) / completedVillages.length)
    : 0;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-[#1a4a38] px-4 pt-12 pb-5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-white/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="text-xs text-white/55 mb-1">{town}</div>
        <h1 className="text-xl font-semibold text-white mb-0.5">全镇考核完成</h1>
        <p className="text-xs text-white/55">共 {completedVillages.length} 个村点 · 平均得分率 {avgPct}%</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-border p-3 text-center">
            <div className="text-xl font-bold text-foreground">{completedVillages.length}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">考核村点</div>
          </div>
          <div className="bg-white rounded-xl border border-border p-3 text-center">
            <div className="text-xl font-bold text-foreground">{avgPct}%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">平均得分率</div>
          </div>
          <div className={`rounded-xl border p-3 text-center ${totalDeducted > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
            <div className={`text-xl font-bold ${totalDeducted > 0 ? "text-red-600" : "text-green-600"}`}>-{totalDeducted}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">总扣分</div>
          </div>
        </div>

        {/* Village list */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">各村点得分</span>
          </div>
          {completedVillages.map((r, i) => {
            const p = r.maxScore > 0 ? Math.round(r.currentScore / r.maxScore * 100) : 0;
            return (
              <div key={i} className={`px-4 py-3 flex items-center gap-3 ${i < completedVillages.length - 1 ? "border-b border-border" : ""}`}>
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground truncate">{r.village}</span>
                    <span className="text-sm font-bold text-foreground shrink-0 ml-2">{r.currentScore}/{r.maxScore}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p}%`,
                        background: p >= 90 ? "#16a34a" : p >= 75 ? "#2563eb" : p >= 60 ? "#d97706" : "#dc2626",
                      }}
                    />
                  </div>
                </div>
                {r.deductedScore > 0 && (
                  <span className="text-xs text-red-500 shrink-0">-{r.deductedScore}</span>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={submitting}
          className={`w-full py-4 bg-[#1a4a38] text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 ${submitting ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <Send className="w-4 h-4" />{submitting ? "提交中..." : "提交"}
        </button>
      </div>
    </div>
  );
}

// ==================== SUBMITTED DATA VIEW ====================

function PSubmittedData({ submittedData, onBack }: {
  submittedData: Record<string, VillageRecord[]>;
  onBack: () => void;
}) {
  const [expandedTown, setExpandedTown] = useState<string | null>(null);
  const towns = Object.keys(submittedData);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <h1 className="text-xl font-semibold text-primary-foreground mb-0.5">已提交镇街数据</h1>
        <p className="text-xs text-primary-foreground/55">共 {towns.length} 个镇街</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {towns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">暂无已提交数据</p>
            <p className="text-xs text-muted-foreground/70 mt-1">完成全镇考核并提交后将在此显示</p>
          </div>
        )}

        {towns.map(townName => {
          const villages = submittedData[townName];
          const totalMax = villages.reduce((s, v) => s + v.maxScore, 0);
          const totalCurrent = villages.reduce((s, v) => s + v.currentScore, 0);
          const pct = totalMax > 0 ? Math.round(totalCurrent / totalMax * 100) : 0;
          const isOpen = expandedTown === townName;

          return (
            <div key={townName} className="bg-white rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setExpandedTown(isOpen ? null : townName)}
                className="w-full px-4 py-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{townName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{villages.length} 个村点</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{totalCurrent}<span className="text-xs font-normal text-muted-foreground">/{totalMax}</span></div>
                    <div className="text-xs text-muted-foreground">{pct}%</div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  {/* Score bar */}
                  <div className="px-4 pt-3 pb-2">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {/* Village list */}
                  {villages.map((v, i) => {
                    const vPct = v.maxScore > 0 ? Math.round(v.currentScore / v.maxScore * 100) : 0;
                    return (
                      <div key={i} className={`px-4 py-3 flex items-center justify-between ${i < villages.length - 1 ? "border-b border-border" : ""}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          </div>
                          <span className="text-sm text-foreground">{v.village}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${vPct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-foreground w-14 text-right">{v.currentScore}/{v.maxScore}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================

type Page = "city" | "cycle" | "town" | "village" | "facility_choice" | "facilitytype" | "criteria" | "detail" | "summary" | "success" | "towncomplete" | "survey_list" | "survey_form" | "water_quality" | "submitted_data";

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState<Page>("city");
  const [city, setCity] = useState("");
  const [cityId, setCityId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [cycleName, setCycleName] = useState("");
  const [town, setTown] = useState("");
  const [selectedTown, setSelectedTown] = useState<TownOption | null>(null);
  const [village, setVillage] = useState("");
  const [ftype, setFtype] = useState<FacilityType>("treatment");
  const [primaryFacilityType, setPrimaryFacilityType] = useState<PrimaryFacilityType>("rural_treatment");
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [detailId, setDetailId] = useState("");
  const [completedVillages, setCompletedVillages] = useState<VillageRecord[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [submittedData, setSubmittedData] = useState<Record<string, VillageRecord[]>>(() => {
    try {
      return JSON.parse(localStorage.getItem(SUBMITTED_STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SYNC_QUEUE_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [, setStandardRevision] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [isTownSubmitting, setIsTownSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [standardVersionName, setStandardVersionName] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStandards() {
      try {
        const type = standardTypeForPrimary(primaryFacilityType);
        const params = new URLSearchParams({ facility_type: primaryFacilityType });
        if (cityId) params.set("city_id", cityId);
        if (cycleId) params.set("cycle_id", cycleId);
        const response = await fetch(`${API_BASE_URL}/mobile/indicator-standards?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (cancelled) return;
          if (Array.isArray(data?.items) && data.items.length) {
            applyBackendStandards(type, data.items);
            if (data.version?.name) setStandardVersionName(data.version.name);
          }
        }
        if (!cancelled) setStandardRevision(value => value + 1);
      } catch {
        // Keep bundled standards usable when backend is offline.
      }
    }

    loadStandards();
    return () => { cancelled = true; };
  }, [cityId, cycleId, primaryFacilityType]);
  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(completedVillages));
  }, [completedVillages]);
  useEffect(() => {
    localStorage.setItem(SUBMITTED_STORAGE_KEY, JSON.stringify(submittedData));
  }, [submittedData]);
  useEffect(() => {
    localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(syncQueue));
  }, [syncQueue]);
  const [surveyEntries, setSurveyEntries] = useState<Record<string, SurveyFormEntry>>({});
  const [surveyTarget, setSurveyTarget] = useState<{ cat: SurveyCategory; res: SurveyRespondent } | null>(null);
  const [waterQuality, setWaterQuality] = useState<WaterQualityEntry>(() => emptyWaterQualityEntry());
  const [typeProgress, setTypeProgress] = useState<Partial<Record<FacilityType, boolean>>>({});
  const [scoreByType, setScoreByType] = useState<Partial<Record<FacilityType, TypeScore>>>({});

  const groups = ftype === "treatment"
    ? TREATMENT
    : ftype === "network"
      ? NETWORK
      : [];
  const allItems = getAllItems(groups);
  const total = totalMaxScore(groups);
  const deducted = allItems.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id, surveyEntries), 0);
  const finalScore = total - deducted;

  const saveEntry = (e: ItemEntry) => setEntries(prev => ({ ...prev, [e.itemId]: e }));

  // Called from P5Summary — saves this type's score, marks done, returns to hub
  const handleSubmit = () => {
    const typeScore: TypeScore = ftype === "survey"
      ? calcSurveyTypeScore(surveyEntries)
      : { maxScore: total, currentScore: finalScore, deductedScore: deducted };
    setScoreByType(prev => ({ ...prev, [ftype]: typeScore }));
    setTypeProgress(prev => ({ ...prev, [ftype]: true }));
    setPage("facilitytype");
  };

  // Called from the hub after the selected facility, survey, and water-quality records are completed.
  const handleVillageSubmit = () => {
    const combinedScores = Object.values(scoreByType);
    const combinedMax = combinedScores.reduce((s, v) => s + v.maxScore, 0);
    const combinedCurrent = combinedScores.reduce((s, v) => s + v.currentScore, 0);
    const combinedDeducted = combinedScores.reduce((s, v) => s + v.deductedScore, 0);
    const record: VillageRecord = {
      village,
      facilityType: primaryFacilityType,
      primaryFacilityType,
      standardFacilityType: standardTypeForPrimary(primaryFacilityType),
      submittedAt: new Date().toISOString(),
      maxScore: combinedMax,
      deductedScore: combinedDeducted,
      currentScore: combinedCurrent,
      entries,
      surveyEntries,
      waterQuality,
    };
    setCompletedVillages(prev => [...prev.filter(r => r.village !== village || r.primaryFacilityType !== primaryFacilityType), record]);
    setPage("success");
  };

  const handleNextVillage = () => {
    setVillage(""); setEntries({}); setDetailId("");
    setFtype("treatment"); setPrimaryFacilityType("rural_treatment"); setSurveyEntries({}); setSurveyTarget(null);
    setWaterQuality(emptyWaterQualityEntry(primaryFacilityType));
    setTypeProgress({}); setScoreByType({});
    setPage(primaryFacilityType === "rural_treatment" ? "village" : "facility_choice");
  };

  const buildPackage = (): TownPackage => ({
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    cityId: cityId || undefined,
    cycleId: cycleId || undefined,
    city,
    period: cycleName || "2026年第2季度",
    town,
    villages: completedVillages,
  });

  const markPackageSynced = (pkg: TownPackage) => {
    setSubmittedData(prev => ({ ...prev, [pkg.town]: pkg.villages }));
    setSyncQueue(prev => prev.map(item => item.pkg.exportedAt === pkg.exportedAt
      ? { ...item, syncStatus: "synced", syncedAt: new Date().toISOString(), lastError: undefined }
      : item));
  };

  const stagePackageForSync = (pkg: TownPackage) => {
    setSyncQueue(prev => {
      const next: SyncQueueItem = {
        localId: makeLocalId(),
        town: pkg.town,
        pkg,
        syncStatus: "pending_sync",
        createdAt: new Date().toISOString(),
      };
      return [...prev.filter(item => item.pkg.exportedAt !== pkg.exportedAt), next];
    });
  };

  const queuePackage = (pkg: TownPackage, error: unknown) => {
    const message = error instanceof Error ? error.message : "sync failed";
    setSyncQueue(prev => {
      const existing = prev.find(item => item.pkg.exportedAt === pkg.exportedAt);
      if (existing) {
        return prev.map(item => item.localId === existing.localId
          ? { ...item, syncStatus: "sync_failed", lastError: message }
          : item);
      }
      return [...prev, {
        localId: makeLocalId(),
        town: pkg.town,
        pkg,
        syncStatus: "sync_failed",
        createdAt: new Date().toISOString(),
        lastError: message,
      }];
    });
  };

  useEffect(() => {
    if (!auth?.token) return;
    const pending = syncQueue.filter(item => item.syncStatus !== "synced");
    if (!pending.length) return;
    let cancelled = false;
    async function syncPending() {
      for (const item of pending) {
        try {
          await submitTownPackageToBackend(item.pkg, auth.token);
          if (cancelled) return;
          markPackageSynced(item.pkg);
        } catch (error) {
          if (cancelled) return;
          queuePackage(item.pkg, error);
        }
      }
    }
    syncPending();
    return () => { cancelled = true; };
  }, [auth?.token]);

  const renderFieldPage = () => {
    switch (page) {
      case "city":
        return (
          <P0City
            onNext={c => {
              setCity(c.name);
              setCityId(c.id ?? "");
              setCycleId("");
              setCycleName("");
              setTown("");
              setCompletedVillages([]);
              setPage("cycle");
            }}
          />
        );
      case "cycle":
        return (
          <P0Cycle
            cityId={cityId || undefined}
            cityName={city}
            onBack={() => setPage("city")}
            onNext={cycle => {
              setCycleId(cycle.backendId ?? "");
              setCycleName(cycle.name);
              setTown("");
              setCompletedVillages([]);
              setPage("town");
            }}
          />
        );
      case "town":
        return (
          <P1Town
            cityId={cityId || undefined}
            projectName={city}
            onBack={() => setPage("cycle")}
            onNext={t => { setTown(t.name); setSelectedTown(t); setVillage(""); setCompletedVillages([]); setWaterQuality(emptyWaterQualityEntry(primaryFacilityType)); setTypeProgress({}); setScoreByType({}); setPage("facility_choice"); }}
            submittedData={submittedData}
            onViewSubmitted={() => setPage("submitted_data")}
          />
        );
      case "village":
        return (
          <P2Village
            town={town}
            cityId={cityId || undefined}
            onBack={() => setPage("facility_choice")}
            onNext={v => { setVillage(v); setWaterQuality(emptyWaterQualityEntry(primaryFacilityType)); setPage("facilitytype"); }}
          />
        );
      case "facility_choice":
        return (
          <P2bFacilityChoice
            town={town}
            allowedTargets={selectedTown?.assessmentTargets ?? []}
            onBack={() => setPage("town")}
            onSelect={type => {
              setPrimaryFacilityType(type);
              setFtype(standardTypeForPrimary(type));
              setEntries({});
              setSurveyEntries({});
              setWaterQuality(emptyWaterQualityEntry(type));
              setTypeProgress({});
              setScoreByType({});
              if (type === "rural_treatment") {
                setVillage("");
                setPage("village");
              } else {
                setVillage(PRIMARY_FACILITY_TYPE_INFO[type].label);
                setPage("facilitytype");
              }
            }}
          />
        );
      case "facilitytype":
        return (
          <P2bFacilityType
            town={town} village={village}
            primaryFacilityType={primaryFacilityType}
            typeProgress={typeProgress}
            onBack={() => setPage(primaryFacilityType === "rural_treatment" ? "village" : "facility_choice")}
            onEnter={t => {
              setFtype(t);
              if (t === standardTypeForPrimary(primaryFacilityType) && !typeProgress[t]) setEntries({});
              setPage(t === "survey" ? "survey_list" : t === "water_quality" ? "water_quality" : "criteria");
            }}
            onSubmitVillage={handleVillageSubmit}
          />
        );
      case "criteria":
        return (
          <P3Criteria
            town={town} village={village} ftype={ftype}
            groups={groups} entries={entries} surveyEntries={surveyEntries}
            standardVersionName={standardVersionName}
            onBack={() => setPage("facilitytype")}
            onSelect={id => { setDetailId(id); setPage("detail"); }}
            onSummary={() => setPage("summary")}
          />
        );
      case "detail":
        return detailId ? (
          <P4Detail
            itemId={detailId}
            groups={groups} entries={entries} surveyEntries={surveyEntries}
            onBack={() => setPage("criteria")}
            onSave={saveEntry}
          />
        ) : null;
      case "summary":
        return (
          <P5Summary
            town={town} village={village} ftype={ftype}
            groups={groups} entries={entries}
            surveyEntries={surveyEntries}
            onBack={() => setPage(ftype === "survey" ? "survey_list" : "criteria")}
            onSubmit={handleSubmit}
            onEditItem={id => { setDetailId(id); setPage("detail"); }}
            onEditSurvey={(cat, res) => { setSurveyTarget({ cat, res }); setPage("survey_form"); }}
          />
        );
      case "success":
        return (
          <PSuccess
            town={town} village={village}
            primaryFacilityType={primaryFacilityType}
            scoreByType={scoreByType}
            completedVillages={completedVillages}
            onNextVillage={handleNextVillage}
            onTownComplete={() => setPage("towncomplete")}
            onBack={() => setPage("facilitytype")}
          />
        );
      case "towncomplete":
        return (
          <PTownComplete
            town={town}
            completedVillages={completedVillages}
            onBack={() => setPage("success")}
            submitting={isTownSubmitting}
            error={submitError}
            onSubmit={async () => {
              setIsTownSubmitting(true);
              setSubmitError("");
              const pkg = buildPackage();
              try {
                if (!auth?.token) throw new Error("missing auth");
                stagePackageForSync(pkg);
                await submitTownPackageToBackend(pkg, auth.token);
                markPackageSynced(pkg);
                setTown(""); setVillage("");
                setFtype("treatment"); setEntries({});
                setPrimaryFacilityType("rural_treatment");
                setDetailId(""); setCompletedVillages([]);
                setWaterQuality(emptyWaterQualityEntry("rural_treatment"));
                setTypeProgress({}); setScoreByType({});
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
                setPage("town");
              } catch (error) {
                console.error(error);
                queuePackage(pkg, error);
                setSubmitError("提交失败，数据已离线暂存；后端恢复或重新登录后会自动重试。");
              } finally {
                setIsTownSubmitting(false);
              }
            }}
          />
        );
      case "survey_list":
        return (
          <PSurveyList
            town={town} village={village}
            surveyEntries={surveyEntries}
            onBack={() => setPage("facilitytype")}
            onOpen={(cat, res) => { setSurveyTarget({ cat, res }); setPage("survey_form"); }}
            onSummary={() => setPage("summary")}
          />
        );
      case "survey_form":
        return surveyTarget ? (
          <PSurveyForm
            category={surveyTarget.cat}
            respondent={surveyTarget.res}
            entry={surveyEntries[surveyKey(surveyTarget.cat, surveyTarget.res)] ?? emptySurveyForm()}
            onBack={() => setPage("survey_list")}
            onSave={e => {
              setSurveyEntries(prev => ({ ...prev, [surveyKey(surveyTarget.cat, surveyTarget.res)]: e }));
              setPage("survey_list");
            }}
          />
        ) : null;
      case "water_quality":
        return (
          <PWaterQualityForm
            town={town}
            village={village}
            primaryFacilityType={primaryFacilityType}
            entry={waterQuality}
            onBack={() => setPage("facilitytype")}
            onSave={entry => {
              setWaterQuality(entry);
              setTypeProgress(prev => ({ ...prev, water_quality: entry.completed }));
              setScoreByType(prev => ({ ...prev, water_quality: { maxScore: 0, currentScore: 0, deductedScore: 0 } }));
              setPage("facilitytype");
            }}
          />
        );
      case "submitted_data":
        return (
          <PSubmittedData
            submittedData={submittedData}
            onBack={() => setPage("town")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-400 flex items-center justify-center p-4">
      <div className="relative w-[375px] h-[812px] bg-background rounded-[44px] shadow-2xl overflow-hidden border-[3px] border-gray-800">
        <div className="absolute top-0 inset-x-0 h-11 z-50 flex items-center justify-between px-6 pointer-events-none">
          <span className="text-[11px] font-semibold text-white drop-shadow-sm">9:41</span>
          <div className="absolute left-1/2 -translate-x-1/2 top-1 w-28 h-7 bg-black rounded-full" />
          <div className="flex items-center gap-1.5 drop-shadow-sm">
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
              <rect x="0" y="7.5" width="3" height="3.5" rx="0.8" fill="white" fillOpacity="0.45" />
              <rect x="4.5" y="5" width="3" height="6" rx="0.8" fill="white" fillOpacity="0.65" />
              <rect x="9" y="2.5" width="3" height="8.5" rx="0.8" fill="white" fillOpacity="0.85" />
              <rect x="13.5" y="0" width="2.5" height="11" rx="0.8" fill="white" />
            </svg>
            <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
              <rect x="0.5" y="2.5" width="14" height="8" rx="1.5" stroke="white" strokeWidth="1.1" />
              <rect x="1.5" y="3.5" width="10" height="6" rx="0.8" fill="white" fillOpacity="0.9" />
              <path d="M15.5 5.5 C16.5 5.5 17 6 17 6.5 C17 7 16.5 7.5 15.5 7.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div className="absolute inset-0">{auth ? renderFieldPage() : <MobileLoginPage onLogin={setAuth} />}</div>
        {showToast && (
          <div className="absolute bottom-16 inset-x-4 z-50 flex items-center gap-3 bg-[#1a3a52] text-white px-4 py-3.5 rounded-xl shadow-lg">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            <span className="text-sm font-medium">提交已完成</span>
          </div>
        )}
      </div>
    </div>
  );
}
