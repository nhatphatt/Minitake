import React, { useState, useEffect } from "react";
import { useLoading } from "../../contexts/LoadingContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Search, Users, Trash2, RefreshCw, Shield, Mail, Calendar, Building, Crown, ArrowDownCircle
} from "lucide-react";
import { toast } from "sonner";
import api from "@/utils/api";
import { getAuthUser, removeAuthToken, removeAuthUser } from "@/utils/auth";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const SuperAdminUsers = () => {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', description: '', onConfirm: null, variant: 'danger' });

  useEffect(() => {
    const token = localStorage.getItem("minitake_token");
    const user = getAuthUser();
    if (!token || !user || user.role !== "super_admin") {
      removeAuthToken();
      removeAuthUser();
      navigate("/admin/login", { replace: true });
      return;
    }
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm]);

  const fetchUsers = async () => {
    showLoading('Đang tải dữ liệu...');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(searchTerm && { search: searchTerm }),
      });
      const response = await api.get(`/super-admin/users?${params}`);
      setUsers(response.data.users || []);
      setTotalPages(response.data.total_pages || 1);
      setTotalUsers(response.data.total || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        removeAuthToken();
        removeAuthUser();
        navigate("/admin/login");
      } else {
        toast.error("Không thể tải danh sách user");
      }
    } finally {
      hideLoading();
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await api.delete(`/super-admin/users/${selectedUser.id}`);
      toast.success("Xóa user thành công");
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Không thể xóa user");
    }
  };

  const handleUpgradePro = (user) => {
    setConfirmDialog({
      open: true,
      title: 'Nâng cấp lên PRO',
      description: `Bạn có chắc muốn nâng cấp cửa hàng của "${user.name || user.email}" lên gói PRO? User sẽ được sử dụng đầy đủ tính năng PRO.`,
      variant: 'info',
      onConfirm: async () => {
        try {
          await api.put(`/super-admin/stores/${user.store_id}/upgrade-pro`);
          toast.success(`Đã nâng cấp "${user.name || user.email}" lên PRO`);
          setConfirmDialog(prev => ({ ...prev, open: false }));
          fetchUsers();
        } catch (error) {
          toast.error(error.response?.data?.detail || "Không thể nâng cấp");
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      }
    });
  };

  const handleDowngradeStarter = (user) => {
    setConfirmDialog({
      open: true,
      title: 'Hạ xuống STARTER',
      description: `Bạn có chắc muốn hạ cửa hàng của "${user.name || user.email}" xuống gói STARTER? Giới hạn 10 bàn sẽ được áp dụng.`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          await api.put(`/super-admin/stores/${user.store_id}/downgrade-starter`);
          toast.success(`Đã hạ "${user.name || user.email}" xuống STARTER`);
          setConfirmDialog(prev => ({ ...prev, open: false }));
          fetchUsers();
        } catch (error) {
          toast.error(error.response?.data?.detail || "Không thể hạ gói");
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      }
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "super_admin": return "bg-red-500/20 text-red-300";
      case "admin": return "bg-violet-500/20 text-violet-300";
      case "staff": return "bg-blue-500/20 text-blue-300";
      default: return "bg-gray-500/20 text-gray-300";
    }
  };

  const getRoleName = (role) => {
    switch (role) {
      case "super_admin": return "Super Admin";
      case "admin": return "Admin";
      case "staff": return "Staff";
      default: return role;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Quản lý Users</h1>
          <p className="text-slate-400 mt-1">Quản lý tất cả tài khoản người dùng</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Tìm kiếm email, tên..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="pl-10 w-64 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>
          <Button variant="outline" onClick={fetchUsers} className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Tổng Users</p>
                <p className="text-2xl font-bold text-white">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Admins</p>
                <p className="text-2xl font-bold text-white">{users.filter(u => u.role === "admin").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
      </div>

      {/* Users Table */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Danh sách Users
          </CardTitle>
          <CardDescription className="text-slate-400">
            Hiển thị {users.length} / {totalUsers} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Không tìm thấy user nào</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700/50 hover:bg-slate-700/30">
                    <TableHead className="text-slate-400">User</TableHead>
                    <TableHead className="text-slate-400">Cửa hàng</TableHead>
                    <TableHead className="text-slate-400">Vai trò</TableHead>
                    <TableHead className="text-slate-400">Gói</TableHead>
                    <TableHead className="text-slate-400">Ngày tạo</TableHead>
                    <TableHead className="text-slate-400 text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="border-slate-700/50 hover:bg-slate-700/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                            <span className="text-sm font-medium text-slate-300">
                              {user.name?.charAt(0).toUpperCase() || "U"}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-white">{user.name || "-"}</p>
                            <p className="text-sm text-slate-400 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.store_name ? (
                          <div
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 cursor-pointer"
                            onClick={() => navigate(`/super-admin/stores/${user.store_id}`)}
                          >
                            <Building className="w-4 h-4" />
                            <span className="text-sm underline">{user.store_name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)}>
                          {getRoleName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.store_id ? (
                          <Badge className={
                            user.plan_id === "pro"
                              ? "bg-violet-500/20 text-violet-300"
                              : "bg-slate-500/20 text-slate-300"
                          }>
                            {user.plan_id === "pro" ? "PRO" : "STARTER"}
                          </Badge>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(user.created_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {user.store_id && user.plan_id !== "pro" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpgradePro(user)}
                              className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                              title="Nâng cấp PRO"
                            >
                              <Crown className="w-4 h-4" />
                            </Button>
                          )}
                          {user.store_id && user.plan_id === "pro" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDowngradeStarter(user)}
                              className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                              title="Hạ xuống STARTER"
                            >
                              <ArrowDownCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedUser(user); setShowDeleteConfirm(true); }}
                            className="text-slate-400 hover:text-red-400"
                            title="Xóa user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
                  <p className="text-sm text-slate-400">Trang {page} / {totalPages}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      Trước
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Xóa User"
        description={`Bạn có chắc chắn muốn xóa user "${selectedUser?.name || selectedUser?.email}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        variant="danger"
        onConfirm={handleDeleteUser}
      />

      {/* Upgrade/Downgrade Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText="Xác nhận"
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  );
};

export default SuperAdminUsers;
