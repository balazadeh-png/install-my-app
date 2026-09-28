import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

export interface StockoutForecastItem {
  item_id: string;
  item_code: string;
  item_name: string;
  company_id: string;
  party_id: string;
  current_stock: number;
  avg_daily_consumption: number;
  days_to_stockout: number;
  status: "CRITICAL" | "WARNING" | "HEALTHY";
}

export interface ClientAlertItem {
  id: string;
  company_id: string;
  party_id: string;
  item_id: string;
  severity: "CRITICAL" | "WARNING" | "INFO" | "HEALTHY";
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
  items?: {
    code: string;
    name: string;
  };
}

export const getInventoryForecastFn = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        company_id: z.string().uuid("ID de empresa inválido"),
        party_id: z.string().uuid().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseClient();
    const { data: forecast, error } = await supabase.rpc("get_inventory_stockout_forecast", {
      p_company_id: data.company_id,
      p_party_id: data.party_id || undefined,
    });

    if (error) {
      console.error("Error fetching inventory stockout forecast:", error);
      throw new Error(error.message);
    }

    return (forecast as StockoutForecastItem[]) || [];
  });

export const triggerStockoutAlertsCheckFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        company_id: z.string().uuid("ID de empresa inválido"),
        party_id: z.string().uuid().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseClient();
    const { data: result, error } = await supabase.rpc("check_and_create_stockout_alerts", {
      p_company_id: data.company_id,
      p_party_id: data.party_id || undefined,
    });

    if (error) {
      console.error("Error triggering stockout alerts check:", error);
      throw new Error(error.message);
    }

    return result as {
      success: boolean;
      critical_alerts: number;
      warning_alerts: number;
      resolved_alerts: number;
    };
  });
