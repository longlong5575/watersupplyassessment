from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AssessmentCycle, City, DeductionOption, Indicator, IndicatorVersion, Town, User, Village


DEFAULT_TOWNS = ["北陡镇", "白沙镇", "大江镇", "赤溪镇", "广海镇", "海宴镇", "汶村镇", "水步镇", "斗山镇", "川岛镇"]


def seed_database(session: Session) -> None:
    city = session.scalar(select(City).where(City.name == "江门市"))
    if city is None:
        city = City(name="江门市")
        session.add(city)
        session.flush()
    cycle = session.scalar(select(AssessmentCycle).where(AssessmentCycle.city_id == city.id))
    if cycle is None:
        cycle = AssessmentCycle(city_id=city.id, name="2023年下半年度")
        session.add(cycle)
        session.flush()
    version = session.scalar(select(IndicatorVersion).where(IndicatorVersion.cycle_id == cycle.id))
    if version is None:
        version = IndicatorVersion(city_id=city.id, cycle_id=cycle.id, name="江门市2023年下半年度版")
        session.add(version)
        session.flush()
    if session.scalar(select(Indicator).where(Indicator.version_id == version.id)) is None:
        output = Indicator(version_id=version.id, code="1", name="产出", level=1, full_score=40, sort_order=1)
        session.add(output)
        session.flush()
        operation = Indicator(version_id=version.id, parent_id=output.id, code="1.1", name="项目运营", level=2, full_score=40, sort_order=1)
        session.add(operation)
        session.flush()
        collection = Indicator(version_id=version.id, parent_id=operation.id, code="1.1.1", name="污水收集", level=3, full_score=20, sort_order=1, facility_type="facility")
        session.add(collection)
        session.flush()
        session.add(DeductionOption(indicator_id=collection.id, name="收集管网破损或堵塞", deduction_value=2, requires_photo=True))
    for name in DEFAULT_TOWNS:
        town = session.scalar(select(Town).where(Town.city_id == city.id, Town.name == name))
        if town is None:
            town = Town(city_id=city.id, name=name)
            session.add(town)
            session.flush()
        if session.scalar(select(Village).where(Village.town_id == town.id)) is None:
            session.add(Village(town_id=town.id, name=f"{name}示范村"))
    if session.scalar(select(User).where(User.username == "admin")) is None:
        session.add(User(username="admin", display_name="系统管理员", role="admin"))
    session.commit()
