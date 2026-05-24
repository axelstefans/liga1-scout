import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Liga 1 Scout API"
    VERSION: str = "1.0.0"
    
    # SQLite Database
    DB_PATH: str = os.getenv("DB_PATH", "liga1.db")
    
    # CORS
    # Only allow the Vite dev server by default
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

settings = Settings()
