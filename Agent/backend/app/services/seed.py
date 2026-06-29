from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AssessmentCycle, City, DeductionOption, Indicator, IndicatorVersion, ScoreSourceMapping, Town, User, Village
from app.services.standard_catalog import item_score_total, load_standard_groups


PROJECTS = [
    {
        "name": "郁南项目",
        "cycle": "2026年第2季度",
        "standard": "郁南项目农村生活污水绩效考核标准",
        "towns": {
            "都城镇": ["富窝村", "承平村", "夏袭村"],
            "平台镇": ["古同村", "大地村", "平台村"],
            "桂圩镇": ["桂圩村", "罗顺村", "勿坦村"],
        },
    },
    {
        "name": "茂南项目",
        "cycle": "2026年第2季度",
        "standard": "茂南项目农村生活污水绩效考核标准",
        "towns": {
            "金塘镇": ["牙象村", "丰田村", "白土村"],
            "鳌头镇": ["文运村", "彰教山村", "飞马村"],
            "镇盛镇": ["荷榭村", "联唐村", "斜岭村"],
        },
    },
]


def _option_value(option: dict) -> float:
    if option.get("type") == "range":
        return float(option.get("max") or option.get("min") or 0)
    return float(option.get("value") or option.get("max") or option.get("min") or 0)


def _clean_standard_text(*values: str | None, fallback: str = "扣分项") -> str:
    for value in values:
        text = str(value or "").strip()
        if text and "???" not in text:
            return text
    for value in values:
        text = str(value or "").replace("?", "").strip()
        if text:
            return text
    return fallback


def _requires_photo(item: dict) -> bool:
    text = f"{item.get('scoringMethod', '')}{item.get('dataSource', '')}{item.get('name', '')}"
    return "问卷" not in text and "抽检水质" not in text and item.get("name") != "污水处理质量"


def _survey_mapping_for(level2_name: str, item_name: str) -> tuple[str, dict] | None:
    if item_name == "污水收集":
        return "sewage_collection", {"method": "weighted_5_point", "weights": {"villager1": 0.15, "villager2": 0.15, "gov_rep": 0.3, "assessment_team": 0.4}}
    if item_name == "整体效果":
        return "overall_effect", {"method": "weighted_5_point", "weights": {"villager1": 0.15, "villager2": 0.15, "gov_rep": 0.3, "assessment_team": 0.4}}
    if "满意度" in level2_name and item_name == "实施机构满意度":
        return "satisfaction", {"method": "average_5_point", "respondents": ["implementation_org"]}
    if "满意度" in level2_name and item_name == "镇街满意度":
        return "satisfaction", {"method": "average_5_point", "respondents": ["gov_rep"]}
    if "满意度" in level2_name and item_name == "公众满意度":
        return "satisfaction", {"method": "average_5_point", "respondents": ["villager1", "villager2"]}
    return None


def _seed_standard_groups(session: Session, version: IndicatorVersion) -> None:
    enabled_level3_count = len(
        list(
            session.scalars(
                select(Indicator).where(Indicator.version_id == version.id, Indicator.level == 3, Indicator.enabled.is_(True))
            )
        )
    )
    if enabled_level3_count >= 40:
        return

    for indicator in session.scalars(select(Indicator).where(Indicator.version_id == version.id)).all():
        indicator.enabled = False
    session.flush()

    standards = load_standard_groups()
    for facility_type, groups in standards.items():
        if round(item_score_total(groups), 2) != 100:
            raise RuntimeError(f"{facility_type} scoring standard total must be 100")
        for level1_index, level1 in enumerate(groups, 1):
            level1_score = sum(float(item.get("maxScore") or 0) for level2 in level1.get("children", []) for item in level2.get("items", []))
            l1 = Indicator(
                version_id=version.id,
                code=f"{facility_type}.{level1_index}",
                name=level1["name"],
                level=1,
                full_score=level1_score,
                sort_order=level1_index * 1000,
                facility_type=facility_type,
            )
            session.add(l1)
            session.flush()
            for level2_index, level2 in enumerate(level1.get("children", []), 1):
                level2_score = sum(float(item.get("maxScore") or 0) for item in level2.get("items", []))
                l2 = Indicator(
                    version_id=version.id,
                    parent_id=l1.id,
                    code=f"{facility_type}.{level1_index}.{level2_index}",
                    name=level2["name"],
                    level=2,
                    full_score=level2_score,
                    sort_order=l1.sort_order + level2_index * 100,
                    facility_type=facility_type,
                )
                session.add(l2)
                session.flush()
                for level3_index, item in enumerate(level2.get("items", []), 1):
                    l3 = Indicator(
                        version_id=version.id,
                        parent_id=l2.id,
                        code=item.get("id") or f"{facility_type}.{level1_index}.{level2_index}.{level3_index}",
                        name=item["name"],
                        level=3,
                        full_score=float(item.get("maxScore") or 0),
                        sort_order=l2.sort_order + level3_index,
                        facility_type=facility_type,
                    )
                    session.add(l3)
                    session.flush()
                    for option in item.get("options", []):
                        session.add(
                            DeductionOption(
                                indicator_id=l3.id,
                                name=_clean_standard_text(
                                    option.get("reason"),
                                    option.get("sourceText"),
                                    item.get("evaluationStandard"),
                                    item.get("standardText"),
                                ),
                                deduction_type=option.get("type") or "fixed",
                                deduction_value=_option_value(option),
                                requires_photo=_requires_photo(item),
                            )
                        )
                    mapping = _survey_mapping_for(level2["name"], item["name"])
                    if mapping:
                        source_key, rule = mapping
                        session.add(ScoreSourceMapping(indicator_id=l3.id, source_type="survey", source_key=source_key, rule=rule))


def _seed_project(session: Session, project: dict) -> None:
    city = session.scalar(select(City).where(City.name == project["name"]))
    if city is None:
        city = City(name=project["name"])
        session.add(city)
        session.flush()

    cycle = session.scalar(select(AssessmentCycle).where(AssessmentCycle.city_id == city.id, AssessmentCycle.name == project["cycle"]))
    if cycle is None:
        cycle = session.scalar(
            select(AssessmentCycle).where(
                AssessmentCycle.city_id == city.id,
                AssessmentCycle.name == "2026年度考核",
            )
        )
        if cycle is not None:
            cycle.name = project["cycle"]
    if cycle is None:
        cycle = AssessmentCycle(city_id=city.id, name=project["cycle"])
        session.add(cycle)
        session.flush()

    version = session.scalar(select(IndicatorVersion).where(IndicatorVersion.cycle_id == cycle.id, IndicatorVersion.name == project["standard"]))
    if version is None:
        version = IndicatorVersion(city_id=city.id, cycle_id=cycle.id, name=project["standard"])
        session.add(version)
        session.flush()
    _seed_standard_groups(session, version)

    for town_name, villages in project["towns"].items():
        town = session.scalar(select(Town).where(Town.city_id == city.id, Town.name == town_name))
        if town is None:
            town = Town(city_id=city.id, name=town_name)
            session.add(town)
            session.flush()
        for village_name in villages:
            if session.scalar(select(Village).where(Village.town_id == town.id, Village.name == village_name)) is None:
                session.add(Village(town_id=town.id, name=village_name))


def seed_database(session: Session) -> None:
    for project in PROJECTS:
        _seed_project(session, project)

    if session.scalar(select(User).where(User.username == "admin")) is None:
        session.add(User(username="admin", display_name="系统管理员", role="admin"))
    if session.scalar(select(User).where(User.username == "inspector")) is None:
        session.add(User(username="inspector", display_name="现场采集员", role="inspector"))
    session.commit()
