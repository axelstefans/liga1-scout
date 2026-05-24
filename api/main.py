from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .routers import players, teams, rankings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Data API for Liga 1 Scout Dashboard"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"], # Dashboard is read-only
    allow_headers=["*"],
)

# Include routers
app.include_router(players.router, prefix="/api/v1")
app.include_router(teams.router, prefix="/api/v1")
app.include_router(rankings.router, prefix="/api/v1")

@app.get("/health")
def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "version": settings.VERSION}
