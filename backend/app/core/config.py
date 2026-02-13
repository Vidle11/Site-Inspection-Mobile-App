import os


class Settings:
    app_name: str = os.getenv("APP_NAME", "Site Inspection Evidence API")
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./site_inspection.db")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "local-dev-only-change-me")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_exp_minutes: int = int(os.getenv("JWT_EXP_MINUTES", "30"))


settings = Settings()
