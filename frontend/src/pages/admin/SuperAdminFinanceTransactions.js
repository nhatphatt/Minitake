import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, Search, ChevronLeft, ChevronRight, Wifi } from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";

const POLL_INTERVAL = 30000; // 30 seconds

const formatCurrency = (v) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v || 0);

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const STATUS_MAP = {
  paid:    { label: "Đã thanh toán", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  pending: { label: "Chờ xử lý",    cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  failed:  { label: "Thất bại",     cls: "bg-red-500/20 text-red-300 border-red-500/30" },
  cancelled: { label: "Đã hủy",    cls: "bg-slate-600/50 text-slate-400 border-slate-600" },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || { label: status, cls: "bg-slate-600/50 text-slate-400 border-slate-600" };
  return <Badge className={s.cls}>{s.label}</Badge>;
};

const SuperAdminFinanceTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  const LIMIT = 20;

  const fetchTransactions = useCallback(async (p, s, st) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: p,
        limit: LIMIT,
        sort: "desc",
      });
      if (st) params.set("status", st);
      if (s) params.set("search", s);

      const res = await api.get(`/super-admin/finance/transactions?${params}`);
      setTransactions(res.data.transactions || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch {
      toast.error("Không thể tải danh sách giao dịch");
    } finally {
      setLoading(false);
    }
  }, []);

  // Start polling
  const startPoll = useCallback((p, s, st) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchTransactions(p, s, st), POLL_INTERVAL);
  }, [fetchTransactions]);

  useEffect(() => {
    fetchTransactions(page, search, statusFilter);
    startPoll(page, search, statusFilter);

    // Tick counter
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setSecondsAgo((s) => s + 1), 1000);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(tickRef.current);
    };
  }, [page, search, statusFilter, fetchTransactions, startPoll]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleStatusFilter = (s) => {
    setPage(1);
    setStatusFilter(s === statusFilter ? "" : s);
  };

  const handleRefresh = () => {
    fetchTransactions(page, search, statusFilter);
    startPoll(page, search, statusFilter);
  };

  return (
    <div className="p-8 min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Giao dịch</h1>
          <div className="flex items-center gap-2 mt-1">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <p className="text-slate-400 text-sm">
              Tự động cập nhật mỗi {POLL_INTERVAL / 1000}s
              {lastUpdated && (
                <span className="ml-2 text-slate-500">
                  · Cập nhật {secondsAgo}s trước
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={loading}
          className="border-slate-700 text-slate-300 hover:bg-slate-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800/50 border-slate-700 mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-60">
              <Input
                placeholder="Tìm tên cửa hàng hoặc email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="bg-slate-700 border-slate-600 text-slate-300 placeholder:text-slate-500"
              />
              <Button
                onClick={handleSearch}
                className="bg-violet-600 hover:bg-violet-700 shrink-0"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              {["paid", "pending", "failed"].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    statusFilter === s
                      ? STATUS_MAP[s].cls
                      : "border-slate-700 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {STATUS_MAP[s].label}
                </button>
              ))}
              {statusFilter && (
                <button
                  onClick={() => handleStatusFilter("")}
                  className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-300"
                >
                  Xóa lọc
                </button>
              )}
            </div>

            <span className="text-slate-500 text-sm ml-auto">
              {total} giao dịch
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4 px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400 pl-6">Cửa hàng</TableHead>
                <TableHead className="text-slate-400">Email chủ</TableHead>
                <TableHead className="text-slate-400">Gói</TableHead>
                <TableHead className="text-slate-400">Số tiền</TableHead>
                <TableHead className="text-slate-400">Trạng thái</TableHead>
                <TableHead className="text-slate-400">Phương thức</TableHead>
                <TableHead className="text-slate-400">Thời gian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-12">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-12">
                    Không có giao dịch nào
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow
                    key={tx.payment_id}
                    className="border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                  >
                    <TableCell className="pl-6">
                      <div>
                        <p className="text-white font-medium">{tx.store_name || "—"}</p>
                        {tx.store_slug && (
                          <p className="text-slate-500 text-xs">{tx.store_slug}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">{tx.owner_email || "—"}</TableCell>
                    <TableCell>
                      {tx.plan_id === "pro" ? (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">PRO</Badge>
                      ) : (
                        <Badge className="bg-slate-600/50 text-slate-400 border-slate-600">STARTER</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-emerald-400 font-semibold">
                      {formatCurrency(tx.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={tx.status} />
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm capitalize">
                      {tx.payment_method || "—"}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {formatDate(tx.paid_at || tx.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
            <p className="text-slate-500 text-sm">
              Trang {page} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="border-slate-700 text-slate-400 hover:bg-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="border-slate-700 text-slate-400 hover:bg-slate-700"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SuperAdminFinanceTransactions;
