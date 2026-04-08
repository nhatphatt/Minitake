import React from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, CreditCard, Users, LogOut } from "lucide-react";
import MinitakeLogo from "@/components/MinitakeLogo";
import { Button } from "@/components/ui/button";
import { removeAuthToken, removeAuthUser, getAuthUser } from "@/utils/auth";

const navItems = [
  { id: "overview", label: "Tổng quan", icon: Home, path: "/super-admin/dashboard" },
  { id: "users", label: "Quản lý Users", icon: Users, path: "/super-admin/users" },
  { id: "payos", label: "Quản lý PayOS", icon: CreditCard, path: "/super-admin/payos" },
];

const SuperAdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getAuthUser();

  const handleLogout = () => {
    removeAuthToken();
    removeAuthUser();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-800/50 backdrop-blur-xl border-r border-slate-700/50 z-50">
        <div className="p-6">
          <MinitakeLogo size="lg" variant="dark" />
          <p className="text-xs text-slate-400 mt-1">Super Admin Panel</p>
        </div>

        <nav className="px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-violet-500/20 text-violet-300"
                    : "text-slate-400 hover:bg-slate-700/50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
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
