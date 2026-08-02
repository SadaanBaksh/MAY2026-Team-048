from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "Simplifix API"
    API_V1_STR: str = "/api/v1"

    DATABASE_URL: str = "postgresql+psycopg2://simplifix:simplifix@localhost:5432/simplifix"

    SECRET_KEY: str = "change-this-to-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    BACKEND_CORS_ORIGINS: str = "http://localhost:8081,http://localhost:19006"

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = ""

    # Kept server-side only. Never expose this value through the Expo app.
    GEMINI_API_KEY: str = ""
    # Not "-flash-lite": Google restricted that variant from new users/projects partway through
    # this project (confirmed via a 404 "no longer available to new users" from the Gemini API
    # despite it still being listed in ListModels) — this is the closest stable, still-multimodal
    # sibling. If Google deprecates this one too, check `GET /v1beta/models` with your own key for
    # what's currently available before picking a replacement.
    GEMINI_MODEL: str = "gemini-2.5-flash"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
