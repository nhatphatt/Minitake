import React, { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";

const PERIODS = [
  { key: "day", label: "Ngày" },
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
  { key: "quarter", label: "Quý" },
  { key: "year", label: "Năm" },
  { key: "range", label: "Tùy chọn" },
];

const formatCurrency = (v) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v || 0);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm">
      <p className="text-slate-300 mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === "total_amount" ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const SuperAdminFinanceRevenue = () => {
  const [period, setPeriod] = useState("month");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchRevenue = useCallback(async (p, start, end) => {
    setLoading(true);
    try {
      let url = `/super-admin/finance/revenue?period=${p}`;
      if (p === "range") {
        if (!start || !end) return;
        url += `&start=${start}&end=${end}`;
      }
      const res = await api.get(url);
      setData(res.data);
    } catch {
      toast.error("Không thể tải dữ liệu doanh thu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (period !== "range") fetchRevenue(period);
  }, [period, fetchRevenue]);

  const handleRangeApply = () => {
    if (!rangeStart || !rangeEnd) {
      toast.error("Vui lòng chọn ngày bắt đầu và kết thúc");
      return;
    }
    if (rangeStart > rangeEnd) {
      toast.error("Ngày bắt đầu phải trước ngày kết thúc");
      return;
    }
    fetchRevenue("range", rangeStart, rangeEnd);
  };

  const summary = data?.summary || {};
  const chartData = data?.data || [];
  const byPlan = data?.breakdown_by_plan || [];

  const growthPct = summary.growth_pct;
  const GrowthIcon = growthPct >= 0 ? TrendingUp : TrendingDown;
  const growthColor = growthPct >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="p-8 min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Doanh thu</h1>
          <p className="text-slate-400 mt-1">Thống kê doanh thu từ subscription</p>
        </div>
        <Button
          variant="outline"
          onClick={() => period !== "range" ? fetchRevenue(period) : handleRangeApply()}
          disabled={loading}
          className="border-slate-700 text-slate-300 hover:bg-slate-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === p.key
                ? "bg-violet-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            {p.label}
          </button>
        ))}
        {period === "range" && (
          <div className="flex items-center gap-2 ml-2">
            <Input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-300 w-40"
            />
            <span className="text-slate-500">→</span>
            <Input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-300 w-40"
            />
            <Button
              onClick={handleRangeApply}
              disabled={loading}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Áp dụng
            </Button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="bg-slate-800/50 border-slate-700 lg:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Tổng doanh thu</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {formatCurrency(summary.total_revenue)}
                </p>
                {growthPct !== null && growthPct !== undefined && (
                  <div className={`flex items-center gap-1 mt-2 text-sm ${growthColor}`}>
                    <GrowthIcon className="w-4 h-4" />
                    {growthPct >= 0 ? "+" : ""}{growthPct}% so với kỳ trước
                  </div>
                )}
              </div>
              <DollarSign className="w-10 h-10 text-emerald-400/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Tổng giao dịch</p>
                <p className="text-2xl font-bold text-white mt-1">{summary.total_transactions || 0}</p>
              </div>
              <CreditCard className="w-8 h-8 text-violet-400/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Đã thanh toán</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.paid_count || 0}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 text-xs font-bold">✓</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Chờ xử lý</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{summary.pending_count || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-slate-800/50 border-slate-700 mb-8">
        <CardHeader>
          <CardTitle className="text-white text-base">Biểu đồ doanh thu</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500">
              {loading ? "Đang tải..." : "Không có dữ liệu"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period_key" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 13 }} />
                <Bar yAxisId="left" dataKey="total_amount" name="Doanh thu (VNĐ)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="payment_count" name="Số GD" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Breakdown by plan */}
      {byPlan.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Phân tích theo gói</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byPlan.map((row) => (
                <div key={row.plan_id || "unknown"} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        row.plan_id === "pro"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-slate-600/50 text-slate-300 border-slate-600"
                      }
                    >
                      {row.plan_id === "pro" ? "PRO" : row.plan_id === "starter" ? "STARTER" : row.plan_id || "Không rõ"}
                    </Badge>
                    <span className="text-slate-400 text-sm">{row.count} giao dịch</span>
                  </div>
                  <span className="text-emerald-400 font-semibold">{formatCurrency(row.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SuperAdminFinanceRevenue;
