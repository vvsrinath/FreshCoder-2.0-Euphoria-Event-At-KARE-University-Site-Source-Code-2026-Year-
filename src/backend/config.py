"""Application configuration. Secrets always come from the environment."""
import os

from dotenv import load_dotenv

# Load .env from the backend directory before reading any configuration.
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


def _int_env(name: str, default: int) -> int:
    value = os.environ.get(name)
    try:
        if value is None or value == "":
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


class Config:
    FLASK_ENV = os.environ.get("FLASK_ENV", "development")
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-only-change-me"
    DATABASE_PATH = os.environ.get("DATABASE_PATH", "database/fresh_coders.sqlite")
    # Comma separated list of allowed origins for the React frontend.
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
    SESSION_TTL_HOURS = _int_env("SESSION_TTL_HOURS", 8)
    MAX_CONTENT_LENGTH = _int_env("MAX_CONTENT_LENGTH", 4 * 1024 * 1024)
    LOGIN_MAX_ATTEMPTS = _int_env("LOGIN_MAX_ATTEMPTS", 5)
    LOGIN_WINDOW_MINUTES = _int_env("LOGIN_WINDOW_MINUTES", 15)

    @property
    def is_production(self) -> bool:
        return self.FLASK_ENV == "production"


config = Config()