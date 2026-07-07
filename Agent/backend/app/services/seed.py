from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AssessmentCycle, City, DeductionOption, Indicator, IndicatorVersion, ScoreSourceMapping, Town, User, Village
from app.services.project_catalog import PROJECT_CATALOG
from app.services.standard_catalog import item_score_total, load_standard_groups


def _option_value(option: dict) -> float:
    if option.get("type") == "range":
        return float(option.get("max") or option.get("min") or 0)
    return float(option.get("value") or option.get("max") or option.get("min") or 0)


def _option_meta(option: dict) -> dict:
    meta = {}
    if option.get("type") == "range":
        meta["min"] = float(option.get("min") or 0)
        meta["max"] = float(option.get("max") or option.get("min") or 0)
    if option.get("unit"):
        meta["unit"] = option["unit"]
    if option.get("maxInstances"):
        meta["maxInstances"] = option["maxInstances"]
    return meta


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


def _seed_standard_groups(session: Session, version: IndicatorVersion, project_key: str) -> None:
    standards = load_standard_groups(project_key)
    expected_option_counts = {
        facility_type: sum(
            len(item.get("options", []))
            for level1 in groups
            for level2 in level1.get("children", [])
            for item in level2.get("items", [])
        )
        for facility_type, groups in standards.items()
    }
    expected_unit_counts = {
        facility_type: sum(
            1
            for level1 in groups
            for level2 in level1.get("children", [])
            for item in level2.get("items", [])
            for option in item.get("options", [])
            if option.get("unit")
        )
        for facility_type, groups in standards.items()
    }
    expected_range_counts = {
        facility_type: sum(
            1
            for level1 in groups
            for level2 in level1.get("children", [])
            for item in level2.get("items", [])
            for option in item.get("options", [])
            if option.get("type") == "range"
        )
        for facility_type, groups in standards.items()
    }
    expected_totals = {facility_type: round(item_score_total(groups), 2) for facility_type, groups in standards.items()}
    existing_types = set(
        session.scalars(
            select(Indicator.facility_type).where(
                Indicator.version_id == version.id,
                Indicator.level == 3,
                Indicator.enabled.is_(True),
            )
        ).all()
    )
    if existing_types == set(standards):
        totals = {
            facility_type: sum(
                float(item.full_score or 0)
                for item in session.scalars(
                    select(Indicator).where(
                        Indicator.version_id == version.id,
                        Indicator.level == 3,
                        Indicator.facility_type == facility_type,
                        Indicator.enabled.is_(True),
                    )
                ).all()
            )
            for facility_type in existing_types
        }
        totals = {facility_type: round(total, 2) for facility_type, total in totals.items()}
        actual_option_counts = {
            facility_type: int(
                session.scalar(
                    select(func.count(DeductionOption.id))
                    .join(Indicator, DeductionOption.indicator_id == Indicator.id)
                    .where(
                        Indicator.version_id == version.id,
                        Indicator.level == 3,
                        Indicator.facility_type == facility_type,
                        Indicator.enabled.is_(True),
                    )
                )
                or 0
            )
            for facility_type in existing_types
        }
        actual_unit_counts = {
            facility_type: sum(
                1
                for item in session.scalars(
                    select(DeductionOption)
                    .join(Indicator, DeductionOption.indicator_id == Indicator.id)
                    .where(
                        Indicator.version_id == version.id,
                        Indicator.level == 3,
                        Indicator.facility_type == facility_type,
                        Indicator.enabled.is_(True),
                    )
                ).all()
                if isinstance(item.meta, dict) and item.meta.get("unit")
            )
            for facility_type in existing_types
        }
        actual_range_counts = {
            facility_type: sum(
                1
                for item in session.scalars(
                    select(DeductionOption)
                    .join(Indicator, DeductionOption.indicator_id == Indicator.id)
                    .where(
                        Indicator.version_id == version.id,
                        Indicator.level == 3,
                        Indicator.facility_type == facility_type,
                        Indicator.enabled.is_(True),
                        DeductionOption.deduction_type == "range",
                    )
                ).all()
                if isinstance(item.meta, dict) and "min" in item.meta and "max" in item.meta
            )
            for facility_type in existing_types
        }
        if totals == expected_totals and actual_option_counts == expected_option_counts and actual_unit_counts == expected_unit_counts and actual_range_counts == expected_range_counts:
            return

    for indicator in session.scalars(select(Indicator).where(Indicator.version_id == version.id)).all():
        indicator.enabled = False
    session.flush()

    if not standards:
        return
    for facility_type, groups in standards.items():
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
                                meta=_option_meta(option),
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
    for old_version in session.scalars(
        select(IndicatorVersion).where(
            IndicatorVersion.city_id == city.id,
            IndicatorVersion.id != version.id,
            IndicatorVersion.status == "published",
        )
    ).all():
        old_version.status = "archived"
    version.status = "published"
    _seed_standard_groups(session, version, project["key"])

    active_town_names = {item["name"] for item in project["towns"]}
    for stale_town in session.scalars(select(Town).where(Town.city_id == city.id, Town.name.not_in(active_town_names))).all():
        stale_town.is_active = False

    for town_index, town_data in enumerate(project["towns"], 1):
        town_name = town_data["name"]
        town = session.scalar(select(Town).where(Town.city_id == city.id, Town.name == town_name))
        if town is None:
            town = Town(city_id=city.id, name=town_name)
            session.add(town)
            session.flush()
        town.chapter_code = town_data.get("chapterCode")
        town.assessment_targets = town_data.get("assessmentTargets", [])
        town.assessment_object = town_data.get("assessmentObject", {})
        town.report_template = town_data.get("reportTemplate", {})
        town.sort_order = town_index
        town.is_active = True

        active_village_names = {item["name"] for item in town_data.get("villages", [])}
        for stale_village in session.scalars(select(Village).where(Village.town_id == town.id, Village.name.not_in(active_village_names))).all():
            stale_village.is_active = False
        for village_index, village_data in enumerate(town_data.get("villages", []), 1):
            village_name = village_data["name"]
            village = session.scalar(select(Village).where(Village.town_id == town.id, Village.name == village_name))
            if village is None:
                village = Village(town_id=town.id, name=village_name)
                session.add(village)
            village.administrative_village = village_data.get("administrativeVillage")
            village.chapter_code = village_data.get("chapterCode")
            village.assessment_object = village_data.get("assessmentObject", {})
            village.report_template = village_data.get("reportTemplate", {})
            village.sort_order = village_index
            village.is_active = True


def seed_database(session: Session) -> None:
    for project in PROJECT_CATALOG:
        _seed_project(session, project)

    if session.scalar(select(User).where(User.username == "admin")) is None:
        session.add(User(username="admin", display_name="系统管理员", role="admin"))
    if session.scalar(select(User).where(User.username == "inspector")) is None:
        session.add(User(username="inspector", display_name="现场采集员", role="inspector"))
    session.commit()
