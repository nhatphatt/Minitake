import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoading } from "../../contexts/LoadingContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, ExternalLink, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";
import { getAuthUser, removeAuthToken, removeAuthUser } from "@/utils/auth";

const statusMap = {
  paid: "bg-emerald-500/20 text-emerald-300",
  pending: "bg-amber-500/20 text-amber-300",
  failed: "bg-red-500/20 text-red-300",
  cancelled: "bg-slate-500/20 text-slate-300",
};

const SuperAdminPayOS = () => {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const [payments, setPayments] = useState([]);
  const [config, setConfig] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [syncingId, setSyncingId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const user = getAuthUser();
    if (!user || user.role !== "super_admin") {
      removeAuthToken();
      removeAuthUser();
      navigate("/admin/login", { replace: true });
      return;
    }

    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm, statusFilter]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const timer = setInterval(() => {
      fetchPayments();
    }, 30000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, page, searchTerm, statusFilter]);

  const fetchConfig = async () => {
    try {
      const res = await api.get("/super-admin/payos/config");
      setConfig(res.data);
    } catch (error) {
      toast.error("Không thể tải cấu hình PayOS");
    }
  };

  const fetchPayments = async () => {
    showLoading("Đang tải thanh toán PayOS...");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await api.get(`/super-admin/payos/payments?${params.toString()}`);
      setPayments(res.data.payments || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalPayments(res.data.total || 0);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Không thể tải danh sách PayOS");
    } finally {
      hideLoading();
    }
  };

  const handleSync = async (paymentId) => {
    setSyncingId(paymentId);
    try {
      const res = await api.post(`/super-admin/payos/payments/${paymentId}/sync`);
      toast.success(`Đồng bộ thành công: ${res.data.payos_status || res.data.local_status}`);
      fetchPayments();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Không thể đồng bộ payment");
    } finally {
      setSyncingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
  };

  const summary = useMemo(() => ({
    paid: payments.filter((item) => item.status === "paid").length,
    pending: payments.filter((item) => item.status === "pending").length,
    amount: payments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }), [payments]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Quản lý PayOS</h1>
          <p className="text-slate-400 mt-1">Theo dõi và đồng bộ thanh toán PayOS cho subscription</p>
        </div>
        <Button variant="outline" onClick={fetchPayments} className="border-slate-600 text-slate-300 hover:bg-slate-700">
          <RefreshCw className="w-4 h-4 mr-2" />
          Làm mới
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">Tự động làm mới mỗi 30 giây</p>
          <p className="text-xs text-slate-400">Phù hợp để theo dõi payment mới hoặc trạng thái pending</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setAutoRefresh((prev) => !prev)}
          className={`border-slate-600 ${autoRefresh ? "text-emerald-300 hover:bg-emerald-500/10" : "text-slate-300 hover:bg-slate-700"}`}
        >
          {autoRefresh ? "Đang bật" : "Đang tắt"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <p className="text-sm text-slate-400">Tổng payments</p>
            <p className="text-2xl font-bold text-white mt-1">{totalPayments}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <p className="text-sm text-slate-400">Paid trong trang</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.paid}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <p className="text-sm text-slate-400">Pending trong trang</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{summary.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <p className="text-sm text-slate-400">Tổng tiền trong trang</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.amount.toLocaleString()}đ</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Trạng thái cấu hình PayOS
          </CardTitle>
          <CardDescription className="text-slate-400">Kiểm tra nhanh biến môi trường PayOS ở backend</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Badge className={config?.client_id_configured ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>Client ID</Badge>
          <Badge className={config?.api_key_configured ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>API Key</Badge>
          <Badge className={config?.checksum_key_configured ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>Checksum Key</Badge>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            Danh sách PayOS payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                placeholder="Tìm payment id, order id, store, owner..."
                className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-2">
              {[
                { label: "Tất cả", value: "" },
                { label: "Pending", value: "pending" },
                { label: "Paid", value: "paid" },
              ].map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  onClick={() => { setStatusFilter(item.value); setPage(1); }}
                  className={`border-slate-600 ${statusFilter === item.value ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700"}`}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Chưa có payment PayOS</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700/50 hover:bg-slate-700/30">
                    <TableHead className="text-slate-400">Payment</TableHead>
                    <TableHead className="text-slate-400">Store</TableHead>
                    <TableHead className="text-slate-400">Số tiền</TableHead>
                    <TableHead className="text-slate-400">Trạng thái</TableHead>
                    <TableHead className="text-slate-400">Mã GD PayOS</TableHead>
                    <TableHead className="text-slate-400">Tạo lúc</TableHead>
                    <TableHead className="text-slate-400 text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.payment_id} className="border-slate-700/50 hover:bg-slate-700/30">
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{payment.payment_id}</p>
                          <p className="text-xs text-slate-400">Order: {payment.payos_order_id || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white">{payment.store_name || "Chờ tạo store"}</p>
                          <p className="text-xs text-slate-400">{payment.owner_email || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-white">{Number(payment.amount || 0).toLocaleString()}đ</TableCell>
                      <TableCell>
                        <Badge className={statusMap[payment.status] || "bg-slate-500/20 text-slate-300"}>{payment.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-300">
                          <div>{payment.payos_transaction_id || "-"}</div>
                          {payment.status === "paid" && (
                            <div className="text-xs text-emerald-400">
                              {formatDate(payment.paid_at || payment.updated_at)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-400">{formatDate(payment.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {payment.payos_payment_link && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(payment.payos_payment_link, "_blank", "noopener,noreferrer")}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              title="Mở link PayOS"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSync(payment.payment_id)}
                            disabled={syncingId === payment.payment_id}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${syncingId === payment.payment_id ? "animate-spin" : ""}`} />
                            Sync
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                  <p className="text-sm text-slate-400">Trang {page} / {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="border-slate-600 text-slate-300 hover:bg-slate-700">Trước</Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="border-slate-600 text-slate-300 hover:bg-slate-700">Sau</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminPayOS;
