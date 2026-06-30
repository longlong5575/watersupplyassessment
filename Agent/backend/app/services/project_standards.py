from __future__ import annotations

import re
from typing import Any


_DEDUCTION_RE = re.compile(r"扣\s*(\d+(?:\.\d+)?)(?:\s*(?:至|到|-|~|～)\s*(\d+(?:\.\d+)?))?\s*分")
_LEADING_NUMBER_RE = re.compile(r"^\s*(?:\d+[\.\、)]|[（(]\d+[）)]|[①②③④⑤⑥⑦⑧⑨⑩])\s*")


def _clean_clause(value: str) -> str:
    return _LEADING_NUMBER_RE.sub("", value).strip(" \t\r\n。；;、，,")


def _split_rule_clauses(rule: str) -> list[str]:
    clauses: list[str] = []
    for section in re.split(r"[；;]\s*", rule):
        section = _clean_clause(section)
        if not section:
            continue
        comma_parts = [_clean_clause(part) for part in re.split(r"[、，,]\s*", section)]
        deductible_parts = [part for part in comma_parts if part and "扣" in part and "不扣分" not in part]
        if len(deductible_parts) >= 2:
            clauses.extend(deductible_parts)
        else:
            clauses.append(section)

    deductible = [clause for clause in clauses if "扣" in clause and "不扣分" not in clause]
    return deductible or clauses or [rule]


def split_deduction_options(rule: str, score: float) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for index, clause in enumerate(_split_rule_clauses(rule), 1):
        text = _clean_clause(clause)
        match = _DEDUCTION_RE.search(text)
        reason = f"{index}. {text}"
        if match:
            min_value = float(match.group(1))
            max_value = float(match.group(2) or match.group(1))
            max_value = min(max_value, float(score))
            min_value = min(min_value, max_value)
            if match.group(2):
                options.append({"reason": reason, "type": "range", "min": min_value, "max": max_value})
            else:
                options.append({"reason": reason, "type": "fixed", "value": max_value})
        else:
            options.append({"reason": reason, "type": "fixed", "value": min(float(score), 1.0)})
    return options


def _groups(prefix: str, rows: list[tuple[str, list[tuple[str, float, str]]]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for group_index, (group_name, items) in enumerate(rows, 1):
        result.append(
            {
                "id": f"{prefix}_{group_index}",
                "name": group_name,
                "children": [
                    {
                        "id": f"{prefix}_{group_index}_1",
                        "name": group_name,
                        "items": [
                            {
                                "id": f"{prefix}_{group_index}_{item_index}",
                                "name": name,
                                "maxScore": score,
                                "evaluationStandard": rule,
                                "standardText": rule,
                                "scoringMethod": "按报告评分标准据实扣分，单项最低为0分。",
                                "dataSource": "资料报告、现场检查及运行记录",
                                "options": split_deduction_options(rule, float(score)),
                            }
                            for item_index, (name, score, rule) in enumerate(items, 1)
                        ],
                    }
                ],
            }
        )
    return result


YUNAN_PLANT = _groups(
    "yn_plant",
    [
        ("有效运行时间", [("运行天数及停产", 15, "停产天数每增加1天扣1分；按规定履行停减产程序的天数不扣分。")]),
        ("处理质量", [
            ("污水处理质量", 10, "月度化验缺项或主管部门抽查判定不合格，按全月不合格扣10分。"),
            ("污泥处理质量", 5, "污泥去向不明扣5分。"),
        ]),
        ("运营管理", [
            ("操作规程", 2, "管理制度、岗位操作规程或设备维护手册每缺一项扣0.5分。"),
            ("生产运行记录", 6, "化验、设备、工艺、药耗及库存记录每缺一项扣1分；无人员签名视为无效。"),
            ("维护、维修记录", 3, "设备台账、累计运行台时、维修保养记录每缺一项扣1分；无人员签名视为无效。"),
            ("工艺调控", 6, "工段、设施或仪表每缺失损坏一项扣2分；工艺参数监控分析每缺一项次扣0.5分。"),
        ]),
        ("构筑物及设备管理", [
            ("构筑物", 7, "每处腐蚀损坏扣0.5分；构筑物沉降或漏水每项扣1分。"),
            ("设备", 5, "设备螺栓缺失或腐蚀渗漏每处扣0.5分；无设备台账扣1分。"),
            ("中控系统", 5, "整县未设中控平台扣3分；子站无采集数据或运行记录扣5分。"),
        ]),
        ("安全生产", [
            ("安全管理", 5, "无安全制度扣1分、无有效检查记录扣0.5分；现场安全保护、警示、仪器或危化品管理每项不达标扣1分。"),
            ("安全生产责任书", 1, "未逐级签订安全生产责任书扣1分。"),
            ("特种设备检定", 2, "安全设施每处未按规定设置扣0.5分；电气或特种设备每处无证书检定报告扣1分。"),
            ("应急预案", 3, "预案每缺一项扣0.5分；一年内未组织演练扣1分。"),
            ("安全隐患", 3, "一般安全隐患扣1分；重大安全隐患扣3分。"),
        ]),
        ("人员情况", [
            ("安全岗位持证上岗", 2, "主管安全负责人、安全员每一岗位无有效资格证扣1分。"),
            ("关键岗位持证上岗", 2, "关键岗位每缺少1名持证人员扣1分。"),
            ("运行管理架构", 1, "运行管理机构或岗位职责不健全分别扣0.5至1分。"),
        ]),
        ("厂容厂貌", [
            ("厂站环境", 6, "杂物堆置扣2分；垃圾堆放扣2分；草皮缺失扣2分。"),
            ("噪音和臭味控制", 5, "噪音或臭味超标各扣3分；投诉未处置扣2分。"),
            ("工作人员", 1, "操作人员着装或文明礼貌不符合要求扣1分。"),
        ]),
        ("社会影响", [("社会影响", 5, "被政府部门处罚扣5分；有效投诉每次扣2.5分；公众媒体有效负面报道扣5分。")]),
    ],
)


MAONAN_PLANT = _groups(
    "mn_plant",
    [
        ("有效运行时间", [("运行天数及停产", 15, "停产天数每增加1天扣0.5分；按规定履行停减产程序的天数不扣分。")]),
        ("处理质量", [("污水处理质量", 10, "月度化验缺项或主管部门抽查判定不合格，按全月不合格扣10分。"), ("污泥处理质量", 5, "污泥处置场所管理不规范或去向不明扣2分。")]),
        ("运营管理", [("操作规程", 4, "缺少一项扣0.5分。"), ("生产运行记录", 6, "缺少一项扣1分，无人员签名视为无效。"), ("维护、维修记录", 2, "缺少一项扣1分，无人员签名视为无效。"), ("工艺调控", 5, "设施仪表每缺失损坏一项扣1分；工艺监控分析每缺一项次扣0.5分。")]),
        ("构筑物及设备管理", [("构筑物及设备", 15, "腐蚀损坏每处扣0.1分；沉降或漏水每座各扣0.5分；无设备台账扣1分。"), ("中控系统", 3, "未设全区中控平台扣2分；子站无数据或运行记录扣1分。")]),
        ("安全生产", [("安全管理", 9, "无安全制度或检查记录各扣2分；现场安全要求每项不达标扣0.5分。"), ("安全生产责任书", 1, "未逐级签订扣1分。"), ("应急预案", 2, "预案每缺一项扣1分；一年未演练扣2分。"), ("安全隐患", 2, "存在重大安全隐患扣2分。")]),
        ("人员情况", [("安全岗位持证上岗", 1, "每一安全岗位无有效资格证扣0.5分。"), ("关键岗位持证上岗", 2, "每缺少1名持证人员扣0.2分。"), ("运行管理架构", 3, "机构或岗位职责未配置、不健全分别扣0.5分。")]),
        ("厂容厂貌", [("厂站环境", 8, "生产区堆放杂物扣3分；垃圾堆放或草皮明显缺失各扣1分。"), ("工作人员", 2, "着装或文明礼貌不符合要求扣2分。")]),
        ("社会影响", [("社会影响", 5, "被政府部门处罚扣1分；有效投诉每次扣0.5分；公众媒体有效负面报道扣0.5分。")]),
    ],
)


MAONAN_NETWORK = _groups(
    "mn_network",
    [
        ("日常巡查", [("巡查工作开展", 8, "未定期巡查扣4分；巡查记录不符合要求扣2分。"), ("巡查问题处理", 7, "问题未及时处理或处理记录不符合要求，每处扣0.1分。")]),
        ("管道及附属设施运行维护质量", [("管道", 10, "积泥超限、塌陷、变形、堵塞或污水冒出按报告标准逐处扣分。"), ("检查井", 4, "积泥、井盖、井身、防坠等不符合要求，每处扣0.1分。"), ("倒虹管", 2, "水流不通或保护标志缺损按处扣分。"), ("压力管", 2, "渗漏、冒溢或附属设施失效每处扣分。")]),
        ("泵站运行维护质量", [("机电设备运行状况", 3, "机电设备运行异常每处扣分。"), ("设施维护状况", 3, "设施维护不符合要求每处扣分。"), ("故障率", 3, "故障率超过合同要求按区间扣分。"), ("运行维护记录", 5, "运行维护记录每缺一项扣分。"), ("事故发生率", 4, "发生安全生产事故按标准扣分。")]),
        ("设备配置", [("维护车辆", 4, "缺少高压水冲车、吸泥车等专用车辆按项扣分。"), ("安全防护设备", 2, "气体监测装置、防毒面具等每缺一项扣分。")]),
        ("污泥运输与处置", [("运输", 3, "运输车辆未加盖、未清洗或沿途洒落按项扣分。"), ("安全", 3, "停放时无安全标志或警示灯按项扣分。"), ("污泥处置", 2, "去向不明或处置不符合行业要求按项扣分。")]),
        ("事故抢修与应急预案", [("抢修安排", 3, "抢修记录缺项或未按时限处置按次扣分。"), ("抢修程序", 4, "未及时安排、到场或报告重大事故按次扣分。"), ("突发事件应急处理", 4, "应急预案缺项或未定期演练按项扣分。")]),
        ("安全文明作业", [("培训和持证上岗", 7, "无证、无培训档案或无专用作业服按项扣分。"), ("安全生产、文明施工", 3, "下井审批、围蔽、监护、防护及现场恢复不符合要求按现场综合扣分。")]),
        ("档案和信息管理", [("管理人员", 3, "未配备专职档案人员扣分。"), ("设施档案管理", 2, "竣工技术资料或管网图缺项扣分。"), ("档案资料管理制度", 2, "未建立制度扣分。"), ("运营维护台账", 2, "台账缺失或归档不及时按项扣分。"), ("数字化管理", 1, "数字化管理系统未有效运行扣分。")]),
        ("社会服务", [("投诉渠道", 2, "无24小时有效投诉渠道扣2分。"), ("社会影响", 2, "政府处罚、有效投诉或媒体负面报道按报告标准扣分。")]),
    ],
)
