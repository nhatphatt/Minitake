import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MinitakeLogo from "@/components/MinitakeLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api from "@/utils/api";
import { setAuthToken, setAuthUser } from "@/utils/auth";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post("/auth/login", formData);
      setAuthToken(response.data.access_token);
      setAuthUser(response.data.user);
      toast.success("Đăng nhập thành công!");
      const userRole = response.data.user?.role;
      if (userRole === "super_admin") {
        navigate("/super-admin/dashboard");
      } else {
        navigate("/admin/dashboard");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 items-center justify-center p-12">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-white/5 rounded-full" />
        
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 text-white max-w-md">
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Quản lý quán dễ dàng với <span className="text-emerald-200">Minitake</span>
          </h1>
          <p className="text-lg text-white/70 leading-relaxed mb-8">
            Menu QR thông minh, chatbot AI hỗ trợ khách hàng, báo cáo doanh thu realtime.
          </p>
          <div className="space-y-4">
            {["Menu QR cho từng bàn", "AI Chatbot đặt món tự động", "Thanh toán online tích hợp"].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-400/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-300" />
                </div>
                <span className="text-white/80">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
           <div className="lg:hidden mb-8">
            <MinitakeLogo size="md" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Chào mừng trở lại</h2>
            <p className="text-gray-500 mt-2">Đăng nhập vào tài khoản quản lý của bạn</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="h-12 bg-white border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Mật khẩu
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="h-12 bg-white border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-600/30"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Đăng nhập
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500">
              Chưa có tài khoản?{" "}
              <Link
                to="/admin/register"
                className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
              >
                Đăng ký ngay
              </Link>
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              © 2026 Minitake. Nền tảng quản lý F&B thông minh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
