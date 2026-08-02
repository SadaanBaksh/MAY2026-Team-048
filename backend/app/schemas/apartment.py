from pydantic import BaseModel, ConfigDict, field_validator

# Matches the `apartments.building` / `apartments.unit_number` columns' limits
# (models/apartment.py) — without these, an overlong value hits a raw Postgres
# length-constraint error (500) instead of a clean 422.
BUILDING_MAX_LENGTH = 100
UNIT_NUMBER_MAX_LENGTH = 50


class ApartmentBase(BaseModel):
    unit_number: str
    building: str


class ApartmentCreate(ApartmentBase):
    @field_validator("building")
    @classmethod
    def validate_building(cls, value: str) -> str:
        if len(value) > BUILDING_MAX_LENGTH:
            raise ValueError(f"Building must be {BUILDING_MAX_LENGTH} characters or fewer.")
        return value

    @field_validator("unit_number")
    @classmethod
    def validate_unit_number(cls, value: str) -> str:
        if len(value) > UNIT_NUMBER_MAX_LENGTH:
            raise ValueError(f"Unit number must be {UNIT_NUMBER_MAX_LENGTH} characters or fewer.")
        return value


class ApartmentRead(ApartmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
