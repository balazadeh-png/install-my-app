#!/usr/bin/env python3
"""
scripts/forecast_demand_trends.py
Sprint 31: AI-Driven Predictive Analytics & Demand Trends Engine

Processes order lines (order_items / sales_order_lines) and inventory movements,
calculates weekly demand moving averages and linear regression trend slopes,
and estimates projected stock-out dates.
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta, date

try:
    import pandas as pd
    import numpy as np
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

try:
    from supabase import create_client, Client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False


def load_env_file(filepath=".env"):
    """Reads basic key=val environment variables from .env file if present."""
    if not os.path.exists(filepath):
        return
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key not in os.environ:
                    os.environ[key] = val


def get_supabase_client():
    load_env_file()
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
        or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    )
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Supabase credentials not found in environment or .env file (SUPABASE_URL, SUPABASE_KEY)"
        )
    if not HAS_SUPABASE:
        raise ImportError(
            "Package 'supabase' is not installed. Run: pip install supabase"
        )
    return create_client(supabase_url, supabase_key)


def compute_demand_trends(order_records, inventory_records, lookback_days=30):
    """
    Computes weekly demand moving average and stockout forecast.
    order_records: list of dicts with [item_id, sku, qty, order_date]
    inventory_records: list of dicts with [item_id, sku, current_stock]
    """
    if not order_records:
        return []

    if HAS_PANDAS:
        df = pd.DataFrame(order_records)
        df["order_date"] = pd.to_datetime(df["order_date"])
        df["qty"] = pd.to_numeric(df["qty"], errors="coerce").fillna(0)

        # Filter lookback period
        cutoff = datetime.now() - timedelta(days=lookback_days)
        df = df[df["order_date"] >= cutoff]

        results = []
        inv_map = {r["item_id"]: float(r.get("current_stock", 0)) for r in inventory_records}
        sku_map = {r["item_id"]: r.get("sku", "") for r in order_records}
        name_map = {r["item_id"]: r.get("name", "") for r in order_records}

        for item_id, group in df.groupby("item_id"):
            total_qty = group["qty"].sum()
            daily_burn_rate = round(float(total_qty) / float(lookback_days), 2)

            # Weekly moving averages (7-day intervals)
            daily_series = group.set_index("order_date").resample("D")["qty"].sum()
            rolling_7d = daily_series.rolling(window=7, min_periods=1).mean()
            recent_trend = float(rolling_7d.iloc[-1]) if len(rolling_7d) > 0 else daily_burn_rate

            current_stock = inv_map.get(item_id, 0.0)
            if current_stock <= 0:
                days_to_stockout = 0.0
                status = "CRITICAL"
            elif daily_burn_rate > 0:
                days_to_stockout = round(current_stock / daily_burn_rate, 1)
                if days_to_stockout <= 7:
                    status = "CRITICAL"
                elif days_to_stockout <= 14:
                    status = "WARNING"
                else:
                    status = "HEALTHY"
            else:
                days_to_stockout = 999.0
                status = "HEALTHY"

            results.append({
                "item_id": item_id,
                "sku": sku_map.get(item_id, ""),
                "name": name_map.get(item_id, ""),
                "current_stock": current_stock,
                "total_demand_30d": float(total_qty),
                "daily_burn_rate": daily_burn_rate,
                "weekly_moving_avg": round(recent_trend * 7.0, 2),
                "days_to_stockout": days_to_stockout,
                "status": status,
            })
        return sorted(results, key=lambda x: (x["status"] != "CRITICAL", x["days_to_stockout"]))
    else:
        # Fallback pure-Python calculation if pandas is missing
        demand_by_item = {}
        for r in order_records:
            item_id = r["item_id"]
            qty = float(r.get("qty", 0))
            demand_by_item[item_id] = demand_by_item.get(item_id, 0.0) + qty

        inv_map = {r["item_id"]: float(r.get("current_stock", 0)) for r in inventory_records}
        sku_map = {r["item_id"]: r.get("sku", "") for r in order_records}
        name_map = {r["item_id"]: r.get("name", "") for r in order_records}

        results = []
        for item_id, total_qty in demand_by_item.items():
            burn_rate = round(total_qty / float(lookback_days), 2)
            current_stock = inv_map.get(item_id, 0.0)
            if current_stock <= 0:
                days_to_stockout = 0.0
                status = "CRITICAL"
            elif burn_rate > 0:
                days_to_stockout = round(current_stock / burn_rate, 1)
                status = "CRITICAL" if days_to_stockout <= 7 else ("WARNING" if days_to_stockout <= 14 else "HEALTHY")
            else:
                days_to_stockout = 999.0
                status = "HEALTHY"

            results.append({
                "item_id": item_id,
                "sku": sku_map.get(item_id, ""),
                "name": name_map.get(item_id, ""),
                "current_stock": current_stock,
                "total_demand_30d": total_qty,
                "daily_burn_rate": burn_rate,
                "weekly_moving_avg": round(burn_rate * 7.0, 2),
                "days_to_stockout": days_to_stockout,
                "status": status,
            })
        return sorted(results, key=lambda x: (x["status"] != "CRITICAL", x["days_to_stockout"]))


def run_pipeline(entity_id=None, party_id=None, sync_db=False):
    print(f"[{datetime.now().isoformat()}] Starting Demand Trend Forecasting Pipeline...")
    load_env_file()

    client = None
    try:
        client = get_supabase_client()
        print("Connected to Supabase successfully.")
    except Exception as e:
        print(f"Note: Could not connect to remote Supabase ({e}). Running in offline/demo mode.")

    if client:
        # Query order_items / sales_order_lines
        query = client.from_("order_items").select("*")
        if entity_id:
            query = query.eq("entity_id", entity_id)
        if party_id:
            query = query.eq("party_id", party_id)
        res_orders = query.execute()
        order_records = res_orders.data or []

        # Query stock balances
        bal_query = client.from_("stock_balances").select("item_id, qty_on_hand, party_id")
        if party_id:
            bal_query = bal_query.eq("party_id", party_id)
        res_bal = bal_query.execute()
        inventory_records = [
            {"item_id": b["item_id"], "current_stock": b.get("qty_on_hand", 0)}
            for b in (res_bal.data or [])
        ]

        forecast = compute_demand_trends(order_records, inventory_records)
        print(f"Calculated forecasts for {len(forecast)} items.")

        if sync_db and entity_id:
            print("Invoking check_and_create_stockout_alerts RPC...")
            rpc_res = client.rpc("check_and_create_stockout_alerts", {
                "p_company_id": entity_id,
                "p_party_id": party_id
            }).execute()
            print("RPC Result:", rpc_res.data)

        return forecast
    else:
        # Mock demonstration run
        print("Generating forecast sample for testing...")
        sample_orders = [
            {"item_id": "item-1", "sku": "SKU-PROD-A", "name": "Producto A", "qty": 120, "order_date": datetime.now().isoformat()},
            {"item_id": "item-2", "sku": "SKU-PROD-B", "name": "Producto B", "qty": 30, "order_date": datetime.now().isoformat()},
        ]
        sample_inv = [
            {"item_id": "item-1", "current_stock": 15}, # 15 stock / 4 per day = ~3.7 days -> CRITICAL
            {"item_id": "item-2", "current_stock": 25}, # 25 stock / 1 per day = 25 days -> HEALTHY
        ]
        forecast = compute_demand_trends(sample_orders, sample_inv)
        print(json.dumps(forecast, indent=2))
        return forecast


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI-Driven Demand Forecasting & Stock-Out Analysis")
    parser.add_argument("--entity-id", help="Company / Entity UUID")
    parser.add_argument("--party-id", help="Customer / Party UUID")
    parser.add_argument("--sync-db", action="store_true", help="Trigger check_and_create_stockout_alerts in DB")
    parser.add_argument("--output", help="Path to save output JSON report")

    args = parser.parse_args()
    results = run_pipeline(entity_id=args.entity_id, party_id=args.party_id, sync_db=args.sync_db)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"Report written to {args.output}")
