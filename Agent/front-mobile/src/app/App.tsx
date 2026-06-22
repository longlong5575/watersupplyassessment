import { useState, useRef } from "react";
import {
  ChevronRight, ChevronLeft, Search, Camera, X, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp, Save, Send,
  Plus, Minus, MapPin, Building2, BarChart3,
  AlertTriangle, Info, Check, Package,
} from "lucide-react";

// ==================== TYPES ====================

type FacilityType = "treatment" | "network";
type DeductionType = "fixed" | "range" | "severity";
type EntryStatus = "pending" | "no_deduction" | "has_deduction" | "incomplete";
type SelectionType = "no_deduction" | "standard" | "custom";

interface DeductionOption {
  id: string;
  reason: string;
  type: DeductionType;
  value?: number;
  min?: number;
  max?: number;
  unit?: string;
  maxInstances?: number;
}

interface L3Item {
  id: string;
  name: string;
  maxScore: number;
  description: string;
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

interface VillageRecord {
  village: string;
  facilityType: FacilityType;
  submittedAt: string;
  maxScore: number;
  deductedScore: number;
  currentScore: number;
  entries: Record<string, ItemEntry>;
}

interface TownPackage {
  schemaVersion: "1.0";
  exportedAt: string;
  city: string;
  town: string;
  villages: VillageRecord[];
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

// ==================== SCORING DATA ====================

const TREATMENT: L1Group[] = [
  {
    id: "output", name: "产出", icon: "📊",
    children: [{
      id: "g_coll", name: "污水收集",
      items: [{
        id: "sewage_collection", name: "污水收集", maxScore: 8,
        description: "检查污水收集管网及检查井完好情况，确保污水有效收集，无明显跑冒滴漏现象",
        options: [
          { id: "silt", reason: "检查井内有明显沉泥、浮渣、较多垃圾", type: "fixed", value: 1, unit: "处", maxInstances: 3 },
          { id: "cover", reason: "井盖缺失、打不开、挤压、破损或占用", type: "fixed", value: 1, unit: "处", maxInstances: 3 },
          { id: "pipe_leak", reason: "管网存在渗漏、破损、堵塞", type: "range", min: 1, max: 2 },
          { id: "no_connect", reason: "污水未接入管网或存在私接雨水情况", type: "range", min: 1, max: 3 },
        ],
      }],
    }],
  },
  {
    id: "effect", name: "效果", icon: "✅",
    children: [
      {
        id: "g_overall", name: "整体效果",
        items: [{
          id: "overall_effect", name: "整体效果", maxScore: 6,
          description: "检查设施点周边环境及水体感官效果，评估整体运维质量",
          options: [
            { id: "waste_odor", reason: "设施点范围内有杂物、垃圾堆积、污水或恶臭", type: "range", min: 1, max: 3 },
            { id: "algae", reason: "水体环境较差或存在较多藻类", type: "range", min: 1, max: 3 },
            { id: "discharge", reason: "出水口有明显污水直排或散排", type: "fixed", value: 3 },
          ],
        }],
      },
      {
        id: "g_quality", name: "污水处理质量",
        items: [{
          id: "effluent_quality", name: "污水处理质量", maxScore: 10,
          description: "检查出水水质是否达到相应排放标准，设施运行是否正常",
          options: [
            { id: "quality_fail", reason: "出水水质不达标（单项指标超标）", type: "range", min: 3, max: 5 },
            { id: "shutdown", reason: "处理设施停运（情况严重的扣5分）", type: "severity", value: 3 },
            { id: "no_treatment", reason: "污水未经处理直接排放", type: "fixed", value: 10 },
          ],
        }],
      },
    ],
  },
  {
    id: "management", name: "管理", icon: "📋",
    children: [
      {
        id: "g_facility", name: "设施管理",
        items: [
          {
            id: "env_hygiene", name: "设施点环境卫生", maxScore: 5,
            description: "检查设施点内外环境整洁情况及绿化维护",
            options: [
              { id: "env_waste", reason: "设施点范围内有杂物堆积、垃圾未及时清理", type: "fixed", value: 1, unit: "处", maxInstances: 3 },
              { id: "not_clean", reason: "设施设备表面积垢严重、长期未清洗", type: "range", min: 1, max: 2 },
              { id: "pest", reason: "存在蚊蝇孳生、鼠患等卫生问题", type: "range", min: 1, max: 2 },
            ],
          },
          {
            id: "mechanical", name: "机电设备", maxScore: 8,
            description: "检查机电设备运行状态、维护保养及备品备件情况",
            options: [
              { id: "equip_stop", reason: "机电设备未正常运行（非计划停机）", type: "range", min: 2, max: 4 },
              { id: "instrument", reason: "仪表设备损坏未修复", type: "fixed", value: 1, unit: "处", maxInstances: 3 },
              { id: "no_maint", reason: "设备无维护保养记录或保养不到位", type: "range", min: 1, max: 2 },
            ],
          },
        ],
      },
      {
        id: "g_safety", name: "安全管理",
        items: [{
          id: "safety_mgmt", name: "安全管理", maxScore: 5,
          description: "检查安全警示标识、防护设施及应急预案完备情况",
          options: [
            { id: "no_sign", reason: "未设置安全警示标识或标识不清晰、破损", type: "fixed", value: 1 },
            { id: "no_protect", reason: "安全防护设施缺失或损坏（护栏、盖板等）", type: "range", min: 1, max: 3 },
            { id: "no_emergency", reason: "无应急预案或应急设备缺失", type: "range", min: 1, max: 2 },
          ],
        }],
      },
      {
        id: "g_archive", name: "档案管理",
        items: [{
          id: "archives", name: "档案管理", maxScore: 5,
          description: "检查运维档案、巡查记录及维修记录完整性规范性",
          options: [
            { id: "no_records", reason: "未提供设施日常巡查、定期检查记录、维修记录", type: "range", min: 1, max: 3 },
            { id: "incomplete", reason: "台账不完整或填写不规范", type: "range", min: 1, max: 2 },
            { id: "no_report", reason: "未按要求提交运维月报/季报", type: "fixed", value: 1 },
          ],
        }],
      },
    ],
  },
];

const NETWORK: L1Group[] = [
  {
    id: "output", name: "产出", icon: "📊",
    children: [{
      id: "g_net_cond", name: "管网状况",
      items: [{
        id: "inspection_wells", name: "检查井/截流井", maxScore: 8,
        description: "检查检查井及截流井完好状态与运行情况，确保管网正常运行",
        options: [
          { id: "well_silt", reason: "检查井内有明显沉泥、浮渣、较多垃圾", type: "fixed", value: 1, unit: "处", maxInstances: 3 },
          { id: "cover_net", reason: "井盖缺失、打不开、挤压、破损或占用", type: "fixed", value: 1, unit: "处", maxInstances: 3 },
          { id: "overflow", reason: "截流井存在溢流或堵塞现象", type: "range", min: 2, max: 4 },
        ],
      }],
    }],
  },
  {
    id: "effect", name: "效果", icon: "✅",
    children: [{
      id: "g_net_eff", name: "接入效果",
      items: [{
        id: "connection_effect", name: "整体效果", maxScore: 6,
        description: "检查污水接入率及管网运行整体效果",
        options: [
          { id: "low_rate", reason: "管网接户率低于设计要求", type: "range", min: 1, max: 3 },
          { id: "pipe_leak_net", reason: "管道存在明显渗漏、破损现象", type: "range", min: 1, max: 3 },
          { id: "rain_mix", reason: "雨污混接问题未得到整改", type: "range", min: 1, max: 3 },
        ],
      }],
    }],
  },
  {
    id: "management", name: "管理", icon: "📋",
    children: [{
      id: "g_daily", name: "日常管理",
      items: [
        {
          id: "net_safety", name: "安全管理", maxScore: 5,
          description: "检查管网日常巡查及安全管理情况",
          options: [
            { id: "no_patrol", reason: "未按规定频率开展管网巡查", type: "range", min: 1, max: 2 },
            { id: "no_safety_net", reason: "危险路段未设置安全标识或防护设施", type: "fixed", value: 1 },
            { id: "no_response", reason: "发现问题未及时处理或上报", type: "range", min: 1, max: 2 },
          ],
        },
        {
          id: "net_archives", name: "档案管理", maxScore: 5,
          description: "检查管网档案及运维记录完整性",
          options: [
            { id: "no_net_rec", reason: "未提供管网巡查、维修记录", type: "range", min: 1, max: 3 },
            { id: "incomplete_net", reason: "台账记录不完整或不规范", type: "range", min: 1, max: 2 },
          ],
        },
      ],
    }],
  },
];

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

function calcItemRaw(entry: ItemEntry, item: L3Item): number {
  return entry.options.reduce((sum, oe) => {
    const opt = item.options.find(o => o.id === oe.optionId);
    return sum + (opt ? calcOptionScore(oe, opt) : 0);
  }, 0);
}

function calcEntryDeduction(entries: Record<string, ItemEntry>, groups: L1Group[], itemId: string): number {
  const entry = entries[itemId];
  const item = findItem(groups, itemId);
  if (!entry || !item) return 0;
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

function P0City({ onNext }: { onNext: (c: string) => void }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const cities = [
    { name: "阳江市", sub: "广东省" },
    { name: "茂名市", sub: "广东省" },
    { name: "湛江市", sub: "广东省" },
    { name: "江门市", sub: "广东省" },
    { name: "清远市", sub: "广东省" },
    { name: "韶关市", sub: "广东省" },
  ];
  const filtered = val.trim()
    ? cities.filter(c => c.name.includes(val.trim()))
    : cities;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <div className="flex items-center gap-1.5 mb-1 mt-1">
          <MapPin className="w-3.5 h-3.5 text-primary-foreground/55" />
          <span className="text-xs text-primary-foreground/55 tracking-wide">农村污水PPP现场考核</span>
        </div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择考核城市</h1>
        <p className="text-xs text-primary-foreground/55 mt-1">请先选择本次考核所在地级市</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">城市名称</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={val}
              onChange={e => { setVal(e.target.value); setErr(""); }}
              placeholder="请输入城市名称"
              className="w-full pl-9 pr-9 py-3 bg-white border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {val && (
              <button onClick={() => setVal("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {err && (
            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{err}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {val.trim() ? "搜索结果" : "常用城市"}
          </p>
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">未找到匹配城市</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(c => (
                <button
                  key={c.name}
                  onClick={() => setVal(c.name)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors text-left ${
                    val === c.name ? "bg-primary/5 border-primary" : "bg-white border-border"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${val === c.name ? "bg-primary" : "bg-muted"}`}>
                    <MapPin className={`w-4 h-4 ${val === c.name ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${val === c.name ? "text-primary" : "text-foreground"}`}>{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={() => { if (!val.trim()) { setErr("请先选择或输入城市名称"); return; } onNext(val.trim()); }}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 1: TOWN ====================

function P1Town({ city, onBack, onNext }: { city: string; onBack: () => void; onNext: (t: string) => void }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const towns = ["北陡镇", "白沙镇", "大江镇", "赤溪镇", "那琴镇", "沙塘镇"];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="flex items-center gap-1.5 mb-1">
          <MapPin className="w-3.5 h-3.5 text-primary-foreground/55" />
          <span className="text-xs text-primary-foreground/55 tracking-wide">{city}</span>
        </div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择考核镇街</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">镇街名称</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={val}
              onChange={e => { setVal(e.target.value); setErr(""); }}
              placeholder="请输入镇名"
              className="w-full pl-9 pr-9 py-3 bg-white border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {val && (
              <button onClick={() => setVal("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {err && (
            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{err}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">最近使用镇街</p>
          <div className="space-y-2">
            {towns.map(t => (
              <button
                key={t}
                onClick={() => { setVal(t); setErr(""); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  val === t ? "bg-primary/5 border-primary" : "bg-white border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${val === t ? "bg-primary" : "bg-muted"}`}>
                    <MapPin className={`w-4 h-4 ${val === t ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-sm font-medium ${val === t ? "text-primary" : "text-foreground"}`}>{t}</span>
                </div>
                {val === t && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={() => { if (!val.trim()) { setErr("请先输入镇名"); return; } onNext(val.trim()); }}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 2: VILLAGE ====================

function P2Village({ city, town, onBack, onNext }: {
  city: string;
  town: string;
  onBack: () => void;
  onNext: (v: string) => void;
}) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const villages = ["大步头村", "禾塘村", "合益村", "那廖村", "那黎村", "滘尾村"];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="flex items-center gap-1.5 mb-1">
          <Building2 className="w-3.5 h-3.5 text-primary-foreground/55" />
          <span className="text-xs text-primary-foreground/55">{city} · {town}</span>
        </div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择考核村点</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">村点名称</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={val}
              onChange={e => { setVal(e.target.value); setErr(""); }}
              placeholder="请输入村名或设施点名称"
              className="w-full pl-9 pr-9 py-3 bg-white border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {val && (
              <button onClick={() => setVal("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          {err && (
            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{err}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">最近录入村点</p>
          <div className="space-y-2">
            {villages.map(v => (
              <button
                key={v}
                onClick={() => { setVal(v); setErr(""); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                  val === v ? "bg-primary/5 border-primary" : "bg-white border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${val === v ? "bg-primary" : "bg-muted"}`}>
                    <Building2 className={`w-4 h-4 ${val === v ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-sm font-medium ${val === v ? "text-primary" : "text-foreground"}`}>{v}</span>
                </div>
                {val === v && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={() => { if (!val.trim()) { setErr("请先输入村名或设施点名称"); return; } onNext(val.trim()); }}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          下一步 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 2b: FACILITY TYPE ====================

function P2bFacilityType({ city, town, village, onBack, onNext }: {
  city: string; town: string; village: string;
  onBack: () => void;
  onNext: (t: FacilityType) => void;
}) {
  const [ftype, setFtype] = useState<FacilityType>("treatment");

  const options = [
    {
      v: "treatment" as FacilityType,
      label: "污水处理设施",
      sub: "含处理设备及附属构筑物",
      detail: "适用于建有独立污水处理设施的村点，包括一体化设备、人工湿地、氧化塘等",
      icon: "🏭",
    },
    {
      v: "network" as FacilityType,
      label: "纳厂/管网设施",
      sub: "接入已建处理设施",
      detail: "适用于污水通过管网收集后接入集中处理厂或已建处理设施的村点",
      icon: "🔧",
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-6 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="flex items-center gap-1.5 mb-1">
          <Building2 className="w-3.5 h-3.5 text-primary-foreground/55" />
          <span className="text-xs text-primary-foreground/55">{city} · {town} · {village}</span>
        </div>
        <h1 className="text-xl font-semibold text-primary-foreground">选择考核标准类型</h1>
        <p className="text-xs text-primary-foreground/55 mt-1">根据该村点设施实际情况选择对应标准</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {options.map(opt => (
          <button
            key={opt.v}
            onClick={() => setFtype(opt.v)}
            className={`w-full text-left rounded-xl border-2 p-4 transition-colors ${
              ftype === opt.v
                ? "border-primary bg-primary/5"
                : "border-border bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${ftype === opt.v ? "bg-primary/10" : "bg-muted"}`}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-sm font-semibold ${ftype === opt.v ? "text-primary" : "text-foreground"}`}>{opt.label}</span>
                  {ftype === opt.v && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <p className={`text-xs font-medium mb-1.5 ${ftype === opt.v ? "text-primary/70" : "text-muted-foreground"}`}>{opt.sub}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{opt.detail}</p>
              </div>
            </div>
          </button>
        ))}

        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 flex gap-2 mt-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            考核标准类型决定后续评分指标体系，选错将影响考核结果，请根据现场实际设施类型确认后选择。
          </p>
        </div>
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white shrink-0">
        <button
          onClick={() => onNext(ftype)}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          进入评分标准 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== PAGE 3: CRITERIA LIST ====================

function P3Criteria({ city, town, village, ftype, groups, entries, onBack, onSelect, onSummary }: {
  city: string; town: string; village: string; ftype: FacilityType;
  groups: L1Group[];
  entries: Record<string, ItemEntry>;
  onBack: () => void;
  onSelect: (id: string) => void;
  onSummary: () => void;
}) {
  const allItems = getAllItems(groups);
  const total = totalMaxScore(groups);
  const deducted = allItems.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id), 0);
  const current = total - deducted;
  const doneCount = allItems.filter(i => entries[i.id]?.done).length;

  const l1BgColors = ["bg-[#1a3a52]", "bg-[#1a4a38]", "bg-[#3a1a52]"];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-primary-foreground/55 mb-0.5">{city} · {town} · {village}</div>
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
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {groups.map((l1, li) => {
          const l1Items = l1.children.flatMap(l2 => l2.items);
          const l1Total = l1Items.reduce((s, i) => s + i.maxScore, 0);
          const l1Ded = l1Items.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id), 0);

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
                    const ded = calcEntryDeduction(entries, groups, item.id);
                    const status = getStatus(entries[item.id]);
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        className={`w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-gray-50 ${ii < l2.items.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm font-medium text-foreground mb-1">{item.name}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusTag status={status} />
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

function P4Detail({ itemId, groups, entries, onBack, onSave }: {
  itemId: string;
  groups: L1Group[];
  entries: Record<string, ItemEntry>;
  onBack: () => void;
  onSave: (e: ItemEntry) => void;
}) {
  const item = findItem(groups, itemId)!;
  const l1 = findL1(groups, itemId);
  const l2 = findL2(groups, itemId);

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

  const rawTotal = entry.options.reduce((sum, oe, i) => {
    const opt = item.options[i];
    return sum + (opt ? calcOptionScore(oe, opt) : 0);
  }, 0);
  const capped = Math.min(rawTotal, item.maxScore);
  const current = item.maxScore - capped;
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

        {/* Deduction options */}
        {item.options.map((opt, oi) => {
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
                              onClick={() => updateOpt(oi, { instances: oe.instances + 1 })}
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
                            {Array.from({ length: opt.max! - opt.min! + 1 }, (_, k) => opt.min! + k).map(v => (
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

        {/* General note */}
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
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white grid grid-cols-2 gap-2 shrink-0">
        <button onClick={() => save(false)} className="py-3 border border-primary text-primary rounded-xl font-medium text-sm flex items-center justify-center gap-1.5">
          <Save className="w-4 h-4" />保存草稿
        </button>
        <button onClick={() => save(true)} className="py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-1.5">
          <CheckCircle className="w-4 h-4" />完成本项
        </button>
      </div>

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

function P5Summary({ city, town, village, ftype, groups, entries, onBack, onSubmit }: {
  city: string; town: string; village: string; ftype: FacilityType;
  groups: L1Group[];
  entries: Record<string, ItemEntry>;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const [showPhotoWarn, setShowPhotoWarn] = useState(false);

  const allItems = getAllItems(groups);
  const total = totalMaxScore(groups);
  const deducted = allItems.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id), 0);
  const current = total - deducted;
  const doneCount = allItems.filter(i => entries[i.id]?.done).length;
  const hasDeductCount = allItems.filter(i => calcEntryDeduction(entries, groups, i.id) > 0).length;
  const totalPhotos = allItems.reduce((s, i) => {
    const e = entries[i.id];
    return s + (e ? e.options.reduce((ps, o) => ps + o.photos.length, 0) : 0);
  }, 0);
  const pendingCount = allItems.filter(i => !entries[i.id]?.done).length;

  const validate = () => {
    const errs: string[] = [];
    allItems.forEach(item => {
      const e = entries[item.id];
      if (!e) return;
      e.options.forEach(oe => {
        if (oe.selection === "custom" && !oe.customNote.trim()) {
          errs.push(`"${item.name}"：选择了其他原因但未填写扣分依据`);
        }
        if (oe.adjustedScore !== null && !oe.adjustNote.trim()) {
          errs.push(`"${item.name}"：有人工调整扣分但未填写调整说明`);
        }
      });
    });
    if (errs.length > 0) { setErrors(errs); return; }

    const hasDeductNoPhoto = allItems.some(item => {
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

  const l1AccentColors = [
    { text: "text-blue-800", bg: "bg-blue-50 border-blue-200" },
    { text: "text-emerald-800", bg: "bg-emerald-50 border-emerald-200" },
    { text: "text-violet-800", bg: "bg-violet-50 border-violet-200" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="bg-primary px-4 pt-12 pb-5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-primary-foreground/55 mb-3 text-sm">
          <ChevronLeft className="w-4 h-4" />返回
        </button>
        <h1 className="text-lg font-semibold text-primary-foreground mb-1">本村考核汇总</h1>
        <div className="text-xs text-primary-foreground/55">{city} · {town} · {village}</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-2">
        {/* Main score */}
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
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${total > 0 ? (current / total) * 100 : 0}%` }} />
          </div>
          <div className="text-right text-xs text-muted-foreground mt-1">{total > 0 ? Math.round((current / total) * 100) : 0}%</div>
        </div>

        {/* Stats */}
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

        {/* L1 breakdown */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2.5">分组汇总</h3>
          <div className="space-y-2.5">
            {groups.map((l1, li) => {
              const l1Items = l1.children.flatMap(l2 => l2.items);
              const l1Total = l1Items.reduce((s, i) => s + i.maxScore, 0);
              const l1Ded = l1Items.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id), 0);
              const l1Done = l1Items.filter(i => entries[i.id]?.done).length;
              const l1HasDed = l1Items.filter(i => calcEntryDeduction(entries, groups, i.id) > 0).length;
              const l1Pending = l1Items.filter(i => !entries[i.id]?.done).length;
              const ac = l1AccentColors[li] ?? l1AccentColors[0];

              return (
                <div key={l1.id} className={`rounded-xl border p-4 ${ac.bg}`}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className={`text-sm font-semibold ${ac.text}`}>{l1.icon} {l1.name}</span>
                    <span className={`text-sm font-bold ${ac.text}`}>{l1Total - l1Ded}/{l1Total}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {[
                      { label: "已完成", val: `${l1Done}/${l1Items.length}`, c: "text-blue-700" },
                      { label: "有扣分", val: String(l1HasDed), c: l1HasDed > 0 ? "text-red-600" : "text-green-600" },
                      { label: "待补充", val: String(l1Pending), c: l1Pending > 0 ? "text-amber-600" : "text-green-600" },
                      { label: "本组扣", val: `-${l1Ded}`, c: l1Ded > 0 ? "text-red-600" : "text-muted-foreground" },
                    ].map((s, i) => (
                      <div key={i}>
                        <div className={`text-sm font-bold ${s.c}`}>{s.val}</div>
                        <div className="text-[10px] text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700">提交前请修正以下问题</span>
            </div>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-red-600 ml-6">• {e}</p>
            ))}
          </div>
        )}
        <div className="h-2" />
      </div>

      <div className="px-4 pb-10 pt-3 border-t border-border bg-white space-y-2 shrink-0">
        <button onClick={validate} className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />提交本村考核
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onBack} className="py-3 border border-border text-foreground rounded-xl text-sm font-medium flex items-center justify-center gap-1">
            <ChevronLeft className="w-4 h-4" />返回修改
          </button>
          <button className="py-3 border border-primary text-primary rounded-xl text-sm font-medium flex items-center justify-center gap-1.5">
            <Save className="w-4 h-4" />保存草稿
          </button>
        </div>
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

function PSuccess({ city, town, village, score, total, completedVillages, onNextVillage, onTownComplete }: {
  city: string; town: string; village: string;
  score: number; total: number;
  completedVillages: VillageRecord[];
  onNextVillage: () => void;
  onTownComplete: () => void;
}) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const grade = pct >= 90 ? "优秀" : pct >= 75 ? "良好" : pct >= 60 ? "合格" : "待改进";
  const gradeColor = pct >= 90 ? "text-green-600" : pct >= 75 ? "text-blue-600" : pct >= 60 ? "text-amber-600" : "text-red-600";

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="flex-1 px-5 pt-14 pb-6 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-1">提交成功</h2>
        <p className="text-xs text-muted-foreground mb-5">{city} · {town} · {village}</p>

        {/* Score card */}
        <div className="bg-white rounded-2xl border border-border p-4 w-full mb-4">
          <div className="text-3xl font-bold text-foreground">
            {score}<span className="text-base font-normal text-muted-foreground">/{total}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 mb-2.5">综合得分</div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{pct}%</span>
            <span className={`text-xs font-bold ${gradeColor}`}>{grade}</span>
          </div>
        </div>

        {/* Town progress */}
        <div className="bg-white rounded-2xl border border-border p-4 w-full mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">全镇考核进度</span>
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
              已完成 {completedVillages.length} 村
            </span>
          </div>
          <div className="space-y-2">
            {completedVillages.map((r, i) => {
              const p = r.maxScore > 0 ? Math.round((r.currentScore / r.maxScore) * 100) : 0;
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
      </div>

      <div className="px-5 pb-10 space-y-2.5 shrink-0">
        <button
          onClick={onTownComplete}
          className="w-full py-3.5 bg-[#1a4a38] text-white rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Package className="w-4 h-4" />已完成全镇考核
        </button>
        <button
          onClick={onNextVillage}
          className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          继续录入下一村点 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ==================== TOWN COMPLETE ====================

function PTownComplete({ city, town, completedVillages, onBack, onSubmit }: {
  city: string; town: string;
  completedVillages: VillageRecord[];
  onBack: () => void;
  onSubmit: () => void;
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
        <div className="text-xs text-white/55 mb-1">{city} · {town}</div>
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

        {/* Submit */}
        <button
          onClick={onSubmit}
          className="w-full py-4 bg-[#1a4a38] text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />提交
        </button>
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================

type Page = "city" | "town" | "village" | "facilitytype" | "criteria" | "detail" | "summary" | "success" | "towncomplete";

export default function App() {
  const [page, setPage] = useState<Page>("city");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");
  const [village, setVillage] = useState("");
  const [ftype, setFtype] = useState<FacilityType>("treatment");
  const [entries, setEntries] = useState<Record<string, ItemEntry>>({});
  const [detailId, setDetailId] = useState("");
  const [completedVillages, setCompletedVillages] = useState<VillageRecord[]>([]);
  const [showToast, setShowToast] = useState(false);

  const groups = ftype === "treatment" ? TREATMENT : NETWORK;
  const allItems = getAllItems(groups);
  const total = totalMaxScore(groups);
  const deducted = allItems.reduce((s, i) => s + calcEntryDeduction(entries, groups, i.id), 0);
  const finalScore = total - deducted;

  const saveEntry = (e: ItemEntry) => setEntries(prev => ({ ...prev, [e.itemId]: e }));

  const handleSubmit = () => {
    const record: VillageRecord = {
      village,
      facilityType: ftype,
      submittedAt: new Date().toISOString(),
      maxScore: total,
      deductedScore: deducted,
      currentScore: finalScore,
      entries,
    };
    setCompletedVillages(prev => {
      const filtered = prev.filter(r => r.village !== village);
      return [...filtered, record];
    });
    setPage("success");
  };

  const handleNextVillage = () => {
    setVillage(""); setEntries({}); setDetailId("");
    setFtype("treatment"); setPage("village");
  };

  const buildPackage = (): TownPackage => ({
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    city, town,
    villages: completedVillages,
  });

  const renderFieldPage = () => {
    switch (page) {
      case "city":
        return <P0City onNext={c => { setCity(c); setPage("town"); }} />;
      case "town":
        return (
          <P1Town
            city={city}
            onBack={() => setPage("city")}
            onNext={t => { setTown(t); setCompletedVillages([]); setPage("village"); }}
          />
        );
      case "village":
        return (
          <P2Village
            city={city} town={town}
            onBack={() => setPage("town")}
            onNext={v => { setVillage(v); setPage("facilitytype"); }}
          />
        );
      case "facilitytype":
        return (
          <P2bFacilityType
            city={city} town={town} village={village}
            onBack={() => setPage("village")}
            onNext={t => { setFtype(t); setEntries({}); setPage("criteria"); }}
          />
        );
      case "criteria":
        return (
          <P3Criteria
            city={city} town={town} village={village} ftype={ftype}
            groups={groups} entries={entries}
            onBack={() => setPage("village")}
            onSelect={id => { setDetailId(id); setPage("detail"); }}
            onSummary={() => setPage("summary")}
          />
        );
      case "detail":
        return detailId ? (
          <P4Detail
            itemId={detailId}
            groups={groups} entries={entries}
            onBack={() => setPage("criteria")}
            onSave={saveEntry}
          />
        ) : null;
      case "summary":
        return (
          <P5Summary
            city={city} town={town} village={village} ftype={ftype}
            groups={groups} entries={entries}
            onBack={() => setPage("criteria")}
            onSubmit={handleSubmit}
          />
        );
      case "success":
        return (
          <PSuccess
            city={city} town={town} village={village}
            score={finalScore} total={total}
            completedVillages={completedVillages}
            onNextVillage={handleNextVillage}
            onTownComplete={() => setPage("towncomplete")}
          />
        );
      case "towncomplete":
        return (
          <PTownComplete
            city={city} town={town}
            completedVillages={completedVillages}
            onBack={() => setPage("success")}
            onSubmit={() => {
              setPage("city");
              setCity(""); setTown(""); setVillage("");
              setFtype("treatment"); setEntries({});
              setDetailId(""); setCompletedVillages([]);
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
            }}
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
        <div className="absolute inset-0">{renderFieldPage()}</div>
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
