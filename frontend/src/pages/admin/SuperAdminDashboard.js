import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLoading } from "../../contexts/LoadingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  Users,
  ShoppingCart,
  DollarSign,
  Crown,
  Zap,
  TrendingUp,
  UtensilsCrossed,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "@/utils/api";
import { toast } from "sonner";
import { getAuthUser, removeAuthToken, removeAuthUser } from "@/utils/auth";
import { Button } from "@/components/ui/button";

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const [data, setData] = useState(null);

  useEffect(() => {
    const user = getAuthUser();
    if (!user || user.role !== "super_admin") {
      removeAuthToken();
      removeAuthUser();
      navigate("/admin/login", { replace: true });
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    showLoading("Đang tải dữ liệu...");
    try {
      const res = await api.get("/super-admin/dashboard");
      setData(res.data);
    } catch (error) {
      toast.error("Không thể tải dữ liệu dashboard");
    } finally {
      hideLoading();
    }
  };

  if (!data) return null;

  const statCards = [
    {
      label: "Tổng cửa hàng",
      value: data.total_stores,
      icon: Building,
      color: "text-blue-400",
      bg: "bg-blue-500/20",
    },
    {
      label: "Tổng người dùng",
      value: data.total_users,
      icon: Users,
      color: "text-purple-400",
      bg: "bg-purple-500/20",
    },
    {
      label: "Tổng đơn hàng",
      value: data.total_orders.toLocaleString(),
      icon: ShoppingCart,
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
    },
    {
      label: "Tổng món trong hệ thống",
      value: data.total_menu_items,
      icon: UtensilsCrossed,
      color: "text-amber-400",
      bg: "bg-amber-500/20",
    },
  ];

  const subCards = [
    {
      label: "Đơn hôm nay",
      value: data.today_orders,
      sub: data.today_revenue > 0 ? `${data.today_revenue.toLocaleString()}đ` : "0đ",
      icon: TrendingUp,
      color: "text-teal-400",
      bg: "bg-teal-500/20",
    },
    {
      label: "Gói Pro",
      value: data.pro_stores,
      icon: Crown,
      color: "text-amber-400",
      bg: "bg-amber-500/20",
    },
    {
      label: "Gói Starter",
      value: data.starter_stores,
      icon: Zap,
      color: "text-slate-400",
      bg: "bg-slate-500/20",
    },
    {
      label: "Doanh thu subscription",
      value: `${data.total_revenue.toLocaleString()}đ`,
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-500/20",
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#FFFFFF]">Tổng quan hệ thống</h1>
          <p className="text-slate-400 text-sm mt-1">
            Dashboard quản trị Super Admin
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="border-slate-600 text-slate-300 hover:bg-slate-700">
          <RefreshCw className="w-4 h-4 mr-2" />
          Làm mới
        </Button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-sm text-slate-400 mt-1">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {subCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{s.value}</div>
                  <div className="text-xs text-slate-400">{s.label}</div>
                  {s.sub && <div className="text-xs text-emerald-400 font-medium">{s.sub}</div>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      {data.orders_by_day.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white">
              Đơn hàng 7 ngày gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.orders_by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                  formatter={(value, name) =>
                    name === "revenue"
                      ? [`${Number(value).toLocaleString()}đ`, "Doanh thu"]
                      : [value, "Đơn hàng"]
                  }
                  labelFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                  }}
                />
                <Bar dataKey="orders" fill="#10b981" radius={[4, 4, 0, 0]} name="orders" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-1 gap-6">

        {/* Top Stores by Revenue */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white">
              Top doanh thu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.top_stores.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Chưa có dữ liệu</p>
            )}
            {data.top_stores.map((store, i) => (
              <div
                key={store.id}
                className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-xl"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  i === 0
                    ? "bg-amber-500/20 text-amber-400"
                    : i === 1
                    ? "bg-slate-600/50 text-slate-300"
                    : "bg-orange-500/20 text-orange-400"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white truncate">
                    {store.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {store.order_count || 0} đơn hàng
                  </div>
                </div>
                <div className="text-sm font-semibold text-emerald-400">
                  {Number(store.revenue || 0).toLocaleString()}đ
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
