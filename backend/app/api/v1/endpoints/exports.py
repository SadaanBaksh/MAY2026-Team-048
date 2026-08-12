import csv
import io
from collections.abc import Iterable, Sequence
from datetime import datetime, timezone
from enum import Enum

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.response_docs import FORBIDDEN, UNAUTHORIZED
from app.db.session import get_db
from app.models.category import Category
from app.models.enums import UserRole
from app.models.public_service import PublicService
from app.models.user import User

router = APIRouter()


class ExportDataset(str, Enum):
    employees = "employees"
    residents = "residents"
    services = "services"


def _csv_value(value: object | None) -> object:
    """Return spreadsheet-safe text while preserving ordinary CSV values.

    Office applications can execute cells beginning with formula-control characters.
    Prefixing user-entered strings with an apostrophe keeps exported files inert.
    """
    if value is None:
        return ""
    if isinstance(value, Enum):
        value = value.value
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{value}"
    return value


def _csv_response(
    dataset: ExportDataset, headers: Sequence[str], rows: Iterable[Sequence[object | None]]
) -> Response:
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\r\n")
    writer.writerow(headers)
    writer.writerows([_csv_value(value) for value in row] for row in rows)

    # A UTF-8 BOM makes non-ASCII names open correctly in common spreadsheet apps.
    content = "\ufeff" + stream.getvalue()
    export_date = datetime.now(timezone.utc).date().isoformat()
    filename = f"simplifix-{dataset.value}-{export_date}.csv"
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


def _employee_export(db: Session) -> Response:
    users = (
        db.query(User)
        .filter(User.role.in_([UserRole.facility_employee, UserRole.maintenance_staff]))
        .order_by(User.name, User.id)
        .all()
    )
    return _csv_response(
        ExportDataset.employees,
        (
            "employee_id",
            "name",
            "role",
            "title",
            "specialization",
            "email",
            "phone",
            "account_status",
            "active_jobs",
            "rating",
            "joined_at",
        ),
        (
            (
                user.id,
                user.name,
                user.role,
                user.title,
                user.specialization,
                user.email,
                user.phone,
                user.account_status,
                user.active_jobs,
                user.rating,
                user.created_at,
            )
            for user in users
        ),
    )


def _resident_export(db: Session) -> Response:
    users = (
        db.query(User)
        .filter(User.role == UserRole.resident)
        .order_by(User.name, User.id)
        .all()
    )
    return _csv_response(
        ExportDataset.residents,
        (
            "resident_id",
            "name",
            "email",
            "phone",
            "building",
            "unit_number",
            "account_status",
            "joined_at",
        ),
        (
            (
                user.id,
                user.name,
                user.email,
                user.phone,
                user.building,
                user.unit_number,
                user.account_status,
                user.created_at,
            )
            for user in users
        ),
    )


def _service_export(db: Session) -> Response:
    services = db.query(PublicService).order_by(PublicService.created_at.desc()).all()
    users = {user.id: user for user in db.query(User).all()}
    categories = {category.id: category for category in db.query(Category).all()}

    def rows() -> Iterable[Sequence[object | None]]:
        for service in services:
            creator = users.get(service.created_by_id)
            worker = users.get(service.worker_id) if service.worker_id else None
            reports = sorted(service.reports, key=lambda report: report.created_at)
            yield (
                service.id,
                service.title,
                categories.get(service.category_id).name
                if service.category_id in categories
                else service.category_id,
                service.description,
                service.location,
                service.priority,
                service.status,
                service.created_by_id,
                creator.name if creator else "",
                creator.email if creator else "",
                creator.building if creator else "",
                service.worker_id,
                worker.name if worker else "",
                worker.email if worker else "",
                len(reports),
                " | ".join(report.id for report in reports),
                " | ".join(report.author.name for report in reports),
                len(service.comments),
                service.created_at,
                service.updated_at,
                service.resolved_at,
                service.resolution_remarks,
                service.resolution_proof_url,
                service.merged_into_id,
            )

    return _csv_response(
        ExportDataset.services,
        (
            "service_id",
            "title",
            "category",
            "description",
            "location",
            "priority",
            "status",
            "created_by_id",
            "created_by_name",
            "created_by_email",
            "created_by_building",
            "assigned_worker_id",
            "assigned_worker_name",
            "assigned_worker_email",
            "report_count",
            "report_ids",
            "report_authors",
            "comment_count",
            "created_at",
            "updated_at",
            "resolved_at",
            "resolution_remarks",
            "resolution_proof_url",
            "merged_into_id",
        ),
        rows(),
    )


@router.get(
    "/{dataset}.csv",
    dependencies=[Depends(require_roles(UserRole.facility_manager))],
    responses={**UNAUTHORIZED, **FORBIDDEN},
)
def export_csv(dataset: ExportDataset, db: Session = Depends(get_db)) -> Response:
    exporters = {
        ExportDataset.employees: _employee_export,
        ExportDataset.residents: _resident_export,
        ExportDataset.services: _service_export,
    }
    return exporters[dataset](db)
