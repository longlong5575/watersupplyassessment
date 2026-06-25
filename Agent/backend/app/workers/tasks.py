from app.services.report_tasks import run_report_task
from app.workers.celery_app import celery_app


@celery_app.task(name="assessment.generate_report")
def generate_report(task_id: str) -> None:
    run_report_task(task_id)
