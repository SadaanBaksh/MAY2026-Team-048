from pydantic import BaseModel, ConfigDict


class ApartmentBase(BaseModel):
    unit_number: str
    building: str


class ApartmentCreate(ApartmentBase):
    pass


class ApartmentRead(ApartmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
