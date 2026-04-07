import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from stock_service import StockService

logging.basicConfig(level=logging.INFO)

STATIC_DIR = Path(__file__).parent / "static"
service: StockService


@asynccontextmanager
async def lifespan(app: FastAPI):
    global service
    service = StockService()
    yield


app = FastAPI(title="DOF Group Stock Tracker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/quote")
async def quote():
    try:
        return service.get_quote()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/chart")
async def chart(period: str = Query(default="1d", pattern="^(1d|5d|1mo|3mo)$")):
    try:
        return service.get_chart(period)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/news")
async def news():
    try:
        return service.get_news()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/info")
async def info():
    try:
        return service.get_info()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
