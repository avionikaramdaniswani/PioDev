import { useEffect, useState } from "react";

export type TierPricing = {
  price_idr: number;
  discount_percent: number;
  discount_label: string;
};

export type PricingConfig = {
  plus: TierPricing;
  pro: TierPricing;
};

export const DEFAULT_PRICING: PricingConfig = {
  plus: { price_idr: 10000, discount_percent: 0, discount_label: "" },
  pro:  { price_idr: 18000, discount_percent: 0, discount_label: "" },
};

export function discountedPrice(t: TierPricing): number {
  if (!t.discount_percent || t.discount_percent <= 0) return t.price_idr;
  return Math.round(t.price_idr * (100 - t.discount_percent) / 100);
}

export function formatIDR(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

// Module-level cache supaya halaman lain (chat promo) tidak fetch berulang.
let cached: { value: PricingConfig; loadedAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;
let inflight: Promise<PricingConfig> | null = null;

export async function fetchPricingConfig(force = false): Promise<PricingConfig> {
  if (!force && cached && Date.now() - cached.loadedAt < TTL_MS) {
    return cached.value;
  }
  if (!force && inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/pricing-config");
      if (!res.ok) throw new Error("fetch failed");
      const value = (await res.json()) as PricingConfig;
      cached = { value, loadedAt: Date.now() };
      return value;
    } catch {
      cached = { value: DEFAULT_PRICING, loadedAt: Date.now() };
      return DEFAULT_PRICING;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function invalidatePricingConfig() {
  cached = null;
}

export function usePricingConfig(): PricingConfig {
  const [config, setConfig] = useState<PricingConfig>(cached?.value ?? DEFAULT_PRICING);
  useEffect(() => {
    let alive = true;
    fetchPricingConfig().then((v) => {
      if (alive) setConfig(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
