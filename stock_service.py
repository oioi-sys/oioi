import time
import logging
from datetime import datetime, timezone
from typing import Any

import yfinance as yf

logger = logging.getLogger(__name__)

TICKER = "DOF.OL"

PERIOD_INTERVAL = {
    "1d": "5m",
    "5d": "15m",
    "1mo": "1d",
    "3mo": "1d",
}


class StockService:
    QUOTE_TTL = 25
    CHART_TTL = 55
    NEWS_TTL = 240
    INFO_TTL = 3600

    def __init__(self):
        self._ticker = yf.Ticker(TICKER)
        self._quote_cache: tuple[dict, float] | None = None
        self._chart_cache: dict[str, tuple[dict, float]] = {}
        self._news_cache: tuple[dict, float] | None = None
        self._info_cache: tuple[dict, float] | None = None

    def _is_fresh(self, cache_entry: tuple[Any, float] | None, ttl: int) -> bool:
        if cache_entry is None:
            return False
        return (time.monotonic() - cache_entry[1]) < ttl

    def get_quote(self) -> dict:
        if self._is_fresh(self._quote_cache, self.QUOTE_TTL):
            return self._quote_cache[0]  # type: ignore[index]

        try:
            fi = self._ticker.fast_info
            price = fi.last_price
            prev_close = fi.previous_close
            if price is None:
                raise ValueError("No price available")

            change = round(price - prev_close, 4) if prev_close else None
            change_pct = round((change / prev_close) * 100, 2) if prev_close and change is not None else None

            data = {
                "ticker": TICKER,
                "price": round(price, 2),
                "currency": fi.currency or "NOK",
                "change": change,
                "change_pct": change_pct,
                "prev_close": round(prev_close, 2) if prev_close else None,
                "day_high": round(fi.day_high, 2) if fi.day_high else None,
                "day_low": round(fi.day_low, 2) if fi.day_low else None,
                "volume": fi.last_volume,
                "market_cap": fi.market_cap,
                "market_state": getattr(fi, "market_state", "UNKNOWN"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            self._quote_cache = (data, time.monotonic())
            return data
        except Exception as e:
            logger.warning("Failed to fetch quote: %s", e)
            if self._quote_cache:
                return self._quote_cache[0]
            raise

    def get_chart(self, period: str) -> dict:
        if period not in PERIOD_INTERVAL:
            period = "1d"

        cached = self._chart_cache.get(period)
        if self._is_fresh(cached, self.CHART_TTL):
            return cached[0]  # type: ignore[index]

        interval = PERIOD_INTERVAL[period]
        try:
            df = self._ticker.history(period=period, interval=interval)
            if df.empty:
                raise ValueError("Empty chart data")

            points = []
            for ts, row in df.iterrows():
                if hasattr(ts, "to_pydatetime"):
                    ts = ts.to_pydatetime()
                points.append({
                    "t": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                    "o": round(float(row["Open"]), 2),
                    "h": round(float(row["High"]), 2),
                    "l": round(float(row["Low"]), 2),
                    "c": round(float(row["Close"]), 2),
                    "v": int(row["Volume"]),
                })

            data = {"period": period, "interval": interval, "data": points}
            self._chart_cache[period] = (data, time.monotonic())
            return data
        except Exception as e:
            logger.warning("Failed to fetch chart (%s): %s", period, e)
            if cached:
                return cached[0]
            raise

    def get_news(self) -> dict:
        if self._is_fresh(self._news_cache, self.NEWS_TTL):
            return self._news_cache[0]  # type: ignore[index]

        try:
            raw = self._ticker.news or []
            items = []
            for n in raw:
                content = n.get("content", {})
                title = content.get("title") or n.get("title", "")
                publisher = content.get("provider", {}).get("displayName") or n.get("publisher", "")
                link = (
                    content.get("canonicalUrl", {}).get("url")
                    or content.get("clickThroughUrl", {}).get("url")
                    or n.get("link", "")
                )
                pub_time = content.get("pubDate") or n.get("providerPublishTime")
                if isinstance(pub_time, (int, float)):
                    pub_time = datetime.fromtimestamp(pub_time, tz=timezone.utc).isoformat()
                summary = content.get("summary") or content.get("description") or ""
                thumbnail = ""
                thumbnails = content.get("thumbnail", {}).get("resolutions", [])
                if thumbnails:
                    thumbnail = thumbnails[0].get("url", "")
                if title:
                    items.append({
                        "title": title,
                        "publisher": publisher,
                        "link": link,
                        "published_at": pub_time,
                        "summary": summary,
                        "thumbnail": thumbnail,
                    })

            data = {"items": items, "count": len(items)}
            self._news_cache = (data, time.monotonic())
            return data
        except Exception as e:
            logger.warning("Failed to fetch news: %s", e)
            if self._news_cache:
                return self._news_cache[0]
            raise

    def get_info(self) -> dict:
        if self._is_fresh(self._info_cache, self.INFO_TTL):
            return self._info_cache[0]  # type: ignore[index]

        try:
            info = self._ticker.info or {}
            hi52 = info.get("fiftyTwoWeekHigh")
            lo52 = info.get("fiftyTwoWeekLow")
            data = {
                "name": info.get("longName", "DOF Group ASA"),
                "sector": info.get("sector", ""),
                "industry": info.get("industry", ""),
                "description": info.get("longBusinessSummary", ""),
                "website": info.get("website", "https://dofgroup.com"),
                "employees": info.get("fullTimeEmployees"),
                "pe_ratio": info.get("trailingPE"),
                "52w_high": round(hi52, 2) if hi52 else None,
                "52w_low": round(lo52, 2) if lo52 else None,
                "exchange": info.get("exchange", "OSL"),
            }
            self._info_cache = (data, time.monotonic())
            return data
        except Exception as e:
            logger.warning("Failed to fetch info: %s", e)
            if self._info_cache:
                return self._info_cache[0]
            raise
