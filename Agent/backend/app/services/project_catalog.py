from __future__ import annotations

from typing import Any


def _target(section: str, title: str, description: str) -> dict[str, str]:
    return {"sectionCode": section, "title": title, "description": description}


def _yunan_town(
    name: str,
    chapter: str,
    plant: str | None,
    network: str,
    rural: str | None,
    villages: list[tuple[str, str]],
) -> dict[str, Any]:
    targets: list[str] = []
    objects: dict[str, dict[str, str]] = {}
    if plant:
        targets.append("town_plant")
        objects["town_plant"] = _target(f"{chapter}.1", f"{name}污水处理厂考核对象", plant)
    targets.append("town_network")
    objects["town_network"] = _target(f"{chapter}.1", f"{name}污水收集管网考核对象", network)
    if rural:
        targets.append("rural_treatment")
        objects["rural_treatment"] = _target(f"{chapter}.1", f"{name}农村污水处理设施考核对象", rural)
    return {
        "name": name,
        "chapterCode": chapter,
        "assessmentTargets": targets,
        "assessmentObject": objects,
        "reportTemplate": {"assessmentObjectSection": f"{chapter}.1", "heading": "考核对象"},
        "villages": [
            {
                "name": natural,
                "administrativeVillage": administrative,
                "chapterCode": f"{chapter}.1.{index}",
                "assessmentObject": {
                    "sectionCode": f"{chapter}.1.{index}",
                    "title": f"{natural}农村污水处理设施",
                    "description": f"{name}{administrative}{natural}农村生活污水处理设施。",
                },
                "reportTemplate": {
                    "project": "郁南县整县生活污水处理设施捆绑PPP项目",
                    "town": name,
                    "administrativeVillage": administrative,
                    "facilityPoint": natural,
                    "facilityType": "农村污水处理设施",
                },
            }
            for index, (administrative, natural) in enumerate(villages, 1)
        ],
    }


_RURAL_PROCESS = "采用好氧处理与人工湿地组合工艺，出水执行《农村生活污水处理排放标准》（DB44/2208-2019）。"


YUNAN_TOWNS = [
    _yunan_town(
        "建城镇", "2.2",
        "设计规模1000m3/d，服务人口约42000人，采用MBR工艺，2024年2月29日起商业运营。",
        "主管长约6.34km、支管长约3.94km，设1座740m3/d污水提升泵站。",
        f"报告记载已建28座农村污水处理设施，总规模420m3/d。{_RURAL_PROCESS}",
        [("西镇村", "石角村"), ("西镇村", "两头村"), ("西镇村", "邓屋村"), ("西镇村", "垌心村"), ("便民村", "高塱村")],
    ),
    _yunan_town(
        "桂圩镇", "2.3",
        "设计规模450m3/d，服务人口约4000人，采用MBR工艺，2024年2月29日起商业运营。",
        "主管长约3.491km、支管长约6.329km，无污水提升泵站。",
        f"报告记载已建35座农村污水处理设施，总规模790m3/d。{_RURAL_PROCESS}",
        [("新塘村", "山禾地村"), ("䓣口村", "赤坭村"), ("䓣口村", "高寨村"), ("䓣口村", "平山村"), ("䓣口村", "道枝村")],
    ),
    _yunan_town(
        "罗顺片区", "2.4",
        "设计规模350m3/d，服务人口约3000人，采用MBR工艺，2024年2月29日起商业运营。",
        "主管长约2.156km、支管长约3.433km，无污水提升泵站。",
        None, [],
    ),
    _yunan_town(
        "宝珠镇", "2.5",
        "设计规模400m3/d，服务人口约3800人，采用MBR工艺。",
        "主管长约2.675km、支管长约12.189km，设1座100m3/d污水提升泵站。",
        f"报告记载已建13座农村污水处理设施，总规模150m3/d。{_RURAL_PROCESS}",
        [("庞寨村", "茅坪村"), ("庞寨村", "旺冲口村"), ("大社村", "大社村")],
    ),
    _yunan_town(
        "通门镇", "2.6",
        "设计规模550m3/d，服务人口约5000人，采用MBR工艺。",
        "主管长约2.41km、支管长约5.904km，无污水提升泵站。",
        f"报告记载已建22座农村污水处理设施，总规模470m3/d。{_RURAL_PROCESS}",
        [("街坊村", "邓屋村"), ("街坊村", "水竹根村"), ("街坊村", "荷木坳村"), ("街坊村", "通门中学（冲北村）"), ("街坊村", "白花村")],
    ),
    _yunan_town(
        "千官镇", "2.7",
        "设计规模1000m3/d，服务人口约10000人，采用MBR工艺。",
        "主管长约6.631km、支管长约7.942km，设1座700m3/d污水提升泵站。",
        f"报告记载已建34座农村污水处理设施，总规模360m3/d。{_RURAL_PROCESS}",
        [("旺玖村", "铜古顶一组"), ("旺玖村", "铜古顶二组"), ("旺玖村", "社咀村")],
    ),
    _yunan_town(
        "大湾镇", "2.8", None,
        "污水接入工业园污水处理厂，主管长约6.462km、支管长约10.056km，设3座提升泵站，总规模1130m3/d。",
        f"报告记载已建16座农村污水处理设施，总规模340m3/d。{_RURAL_PROCESS}",
        [("水口村", "恭朴村"), ("水口村", "上水口村一组"), ("水口村", "上水口村二组")],
    ),
    _yunan_town(
        "大方镇", "2.9",
        "设计规模400m3/d，服务人口约4500人，采用MBR工艺。",
        "主管长约3.507km、支管长约3.571km，无污水提升泵站。",
        f"报告记载已建30座农村污水处理设施，总规模420m3/d。{_RURAL_PROCESS}",
        [("上福村", "办朗村"), ("上福村", "塱顶村"), ("上福村", "大克村"), ("上福村", "合作村"), ("上福村", "赖屋村"), ("上福村", "增西一村"), ("上福村", "增西二村")],
    ),
    _yunan_town(
        "河口镇", "2.10",
        "设计规模450m3/d，服务人口约4000人，采用MBR工艺。",
        "主管长约4.845km、支管长约5.298km，无污水提升泵站。",
        f"报告记载已建34座农村污水处理设施，总规模1070m3/d。{_RURAL_PROCESS}",
        [("河口寨村", "河口寨村"), ("河口寨村", "新屋坝村"), ("河口寨村", "大木口村"), ("河口寨村", "乌石村"), ("河口寨村", "白银前村"), ("河口寨村", "应咀村")],
    ),
    _yunan_town(
        "宋桂镇", "2.11",
        "设计规模700m3/d，服务人口约6800人，采用MBR工艺。",
        "主管长约2.318km、支管长约0.917km，设1座700m3/d污水提升泵站。",
        f"报告记载已建1座农村污水处理设施，总规模20m3/d。{_RURAL_PROCESS}",
        [("宁波村", "井上村")],
    ),
    _yunan_town(
        "东坝镇", "2.12",
        "设计规模1000m3/d，服务人口约10000人，采用MBR工艺。",
        "主管长约7.472km、支管长约18.143km，无污水提升泵站。",
        f"本节记载已建9座农村污水处理设施，本目录按项目归属纳入东坝镇范围。{_RURAL_PROCESS}",
        [("石咀村", "石圳村"), ("粗石村", "平湾村"), ("粗石村", "玉兰村")],
    ),
    _yunan_town(
        "历洞镇", "2.13",
        "设计规模450m3/d，服务人口约4000人，采用MBR工艺。",
        "主管长约2.298km、支管长约4.196km，设1座150m3/d污水提升泵站。",
        f"报告记载已建4座农村污水处理设施，总规模60m3/d。{_RURAL_PROCESS}",
        [("沙木村", "望天村"), ("历洞村", "连塘洞村"), ("旺埇村", "赖屋村"), ("旺埇村", "罗屋村")],
    ),
    _yunan_town(
        "南江口镇", "2.14", None,
        "主管长约5.007km、支管长约2.447km，设1座700m3/d污水提升泵站。",
        f"报告记载已建29座农村污水处理设施，总规模580m3/d。{_RURAL_PROCESS}",
        [("平罗村", "格木村三队"), ("平罗村", "格木村二队部分、四队、五队"), ("平罗村", "平罗村一队、二队、五队+南岸新村"), ("平罗村", "平罗村三队"), ("平罗村", "横山村一组"), ("平罗村", "横山村二组")],
    ),
    _yunan_town(
        "连滩镇", "2.15", None,
        "主管长约5.224km、支管长约2.306km，设1座6000m3/d污水提升泵站。",
        f"报告记载已建3座农村污水处理设施，总规模110m3/d。{_RURAL_PROCESS}",
        [("高枧村", "安宁村"), ("天花塘村", "到角塘村"), ("逍遥村", "大坪村")],
    ),
    _yunan_town(
        "平台镇", "2.16",
        "设计规模400m3/d，采用MBR工艺。",
        "主管长约3.304km、支管长约2.031km，设1座300m3/d污水提升泵站。",
        f"报告记载已建8座农村污水处理设施，总规模190m3/d。{_RURAL_PROCESS}",
        [("平台村", "杉田村"), ("平台村", "双村一组")],
    ),
    _yunan_town(
        "都城镇", "2.17", None,
        "主管长约3.927km、支管长约0.333km，设3座污水提升泵站，规模分别为3000、20000、25000m3/d。",
        f"报告记载已建7座农村污水处理设施，总规模150m3/d。{_RURAL_PROCESS}",
        [("白木村", "庙后1+2+3村"), ("白木村", "庙后4+5+6村"), ("白木村", "天窝村三组+二组部分")],
    ),
]


def _maonan_town(name: str, chapter: str, description: str, targets: list[str]) -> dict[str, Any]:
    objects = {
        target: _target(
            f"{chapter}.1",
            f"{name}{'水质净化厂' if target == 'town_plant' else '污水收集管网'}考核对象",
            description,
        )
        for target in targets
    }
    return {
        "name": name,
        "chapterCode": chapter,
        "assessmentTargets": targets,
        "assessmentObject": objects,
        "reportTemplate": {"assessmentObjectSection": f"{chapter}.1", "heading": "基本情况（考核对象）"},
        "villages": [],
    }


MAONAN_TOWNS = [
    _maonan_town("金塘镇", "2.2", "水质净化厂设计规模1000m3/d，采用改良A2O工艺；实际建设管网21.25km，服务人口约1.21万人，2021年7月16日起商业运营。报告说明配套管网尚未正式移交，本期仅考核水质净化厂。", ["town_plant"]),
    _maonan_town("山阁镇", "2.3", "水质净化厂设计规模800m3/d，采用改良A2O工艺；运维管网9.951km，设2座提升泵站，服务人口约0.64万人，2020年11月21日起商业运营。", ["town_plant", "town_network"]),
    _maonan_town("镇盛镇", "2.4", "水质净化厂设计规模1200m3/d，采用改良A2O工艺；管网约9.19km，设1座提升泵站，服务人口约1.27万人，2020年11月21日起商业运营。", ["town_plant", "town_network"]),
    _maonan_town("袂花镇", "2.5", "水质净化厂设计规模600m3/d，采用改良A2O工艺；自2024年1月起运维管网1.304km，服务人口约0.46万人，2021年2月2日起商业运营。", ["town_plant", "town_network"]),
    _maonan_town("鳌头镇", "2.6", "水质净化厂设计规模800m3/d，采用改良A2O工艺；实际建设（维修）管网4.884km，服务人口约0.75万人，2021年1月13日起商业运营。", ["town_plant", "town_network"]),
    _maonan_town("茂南区", "2.7", "水质净化厂首期设计规模25000m3/d，采用改良A2O工艺；污水收集管网22.194km，设龙江村、石车、石车仔3座提升泵站，2021年6月25日起商业运营。", ["town_plant", "town_network"]),
    _maonan_town("中科云粤西产业园", "2.8", "污水收集管网接入茂南区水质净化厂；自2024年1月起运维管网16.707km，设逢地屋、那梭、农林学院3座提升泵站，2021年6月25日起商业运营。", ["town_network"]),
]


PROJECT_CATALOG: list[dict[str, Any]] = [
    {
        "key": "yunan",
        "name": "郁南项目",
        "fullName": "郁南县整县生活污水处理设施捆绑PPP项目",
        "cycle": "2026年第2季度",
        "standard": "郁南项目绩效考核标准",
        "sourceReport": "2025年郁南第2季度镇村考核报告",
        "towns": YUNAN_TOWNS,
    },
    {
        "key": "maonan",
        "name": "茂南项目",
        "fullName": "茂南区水质净化处理设施全区捆绑PPP项目",
        "cycle": "2026年第2季度",
        "standard": "茂南项目绩效考核标准",
        "sourceReport": "茂南区城镇设施第八、九周期绩效考核报告",
        "towns": MAONAN_TOWNS,
    },
]


def project_by_name(name: str) -> dict[str, Any] | None:
    return next((item for item in PROJECT_CATALOG if item["name"] == name), None)
