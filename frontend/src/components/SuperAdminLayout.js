import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Users, LogOut, DollarSign, BarChart3, ArrowRightLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeAuthToken, removeAuthUser, getAuthUser } from "@/utils/auth";

const SuperAdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getAuthUser();
  const isFinancePath = location.pathname.startsWith("/super-admin/finance");
  const [financeOpen, setFinanceOpen] = useState(isFinancePath);

  const handleLogout = () => {
    removeAuthToken();
    removeAuthUser();
    navigate("/admin/login");
  };

  const navBtn = (path, Icon, label) => {
    const isActive = location.pathname === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
          isActive ? "bg-violet-500/20 text-violet-300" : "text-slate-400 hover:bg-slate-700/50"
        }`}
      >
        <Icon className="w-5 h-5" />
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-800/50 backdrop-blur-xl border-r border-slate-700/50 z-50">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Minitake
          </h1>
          <p className="text-xs text-slate-400 mt-1">Super Admin Panel</p>
        </div>

        <nav className="px-4 space-y-1">
          {navBtn("/super-admin/dashboard", Home, "Tổng quan")}
          {navBtn("/super-admin/users", Users, "Quản lý Users")}

          {/* Finance dropdown */}
          <div>
            <button
              onClick={() => setFinanceOpen((o) => !o)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isFinancePath ? "bg-violet-500/20 text-violet-300" : "text-slate-400 hover:bg-slate-700/50"
              }`}
            >
              <DollarSign className="w-5 h-5" />
              <span className="flex-1 text-left">Tài chính</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${financeOpen ? "rotate-180" : ""}`} />
            </button>

            {financeOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l border-slate-700/50 pl-3">
                <button
                  onClick={() => navigate("/super-admin/finance/revenue")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    location.pathname === "/super-admin/finance/revenue"
                      ? "bg-violet-500/20 text-violet-300"
                      : "text-slate-400 hover:bg-slate-700/50"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Doanh thu
                </button>
                <button
                  onClick={() => navigate("/super-admin/finance/transactions")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    location.pathname === "/super-admin/finance/transactions"
                      ? "bg-violet-500/20 text-violet-300"
                      : "text-slate-400 hover:bg-slate-700/50"
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Giao dịch
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64">
        <Outlet />
      </main>
    </div>
  );
};

export default SuperAdminLayout;
