import { useState, useRef } from "react";
import { useEffect } from "react";
import {
  ChevronRight, ChevronLeft, Search, Camera, X, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp, Save, Send,
  Plus, Minus, MapPin, Building2, BarChart3,
  AlertTriangle, Info, Check, Package, Smartphone,
  Trash2, Wrench, ClipboardList, Droplets, House,
} from "lucide-react";
import { NETWORK_STANDARDS, TREATMENT_STANDARDS } from "./assessmentStandards";

let API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";
const API_BASE_URL_STORAGE_KEY = "assessment-api-base-url-v1";

async function probeApiBaseUrl(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 1500);
  try {
    const healthUrl = `${baseUrl.replace(/\/api\/?$/, "")}/health`;
    const response = await fetch(healthUrl, { signal: controller.signal, cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function discoverApiBaseUrl(): Promise<string> {
  const cached = localStorage.getItem(API_BASE_URL_STORAGE_KEY) || "";
  const preferred = [...new Set([API_BASE_URL, cached, "http://127.0.0.1:8000/api"].filter(Boolean))];
  for (const candidate of preferred) {
    if (await probeApiBaseUrl(candidate)) {
      localStorage.setItem(API_BASE_URL_STORAGE_KEY, candidate);
      return candidate;
    }
  }
  const fallback = Array.from({ length: 30 }, (_, index) => `http://127.0.0.1:${8100 + index}/api`);
  for (const candidate of fallback) {
    if (await probeApiBaseUrl(candidate)) {
      localStorage.setItem(API_BASE_URL_STORAGE_KEY, candidate);
      return candidate;
    }
  }
  return API_BASE_URL;
}
const DRAFT_STORAGE_KEY = "assessment-mobile-draft-v1";
const SUBMITTED_STORAGE_KEY = "assessment-mobile-submitted-v1";
const AUTH_STORAGE_KEY = "assessment-mobile-auth-v1";

function readStoredAuth<T>(): T | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const value = JSON.parse(storage.getItem(AUTH_STORAGE_KEY) || "null") as T | null;
      if (value) return value;
    } catch {
      storage.removeItem(AUTH_STORAGE_KEY);
    }
  }
  return null;
}

function saveStoredAuth(auth: unknown, remember: boolean): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  (remember ? localStorage : sessionStorage).setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function authHeaders(): HeadersInit {
  const auth = readStoredAuth<{ token?: string }>();
  return auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};
}
const SYNC_QUEUE_STORAGE_KEY = "assessment-mobile-sync-queue-v1";

// ==================== TYPES ====================

type FacilityType = "treatment" | "network" | "survey" | "water_quality";
type DeductionType = "fixed" | "range" | "severity";
type EntryStatus = "pending" | "no_deduction" | "has_deduction" | "incomplete";
type SelectionType = "no_deduction" | "standard" | "custom";

type CityOption = { id?: string; name: string; sub: string };
type CycleOption = { id: string; name: string; status: string; backendId?: string };
type AssessmentObjectInfo = { sectionCode?: string; title?: string; description?: string };
type ScorePolicy = {
  mode: "direct_100" | "scaled_applicable";
  originalMaxScore: number;
  excludedScore: number;
  applicableMaxScore: number;
  excludedIndicatorCodes: string[];
  description: string;
};
type TownOption = {
  id: string;
  cityId?: string;
  name: string;
  chapterCode?: string;
  assessmentTargets: PrimaryFacilityType[];
  assessmentObject: Partial<Record<PrimaryFacilityType, AssessmentObjectInfo>>;
  scorePolicies?: Partial<Record<PrimaryFacilityType, ScorePolicy>>;
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
  code?: string;
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
  bod5Value?: string;
  bod5Limit?: string;
  ssValue?: string;
  ssLimit?: string;
  nh3nValue: string;
  nh3nLimit: string;
  tpValue: string;
  tpLimit: string;
  monthlyMissingTest?: boolean;
  monthlyRegulatorUnqualified?: boolean;
  conclusion: "pending" | "qualified" | "unqualified";
  conclusionOverridden?: boolean;
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
  backendStatus?: "submitted" | "returned" | "reviewed" | "locked";
  editable?: boolean;
  backendRecordId?: string;
  serverUpdatedAt?: string;
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
  syncStatus: "pending_sync" | "synced" | "sync_failed" | "sync_conflict";
  createdAt: string;
  syncedAt?: string;
  lastError?: string;
}

class SyncConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncConflictError";
  }
}

function mergeVillageRecords(existing: VillageRecord[], incoming: VillageRecord[]): VillageRecord[] {
  const merged = new Map<string, VillageRecord>();
  [...existing, ...incoming].forEach(record => {
    const projectType = record.primaryFacilityType ?? record.facilityType;
    const key = `${projectType}::${record.village}`;
    merged.set(key, record);
  });
  return Array.from(merged.values());
}

function syncedRecordsForTown(
  syncQueue: SyncQueueItem[],
  town: string,
  cityId: string,
  period: string,
): VillageRecord[] {
  return syncQueue
    .filter(item => item.syncStatus === "synced" && item.pkg.town === town && (!cityId || item.pkg.cityId === cityId) && item.pkg.period === period)
    .reduce<VillageRecord[]>((records, item) => mergeVillageRecords(records, item.pkg.villages), []);
}

function submittedDataFromQueue(syncQueue: SyncQueueItem[]): Record<string, VillageRecord[]> {
  return syncQueue
    .filter(item => item.syncStatus === "synced")
    .reduce<Record<string, VillageRecord[]>>((result, item) => ({
      ...result,
      [item.pkg.town]: mergeVillageRecords(result[item.pkg.town] ?? [], item.pkg.villages),
    }), {});
}

function makeLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function throwBackendSyncError(response: Response, fallback: string): Promise<never> {
  let detail: unknown = null;
  try {
    const body = await response.json();
    detail = body?.detail;
  } catch {
    detail = null;
  }
  if (response.status === 409 && detail && typeof detail === "object" && (detail as { code?: string }).code === "record_conflict") {
    const conflict = detail as { message?: string; solution?: string };
    throw new SyncConflictError(`${conflict.message || "后台记录已被其他设备修改"}。${conflict.solution ? `解决方法：${conflict.solution}` : "请采用后台最新数据后重新修改。"}`);
  }
  const reason = typeof detail === "string" ? detail : "";
  throw new Error(`${fallback}：${reason || `服务器返回 ${response.status}`}`);
}

async function submitTownPackageToBackend(pkg: TownPackage, token: string): Promise<TownPackage> {
  const createResponse = await fetch(`${API_BASE_URL}/mobile/assessment-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(pkg),
  });
  if (!createResponse.ok) await throwBackendSyncError(createResponse, "保存考核记录失败");

  const record = await createResponse.json();
  const recordIds = Array.isArray(record.recordIds) && record.recordIds.length ? record.recordIds : [record.id];
  const createdRecords = Array.isArray(record.records) ? record.records : [];
  const submitted: Array<{ id?: string; updatedAt?: string }> = [];
  for (const recordId of recordIds) {
    const submitResponse = await fetch(`${API_BASE_URL}/mobile/assessment-records/${recordId}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!submitResponse.ok) await throwBackendSyncError(submitResponse, "提交考核记录失败");
    submitted.push(await submitResponse.json());
  }
  return {
    ...pkg,
    villages: pkg.villages.map((village, index) => {
      const created = createdRecords[index] ?? {};
      const submittedRecord = submitted.find(item => item.id === created.id) ?? submitted[index] ?? created;
      return {
        ...village,
        backendRecordId: submittedRecord.id ?? created.id ?? village.backendRecordId,
        serverUpdatedAt: submittedRecord.updatedAt ?? created.updatedAt ?? village.serverUpdatedAt,
        backendStatus: "submitted",
        editable: true,
      };
    }),
  };
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

function applyBackendStandards(type: "treatment" | "network", items: Array<{ id: string; parentId: string | null; code?: string; name: string; level: number; fullScore: number; facilityType?: string | null; description?: string; evaluationStandard?: string; standardText?: string; scoringMethod?: string; dataSource?: string; calculationMethod?: string; deductionOptions?: Array<{ id: string; name: string; deduction: number; type?: DeductionType; unit?: string; maxInstances?: number; min?: number; max?: number }> }>) {
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
        code: item.code,
        name: item.name,
        maxScore: item.fullScore,
        description: item.description || item.dataSource || "",
        evaluationStandard: item.evaluationStandard,
        standardText: item.standardText,
        scoringMethod: item.scoringMethod,
        dataSource: item.dataSource,
        calculationMethod: item.calculationMethod,
        options: (item.deductionOptions ?? []).map(option => ({
          id: option.id,
          name: option.name,
          reason: option.name,
          type: option.type === "range" ? "range" as const : "fixed" as const,
          value: option.deduction,
          min: option.type === "range" ? (option.min ?? 0) : undefined,
          max: option.type === "range" ? (option.max ?? option.deduction) : undefined,
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

function roundScoreValue(value: number): number {
  return Number((value + Number.EPSILON).toFixed(2));
}

function formatScoreValue(value: number): string {
  return roundScoreValue(value).toString();
}

function calcOptionScore(oe: OptionEntry, opt: DeductionOption): number {
  if (oe.selection === "no_deduction") return 0;
  if (oe.selection === "custom") return roundScoreValue(oe.customScore);
  if (oe.adjustedScore !== null) return roundScoreValue(oe.adjustedScore);
  if (opt.type === "fixed") return roundScoreValue(opt.value! * Math.min(oe.instances, opt.maxInstances ?? 999));
  if (opt.type === "range") return roundScoreValue(oe.rangeValue);
  if (opt.type === "severity") return roundScoreValue(oe.severity === "severe" ? opt.value! + 5 : opt.value!);
  return 0;
}

function makeScoreChoices(min: number, max: number): number[] {
  const values: number[] = [];
  for (let value = min; value <= max + 0.0001; value += 0.1) {
    values.push(Number(value.toFixed(1)));
  }
  return values;
}

function isCountBasedOption(opt: DeductionOption): boolean {
  return opt.type === "fixed" && Boolean(opt.unit || opt.maxInstances);
}

function getOptionUnit(opt: DeductionOption): string {
  return opt.unit?.trim() || "项";
}

function getOptionMaxInstances(opt: DeductionOption): number {
  return Math.max(1, Math.floor(opt.maxInstances ?? 999));
}

function clampOptionInstances(value: number, opt: DeductionOption): number {
  const safeValue = Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.min(Math.max(1, safeValue), getOptionMaxInstances(opt));
}

function itemKnowledgeText(item: L3Item): string {
  const optionText = item.options.map(option => `${option.reason} ${option.sourceText ?? ""}`).join(" ");
  return `${item.name} ${item.description} ${item.evaluationStandard ?? ""} ${item.standardText ?? ""} ${item.scoringMethod ?? ""} ${item.dataSource ?? ""} ${optionText}`;
}

function normalizeDisplayText(value?: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function comparisonText(value?: string): string {
  return normalizeDisplayText(value)
    .replace(/(^|\s)\d+[.、．)]\s*/g, " ")
    .replace(/[，。；：、“”‘’（）()\[\]【】\s]/g, "");
}

function uniqueDisplayTexts(values: Array<string | undefined>): string[] {
  const result: string[] = [];
  values.forEach(value => {
    const text = normalizeDisplayText(value);
    if (!text || result.some(existing => existing === text || existing.includes(text))) return;
    const shorterIndexes = result
      .map((existing, index) => text.includes(existing) ? index : -1)
      .filter(index => index >= 0)
      .reverse();
    shorterIndexes.forEach(index => result.splice(index, 1));
    result.push(text);
  });
  return result;
}

function uniqueDeductionOptions(options: DeductionOption[]): DeductionOption[] {
  const seen = new Set<string>();
  return options.filter(option => {
    const key = normalizeDisplayText(option.reason);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function knowledgeRowsForItem(item: L3Item): Array<{ label: string; text: string }> {
  return [
    { label: "评价标准", text: item.evaluationStandard ?? "" },
    { label: "评分方法", text: item.scoringMethod ?? "" },
    { label: "资料来源", text: item.dataSource ?? "" },
  ].filter(row => normalizeDisplayText(row.text));
}

function isMonthlyUnqualifiedRuleItem(item: L3Item): boolean {
  const text = itemKnowledgeText(item);
  return text.includes("全月不合格") || (text.includes("化验") && text.includes("判定为不合格"));
}

function isMonthlyReasonOption(option: DeductionOption): boolean {
  const text = `${option.reason} ${option.sourceText ?? ""}`;
  return text.includes("视为全月不合格") && !text.includes("判定为不合格扣");
}

function isMonthlyDeductionOption(option: DeductionOption, item: L3Item): boolean {
  const text = `${option.reason} ${option.sourceText ?? ""}`;
  return text.includes("判定为不合格扣") || (option.value ?? 0) >= item.maxScore;
}

function knowledgeGuidanceForItem(item: L3Item): string[] {
  const text = itemKnowledgeText(item);
  const tips: string[] = [];
  if (text.includes("停产")) {
    tips.push("停产口径：按标准记录停产天数；因故停减产程序符合要求的天数不扣分，未履行或无法证明合规程序的停产天数按标准扣分。");
  }
  if (isMonthlyUnqualifiedRuleItem(item)) {
    tips.push("全月不合格口径：化验报告显示当月有一项应做化验项目未做，或环保部门/上级监管部门抽查判定不合格时，先判定本月不合格，再按“判定为不合格”统一扣分。");
  }
  if (text.includes("水质") || text.includes("CODCr") || text.includes("NH3-N")) {
    tips.push("水质口径：以实测值与对应排放限值比对，超限即判为该指标不达标；现场可在水质抽检模块自动回填评分。");
  }
  if (text.includes("每一处") || text.includes("每项") || text.includes("出现一项")) {
    tips.push("数量扣分口径：同类问题按处数/项数选择数量，系统按标准单项扣分自动累加，并按本评分点满分封顶。");
  }
  return tips;
}

function buildMonthlyEntry(item: L3Item, current: ItemEntry, unqualified: boolean, reasonIds: Set<string>): ItemEntry {
  const reasonOptions = item.options.filter(isMonthlyReasonOption);
  const deduction = item.options.find(option => isMonthlyDeductionOption(option, item));
  const options = item.options.map(option => {
    const base = current.options.find(entry => entry.optionId === option.id) ?? makeOptionEntry(option.id);
    if (!unqualified) {
      return { ...base, selection: "no_deduction" as SelectionType, customScore: 0, customNote: "", note: "" };
    }
    if (deduction?.id === option.id) {
      return {
        ...base,
        selection: "standard" as SelectionType,
        instances: 1,
        note: "不合格判定自动扣分",
      };
    }
    if (reasonOptions.some(reason => reason.id === option.id) && reasonIds.has(option.id)) {
      return {
        ...base,
        selection: "custom" as SelectionType,
        customScore: 0,
        customNote: option.reason,
        note: "全月不合格触发原因",
      };
    }
    return { ...base, selection: "no_deduction" as SelectionType, customScore: 0, customNote: "", note: "" };
  });
  return {
    ...current,
    options,
    generalNote: current.generalNote,
  };
}

function calcItemRaw(entry: ItemEntry, item: L3Item): number {
  return roundScoreValue(entry.options.reduce((sum, oe) => {
    const opt = item.options.find(o => o.id === oe.optionId);
    return sum + (opt ? calcOptionScore(oe, opt) : 0);
  }, 0));
}

type SurveyDerivedKind = "sewage_collection" | "overall_effect" | "satisfaction_org" | "satisfaction_town" | "satisfaction_public";

interface SurveyDerivedScore {
  kind: SurveyDerivedKind;
  currentScore: number;
  deductedScore: number;
  completed: boolean;
}

function getSurveyDerivedKind(item: L3Item, l2?: L2Group): SurveyDerivedKind | null {
  if (item.name === "污水收集") return "sewage_collection";
  if (item.name === "整体效果") return "overall_effect";
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

function isApplicableItem(item: L3Item, policy?: ScorePolicy): boolean {
  return !policy?.excludedIndicatorCodes.includes(item.code ?? item.id);
}

function applicableScoreItems(groups: L1Group[], policy?: ScorePolicy): L3Item[] {
  return getAllItems(groups).filter(item => isApplicableItem(item, policy));
}

function calculatePolicyTypeScore(
  groups: L1Group[],
  entries: Record<string, ItemEntry>,
  surveyEntries: Record<string, SurveyFormEntry>,
  policy?: ScorePolicy,
  completedOnly = false,
): TypeScore & { applicableMaxScore: number; rawDeduction: number } {
  const items = applicableScoreItems(groups, policy);
  const applicableMaxScore = items.reduce((sum, item) => sum + item.maxScore, 0);
  const rawDeduction = roundScoreValue(items.reduce(
    (sum, item) => sum + calcEntryDeduction(entries, groups, item.id, surveyEntries),
    0,
  ));
  const rawCurrent = completedOnly
    ? items.reduce((sum, item) => {
        const derived = calcSurveyDerivedScore(item, findL2(groups, item.id), surveyEntries);
        const done = derived ? derived.completed : Boolean(entries[item.id]?.done);
        return sum + (done ? item.maxScore - calcEntryDeduction(entries, groups, item.id, surveyEntries) : 0);
      }, 0)
    : applicableMaxScore - rawDeduction;
  const currentScore = applicableMaxScore > 0
    ? roundScoreValue(Math.max(0, Math.min(rawCurrent / applicableMaxScore * 100, 100)))
    : 0;
  return {
    maxScore: 100,
    currentScore,
    deductedScore: roundScoreValue(100 - currentScore),
    applicableMaxScore,
    rawDeduction,
  };
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
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError("请输入员工账号和密码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(typeof detail?.detail === "string" ? detail.detail : "登录失败，请稍后重试");
      }
      const auth = await response.json();
      saveStoredAuth(auth, rememberLogin);
      onLogin(auth);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请稍后重试");
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
          placeholder="请输入员工账号"
          className="w-full px-3 py-3 bg-white border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          autoComplete="username"
        />
        <label className="block text-sm font-medium text-foreground mb-2 mt-4">登录密码</label>
        <input
          type="password"
          value={password}
          onChange={event => { setPassword(event.target.value); setError(""); }}
          onKeyDown={event => { if (event.key === "Enter") submit(); }}
          placeholder="请输入登录密码"
          className="w-full px-3 py-3 bg-white border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          autoComplete="current-password"
        />
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={rememberLogin}
            onChange={event => setRememberLogin(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <span className="block font-medium">自动登录</span>
            <span className="block text-xs text-muted-foreground">下次打开时直接进入当前账号</span>
          </span>
        </label>
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

function cleanStandardName(name: string): string {
  return name
    .replace(/[（(][^（）()]*?(?:批次|周期|报告版|资料版|第[^（）()]*?(?:版|期))[^（）()]*?[）)]/g, "")
    .replace(/第[一二三四五六七八九十百零〇、,，\d]+(?:批次|周期|期)(?:报告)?版?|资料报告版|周期报告版|报告版/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findWaterQualityItem(groups: L1Group[]): L3Item | undefined {
  return getAllItems(groups).find(item => {
    const optionText = item.options.map(option => `${option.reason} ${option.sourceText ?? ""}`).join(" ");
    const text = `${item.name} ${item.evaluationStandard ?? ""} ${item.standardText ?? ""} ${item.dataSource ?? ""} ${optionText}`;
    const hasMeasuredWaterQuality = (text.includes("水质") || text.includes("CODCr")) && text.includes("CODCr") && text.includes("NH3-N");
    const hasMonthlyUnqualifiedRule = text.includes("全月不合格") || (text.includes("化验") && text.includes("判定为不合格"));
    return hasMeasuredWaterQuality || hasMonthlyUnqualifiedRule;
  });
}

function PPortal({ onField, onKnowledge }: { onField: () => void; onKnowledge: () => void }) {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <div className="flex items-center gap-1.5 mb-1 mt-1">
          <Smartphone className="w-3.5 h-3.5 text-primary-foreground/55" />
          <span className="text-xs text-primary-foreground/55 tracking-wide">PPP农村污水考核系统</span>
        </div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择功能</h1>
        <p className="text-xs text-primary-foreground/55 mt-1">进入现场填报，或查看项目知识库资料</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        <button onClick={onField} className="w-full rounded-xl border-2 border-primary bg-primary/5 p-5 text-left active:bg-primary/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <MapPin className="w-6 h-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-foreground">现场考核</div>
              <p className="text-xs text-muted-foreground mt-1">选择项目、镇街和考核对象，录入现场评分数据</p>
            </div>
            <ChevronRight className="w-5 h-5 text-primary shrink-0" />
          </div>
        </button>

        <button onClick={onKnowledge} className="w-full rounded-xl border border-border bg-white p-5 text-left active:bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-foreground">知识库</div>
              <p className="text-xs text-muted-foreground mt-1">查看考核标准、项目资料和报告口径</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </div>
        </button>
      </div>
    </div>
  );
}

function PKnowledge({ onBack }: { onBack: () => void }) {
  const [keyword, setKeyword] = useState("");
  const allItems = [
    ...getAllItems(TREATMENT_STANDARDS as unknown as L1Group[]).map(item => ({ item, type: "污水处理设施" })),
    ...getAllItems(NETWORK_STANDARDS as unknown as L1Group[]).map(item => ({ item, type: "管网设施" })),
  ];
  const itemKeys = new Set<string>();
  const items = allItems.filter(({ item, type }) => {
    const key = `${type}:${item.id}`;
    if (itemKeys.has(key)) return false;
    itemKeys.add(key);
    return true;
  });
  const normalizedKeyword = keyword.trim();
  const filtered = items.filter(({ item, type }) => {
    if (!normalizedKeyword) return true;
    return `${type} ${itemKnowledgeText(item)} ${knowledgeGuidanceForItem(item).join(" ")}`.includes(normalizedKeyword);
  });
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <h1 className="text-lg font-semibold text-primary-foreground">知识库</h1>
        <p className="text-xs text-primary-foreground/55 mt-1">按评分点核对标准、扣分口径和常见判定问题</p>
      </div>
      <div className="px-4 pt-4 pb-2 bg-background shrink-0">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
            placeholder="搜索评分点、停产、全月不合格、水质..."
            className="w-full h-11 rounded-xl border border-border bg-white pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {filtered.map(({ item, type }) => {
          const knowledgeRows = knowledgeRowsForItem(item);
          const knowledgeTextSet = new Set(knowledgeRows.map(row => normalizeDisplayText(row.text)));
          const tips = uniqueDisplayTexts(knowledgeGuidanceForItem(item))
            .filter(tip => !knowledgeTextSet.has(normalizeDisplayText(tip)));
          const combinedKnowledgeText = comparisonText(knowledgeRows.map(row => row.text).join(" "));
          const deductionOptions = uniqueDeductionOptions(item.options)
            .filter(option => !combinedKnowledgeText.includes(comparisonText(option.reason)));
          return (
          <div key={`${type}-${item.id}`} className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-primary font-medium">{type}</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{item.name}</div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{item.maxScore}分</span>
            </div>
            {tips.length > 0 && (
              <div className="mt-3 space-y-2">
                {tips.map(tip => (
                  <div key={tip} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
                    {tip}
                  </div>
                ))}
              </div>
            )}
            {knowledgeRows.length > 0 && (
              <div className="mt-3 space-y-2 text-xs leading-relaxed">
                {knowledgeRows.map(row => (
                  <div key={`${row.label}-${row.text}`} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <div className="mb-1 text-[11px] font-medium text-muted-foreground">{row.label}</div>
                    <p className="whitespace-pre-line text-foreground">{row.text}</p>
                  </div>
                ))}
              </div>
            )}
            {deductionOptions.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[11px] font-medium text-muted-foreground">扣分选项</div>
                {deductionOptions.map(option => (
                  <div key={option.id} className="rounded-lg bg-muted px-3 py-2 text-xs text-foreground leading-relaxed">
                    {option.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            没有找到匹配的评分点
          </div>
        )}
      </div>
    </div>
  );
}

function P0City({ onBack, onNext }: { onBack: () => void; onNext: (c: CityOption) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [cities, setCities] = useState<CityOption[]>([
    { id: "yunan", name: "郁南项目", sub: "郁南项目绩效考核标准" },
    { id: "maonan", name: "茂南项目", sub: "茂南项目绩效考核标准" },
  ]);
  useEffect(() => {
    fetch(`${API_BASE_URL}/mobile/projects`, { headers: authHeaders() })
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
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
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
                    <div className={`text-sm font-medium truncate ${selectedId === (c.id ?? c.name) ? "text-primary" : "text-foreground"}`}>{cleanStandardName(c.name)}</div>
                    <div className="text-xs text-muted-foreground">{cleanStandardName(c.sub)}</div>
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

function currentCycleParts(): { year: number; periodId: string } {
  const now = new Date();
  const year = CYCLE_YEARS.includes(now.getFullYear()) ? now.getFullYear() : 2026;
  return { year, periodId: `q${Math.floor(now.getMonth() / 3) + 1}` };
}

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

function cycleStatusLabel(status: string): string {
  if (status === "active") return "当前启用";
  if (status === "closed") return "已关闭";
  if (status === "draft") return "草稿";
  return status || "固定选项";
}

function P0Cycle({ cityId, cityName, onBack, onNext }: {
  cityId?: string;
  cityName: string;
  onBack: () => void;
  onNext: (cycle: CycleOption) => void;
}) {
  const defaultCycles = fixedCycleOptions();
  const [cycles, setCycles] = useState<CycleOption[]>(defaultCycles);
  const initialCycle = currentCycleParts();
  const [selectedYear, setSelectedYear] = useState(initialCycle.year);
  const [selectedPeriodId, setSelectedPeriodId] = useState(initialCycle.periodId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = cityId ? `?city_id=${encodeURIComponent(cityId)}` : "";
    setLoading(true);
    setError("");
    fetch(`${API_BASE_URL}/mobile/assessment-cycles${params}`, { headers: authHeaders() })
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
        const target = mapped.find(item => item.name === cycleNameFromParts(initialCycle.year, initialCycle.periodId)) ?? mapped[0];
        const parsed = target ? parseCycleNameParts(target.name) : null;
        if (parsed) {
          setSelectedYear(parsed.year);
          setSelectedPeriodId(parsed.periodId);
        }
      })
      .catch(() => {
        const fallback = fixedCycleOptions();
        setError("后端暂时未连接，仍可先选择固定考核周期");
        setCycles(fallback);
        setSelectedYear(initialCycle.year);
        setSelectedPeriodId(initialCycle.periodId);
      })
      .finally(() => setLoading(false));
  }, [cityId, initialCycle.periodId, initialCycle.year]);

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
        {loading && <div className="rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted-foreground">正在同步后台考核周期...</div>}
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
            <div className="text-xs text-muted-foreground mt-1">{selected.backendId ? `后台周期：${cycleStatusLabel(selected.status)}` : cycleStatusLabel(selected.status)}</div>
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

function P1Town({ cityId, projectName, cycleName, onBack, onNext, submittedData, syncQueue, onViewSubmitted, onRetrySync, onDiscardSync }: {
  cityId?: string;
  projectName: string;
  cycleName: string;
  onBack: () => void;
  onNext: (t: TownOption) => void;
  submittedData: Record<string, VillageRecord[]>;
  syncQueue: SyncQueueItem[];
  onViewSubmitted: () => void;
  onRetrySync: () => Promise<void>;
  onDiscardSync: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [towns, setTowns] = useState<TownOption[]>([]);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setSelectedId("");
    const params = cityId ? `?city_id=${encodeURIComponent(cityId)}` : "";
    fetch(`${API_BASE_URL}/mobile/towns${params}`, { headers: authHeaders() })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (Array.isArray(data?.items)) {
          const projectTowns = cityId ? data.items.filter((town: TownOption) => !town.cityId || town.cityId === cityId) : data.items;
          setTowns(projectTowns);
        }
      })
      .catch(() => undefined);
  }, [cityId]);
  const selected = towns.find(town => town.id === selectedId);
  const currentSyncQueue = syncQueue.filter(item =>
    (!cityId || item.pkg.cityId === cityId) && item.pkg.period === cycleName
  );
  const failedSyncCount = currentSyncQueue.filter(item => item.syncStatus === "sync_failed").length;
  const pendingSyncCount = currentSyncQueue.filter(item => item.syncStatus === "pending_sync").length;
  const conflictSyncCount = currentSyncQueue.filter(item => item.syncStatus === "sync_conflict").length;
  const completedTypesByTown = new Map<string, Set<PrimaryFacilityType>>();
  syncQueue
    .filter(item => item.syncStatus === "synced" && (!cityId || item.pkg.cityId === cityId) && item.pkg.period === cycleName)
    .forEach(item => {
      const completedTypes = completedTypesByTown.get(item.pkg.town) ?? new Set<PrimaryFacilityType>();
      item.pkg.villages.forEach(record => {
        if (record.primaryFacilityType) completedTypes.add(record.primaryFacilityType);
      });
      completedTypesByTown.set(item.pkg.town, completedTypes);
    });

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
            {towns.map(t => {
              const completedTypes = completedTypesByTown.get(t.name) ?? new Set<PrimaryFacilityType>();
              const completedCount = t.assessmentTargets.filter(type => completedTypes.has(type)).length;
              const remainingCount = Math.max(t.assessmentTargets.length - completedCount, 0);
              const completed = t.assessmentTargets.length > 0 && remainingCount === 0;
              const inProgress = completedCount > 0 && !completed;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                    selectedId === t.id ? "bg-primary/5 border-primary" : completed ? "bg-green-50/60 border-green-200" : inProgress ? "bg-amber-50/60 border-amber-200" : "bg-white border-border"
                  }`}
                >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedId === t.id ? "bg-primary" : "bg-muted"}`}>
                    <MapPin className={`w-4 h-4 ${selectedId === t.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <span className={`text-sm font-medium ${selectedId === t.id ? "text-primary" : "text-foreground"}`}>{t.name}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.assessmentTargets.length}类考核对象</div>
                    <div className={`text-xs mt-1 ${completed ? "text-green-700" : inProgress ? "text-amber-700" : "text-muted-foreground"}`}>
                      已完成 {completedCount} 个考核对象
                    </div>
                    <div className={`text-xs mt-0.5 ${remainingCount === 0 ? "text-green-700 font-medium" : "text-muted-foreground"}`}>
                      剩余 {remainingCount} 个考核对象
                    </div>
                  </div>
                </div>
                  {completed
                    ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                    : selectedId === t.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
            {towns.length === 0 && (
              <div className="rounded-lg border border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                当前项目暂无可选镇街
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0 space-y-2">
        {conflictSyncCount > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <div className="flex items-center justify-between gap-3">
              <span>{conflictSyncCount} 个考核对象存在设备修改冲突，后台数据未被覆盖</span>
              <button onClick={onViewSubmitted} className="font-semibold underline shrink-0">去处理</button>
            </div>
          </div>
        )}
        {(failedSyncCount > 0 || pendingSyncCount > 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <div className="flex items-center justify-between gap-3">
              <span>{failedSyncCount > 0 ? `${failedSyncCount} 个数据包同步失败` : `${pendingSyncCount} 个数据包等待同步`}</span>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={onDiscardSync} disabled={retrying} className="font-semibold underline text-red-600 disabled:opacity-50">放弃</button>
                <button
                  onClick={async () => { setRetrying(true); try { await onRetrySync(); } finally { setRetrying(false); } }}
                  disabled={retrying}
                  className="font-semibold underline disabled:opacity-50"
                >
                  {retrying ? "重试中..." : "立即重试"}
                </button>
              </div>
            </div>
          </div>
        )}
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

function P2Village({ town, cityId, completedVillages, readonlyVillages, onBack, onNext }: {
  town: string;
  cityId?: string;
  completedVillages: Set<string>;
  readonlyVillages: Map<string, string>;
  onBack: () => void;
  onNext: (v: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [villages, setVillages] = useState<VillageOption[]>([]);

  useEffect(() => {
    const params = cityId ? `?city_id=${encodeURIComponent(cityId)}` : "";
    fetch(`${API_BASE_URL}/mobile/towns/${encodeURIComponent(town)}/villages${params}`, { headers: authHeaders() })
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
        <h1 className="text-xl font-semibold text-primary-foreground">选择考核项目点</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">设施点清单</p>
          <div className="space-y-2">
            {villages.map(v => {
              const completed = completedVillages.has(v.name);
              const readonlyLabel = readonlyVillages.get(v.name);
              const readOnly = !!readonlyLabel;
              return (
                <button
                  key={v.id}
                  onClick={() => !readOnly && setSelectedId(v.id)}
                  disabled={readOnly}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  selectedId === v.id ? "bg-primary/5 border-primary" : completed ? "bg-green-50/60 border-green-200" : "bg-white border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedId === v.id ? "bg-primary" : "bg-muted"}`}>
                    <Building2 className={`w-4 h-4 ${selectedId === v.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <span className={`text-sm font-medium ${selectedId === v.id ? "text-primary" : "text-foreground"}`}>{v.name}</span>
                    <div className="text-xs text-muted-foreground mt-0.5">{v.administrativeVillage || "行政村待核"}</div>
                    {completed && <div className="text-xs text-green-700 font-medium mt-1">{readonlyLabel || "修改"}</div>}
                  </div>
                </div>
                  {completed ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" /> : selectedId === v.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
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

const FACILITY_TYPE_INFO: Record<FacilityType, { label: string; sub: string; icon: typeof Building2 }> = {
  treatment: { label: "污水处理设施", sub: "含处理设备及附属构筑物", icon: Building2 },
  network:   { label: "纳厂/管网设施", sub: "接入已建处理设施",       icon: Wrench },
  survey:    { label: "调查问卷",      sub: "多方满意度问卷调查",      icon: ClipboardList },
  water_quality: { label: "水质抽检情况", sub: "填写出水抽检指标及结论", icon: Droplets },
};

const PRIMARY_FACILITY_TYPE_INFO: Record<PrimaryFacilityType, { label: string; sub: string; icon: typeof Building2 }> = {
  town_plant: { label: "镇街污水厂", sub: "镇街污水处理厂考核", icon: Building2 },
  town_network: { label: "镇街污水收集管网", sub: "镇街污水收集管网考核", icon: Wrench },
  rural_treatment: { label: "农村污水处理设施", sub: "农村污水处理设施考核", icon: House },
};

function P2bFacilityChoice({ town, allowedTargets, completedTypes, readonlyTypes, onBack, onSelect }: {
  town: string;
  allowedTargets: PrimaryFacilityType[];
  completedTypes: Set<PrimaryFacilityType>;
  readonlyTypes: Map<PrimaryFacilityType, string>;
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
          const completed = completedTypes.has(type);
          const readonlyLabel = readonlyTypes.get(type);
          const readOnly = !!readonlyLabel;
          const TypeIcon = info.icon;
          return (
            <button
              key={type}
              onClick={() => !readOnly && onSelect(type)}
              disabled={readOnly}
              className={`w-full text-left rounded-xl border-2 p-5 transition-colors active:bg-gray-50 ${completed ? "border-green-200 bg-green-50/60" : "border-border bg-white"}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <TypeIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-foreground">{info.label}</div>
                  {(readonlyLabel || completed) && (
                    <p className="text-xs font-medium mt-1 text-green-700">{readonlyLabel || "修改"}</p>
                  )}
                </div>
                {completed ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" /> : <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function P2bFacilityType({ town, village, primaryFacilityType, hasWaterQualityItem, typeProgress, onBack, onEnter, onSubmitVillage }: {
  town: string; village: string;
  primaryFacilityType: PrimaryFacilityType;
  hasWaterQualityItem: boolean;
  typeProgress: Partial<Record<FacilityType, boolean>>;
  onBack: () => void;
  onEnter: (t: FacilityType) => void;
  onSubmitVillage: () => void;
}) {
  const mainFacilityType = standardTypeForPrimary(primaryFacilityType);
  const primaryInfo = PRIMARY_FACILITY_TYPE_INFO[primaryFacilityType];
  const availableTypes: FacilityType[] = [
    mainFacilityType,
    ...(primaryFacilityType === "rural_treatment" ? ["survey" as const] : []),
    ...(hasWaterQualityItem ? ["water_quality" as const] : []),
  ];
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
          const TypeIcon = info.icon;
          return (
            <button
              key={t}
              onClick={() => onEnter(t)}
              className="w-full text-left rounded-xl border-2 p-4 bg-white transition-colors active:bg-gray-50 border-border"
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${done ? "bg-green-100" : "bg-muted"}`}>
                  {done ? <CheckCircle className="w-5 h-5 text-green-600" /> : <TypeIcon className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{info.label}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${done ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {done ? "修改" : "待完成"}
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
    bod5Value: "",
    bod5Limit: "",
    ssValue: "",
    ssLimit: "",
    nh3nValue: "",
    tpValue: "",
    monthlyMissingTest: false,
    monthlyRegulatorUnqualified: false,
    conclusion: "pending",
    note: "",
    completed: false,
    ...WATER_QUALITY_LIMITS[primaryFacilityType],
  };
}

function numericWaterQualityValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function numericWaterQualityLimit(value: string): number | null {
  const matched = value.match(/\d+(?:\.\d+)?/);
  if (!matched) return null;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function automaticWaterQualityConclusion(entry: WaterQualityEntry): "pending" | "qualified" | "unqualified" {
  if (entry.monthlyMissingTest || entry.monthlyRegulatorUnqualified) return "unqualified";
  const pairs: Array<[string, string]> = [
    [entry.codValue, entry.codLimit],
    ...(entry.bod5Limit ? [[entry.bod5Value ?? "", entry.bod5Limit] as [string, string]] : []),
    ...(entry.ssLimit ? [[entry.ssValue ?? "", entry.ssLimit] as [string, string]] : []),
    [entry.nh3nValue, entry.nh3nLimit],
    ...(entry.hasTpLimit ? [[entry.tpValue, entry.tpLimit] as [string, string]] : []),
  ];
  const values = pairs.map(([value, limit]) => [numericWaterQualityValue(value), numericWaterQualityLimit(limit)] as const);
  if (values.some(([value, limit]) => value === null || limit === null)) return "pending";
  return values.some(([value, limit]) => value! > limit!) ? "unqualified" : "qualified";
}

function isMonthlyUnqualifiedOption(option: DeductionOption, item: L3Item): boolean {
  return (option.value ?? 0) >= item.maxScore;
}

function waterQualityItemEntry(item: L3Item, waterQuality: WaterQualityEntry): ItemEntry {
  const automaticConclusion = automaticWaterQualityConclusion(waterQuality);
  const forceQualified = waterQuality.conclusionOverridden && waterQuality.conclusion === "qualified";
  const forceUnqualified = waterQuality.conclusionOverridden && waterQuality.conclusion === "unqualified" && automaticConclusion === "qualified";
  const triggerReasons = [
    waterQuality.monthlyMissingTest && "化验报告显示当月有一项没做化验项目",
    waterQuality.monthlyRegulatorUnqualified && "环保部门或上级监管部门抽查判定不合格",
  ].filter((item): item is string => Boolean(item));
  const monthlyUnqualified = !forceQualified && (
    waterQuality.conclusion === "unqualified"
    || automaticConclusion === "unqualified"
    || triggerReasons.length > 0
    || forceUnqualified
  );
  const hasMonthlyRule = item.options.some(option => isMonthlyUnqualifiedOption(option, item));
  if (hasMonthlyRule) {
    const options = item.options.map(option => {
      const selected = monthlyUnqualified && isMonthlyUnqualifiedOption(option, item);
      return {
        ...makeOptionEntry(option.id),
        selection: selected ? "standard" as const : "no_deduction" as const,
        instances: 1,
        note: selected ? `水质不合格判定：${triggerReasons.length ? triggerReasons.join("；") : "判定为不合格"}` : "",
      };
    });
    return {
      itemId: item.id,
      options,
      generalNote: [waterQuality.note, triggerReasons.length ? `全月不合格触发原因：${triggerReasons.join("；")}` : ""].filter(Boolean).join("\n"),
      done: waterQuality.completed,
    };
  }
  const codFailed = !forceQualified && (forceUnqualified || numericWaterQualityValue(waterQuality.codValue)! > numericWaterQualityLimit(waterQuality.codLimit)!);
  const measuredOtherFailedCount = Number(numericWaterQualityValue(waterQuality.nh3nValue)! > numericWaterQualityLimit(waterQuality.nh3nLimit)!)
    + Number(waterQuality.hasTpLimit && numericWaterQualityValue(waterQuality.tpValue)! > numericWaterQualityLimit(waterQuality.tpLimit)!)
    + Number(Boolean(waterQuality.bod5Limit) && numericWaterQualityValue(waterQuality.bod5Value ?? "")! > numericWaterQualityLimit(waterQuality.bod5Limit ?? "")!)
    + Number(Boolean(waterQuality.ssLimit) && numericWaterQualityValue(waterQuality.ssValue ?? "")! > numericWaterQualityLimit(waterQuality.ssLimit ?? "")!);
  const measuredOtherCount = 1 + Number(waterQuality.hasTpLimit) + Number(Boolean(waterQuality.bod5Limit)) + Number(Boolean(waterQuality.ssLimit));
  const otherFailedCount = forceQualified ? 0 : forceUnqualified ? measuredOtherCount : measuredOtherFailedCount;
  const options = item.options.map(option => {
    const optionText = `${option.reason} ${option.sourceText ?? ""}`;
    const isCodOption = optionText.includes("CODCr") && !optionText.includes("NH3-N");
    const instances = isCodOption ? Number(codFailed) : otherFailedCount;
    return {
      ...makeOptionEntry(option.id),
      selection: instances > 0 ? "standard" as const : "no_deduction" as const,
      instances: Math.max(1, instances),
      note: instances > 0 ? `水质抽检自动回填：${option.reason}` : "",
    };
  });
  return {
    itemId: item.id,
    options,
    generalNote: waterQuality.note,
    done: waterQuality.completed,
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
                    aria-label={`${CATEGORY_LABEL[cat]} ${RESPONDENT_LABEL[res]} ${done ? `已完成 ${score}分` : "待填写"}`}
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
          <Save className="w-4 h-4" />保存并返回
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

function WaterQualityField({ label, value, placeholder, numeric = false, onChange }: {
  label: string;
  value: string;
  placeholder?: string;
  numeric?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground block mb-1.5">{label}</span>
      <input
        value={value}
        type={numeric ? "text" : undefined}
        inputMode={numeric ? "decimal" : undefined}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        style={{ background: "var(--input-background)" }}
      />
    </label>
  );
}

function WaterQualityFixedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground block mb-1.5">{label}</span>
      <div className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/45 text-foreground min-h-[38px] flex items-center">
        {value}
      </div>
    </div>
  );
}

function PWaterQualityForm({ town, village, projectName, primaryFacilityType, entry, onBack, onSave }: {
  town: string;
  village: string;
  projectName: string;
  primaryFacilityType: PrimaryFacilityType;
  entry: WaterQualityEntry;
  onBack: () => void;
  onSave: (entry: WaterQualityEntry) => void;
}) {
  const [form, setForm] = useState<WaterQualityEntry>(() => applyFixedWaterQualityLimits(entry, primaryFacilityType));
  useEffect(() => {
    setForm(prev => ({
      ...applyFixedWaterQualityLimits(prev, primaryFacilityType),
      bod5Limit: projectName.includes("茂南") && primaryFacilityType === "town_plant" ? "10" : "",
      ssLimit: projectName.includes("茂南") && primaryFacilityType === "town_plant" ? "10" : "",
    }));
  }, [primaryFacilityType, projectName]);
  const update = (patch: Partial<WaterQualityEntry>) => setForm(prev => ({ ...prev, ...patch }));
  const updateMeasurement = (patch: Partial<WaterQualityEntry>) => setForm(prev => {
    const next = { ...prev, ...patch };
    return next.conclusionOverridden ? next : { ...next, conclusion: automaticWaterQualityConclusion(next) };
  });
  const updateMonthlyTrigger = (patch: Partial<WaterQualityEntry>) => setForm(prev => {
    const next = { ...prev, ...patch };
    return {
      ...next,
      conclusion: automaticWaterQualityConclusion(next),
      conclusionOverridden: false,
    };
  });
  const automaticConclusion = automaticWaterQualityConclusion(form);
  const hasMonthlyTrigger = Boolean(form.monthlyMissingTest || form.monthlyRegulatorUnqualified);
  const requiredMeasurementsComplete = hasMonthlyTrigger || automaticConclusion !== "pending";
  const overrideNoteComplete = !form.conclusionOverridden || !!form.note.trim();
  const canComplete = !!form.sampleTime && !!form.dischargeStandard && !!form.processType && !!form.designScale
    && requiredMeasurementsComplete && form.conclusion !== "pending" && overrideNoteComplete;
  const missingFields = [
    !form.sampleTime && "取样时间",
    !form.processType && "工艺类型",
    !form.designScale && "规模",
    !requiredMeasurementsComplete && "全部实测值",
    form.conclusion === "pending" && "抽检结论",
    !overrideNoteComplete && "人工修改依据",
  ].filter((item): item is string => Boolean(item));

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
          <WaterQualityField label="取样时间" value={form.sampleTime} placeholder="如：2023-12-10 09:30" onChange={sampleTime => update({ sampleTime })} />
          <WaterQualityFixedField label="排放标准" value={form.dischargeStandard} />
          <WaterQualityField label="工艺类型" value={form.processType} placeholder="如：A/O + 人工湿地" onChange={processType => update({ processType })} />
          <WaterQualityField label="规模（立方米/日）" value={form.designScale} placeholder="如：50" numeric onChange={designScale => update({ designScale })} />
        </div>

        <div className="bg-white border border-border rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <WaterQualityField label="CODCr 实测值" value={form.codValue} placeholder="mg/L" numeric onChange={codValue => updateMeasurement({ codValue })} />
            <WaterQualityFixedField label="CODCr 限值（mg/L）" value={form.codLimit} />
            {form.bod5Limit && <>
              <WaterQualityField label="BOD5 实测值" value={form.bod5Value ?? ""} placeholder="mg/L" numeric onChange={bod5Value => updateMeasurement({ bod5Value })} />
              <WaterQualityFixedField label="BOD5 限值（mg/L）" value={form.bod5Limit} />
            </>}
            {form.ssLimit && <>
              <WaterQualityField label="SS 实测值" value={form.ssValue ?? ""} placeholder="mg/L" numeric onChange={ssValue => updateMeasurement({ ssValue })} />
              <WaterQualityFixedField label="SS 限值（mg/L）" value={form.ssLimit} />
            </>}
            <WaterQualityField label="NH3-N 实测值" value={form.nh3nValue} placeholder="mg/L" numeric onChange={nh3nValue => updateMeasurement({ nh3nValue })} />
            <WaterQualityFixedField label="NH3-N 限值（mg/L）" value={form.nh3nLimit} />
            {form.hasTpLimit && (
              <>
                <WaterQualityField label="TP 实测值" value={form.tpValue} placeholder="mg/L" numeric onChange={tpValue => updateMeasurement({ tpValue })} />
                <WaterQualityFixedField label="TP 限值（mg/L）" value={form.tpLimit} />
              </>
            )}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">不合格判定</div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              以下两项只作为全月不合格触发原因记录，不单独评分；如触发，则统一回填“判定为不合格扣分”。
            </p>
          </div>
          <div className="space-y-2">
            {[
              {
                key: "monthlyMissingTest" as const,
                label: "化验报告显示当月有一项没做化验项目",
              },
              {
                key: "monthlyRegulatorUnqualified" as const,
                label: "环保部门或上级监管部门抽查判定不合格",
              },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => {
                  updateMonthlyTrigger({ [item.key]: !form[item.key] });
                }}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm flex items-center gap-2 ${
                  form[item.key]
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-white border-border text-foreground"
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${form[item.key] ? "bg-red-600 border-red-600" : "border-border"}`}>
                  {form[item.key] && <Check className="w-3 h-3 text-white" />}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="text-xs text-primary">
            系统判定：{automaticConclusion === "pending" ? "请完整填写实测值" : automaticConclusion === "qualified" ? "达标" : "不达标"}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "qualified" as const, label: "达标" },
              { value: "unqualified" as const, label: "不达标" },
            ]).map(item => (
              <button
                key={item.value}
                onClick={() => update({
                  conclusion: item.value,
                  conclusionOverridden: automaticConclusion !== "pending" && item.value !== automaticConclusion,
                })}
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
            <span className="text-xs text-muted-foreground block mb-1.5">
              备注{form.conclusionOverridden ? "（人工修改结论后必填）" : ""}
            </span>
            <textarea
              value={form.note}
              onChange={e => update({ note: e.target.value })}
              placeholder="填写超标指标、检测机构、报告编号等"
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ background: "var(--input-background)" }}
            />
          </label>
          {form.conclusionOverridden && !form.note.trim() && <p className="text-xs text-red-500">人工修改系统判定后必须填写修改依据。</p>}
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        {!canComplete && <p className="mb-2 text-center text-xs text-amber-700">请补充：{missingFields.join("、")}</p>}
        <button
          onClick={() => { if (canComplete) onSave({ ...form, completed: true }); }}
          disabled={!canComplete}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />保存水质抽检情况
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 3: CRITERIA LIST ====================

function P3Criteria({ town, village, ftype, groups, entries, surveyEntries, scorePolicy, standardVersionName, onBack, onSelect, onSummary }: {
  town: string; village: string; ftype: FacilityType;
  groups: L1Group[];
  entries: Record<string, ItemEntry>;
  surveyEntries: Record<string, SurveyFormEntry>;
  scorePolicy?: ScorePolicy;
  standardVersionName?: string;
  onBack: () => void;
  onSelect: (id: string) => void;
  onSummary: () => void;
}) {
  const allItems = applicableScoreItems(groups, scorePolicy);
  const calculated = calculatePolicyTypeScore(groups, entries, surveyEntries, scorePolicy, true);
  const total = calculated.maxScore;
  const deducted = calculated.rawDeduction;
  const current = calculated.currentScore;
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
            <div className="text-base font-bold text-red-200">-{formatScoreValue(deducted)}</div>
            <div className="text-[10px] text-red-200/70">已扣分</div>
          </div>
          <div className="bg-green-500/20 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-green-200">{formatScoreValue(current)}</div>
            <div className="text-[10px] text-green-200/70">当前得分</div>
          </div>
        </div>

        <span className="inline-block px-2.5 py-1 bg-white/10 rounded-full text-[10px] text-primary-foreground/75">
          {ftype === "treatment" ? "污水处理设施绩效评价标准" : "纳厂/接入已建设施管网绩效评价标准"}
        </span>
        {standardVersionName && (
          <span className="ml-2 inline-block px-2.5 py-1 bg-white/10 rounded-full text-[10px] text-primary-foreground/75">
            {cleanStandardName(standardVersionName)}
          </span>
        )}
        {scorePolicy?.mode === "scaled_applicable" && (
          <p className="mt-2 text-xs leading-5 text-primary-foreground/75">{scorePolicy.description}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {groups.map((l1, li) => {
          const l1Items = l1.children.flatMap(l2 => l2.items).filter(item => isApplicableItem(item, scorePolicy));
          const l1Total = l1Items.reduce((s, i) => s + i.maxScore, 0);
          const l1Ded = l1Items.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id, surveyEntries), 0);

          return (
            <div key={l1.id} className="mt-4 mx-4">
              <div className={`px-4 py-2.5 rounded-t-lg flex items-center justify-between ${l1BgColors[li] ?? "bg-gray-800"}`}>
                <span className="text-sm font-semibold text-white">{l1.icon} {l1.name}</span>
                <span className="text-xs text-white/65">{l1Total > 0 ? `${formatScoreValue(l1Total - l1Ded)}/${l1Total}分` : "不适用"}</span>
              </div>

              {l1.children.map(l2 => (
                <div key={l2.id} className="bg-white border border-t-0 border-border last:rounded-b-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">{l2.name}</span>
                  </div>
                  {l2.items.map((item, ii) => {
                    const applicable = isApplicableItem(item, scorePolicy);
                    const derived = calcSurveyDerivedScore(item, l2, surveyEntries);
                    const ded = derived?.deductedScore ?? calcEntryDeduction(entries, groups, item.id, surveyEntries);
                    const status = derived ? null : getStatus(entries[item.id]);
                    return (
                      <button
                        key={item.id}
                        onClick={() => { if (applicable) onSelect(item.id); }}
                        disabled={!applicable}
                        className={`w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-gray-50 disabled:bg-gray-50 ${ii < l2.items.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm font-medium text-foreground mb-1">{item.name}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {!applicable ? (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">不适用，不计入评分</span>
                            ) : derived ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${derived.completed ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                                {derived.completed ? "问卷已回填" : "待问卷回填"}
                              </span>
                            ) : (
                              <StatusTag status={status} />
                            )}
                            {ded > 0 && <span className="text-xs text-red-600 font-medium">-{formatScoreValue(ded)}分</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {applicable ? (
                            <>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-foreground">{status === "pending" ? "—" : formatScoreValue(item.maxScore - ded)}</div>
                                <div className="text-xs text-muted-foreground">/{item.maxScore}</div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </>
                          ) : <span className="text-xs text-muted-foreground">不计分</span>}
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
        <button onClick={onBack} className="py-3 border border-primary text-primary rounded-xl font-medium text-sm flex items-center justify-center gap-1.5">
          <ChevronLeft className="w-4 h-4" />返回上一页
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
  const capped = roundScoreValue(Math.min(rawTotal, item.maxScore));
  const current = roundScoreValue(derived ? derived.currentScore : item.maxScore - capped);
  const overLimit = rawTotal > item.maxScore;
  const knowledgeTips = knowledgeGuidanceForItem(item);
  const monthlyRule = isMonthlyUnqualifiedRuleItem(item);
  const monthlyReasonOptions = item.options.filter(isMonthlyReasonOption);
  const monthlyDeductionOption = item.options.find(option => isMonthlyDeductionOption(option, item));
  const monthlyUnqualified = monthlyRule && monthlyDeductionOption
    ? entry.options.some(oe => oe.optionId === monthlyDeductionOption.id && oe.selection !== "no_deduction")
    : false;
  const selectedMonthlyReasons = new Set(entry.options
    .filter(oe => oe.selection === "custom" && oe.note === "全月不合格触发原因")
    .map(oe => oe.optionId));

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

  const save = (done: boolean) => {
    if (done && monthlyUnqualified && selectedMonthlyReasons.size === 0) {
      window.alert("请选择至少一个不合格原因");
      return;
    }
    onSave({ ...entry, done });
    onBack();
  };

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
            <div className={`text-base font-bold ${capped > 0 ? "text-red-200" : "text-primary-foreground"}`}>-{formatScoreValue(capped)}</div>
            <div className={`text-[10px] ${capped > 0 ? "text-red-200/65" : "text-primary-foreground/55"}`}>已扣分</div>
          </div>
          <div className={`rounded-lg p-2 text-center ${capped > 0 ? "bg-amber-400/20" : "bg-green-500/20"}`}>
            <div className={`text-base font-bold ${capped > 0 ? "text-amber-200" : "text-green-200"}`}>{formatScoreValue(current)}</div>
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

        {(item.evaluationStandard || item.scoringMethod || item.dataSource || knowledgeTips.length > 0) && (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              知识库
            </div>
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
              {knowledgeTips.length > 0 && (
                <div className="px-3 py-2.5 space-y-1.5">
                  <div className="text-[11px] text-muted-foreground">口径解释</div>
                  {knowledgeTips.map(tip => (
                    <p key={tip} className="text-xs text-foreground leading-relaxed">{tip}</p>
                  ))}
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

        {monthlyRule && !derived && (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">不合格判定</p>
              <p className="text-xs text-muted-foreground mt-1">先判断本项是否合格；选择不合格后，再选择触发原因，系统自动按“判定为不合格”扣分。</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEntry(prev => buildMonthlyEntry(item, prev, false, new Set()))}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                    !monthlyUnqualified ? "border-green-500 bg-green-50 text-green-700" : "border-border bg-white text-foreground"
                  }`}
                >
                  合格
                </button>
                <button
                  onClick={() => {
                    setEntry(prev => buildMonthlyEntry(item, prev, true, new Set()));
                  }}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                    monthlyUnqualified ? "border-red-500 bg-red-50 text-red-700" : "border-border bg-white text-foreground"
                  }`}
                >
                  不合格
                </button>
              </div>

              {monthlyUnqualified && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">不合格原因</p>
                  {monthlyReasonOptions.map(option => {
                    const checked = selectedMonthlyReasons.has(option.id);
                    return (
                      <label key={option.id} className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          onChange={event => {
                            const next = new Set(selectedMonthlyReasons);
                            if (event.target.checked) next.add(option.id);
                            else next.delete(option.id);
                            setEntry(prev => buildMonthlyEntry(item, prev, true, next));
                          }}
                        />
                        <span className="text-xs text-foreground leading-relaxed">{option.reason}</span>
                      </label>
                    );
                  })}
                  {monthlyDeductionOption && (
                    <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700 leading-relaxed">
                      自动扣分：{monthlyDeductionOption.reason}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deduction options */}
        {!derived && !monthlyRule && item.options.length > 0 && (
          <div className="text-sm font-semibold text-foreground pt-1">扣分选项</div>
        )}
        {!derived && !monthlyRule && item.options.map((opt, oi) => {
          const oe = entry.options[oi];
          if (!oe) return null;
          const score = calcOptionScore(oe, opt);
          const countBased = isCountBasedOption(opt);
          const unit = getOptionUnit(opt);
          const maxInstances = getOptionMaxInstances(opt);
          const instances = clampOptionInstances(oe.instances, opt);
          const fixedBaseScore = opt.value ?? 0;
          const countScore = roundScoreValue(fixedBaseScore * instances);
          const countScoreLimit = roundScoreValue(fixedBaseScore * maxInstances);
          const quickCounts = Array.from(new Set([1, 2, 3, 5, 10, maxInstances].filter(v => v <= maxInstances)));

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
                      <span className="text-xs text-red-600 font-medium">扣 {formatScoreValue(score)} 分</span>
                    )}
                    {oe.selection === "standard" && score === 0 && (
                      <span className="text-xs text-muted-foreground">请选择扣分值</span>
                    )}
                    {oe.selection === "custom" && (
                      <span className="text-xs text-amber-600 font-medium">其他：扣 {formatScoreValue(oe.customScore)} 分</span>
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
                      { sel: "standard" as SelectionType, label: "按此原因扣分", color: "#1a3a52" },
                      { sel: "no_deduction" as SelectionType, label: "不扣分", color: "#16a34a" },
                      { sel: "custom" as SelectionType, label: "其他原因", color: "#d97706" },
                    ]).map(row => (
                      <label key={row.sel} className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="radio"
                          className="mt-0.5 shrink-0"
                          style={{ accentColor: row.color }}
                          checked={oe.selection === row.sel}
                          onChange={() => updateOpt(oi, {
                            selection: row.sel,
                            instances: row.sel === "standard" ? clampOptionInstances(oe.instances, opt) : oe.instances,
                          })}
                        />
                        <span className="text-sm text-foreground">{row.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Standard controls */}
                  {oe.selection === "standard" && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                      <p className="text-xs font-semibold text-slate-600">建议扣分方案</p>

                      {countBased && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500">
                            每{unit}扣 {fixedBaseScore} 分，最多选择 {maxInstances}{unit}
                          </p>
                          <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                            <button
                              onClick={() => updateOpt(oi, { instances: clampOptionInstances(instances - 1, opt) })}
                              className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                            <label className="relative block">
                              <input
                                type="number"
                                min={1}
                                max={maxInstances}
                                value={instances}
                                onChange={event => updateOpt(oi, { instances: clampOptionInstances(Number(event.target.value), opt) })}
                                className="w-full h-9 rounded-lg bg-white border border-slate-200 text-center text-lg font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                aria-label={`扣分${unit}数`}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{unit}</span>
                            </label>
                            <button
                              onClick={() => updateOpt(oi, { instances: clampOptionInstances(instances + 1, opt) })}
                              className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {quickCounts.map(count => (
                              <button
                                key={count}
                                onClick={() => updateOpt(oi, { instances: clampOptionInstances(count, opt) })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                  instances === count
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-white text-slate-600 border-slate-200"
                                }`}
                              >
                                {count}{unit}
                              </button>
                            ))}
                          </div>
                          <div className="bg-white rounded-lg px-3 py-2 border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-500">自动计算</span>
                              <span className="text-sm font-bold text-primary">
                                {formatScoreValue(fixedBaseScore)} × {instances}{unit} = {formatScoreValue(countScore)} 分
                              </span>
                            </div>
                            {countScoreLimit > countScore && (
                              <p className="text-[11px] text-slate-500">本扣分原因最多可扣 {formatScoreValue(countScoreLimit)} 分。</p>
                            )}
                            {rawTotal > item.maxScore && (
                              <p className="text-[11px] text-red-600">本指标扣分已超过满分，最终按 {item.maxScore} 分封顶。</p>
                            )}
                          </div>
                        </div>
                      )}

                      {opt.type === "fixed" && !countBased && (
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
            <Save className="w-4 h-4" />保存并返回
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

function P5Summary({ town, village, ftype, groups, entries, surveyEntries, scorePolicy, onBack, onSubmit, onEditItem, onEditSurvey }: {
  town: string; village: string; ftype: FacilityType;
  groups: L1Group[];
  entries: Record<string, ItemEntry>;
  surveyEntries: Record<string, SurveyFormEntry>;
  scorePolicy?: ScorePolicy;
  onBack: () => void;
  onSubmit: () => void;
  onEditItem: (itemId: string) => void;
  onEditSurvey: (cat: SurveyCategory, res: SurveyRespondent) => void;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const [showPhotoWarn, setShowPhotoWarn] = useState(false);

  const isSurvey = ftype === "survey";
  const allItems = applicableScoreItems(groups, scorePolicy);
  const calculated = calculatePolicyTypeScore(groups, entries, surveyEntries, scorePolicy, true);
  const total = calculated.maxScore;
  const deducted = calculated.rawDeduction;
  const current = calculated.currentScore;
  const doneCount = allItems.filter(i => {
    const derived = calcSurveyDerivedScore(i, findL2(groups, i.id), surveyEntries);
    return derived ? derived.completed : entries[i.id]?.done;
  }).length;
  const incompleteCount = allItems.filter(i => {
    const derived = calcSurveyDerivedScore(i, findL2(groups, i.id), surveyEntries);
    return derived ? !derived.completed : !entries[i.id]?.done;
  }).length;
  const missingPhotoCount = allItems.filter(item => {
    if (calcSurveyDerivedScore(item, findL2(groups, item.id), surveyEntries)) return false;
    const entry = entries[item.id];
    return entry?.options.some(optionEntry => {
      if (optionEntry.selection !== "standard" || optionEntry.photos.length > 0) return false;
      const option = item.options.find(candidate => candidate.id === optionEntry.optionId);
      return option ? calcOptionScore(optionEntry, option) > 0 : false;
    });
  }).length;
  const pendingCount = incompleteCount + missingPhotoCount;
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
      const derived = calcSurveyDerivedScore(item, findL2(groups, item.id), surveyEntries);
      if (derived) {
        if (!derived.completed) errs.push(`“${item.name}”：关联问卷尚未填写完整`);
        return;
      }
      const e = entries[item.id];
      if (!e?.done) {
        errs.push(`“${item.name}”：尚未检查，请确认无扣分或填写扣分情况`);
        return;
      }
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
                  <div className="text-3xl font-bold text-red-600">-{formatScoreValue(deducted)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{scorePolicy?.mode === "scaled_applicable" ? "原始扣分" : "已扣分"}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{formatScoreValue(current)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">当前得分</div>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${total > 0 ? (current / total) * 100 : 0}%` }} />
              </div>
              <div className="text-right text-xs text-muted-foreground mt-1">{total > 0 ? Math.round((current / total) * 100) : 0}%</div>
              {scorePolicy?.mode === "scaled_applicable" && (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{scorePolicy.description}</p>
              )}
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
                const l1Items = l1.children.flatMap(l2 => l2.items).filter(item => isApplicableItem(item, scorePolicy));
                const l1Total = l1Items.reduce((s, i) => s + i.maxScore, 0);
                const l1Ded = l1Items.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id, surveyEntries), 0);
                return (
                  <div key={l1.id} className="overflow-hidden rounded-xl border border-border">
                    <div className={`px-4 py-2.5 flex items-center justify-between ${ac.hdr}`}>
                      <span className="text-sm font-semibold text-white">{l1.icon} {l1.name}</span>
                      <span className="text-xs text-white/65">{l1Total > 0 ? `${formatScoreValue(l1Total - l1Ded)}/${l1Total}分` : "不适用"}</span>
                    </div>
                    <div className="bg-white divide-y divide-border">
                      {l1.children.flatMap(l2 => l2.items.map(item => ({ item, l2 }))).map(({ item, l2 }) => {
                        const applicable = isApplicableItem(item, scorePolicy);
                        const derived = calcSurveyDerivedScore(item, l2, surveyEntries);
                        const ded = derived?.deductedScore ?? calcEntryDeduction(entries, groups, item.id, surveyEntries);
                        const done = derived ? derived.completed : entries[item.id]?.done;
                        const score = done ? item.maxScore - ded : null;
                        return (
                          <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {!applicable && <span className="text-[10px] text-muted-foreground">不适用，不计入评分</span>}
                                {applicable && derived && !done && <span className="text-[10px] text-amber-600">待问卷回填</span>}
                                {applicable && derived && done && <span className="text-[10px] text-blue-600">问卷已回填</span>}
                                {applicable && !derived && !done && <span className="text-[10px] text-amber-600">待录入</span>}
                                {applicable && !derived && done && ded > 0 && <span className="text-[10px] text-red-600">扣{ded}分</span>}
                                {applicable && !derived && done && ded === 0 && <span className="text-[10px] text-green-600">无扣分</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {applicable ? (
                                <>
                                  <span className="text-sm font-bold text-foreground">{score ?? "—"}<span className="text-xs font-normal text-muted-foreground">/{item.maxScore}</span></span>
                                  <button
                                    onClick={() => onEditItem(item.id)}
                                    className="text-xs text-primary border border-primary px-2 py-0.5 rounded-lg shrink-0"
                                  >
                                    {derived ? "查看" : done ? "修改" : "填写"}
                                  </button>
                                </>
                              ) : <span className="text-xs text-muted-foreground">不计分</span>}
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
          <Package className="w-4 h-4" />提交当前已保存考核
        </button>
        <button onClick={onNextVillage} className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2">
          {isRural ? "继续录入下一项目点" : "继续录入其他考核对象"} <ChevronRight className="w-4 h-4" />
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
        <p className="text-xs text-white/55">共 {completedVillages.length} 个项目点 · 平均得分率 {avgPct}%</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-border p-3 text-center">
            <div className="text-xl font-bold text-foreground">{completedVillages.length}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">考核项目点</div>
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
            <span className="text-xs font-medium text-muted-foreground">各项目点得分</span>
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

function formatSubmittedSyncTime(value?: string): string {
  if (!value) return "时间未记录";
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "时间未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatSubmittedScore(value: number): string {
  return Number(value.toFixed(1)).toString();
}

function PSubmittedData({ projectName, cityId, cycleName, syncQueue, onBack, onRetrySync, onDiscardSync, onResolveConflict, onClearSubmittedData }: {
  projectName: string;
  cityId: string;
  cycleName: string;
  syncQueue: SyncQueueItem[];
  onBack: () => void;
  onRetrySync: () => Promise<void>;
  onDiscardSync: () => void;
  onResolveConflict: () => void;
  onClearSubmittedData: () => Promise<{ recordCount: number; reportCount: number }>;
}) {
  const [expandedTown, setExpandedTown] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const scopedQueue = syncQueue.filter(item => (!cityId || item.pkg.cityId === cityId) && item.pkg.period === cycleName);
  const displaySubmittedData = scopedQueue
    .filter(item => item.syncStatus === "synced")
    .reduce<Record<string, VillageRecord[]>>((result, item) => ({
      ...result,
      [item.pkg.town]: mergeVillageRecords(result[item.pkg.town] ?? [], item.pkg.villages),
    }), {});
  const towns = Object.keys(displaySubmittedData);
  const pendingItems = scopedQueue.filter(item => item.syncStatus !== "synced");
  const conflictItems = pendingItems.filter(item => item.syncStatus === "sync_conflict");
  const retryableItems = pendingItems.filter(item => item.syncStatus === "sync_failed" || item.syncStatus === "pending_sync");

  const clearSubmittedData = async () => {
    if (!window.confirm(`确定清空“${projectName} · ${cycleName}”的全部已提交数据吗？`)) return;
    if (!window.confirm("请再次确认：评分、问卷、水质、附件、复核记录和已生成报告都会删除，且无法恢复。")) return;
    setClearing(true);
    setClearError("");
    try {
      const result = await onClearSubmittedData();
      setExpandedTown(null);
      window.alert(`清空完成：已删除 ${result.recordCount} 条考核记录和 ${result.reportCount} 份报告。`);
    } catch (error) {
      setClearError(error instanceof Error ? error.message : "清空失败，请稍后重试");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <h1 className="text-xl font-semibold text-primary-foreground mb-0.5">已提交镇街数据</h1>
        <p className="text-xs text-primary-foreground/55">{projectName} · {cycleName}</p>
        <p className="text-xs text-primary-foreground/55 mt-0.5">共 {towns.length} 个镇街 · 待同步 {pendingItems.length} 个</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {conflictItems.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            <p className="font-semibold">检测到 {conflictItems.length} 条设备修改冲突</p>
            <p className="mt-1 leading-5">后台数据已由其他设备更新，系统已停止覆盖。采用后台最新数据后，可重新进入对应考核对象继续修改。</p>
            {conflictItems.map(item => (
              <p key={item.localId} className="mt-2 rounded-lg bg-white/70 px-3 py-2 leading-5">{item.town}：{item.lastError || "后台数据已更新"}</p>
            ))}
            <button onClick={onResolveConflict} className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2 font-semibold text-white">采用后台最新数据</button>
          </div>
        )}
        {retryableItems.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">还有数据包未同步到后台</p>
                <p className="mt-1">{retryableItems.filter(item => item.syncStatus === "sync_failed").length} 个失败，{retryableItems.filter(item => item.syncStatus === "pending_sync").length} 个等待</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={onDiscardSync} disabled={retrying} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-red-600 disabled:opacity-50">放弃</button>
                <button
                  onClick={async () => { setRetrying(true); try { await onRetrySync(); } finally { setRetrying(false); } }}
                  disabled={retrying}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-white disabled:opacity-50"
                >
                  {retrying ? "重试中..." : "重试"}
                </button>
              </div>
            </div>
          </div>
        )}
        {scopedQueue.filter(item => item.syncStatus === "synced").slice(0, 3).map(item => (
          <div key={item.localId} className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-700">
            {item.town} 已同步 · {formatSubmittedSyncTime(item.syncedAt ?? item.createdAt)}
          </div>
        ))}
        {towns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">暂无已提交数据</p>
            <p className="text-xs text-muted-foreground/70 mt-1">提交当前已保存考核后将在此显示</p>
          </div>
        )}

        {towns.map(townName => {
          const villages = displaySubmittedData[townName];
          const totalMax = villages.reduce((s, v) => s + v.maxScore, 0);
          const totalCurrent = villages.reduce((s, v) => s + v.currentScore, 0);
          const pct = totalMax > 0 ? Math.round(totalCurrent / totalMax * 100) : 0;
          const isOpen = expandedTown === townName;
          const projectCount = new Set(villages.map(record => record.primaryFacilityType ?? record.facilityType)).size;

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
                    <div className="text-xs text-muted-foreground mt-0.5">{projectCount} 个考核项目 · {villages.length} 条记录</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{formatSubmittedScore(totalCurrent)}<span className="text-xs font-normal text-muted-foreground">/{formatSubmittedScore(totalMax)}</span></div>
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
                    const projectType = v.primaryFacilityType;
                    const projectLabel = projectType ? PRIMARY_FACILITY_TYPE_INFO[projectType].label : v.facilityType;
                    const showVillage = projectType === "rural_treatment" && v.village && v.village !== projectLabel;
                    return (
                      <div key={i} className={`px-4 py-3 flex items-center justify-between ${i < villages.length - 1 ? "border-b border-border" : ""}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm text-foreground">{projectLabel}</div>
                            {showVillage && <div className="text-xs text-muted-foreground mt-0.5">{v.village}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${vPct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-foreground w-14 text-right">{formatSubmittedScore(v.currentScore)}/{formatSubmittedScore(v.maxScore)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div className="pt-3 pb-6">
          {clearError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{clearError}</div>
          )}
          <button
            onClick={clearSubmittedData}
            disabled={clearing}
            className="w-full rounded-xl border border-red-300 bg-white py-3 text-sm font-semibold text-red-600 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {clearing ? "正在清空..." : "清空当前项目和季度数据"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================

type Page = "portal" | "knowledge" | "city" | "cycle" | "town" | "village" | "facility_choice" | "facilitytype" | "criteria" | "detail" | "summary" | "success" | "towncomplete" | "survey_list" | "survey_form" | "water_quality" | "submitted_data";

function AssessmentApp() {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    return readStoredAuth<AuthState>();
  });
  const [page, setPage] = useState<Page>("portal");
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
  const [autoLoginChecked, setAutoLoginChecked] = useState(false);
  const [recordsRefreshRevision, setRecordsRefreshRevision] = useState(0);

  useEffect(() => {
    if (auth?.token) {
      setAutoLoginChecked(true);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE_URL}/auth/local-session`, { method: "POST" })
      .then(async response => {
        if (!response.ok) return null;
        return response.json() as Promise<AuthState>;
      })
      .then(nextAuth => {
        if (cancelled || !nextAuth?.token) return;
        saveStoredAuth(nextAuth, false);
        setAuth(nextAuth);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setAutoLoginChecked(true);
      });
    return () => { cancelled = true; };
  }, [auth?.token]);

  useEffect(() => {
    if (!auth?.token) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(response => {
        if (!cancelled && response.status === 401) {
          clearStoredAuth();
          setAuth(null);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [auth?.token]);

  useEffect(() => {
    let cancelled = false;

    async function loadStandards() {
      try {
        const type = standardTypeForPrimary(primaryFacilityType);
        const params = new URLSearchParams({ facility_type: primaryFacilityType });
        if (cityId) params.set("city_id", cityId);
        if (cycleId) params.set("cycle_id", cycleId);
        const response = await fetch(`${API_BASE_URL}/mobile/indicator-standards?${params.toString()}`, { headers: authHeaders() });
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
  useEffect(() => {
    if (!auth?.token || !cityId || !cycleName) return;
    let cancelled = false;
    const params = new URLSearchParams({ city_id: cityId, period: cycleName });
    if (cycleId) params.set("cycle_id", cycleId);
    fetch(`${API_BASE_URL}/mobile/assessment-records?${params.toString()}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`记录恢复失败：${response.status}`)))
      .then(data => {
        if (cancelled || !Array.isArray(data?.items)) return;
        const recordsByTown = new Map<string, VillageRecord[]>();
        const updatedAtByTown = new Map<string, string>();
        data.items.forEach((item: { id?: string; status: VillageRecord["backendStatus"]; editable?: boolean; town: string; updatedAt?: string; raw?: Partial<VillageRecord> }) => {
          if (!item.raw || !item.town) return;
          const record: VillageRecord = {
            village: item.raw.village ?? PRIMARY_FACILITY_TYPE_INFO[item.raw.primaryFacilityType ?? "rural_treatment"].label,
            facilityType: item.raw.facilityType ?? item.raw.primaryFacilityType ?? "rural_treatment",
            primaryFacilityType: item.raw.primaryFacilityType,
            standardFacilityType: item.raw.standardFacilityType,
            submittedAt: item.raw.submittedAt ?? item.updatedAt ?? new Date().toISOString(),
            maxScore: Number(item.raw.maxScore ?? 0),
            deductedScore: Number(item.raw.deductedScore ?? 0),
            currentScore: Number(item.raw.currentScore ?? 0),
            entries: item.raw.entries ?? {},
            surveyEntries: item.raw.surveyEntries ?? {},
            waterQuality: item.raw.waterQuality,
            backendStatus: item.status,
            editable: item.editable !== false,
            backendRecordId: item.id,
            serverUpdatedAt: item.updatedAt,
          };
          recordsByTown.set(item.town, mergeVillageRecords(recordsByTown.get(item.town) ?? [], [record]));
          if (item.updatedAt) updatedAtByTown.set(item.town, item.updatedAt);
        });
        setSyncQueue(prev => {
          const backendPrefix = `backend-${cityId}-${cycleId || cycleName}-`;
          const retained = prev.filter(item => !(
            item.syncStatus === "synced" &&
            item.pkg.cityId === cityId &&
            item.pkg.period === cycleName
          ) && !item.localId.startsWith(backendPrefix));
          const restored = Array.from(recordsByTown.entries()).map(([townName, records]): SyncQueueItem => ({
            localId: `${backendPrefix}${townName}`,
            town: townName,
            pkg: {
              schemaVersion: "1.0",
              exportedAt: updatedAtByTown.get(townName) ?? new Date().toISOString(),
              cityId,
              cycleId: cycleId || undefined,
              city,
              period: cycleName,
              town: townName,
              villages: records,
            },
            syncStatus: "synced",
            createdAt: updatedAtByTown.get(townName) ?? new Date().toISOString(),
            syncedAt: updatedAtByTown.get(townName),
          }));
          const nextQueue = [...retained, ...restored];
          setSubmittedData(submittedDataFromQueue(nextQueue));
          return nextQueue;
        });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [auth?.token, cityId, cycleId, cycleName, recordsRefreshRevision]);
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
  const standardGroups = standardTypeForPrimary(primaryFacilityType) === "treatment" ? TREATMENT : NETWORK;
  const scorePolicy = selectedTown?.scorePolicies?.[primaryFacilityType];
  const waterQualityScoreItem = findWaterQualityItem(standardGroups);
  const currentPolicyScore = calculatePolicyTypeScore(groups, entries, surveyEntries, scorePolicy);
  const syncedTownRecords = syncedRecordsForTown(syncQueue, town, cityId, cycleName);
  const completedPrimaryTypes = new Set<PrimaryFacilityType>(
    [...syncedTownRecords, ...completedVillages]
      .map(record => record.primaryFacilityType)
      .filter((type): type is PrimaryFacilityType => PRIMARY_FACILITY_TYPES.includes(type as PrimaryFacilityType)),
  );
  const readonlyPrimaryTypes = new Map<PrimaryFacilityType, string>();
  [...syncedTownRecords, ...completedVillages].forEach(record => {
    const type = record.primaryFacilityType;
    if (!type || !PRIMARY_FACILITY_TYPES.includes(type)) return;
    if (record.backendStatus === "locked") readonlyPrimaryTypes.set(type, "已锁定");
    else if (record.backendStatus === "reviewed" || record.editable === false) readonlyPrimaryTypes.set(type, "已审核");
  });

  const saveEntry = (e: ItemEntry) => setEntries(prev => ({ ...prev, [e.itemId]: e }));

  const loadSavedRecord = (record: VillageRecord, type: PrimaryFacilityType) => {
    const standardType = standardTypeForPrimary(type);
    const restoredSurveyEntries = record.surveyEntries ?? {};
    const restoredWaterQuality = record.waterQuality ?? emptyWaterQualityEntry(type);
    const surveyCompleted = Object.values(restoredSurveyEntries).some(entry => entry.completed);
    const restoredProgress: Partial<Record<FacilityType, boolean>> = {
      [standardType]: true,
      survey: surveyCompleted,
      water_quality: !!restoredWaterQuality.completed,
    };
    const restoredScores: Partial<Record<FacilityType, TypeScore>> = {
      [standardType]: {
        maxScore: record.maxScore,
        currentScore: record.currentScore,
        deductedScore: record.deductedScore,
      },
    };
    if (surveyCompleted) restoredScores.survey = { maxScore: 0, currentScore: 0, deductedScore: 0 };
    if (restoredWaterQuality.completed) restoredScores.water_quality = { maxScore: 0, currentScore: 0, deductedScore: 0 };
    setPrimaryFacilityType(type);
    setFtype(standardType);
    setEntries(record.entries ?? {});
    setSurveyEntries(restoredSurveyEntries);
    setWaterQuality(restoredWaterQuality);
    setTypeProgress(restoredProgress);
    setScoreByType(restoredScores);
    setDetailId("");
    setCompletedVillages(prev => mergeVillageRecords(prev, [record]));
  };

  // Called from P5Summary — saves this type's score, marks done, returns to hub
  const handleSubmit = () => {
    const typeScore: TypeScore = ftype === "survey"
      ? calcSurveyTypeScore(surveyEntries)
      : currentPolicyScore;
    setScoreByType(prev => ({ ...prev, [ftype]: typeScore }));
    setTypeProgress(prev => ({ ...prev, [ftype]: true }));
    setPage("facilitytype");
  };

  // Called from the hub after the selected facility, survey, and water-quality records are completed.
  const handleVillageSubmit = () => {
    const scoringType = standardTypeForPrimary(primaryFacilityType);
    const refreshedScore = calculatePolicyTypeScore(standardGroups, entries, surveyEntries, scorePolicy);
    const refreshedScores = { ...scoreByType, [scoringType]: refreshedScore };
    const combinedScores = Object.values(refreshedScores);
    const combinedMax = combinedScores.reduce((s, v) => s + v.maxScore, 0);
    const combinedCurrent = roundScoreValue(combinedScores.reduce((s, v) => s + v.currentScore, 0));
    const combinedDeducted = roundScoreValue(combinedScores.reduce((s, v) => s + v.deductedScore, 0));
    const savedRecord = completedVillages.find(item =>
      item.village === village && item.primaryFacilityType === primaryFacilityType
    );
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
      backendRecordId: savedRecord?.backendRecordId,
      serverUpdatedAt: savedRecord?.serverUpdatedAt,
      backendStatus: savedRecord?.backendStatus,
      editable: savedRecord?.editable,
    };
    setScoreByType(refreshedScores);
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
    period: cycleName || cycleNameFromParts(currentCycleParts().year, currentCycleParts().periodId),
    town,
    villages: completedVillages,
  });

  const markPackageSynced = (pkg: TownPackage) => {
    const syncedAt = new Date().toISOString();
    setSubmittedData(prev => ({
      ...prev,
      [pkg.town]: mergeVillageRecords(prev[pkg.town] ?? [], pkg.villages),
    }));
    setSyncQueue(prev => {
      const existing = prev.find(item => item.pkg.exportedAt === pkg.exportedAt);
      if (!existing) {
        return [...prev, {
          localId: makeLocalId(),
          town: pkg.town,
          pkg,
          syncStatus: "synced",
          createdAt: syncedAt,
          syncedAt,
        }];
      }
      return prev.map(item => item.localId === existing.localId
        ? { ...item, pkg, syncStatus: "synced", syncedAt, lastError: undefined }
        : item);
    });
  };
  const queuePackage = (pkg: TownPackage, error: unknown) => {
    const message = error instanceof Error ? error.message : "同步失败";
    const syncStatus: SyncQueueItem["syncStatus"] = error instanceof SyncConflictError ? "sync_conflict" : "sync_failed";
    setSyncQueue(prev => {
      const existing = prev.find(item => item.pkg.exportedAt === pkg.exportedAt);
      if (existing) {
        return prev.map(item => item.localId === existing.localId
          ? { ...item, syncStatus, lastError: message }
          : item);
      }
      return [...prev, {
        localId: makeLocalId(),
        town: pkg.town,
        pkg,
        syncStatus,
        createdAt: new Date().toISOString(),
        lastError: message,
      }];
    });
  };

  const retrySyncItems = async (pending: SyncQueueItem[]) => {
    if (!auth?.token) return;
    if (!pending.length) return;
    setSubmitError("");
    for (const item of pending.filter(current => current.syncStatus !== "sync_conflict" && current.syncStatus !== "synced")) {
      setSyncQueue(prev => prev.map(current => current.localId === item.localId ? { ...current, syncStatus: "pending_sync", lastError: undefined } : current));
      try {
        const syncedPackage = await submitTownPackageToBackend(item.pkg, auth.token);
        markPackageSynced(syncedPackage);
      } catch (error) {
        if (error instanceof Error && error.message.includes("401")) {
          clearStoredAuth();
          setAuth(null);
          setSubmitError("登录状态已失效，请重新登录后继续同步。");
          break;
        }
        queuePackage(item.pkg, error);
        setSubmitError(error instanceof SyncConflictError
          ? "检测到其他设备的更新，未覆盖后台数据。请在已提交数据中处理修改冲突。"
          : "仍有数据包同步失败，稍后可继续重试。");
      }
    }
  };

  const retryPendingSync = async () => {
    await retrySyncItems(syncQueue.filter(item => item.syncStatus === "pending_sync" || item.syncStatus === "sync_failed"));
  };

  const retryCurrentSubmittedSync = async () => {
    await retrySyncItems(syncQueue.filter(item =>
      (item.syncStatus === "pending_sync" || item.syncStatus === "sync_failed")
      && (!cityId || item.pkg.cityId === cityId)
      && item.pkg.period === cycleName
    ));
  };

  const discardPendingSync = () => {
    if (!window.confirm("确定放弃所有同步失败和等待同步的数据包吗？此操作无法撤销。")) return;
    setSyncQueue(prev => prev.filter(item => item.syncStatus === "synced" || item.syncStatus === "sync_conflict"));
    setSubmitError("");
  };

  const discardCurrentPendingSync = () => {
    if (!window.confirm(`确定放弃“${city} · ${cycleName}”尚未同步的数据包吗？此操作无法撤销。`)) return;
    setSyncQueue(prev => prev.filter(item => !(
      (item.syncStatus === "pending_sync" || item.syncStatus === "sync_failed")
      && (!cityId || item.pkg.cityId === cityId)
      && item.pkg.period === cycleName
    )));
    setSubmitError("");
  };

  const resolveCurrentSyncConflicts = () => {
    const conflicts = syncQueue.filter(item =>
      item.syncStatus === "sync_conflict"
      && (!cityId || item.pkg.cityId === cityId)
      && item.pkg.period === cycleName
    );
    if (!conflicts.length) return;
    if (!window.confirm("确定采用后台最新数据吗？本机中与后台冲突的未同步修改将被放弃。")) return;
    setSyncQueue(prev => prev.filter(item => !(
      item.syncStatus === "sync_conflict"
      && (!cityId || item.pkg.cityId === cityId)
      && item.pkg.period === cycleName
    )));
    setSubmitError("");
    setRecordsRefreshRevision(value => value + 1);
  };

  const clearCurrentSubmittedData = async (): Promise<{ recordCount: number; reportCount: number }> => {
    if (!auth?.token || !cityId || !cycleName) throw new Error("请先选择项目和考核季度");
    const params = new URLSearchParams({ city_id: cityId, period: cycleName });
    if (cycleId) params.set("cycle_id", cycleId);
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/mobile/assessment-records?${params.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.token}` },
      });
    } catch {
      throw new Error("清空失败：无法连接后端服务。解决方法：关闭系统后重新点击“点我启动”，等待两个页面都打开后再试。");
    }
    if (!response.ok) {
      let backendReason = "";
      try {
        const body = await response.json();
        backendReason = typeof body?.detail === "string" ? body.detail : "";
      } catch {
        backendReason = "";
      }
      if (response.status === 401) {
        throw new Error("清空失败：登录状态已经失效。解决方法：退出当前页面并重新登录，然后再次清空。");
      }
      if (response.status === 403) {
        throw new Error("清空失败：当前账号没有删除权限。解决方法：使用管理员账号登录后再试。");
      }
      if (response.status === 404) {
        throw new Error(`清空失败：${backendReason || "没有找到当前项目或季度数据"}。解决方法：返回上一级，重新选择项目和考核季度。`);
      }
      if (response.status === 405) {
        throw new Error("清空失败：正在运行的后端版本尚未更新。解决方法：先点击“停止服务”，再重新点击“点我启动”，然后重试。");
      }
      if (response.status === 409) {
        throw new Error(`清空失败：${backendReason || "当前数据已复核或锁定"}。解决方法：请联系管理员将相关记录退回后再清空。`);
      }
      if (response.status === 422) {
        throw new Error(`清空失败：${backendReason || "当前项目与考核季度不匹配"}。解决方法：返回上一级，重新选择正确的项目和季度。`);
      }
      if (response.status >= 500) {
        throw new Error(`清空失败：${backendReason || "后端处理数据时发生异常"}。解决方法：重新启动系统后再试；如果仍然失败，请保留当前项目和季度信息交给技术人员检查。`);
      }
      throw new Error(`清空失败：${backendReason || "服务器拒绝了本次操作"}。解决方法：刷新页面并重新登录后再试。`);
    }
    const result = await response.json();
    const remainingQueue = syncQueue.filter(item => !(
      (!cityId || item.pkg.cityId === cityId) && item.pkg.period === cycleName
    ));
    setSyncQueue(remainingQueue);
    setSubmittedData(submittedDataFromQueue(remainingQueue));
    setCompletedVillages([]);
    setTown("");
    setSelectedTown(null);
    setVillage("");
    setEntries({});
    setSurveyEntries({});
    setWaterQuality(emptyWaterQualityEntry());
    setTypeProgress({});
    setScoreByType({});
    setSubmitError("");
    return { recordCount: Number(result.recordCount || 0), reportCount: Number(result.reportCount || 0) };
  };

  useEffect(() => {
    if (!auth?.token) return;
    const pending = syncQueue.filter(item => item.syncStatus === "pending_sync");
    if (!pending.length) return;
    let cancelled = false;
    async function syncPending() {
      for (const item of pending) {
        try {
          const syncedPackage = await submitTownPackageToBackend(item.pkg, auth.token);
          if (cancelled) return;
          markPackageSynced(syncedPackage);
        } catch (error) {
          if (cancelled) return;
          queuePackage(item.pkg, error);
        }
      }
    }
    syncPending();
    return () => { cancelled = true; };
  }, [auth?.token, syncQueue.length]);

  useEffect(() => {
    const retry = () => { void retryPendingSync(); };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [auth?.token, syncQueue.length]);

  const renderFieldPage = () => {
    switch (page) {
      case "portal":
        return <PPortal onField={() => setPage("city")} onKnowledge={() => setPage("knowledge")} />;
      case "knowledge":
        return <PKnowledge onBack={() => setPage("portal")} />;
      case "city":
        return (
          <P0City
            onBack={() => setPage("portal")}
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
            cycleName={cycleName}
            onBack={() => setPage("cycle")}
            onNext={t => {
              setTown(t.name);
              setSelectedTown(t);
              setVillage("");
              setCompletedVillages(syncedRecordsForTown(syncQueue, t.name, cityId, cycleName));
              setWaterQuality(emptyWaterQualityEntry(primaryFacilityType));
              setTypeProgress({});
              setScoreByType({});
              setPage("facility_choice");
            }}
            submittedData={submittedData}
            syncQueue={syncQueue}
            onViewSubmitted={() => setPage("submitted_data")}
            onRetrySync={retryPendingSync}
            onDiscardSync={discardPendingSync}
          />
        );
      case "village":
        return (
          <P2Village
            town={town}
            cityId={cityId || undefined}
            completedVillages={new Set(completedVillages.filter(record => record.primaryFacilityType === "rural_treatment").map(record => record.village))}
            readonlyVillages={new Map(completedVillages
              .filter(record => record.primaryFacilityType === "rural_treatment" && (record.backendStatus === "locked" || record.backendStatus === "reviewed" || record.editable === false))
              .map(record => [record.village, record.backendStatus === "locked" ? "已锁定" : "已审核"]))}
            onBack={() => setPage("facility_choice")}
            onNext={v => {
              setVillage(v);
              const savedRecord = completedVillages.find(record => record.primaryFacilityType === "rural_treatment" && record.village === v);
              if (savedRecord) {
                loadSavedRecord(savedRecord, "rural_treatment");
              } else {
                setPrimaryFacilityType("rural_treatment");
                setFtype("treatment");
                setEntries({});
                setSurveyEntries({});
                setWaterQuality(emptyWaterQualityEntry("rural_treatment"));
                setTypeProgress({});
                setScoreByType({});
              }
              setPage("facilitytype");
            }}
          />
        );
      case "facility_choice":
        return (
          <P2bFacilityChoice
            town={town}
            allowedTargets={selectedTown?.assessmentTargets ?? []}
            completedTypes={completedPrimaryTypes}
            readonlyTypes={readonlyPrimaryTypes}
            onBack={() => setPage("town")}
            onSelect={type => {
              if (type === "rural_treatment") {
                setPrimaryFacilityType(type);
                setFtype(standardTypeForPrimary(type));
                setEntries({});
                setSurveyEntries({});
                setWaterQuality(emptyWaterQualityEntry(type));
                setTypeProgress({});
                setScoreByType({});
                setVillage("");
                setPage("village");
              } else {
                setVillage(PRIMARY_FACILITY_TYPE_INFO[type].label);
                const savedRecord = completedVillages.find(record => record.primaryFacilityType === type);
                if (savedRecord) {
                  loadSavedRecord(savedRecord, type);
                } else {
                  setPrimaryFacilityType(type);
                  setFtype(standardTypeForPrimary(type));
                  setEntries({});
                  setSurveyEntries({});
                  setWaterQuality(emptyWaterQualityEntry(type));
                  setTypeProgress({});
                  setScoreByType({});
                }
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
            hasWaterQualityItem={!!waterQualityScoreItem}
            typeProgress={typeProgress}
            onBack={() => setPage(primaryFacilityType === "rural_treatment" ? "village" : "facility_choice")}
            onEnter={t => {
              setFtype(t);
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
            scorePolicy={scorePolicy}
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
            scorePolicy={scorePolicy}
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
                if (!auth?.token) throw new Error("登录状态已失效，请重新登录");
                const syncedPackage = await submitTownPackageToBackend(pkg, auth.token);
                markPackageSynced(syncedPackage);
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
                setSubmitError(error instanceof SyncConflictError
                  ? "后台记录已被其他设备修改，本次保存没有覆盖后台数据。请到“已提交镇街数据”处理修改冲突。"
                  : "提交失败，数据已离线暂存；后端恢复或重新登录后会自动重试。");
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
            projectName={city}
            primaryFacilityType={primaryFacilityType}
            entry={waterQuality}
            onBack={() => setPage("facilitytype")}
            onSave={entry => {
              setWaterQuality(entry);
              if (waterQualityScoreItem) {
                const updatedEntries = {
                  ...entries,
                  [waterQualityScoreItem.id]: waterQualityItemEntry(waterQualityScoreItem, entry),
                };
                const standardType = standardTypeForPrimary(primaryFacilityType);
                const updatedScore = calculatePolicyTypeScore(standardGroups, updatedEntries, surveyEntries, scorePolicy);
                setEntries(updatedEntries);
                setScoreByType(prev => ({
                  ...prev,
                  [standardType]: updatedScore,
                }));
              }
              setTypeProgress(prev => ({ ...prev, water_quality: entry.completed }));
              setScoreByType(prev => ({ ...prev, water_quality: { maxScore: 0, currentScore: 0, deductedScore: 0 } }));
              setPage("facilitytype");
            }}
          />
        );
      case "submitted_data":
        return (
          <PSubmittedData
            projectName={city}
            cityId={cityId}
            cycleName={cycleName}
            syncQueue={syncQueue}
            onBack={() => setPage("town")}
            onRetrySync={retryCurrentSubmittedSync}
            onDiscardSync={discardCurrentPendingSync}
            onResolveConflict={resolveCurrentSyncConflicts}
            onClearSubmittedData={clearCurrentSubmittedData}
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
        <div className="absolute inset-0">
          {auth ? renderFieldPage() : autoLoginChecked ? <MobileLoginPage onLogin={setAuth} /> : (
            <div className="h-full flex items-center justify-center bg-background text-sm text-muted-foreground">正在进入系统...</div>
          )}
        </div>
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

export default function App() {
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    discoverApiBaseUrl().then(baseUrl => {
      if (cancelled) return;
      API_BASE_URL = baseUrl;
      setBackendReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!backendReady) {
    return <div className="h-screen w-screen flex items-center justify-center bg-background text-sm text-muted-foreground">正在连接后端服务...</div>;
  }
  return <AssessmentApp />;
}
