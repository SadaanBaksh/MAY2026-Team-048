from pydantic import BaseModel, ConfigDict


class CategoryBase(BaseModel):
    name: str
    icon: str


class CategoryCreate(CategoryBase):
    id: str


class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
