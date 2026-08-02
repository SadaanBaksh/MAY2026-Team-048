from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.apartment import Apartment
from app.models.enums import UserRole
from app.schemas.apartment import ApartmentCreate, ApartmentRead

router = APIRouter()


@router.get("/", response_model=list[ApartmentRead])
def list_apartments(db: Session = Depends(get_db)) -> list[Apartment]:
    return db.query(Apartment).all()


@router.post(
    "/",
    response_model=ApartmentRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.facility_employee, UserRole.facility_manager))],
)
def create_apartment(payload: ApartmentCreate, db: Session = Depends(get_db)) -> Apartment:
    apartment = Apartment(**payload.model_dump())
    db.add(apartment)
    db.commit()
    db.refresh(apartment)
    return apartment


@router.get("/{apartment_id}", response_model=ApartmentRead)
def get_apartment(apartment_id: str, db: Session = Depends(get_db)) -> Apartment:
    apartment = db.get(Apartment, apartment_id)
    if apartment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Apartment not found")
    return apartment
