from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.storage import save_data_url
from app.models import (
    AssessmentCycle,
    AssessmentRecord,
    AssessmentScore,
    Attachment,
    City,
    DeductionOption,
    Indicator,
    IndicatorVersion,
    ScoreSourceMapping,
    SurveyRecord,
    Town,
    Village,
    WaterQualityRecord,
)

KNOWN_SURVEY_RESPONDENTS = ("implementation_org", "assessment_team", "gov_rep", "villager1", "villager2")


def unwrap_payload(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    return data if set(payload) == {"data"} and isinstance(data, dict) else payload


def resolve_city(session: Session, raw: dict[str, Any], town: Town | None = None) -> City:
    city_id = raw.get("cityId") or raw.get("city_id")
    city_name = raw.get("city") or raw.get("cityName")
    city = session.get(City, city_id) if city_id else None
    if city is None and city_name:
        city = session.scalar(select(City).where(City.name == city_name))
    if city is None and town is not None:
        city = session.get(City, town.city_id)
    if city is None:
        city = session.scalar(select(City).order_by(City.created_at))
    if city is None:
        raise ValueError("A valid city is required")
    return city


def resolve_cycle(session: Session, raw: dict[str, Any], city_id: str) -> AssessmentCycle:
    cycle_id = raw.get("cycleId") or raw.get("cycle_id")
    cycle_name = raw.get("period") or raw.get("cycle") or raw.get("cycleName")
    cycle = session.get(AssessmentCycle, cycle_id) if cycle_id else None
    if cycle is None and cycle_name:
        cycle = session.scalar(select(AssessmentCycle).where(AssessmentCycle.city_id == city_id, AssessmentCycle.name == cycle_name))
    if cycle is None:
        cycle = session.scalar(select(AssessmentCycle).where(AssessmentCycle.city_id == city_id, AssessmentCycle.status == "active"))
    if cycle is None:
        raise ValueError("A valid assessment cycle is required")
    return cycle


def resolve_town(session: Session, raw: dict[str, Any]) -> Town:
    town_id = raw.get("townId") or raw.get("town_id")
    town_name = raw.get("town") or raw.get("townName")
    city_id = raw.get("cityId") or raw.get("city_id")
    town = session.get(Town, town_id) if town_id else None
    if town is None and town_name:
        statement = select(Town).where(Town.name == town_name)
        if city_id:
            statement = statement.where(Town.city_id == city_id)
        town = session.scalar(statement)
    if town is None:
        raise ValueError("A valid town is required")
    return town


def resolve_village(session: Session, raw: dict[str, Any], town_id: str) -> Village | None:
    village_id = raw.get("villageId") or raw.get("village_id")
    village_name = raw.get("village") or raw.get("villageName")
    village = session.get(Village, village_id) if village_id else None
    if village is None and village_name:
        village = session.scalar(select(Village).where(Village.town_id == town_id, Village.name == village_name))
    return village


def resolve_indicator_version(session: Session, raw: dict[str, Any], city_id: str, cycle_id: str) -> IndicatorVersion | None:
    version_id = raw.get("indicatorVersionId") or raw.get("indicator_version_id")
    version = session.get(IndicatorVersion, version_id) if version_id else None
    if version is None:
        version = session.scalar(
            select(IndicatorVersion).where(
                IndicatorVersion.city_id == city_id,
                IndicatorVersion.cycle_id == cycle_id,
                IndicatorVersion.status == "published",
            )
        )
    return version


def split_town_package(raw: dict[str, Any]) -> list[dict[str, Any]]:
    villages = raw.get("villages")
    if not isinstance(villages, list) or not villages:
        return [raw]
    records: list[dict[str, Any]] = []
    for village in villages:
        if not isinstance(village, dict):
            continue
        records.append(
            {
                **raw,
                **village,
                "cityId": raw.get("cityId") or raw.get("city_id"),
                "cycleId": raw.get("cycleId") or raw.get("cycle_id"),
                "indicatorVersionId": raw.get("indicatorVersionId") or raw.get("indicator_version_id"),
                "town": raw.get("town"),
                "city": raw.get("city"),
                "period": raw.get("period") or raw.get("cycle") or raw.get("cycleName"),
                "sourcePackage": {"schemaVersion": raw.get("schemaVersion"), "exportedAt": raw.get("exportedAt")},
            }
        )
    return records or [raw]


def create_assessment_record(session: Session, raw: dict[str, Any]) -> AssessmentRecord:
    town = resolve_town(session, raw)
    city = resolve_city(session, raw, town)
    cycle = resolve_cycle(session, raw, city.id)
    village = resolve_village(session, raw, town.id)
    version = resolve_indicator_version(session, raw, city.id, cycle.id)
    record = find_existing_record(session, raw, city.id, cycle.id, town.id, village.id if village else None, version.id if version else None)
    if record is not None and record.status == "locked":
        raise ValueError("Assessment record is locked")
    if record is None:
        record = AssessmentRecord(
            city_id=city.id,
            cycle_id=cycle.id,
            town_id=town.id,
            village_id=village.id if village else None,
            indicator_version_id=version.id if version else None,
            status=raw.get("status", "draft"),
            total_score=raw.get("currentScore"),
            raw_payload=raw,
        )
        session.add(record)
    else:
        record.status = raw.get("status", record.status if record.status in {"draft", "returned"} else "draft")
        record.total_score = raw.get("currentScore")
        record.raw_payload = raw
    session.flush()
    sync_scores(session, record, raw.get("entries", []))
    if raw.get("surveyEntries"):
        sync_surveys(session, record, raw["surveyEntries"])
    if raw.get("waterQuality"):
        sync_water_quality(session, record, raw["waterQuality"])
    return record


def _raw_facility_type(raw: dict[str, Any]) -> str:
    return str(raw.get("primaryFacilityType") or raw.get("facilityScope") or raw.get("facilityType") or raw.get("facility_type") or "unknown")


def find_existing_record(
    session: Session,
    raw: dict[str, Any],
    city_id: str,
    cycle_id: str,
    town_id: str,
    village_id: str | None,
    version_id: str | None,
) -> AssessmentRecord | None:
    statement = select(AssessmentRecord).where(
        AssessmentRecord.city_id == city_id,
        AssessmentRecord.cycle_id == cycle_id,
        AssessmentRecord.town_id == town_id,
        AssessmentRecord.village_id == village_id,
        AssessmentRecord.indicator_version_id == version_id,
    )
    facility_type = _raw_facility_type(raw)
    for record in session.scalars(statement).all():
        if _raw_facility_type(record.raw_payload or {}) == facility_type:
            return record
    return None


def _entry_items(entries: Any) -> list[tuple[str | None, dict[str, Any]]]:
    if isinstance(entries, dict):
        return [(key, value) for key, value in entries.items() if isinstance(value, dict)]
    if isinstance(entries, list):
        return [(None, value) for value in entries if isinstance(value, dict)]
    return []


def _to_float(value: Any, default: float = 0) -> float:
    try:
        if value in ("", None):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _score_option(session: Session, option_entry: dict[str, Any]) -> tuple[str | None, float, str]:
    option_id = option_entry.get("optionId") or option_entry.get("deductionOptionId") or option_entry.get("deduction_option_id")
    selection = option_entry.get("selection")
    if selection in (None, "no_deduction"):
        return option_id, 0, option_entry.get("note") or ""
    if selection == "custom":
        deduction = _to_float(option_entry.get("customScore"))
    elif option_entry.get("rangeValue") not in (None, ""):
        deduction = _to_float(option_entry.get("rangeValue"))
    else:
        option = session.get(DeductionOption, option_id) if option_id else None
        deduction = _to_float(option.deduction_value if option else option_entry.get("deduction"))
    deduction += _to_float(option_entry.get("adjustedScore"))
    deduction *= max(1, int(_to_float(option_entry.get("instances"), 1)))
    reason = option_entry.get("note") or option_entry.get("customNote") or option_entry.get("adjustNote") or ""
    return option_id, max(deduction, 0), reason


def sync_scores(session: Session, record: AssessmentRecord, entries: Any) -> list[AssessmentScore]:
    session.execute(delete(Attachment).where(Attachment.record_id == record.id, Attachment.score_id.is_not(None)))
    session.execute(delete(AssessmentScore).where(AssessmentScore.record_id == record.id))
    created: list[AssessmentScore] = []
    for key, entry in _entry_items(entries):
        indicator_id = entry.get("indicatorId") or entry.get("indicator_id") or entry.get("itemId") or key
        indicator = session.get(Indicator, indicator_id) if indicator_id else None
        if indicator is None:
            continue
        options = entry.get("options") if isinstance(entry.get("options"), list) else []
        selected_options = [option for option in options if isinstance(option, dict) and option.get("selection") not in (None, "no_deduction")]
        if not selected_options:
            legacy_deduction = _to_float(entry.get("deduction") or entry.get("deduct"))
            score = AssessmentScore(
                record_id=record.id,
                indicator_id=indicator.id,
                score=max(float(indicator.full_score) - legacy_deduction, 0),
                deduction=legacy_deduction,
                reason=entry.get("reason") or entry.get("generalNote"),
                source=entry.get("source", "manual"),
            )
            session.add(score)
            created.append(score)
            continue
        for option_entry in selected_options:
            option_id, deduction, reason = _score_option(session, option_entry)
            score_value = max(float(indicator.full_score) - deduction, 0)
            score = AssessmentScore(
                record_id=record.id,
                indicator_id=indicator.id,
                deduction_option_id=option_id,
                score=score_value,
                deduction=deduction,
                reason=reason or entry.get("generalNote"),
                source=entry.get("source", "manual"),
            )
            session.add(score)
            session.flush()
            sync_option_photos(session, record.id, score.id, option_id, option_entry)
            created.append(score)
    session.flush()
    total = sum(_to_float(item.score) for item in created)
    if created:
        record.total_score = total
    return created


def sync_option_photos(session: Session, record_id: str, score_id: str, deduction_option_id: str | None, option_entry: dict[str, Any]) -> None:
    photos = option_entry.get("photos") if isinstance(option_entry.get("photos"), list) else []
    for index, photo in enumerate(photos, start=1):
        if not isinstance(photo, dict) or not photo.get("dataUrl"):
            continue
        try:
            storage_key, size, content_type = save_data_url(photo["dataUrl"], filename=f"photo-{index}.jpg")
        except Exception:
            continue
        session.add(
            Attachment(
                record_id=record_id,
                score_id=score_id,
                deduction_option_id=deduction_option_id,
                filename=f"photo-{index}.jpg",
                storage_key=storage_key,
                content_type=content_type,
                size=size,
            )
        )


def sync_surveys(session: Session, record: AssessmentRecord, payload: Any) -> list[SurveyRecord]:
    session.execute(delete(SurveyRecord).where(SurveyRecord.record_id == record.id))
    session.execute(delete(AssessmentScore).where(AssessmentScore.record_id == record.id, AssessmentScore.source == "survey"))
    survey_items: list[SurveyRecord] = []
    if isinstance(payload, dict):
        iterable = payload.items()
    elif isinstance(payload, list):
        iterable = [(None, item) for item in payload]
    else:
        iterable = []
    for key, item in iterable:
        if not isinstance(item, dict):
            continue
        key_text = str(key or "")
        category = item.get("category") or item.get("surveyType") or item.get("type")
        respondent = item.get("respondent")
        if not category and key_text:
            category, parsed_respondent = _split_survey_key(key_text)
            respondent = respondent or parsed_respondent
        survey_type = category or key_text or "survey"
        survey = SurveyRecord(
            record_id=record.id,
            survey_type=survey_type,
            respondent=respondent,
            score=item.get("score"),
            payload=item,
        )
        session.add(survey)
        survey_items.append(survey)
    session.flush()
    apply_survey_backfill(session, record, survey_items)
    return survey_items


def _split_survey_key(key: str) -> tuple[str, str | None]:
    for respondent in KNOWN_SURVEY_RESPONDENTS:
        suffix = f"_{respondent}"
        if key.endswith(suffix):
            return key[: -len(suffix)], respondent
    parts = key.split("_")
    if len(parts) > 1:
        return "_".join(parts[:-1]), parts[-1]
    return key, None


def _filtered_survey_scores(items: list[SurveyRecord], rule: dict[str, Any]) -> list[tuple[str | None, float]]:
    respondents = rule.get("respondents")
    allowed = set(respondents) if isinstance(respondents, list) else None
    scores: list[tuple[str | None, float]] = []
    for item in items:
        if allowed is not None and item.respondent not in allowed:
            continue
        score = _to_float(item.score, -1)
        if score >= 0:
            scores.append((item.respondent, score))
    return scores


def _survey_average_score(scores: list[tuple[str | None, float]], rule: dict[str, Any]) -> float | None:
    if not scores:
        return None
    weights = rule.get("weights")
    if isinstance(weights, dict):
        weighted_sum = 0.0
        used_weight = 0.0
        for respondent, score in scores:
            weight = _to_float(weights.get(respondent), 0)
            if weight <= 0:
                continue
            weighted_sum += score * weight
            used_weight += weight
        if used_weight > 0:
            return weighted_sum / used_weight
    return sum(score for _, score in scores) / len(scores)


def apply_survey_backfill(session: Session, record: AssessmentRecord, survey_items: list[SurveyRecord]) -> None:
    if not survey_items:
        return
    mappings = list(session.scalars(select(ScoreSourceMapping).where(ScoreSourceMapping.source_type == "survey")))
    by_key: dict[str, list[SurveyRecord]] = {}
    for item in survey_items:
        by_key.setdefault(item.survey_type, []).append(item)
    for mapping in mappings:
        matched = by_key.get(mapping.source_key, [])
        indicator = session.get(Indicator, mapping.indicator_id)
        rule = mapping.rule if isinstance(mapping.rule, dict) else {}
        average_score = _survey_average_score(_filtered_survey_scores(matched, rule), rule)
        if indicator is None or average_score is None:
            continue
        scaled_score = max(0, min(float(indicator.full_score), average_score / 5 * float(indicator.full_score)))
        session.add(
            AssessmentScore(
                record_id=record.id,
                indicator_id=indicator.id,
                score=scaled_score,
                deduction=max(float(indicator.full_score) - scaled_score, 0),
                reason=f"问卷回填：{mapping.source_key}",
                source="survey",
            )
        )


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def sync_water_quality(session: Session, record: AssessmentRecord, payload: Any) -> WaterQualityRecord:
    session.execute(delete(WaterQualityRecord).where(WaterQualityRecord.record_id == record.id))
    data = payload if isinstance(payload, dict) else {"value": payload}
    sampled_at = _parse_datetime(data.get("sampleTime") or data.get("sampledAt") or data.get("sampled_at"))
    item = WaterQualityRecord(
        record_id=record.id,
        sampled_at=sampled_at,
        conclusion=data.get("conclusion"),
        payload=data,
    )
    session.add(item)
    session.flush()
    return item


def submit_record(session: Session, record: AssessmentRecord) -> AssessmentRecord:
    record.status = "submitted"
    record.submitted_at = datetime.now(timezone.utc)
    session.flush()
    return record
