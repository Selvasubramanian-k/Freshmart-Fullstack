from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import close_db, connect_db
from app.routes import (admin_routes, auth_routes, customer_routes, delivery_routes, owner_routes, picker_routes,
                        public_routes, support_routes)

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="FreshMart API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",  # any local dev port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Return one readable message (frontend shows `detail` directly) plus the raw errors."""
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    msg = first.get("msg", "Invalid input").replace("Value error, ", "")
    detail = f"{field}: {msg}" if field else msg
    return JSONResponse(status_code=422, content={"detail": detail, "errors": jsonable(errors)})


def jsonable(errors):
    out = []
    for e in errors:
        e = dict(e)
        e.pop("ctx", None)
        e.pop("input", None)
        out.append(e)
    return out


app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth_routes.router)
app.include_router(public_routes.router)
app.include_router(customer_routes.router)
app.include_router(admin_routes.router)
app.include_router(delivery_routes.router)
app.include_router(owner_routes.router)
app.include_router(support_routes.router)
app.include_router(picker_routes.router)


@app.get("/api/health", tags=["Health"])
async def health():
    return {"status": "ok"}
