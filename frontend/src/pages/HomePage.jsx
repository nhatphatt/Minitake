import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  QrCode,
  ArrowRight,
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  BarChart3,
  Warehouse,
  Check,
  Menu,
  X,
  Zap,
  Crown,
  Play,
  Building,
} from "lucide-react";

const HomePage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      {/* ─── Navigation ─── */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <span className="text-xl font-bold text-gray-900">Minitake</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
            <a
              href="#features"
              className="hover:text-gray-900 transition-colors"
            >
              Tính năng
            </a>
            <a
              href="#how-it-works"
              className="hover:text-gray-900 transition-colors"
            >
              Cách hoạt động
            </a>
            <a
              href="#pricing"
              className="hover:text-gray-900 transition-colors"
            >
              Bảng giá
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-gray-600 hover:text-gray-900"
              onClick={() => navigate("/admin/login")}
            >
              Đăng nhập
            </Button>
            <Button
              onClick={() => navigate("/admin/register")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 shadow-lg shadow-emerald-600/20"
            >
              Dùng thử miễn phí
            </Button>
          </div>

          <button
            className="md:hidden text-gray-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
            <a
              href="#features"
              className="block text-gray-600 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Tính năng
            </a>
            <a
              href="#how-it-works"
              className="block text-gray-600 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Cách hoạt động
            </a>
            <a
              href="#pricing"
              className="block text-gray-600 py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Bảng giá
            </a>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/admin/login")}
              >
                Đăng nhập
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => navigate("/admin/register")}
              >
                Dùng thử
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero ─── */}
      <section className="pt-32 pb-20 px-6 relative">
        {/* Subtle grid bg */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(gray 1px, transparent 1px), linear-gradient(90deg, gray 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-100/40 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-4 py-2 rounded-full mb-6 border border-emerald-100">
            <Zap className="w-4 h-4" />
            Nền tảng quản lý F&B thế hệ mới
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
            Quản lý quán thông minh
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              từ QR đến thanh toán
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Menu QR cho từng bàn, chatbot AI tự động đặt món, thanh toán online,
            báo cáo doanh thu realtime — tất cả trong một nền tảng.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/admin/register")}
              className="h-13 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold shadow-xl shadow-emerald-600/20 transition-all hover:shadow-2xl hover:shadow-emerald-600/30"
            >
              Bắt đầu miễn phí
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/menu/cafe-abc")}
              className="h-13 px-8 rounded-xl text-base border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <Play className="w-4 h-4 mr-2" />
              Xem demo
            </Button>
          </div>

          <p className="text-sm text-gray-400 mt-4">
            Không cần thẻ tín dụng • Thiết lập trong 5 phút
          </p>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Mọi thứ bạn cần để vận hành quán
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Từ nhận đơn đến báo cáo, Minitake giúp bạn số hóa toàn bộ quy
              trình.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: QrCode,
                title: "Menu QR cho từng bàn",
                desc: "Mỗi bàn có QR code riêng. Khách scan, xem menu có hình ảnh, tự đặt món không cần gọi nhân viên.",
                color: "bg-emerald-100 text-emerald-600",
              },
              {
                icon: MessageSquare,
                title: "Chatbot AI đặt món",
                desc: "Chatbot tư vấn món, nhận order và đưa khách đến thanh toán — tất cả trong cửa sổ chat.",
                color: "bg-purple-100 text-purple-600",
              },
              {
                icon: ShoppingCart,
                title: "Quản lý đơn hàng",
                desc: "Nhận đơn realtime, cập nhật trạng thái, ghi chú đặc biệt. Đơn hàng gắn với số bàn cụ thể.",
                color: "bg-blue-100 text-blue-600",
              },
              {
                icon: BarChart3,
                title: "Báo cáo doanh thu",
                desc: "Dashboard trực quan: doanh thu theo ngày/tuần/tháng, món bán chạy, giờ cao điểm.",
                color: "bg-amber-100 text-amber-600",
              },
              {
                icon: Warehouse,
                title: "Quản lý kho & tồn",
                desc: "Theo dõi nguyên liệu, cảnh báo sắp hết. Tự động tính toán tồn kho theo đơn hàng.",
                color: "bg-rose-100 text-rose-600",
              },
              {
                icon: LayoutDashboard,
                title: "Khuyến mãi linh hoạt",
                desc: "Tạo khuyến mãi theo danh mục hoặc món cụ thể. Giảm giá %, giảm tiền, hiển thị trên menu QR.",
                color: "bg-teal-100 text-teal-600",
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-300 group"
                >
                  <div
                    className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-gray-900">
                    {f.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              3 bước để bắt đầu
            </h2>
            <p className="text-gray-500 text-lg">
              Thiết lập nhanh, không cần kỹ thuật.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Đăng ký & tạo quán",
                desc: "Nhập tên quán, tạo slug URL. Chọn gói Starter miễn phí hoặc Pro.",
              },
              {
                step: "02",
                title: "Thêm menu & bàn",
                desc: "Upload menu với hình ảnh và giá. Tạo bàn, hệ thống tự sinh QR code.",
              },
              {
                step: "03",
                title: "Đặt QR lên bàn, xong!",
                desc: "In QR code cho từng bàn. Khách scan là đặt món được ngay.",
              },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 font-bold text-xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                  {s.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Bảng giá đơn giản, minh bạch
            </h2>
            <p className="text-gray-500 text-lg">
              Bắt đầu miễn phí, nâng cấp khi cần.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Starter</h3>
                  <p className="text-xs text-gray-400">Cho quán nhỏ</p>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold">0đ</span>
                <span className="text-gray-400 ml-1">/tháng</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Menu QR code",
                  "Tối đa 10 bàn",
                  "Quản lý đơn hàng",
                  "Báo cáo cơ bản",
                  "Thanh toán tiền mặt",
                ].map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2.5 text-sm text-gray-600"
                  >
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/register")}
                className="w-full h-12 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Bắt đầu miễn phí
              </Button>
            </div>

            {/* Pro */}
            <div className="bg-emerald-600 rounded-2xl p-8 text-white relative overflow-hidden flex flex-col">
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full">
                Phổ biến
              </div>
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-white/5 rounded-full" />

              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Pro</h3>
                  <p className="text-xs text-emerald-200">Đầy đủ tính năng</p>
                </div>
              </div>
              <div className="mb-6 relative z-10">
                <span className="text-4xl font-bold">199.000đ</span>
                <span className="text-emerald-200 ml-1">/tháng</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1 relative z-10">
                {[
                  "Tất cả tính năng Starter",
                  "Không giới hạn bàn",
                  "AI Chatbot đặt món",
                  "Thanh toán online (MoMo, ZaloPay)",
                  "Quản lý kho & tồn",
                  "Khuyến mãi & giảm giá",
                  "Báo cáo nâng cao",
                  "Hỗ trợ ưu tiên 24/7",
                ].map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2.5 text-sm text-emerald-50"
                  >
                    <Check className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate("/admin/register")}
                className="w-full h-12 rounded-xl bg-white text-emerald-700 hover:bg-emerald-50 font-semibold relative z-10"
              >
                Đăng ký Pro
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Doanh nghiệp */}
            <div className="bg-white rounded-2xl p-8 border-2 border-gray-900 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-gray-900 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Chuỗi quán
              </div>
              <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-gray-100 rounded-full" />

              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                  <Building className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Doanh nghiệp</h3>
                  <p className="text-xs text-gray-400">Chuỗi 2-3 chi nhánh</p>
                </div>
              </div>
              <div className="mb-6 relative z-10">
                <span className="text-4xl font-bold">399.000đ</span>
                <span className="text-gray-400 ml-1">/tháng</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1 relative z-10">
                {[
                  "Tất cả tính năng Pro",
                  "Quản lý 2-3 chi nhánh",
                  "Quản lý nhiều khu vực",
                  "Báo cáo tổng hợp chuỗi",
                  "Hỗ trợ ưu tiên 24/7",
                  "Tùy chỉnh thương hiệu",
                ].map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2.5 text-sm text-gray-600"
                  >
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/register")}
                className="w-full h-12 rounded-xl border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-semibold relative z-10 transition-colors"
              >
                Liên hệ tư vấn
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Sẵn sàng số hóa quán của bạn?
          </h2>
          <p className="text-gray-500 text-lg mb-8 max-w-xl mx-auto">
            Đăng ký miễn phí, thiết lập trong 5 phút. Không cần thẻ tín dụng,
            không ràng buộc.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/admin/register")}
              className="h-13 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold shadow-xl shadow-emerald-600/20"
            >
              Tạo quán ngay
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/menu/cafe-abc")}
              className="h-13 px-8 rounded-xl text-base border-gray-200"
            >
              Xem demo trước
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-100 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-gray-900">Minitake</span>
          </div>
          <p className="text-sm text-gray-400">
            © 2026 Minitake. Nền tảng quản lý F&B thông minh.
          </p>
          <div className="flex gap-6 text-sm text-gray-400">
            <a
              href="#features"
              className="hover:text-gray-600 transition-colors"
            >
              Tính năng
            </a>
            <a
              href="#pricing"
              className="hover:text-gray-600 transition-colors"
            >
              Bảng giá
            </a>
            <button
              onClick={() => navigate("/admin/login")}
              className="hover:text-gray-600 transition-colors"
            >
              Đăng nhập
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
