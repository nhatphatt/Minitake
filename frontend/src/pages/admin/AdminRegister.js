import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import MinitakeLogo from "@/components/MinitakeLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import api from "@/utils/api";
import { setAuthToken, setAuthUser } from "@/utils/auth";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Check,
  Crown,
  Zap,
} from "lucide-react";

const AdminRegister = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    password: "",
    name: "",
    store_name: "",
    store_slug: "",
    plan_id: "starter",
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  const toSlug = (str) =>
    str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: "Miễn phí",
      description: "Dành cho quán nhỏ mới bắt đầu",
      features: [
        "Tối đa 10 bàn",
        "Menu QR cơ bản",
        "Báo cáo đơn giản",
        "Thanh toán tiền mặt",
      ],
      icon: Zap,
      gradient: "from-gray-600 to-gray-700",
      bg: "bg-gray-50",
      border: "border-gray-200",
      badge: null,
    },
    {
      id: "pro",
      name: "Pro",
      price: "199.000đ",
      period: "/ tháng",
      description: "Đầy đủ tính năng cho quán phát triển",
      features: [
        "Không giới hạn bàn",
        "AI Chatbot đặt món",
        "Báo cáo AI nâng cao",
        "Thanh toán online (MoMo, ZaloPay)",
        "Hỗ trợ ưu tiên 24/7",
      ],
      icon: Crown,
      gradient: "from-emerald-600 to-teal-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
  ];

  const handleSubmitInfo = async (e) => {
    e.preventDefault();
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(formData.store_slug)) {
      toast.error("Slug chỉ chứa chữ thường, số và dấu gạch ngang");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/check-availability", {
        email: formData.email,
        phone: formData.phone,
        store_slug: formData.store_slug,
      });
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kiểm tra thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planId) => {
    setFormData({ ...formData, plan_id: planId });
    setStep(3);
  };

  const handleRegisterWithPayment = async () => {
    setProcessingPayment(true);
    try {
      if (formData.plan_id === "starter") {
        await registerUser();
      } else {
        const response = await api.post(
          "/subscriptions/create-checkout-for-registration",
          {
            plan_id: "pro",
            store_name: formData.store_name,
            store_slug: formData.store_slug,
            buyer_email: formData.email,
            buyer_phone: formData.phone,
            buyer_name: formData.name,
            password: formData.password,
          }
        );
        if (response.data.checkout_url) {
          window.location.href = response.data.checkout_url;
        } else {
          throw new Error(response.data.detail || "Failed to create checkout");
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Đã xảy ra lỗi");
      setProcessingPayment(false);
    }
  };

  const registerUser = async () => {
    setLoading(true);
    try {
      const response = await api.post("/auth/register", {
        ...formData,
      });
      setAuthToken(response.data.access_token);
      setAuthUser(response.data.user);
      toast.success("Đăng ký thành công!");
      navigate("/admin/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Đăng ký thất bại");
    } finally {
      setLoading(false);
      setProcessingPayment(false);
    }
  };

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get("payment");
    const pendingId = urlParams.get("pending_id");
    if ((payment === "success" || payment === "mock") && pendingId) {
      const completeRegistration = async () => {
        setLoading(true);
        try {
          const response = await api.post("/auth/complete-registration", {
            pending_id: pendingId,
          });
          setAuthToken(response.data.access_token);
          setAuthUser(response.data.user);
          toast.success("Đăng ký thành công với gói PRO!");
          navigate("/admin/dashboard");
        } catch (error) {
          toast.error(
            error.response?.data?.detail || "Hoàn tất đăng ký thất bại"
          );
        } finally {
          setLoading(false);
        }
      };
      completeRegistration();
    }
  }, []);

  const renderStepInfo = () => (
    <form onSubmit={handleSubmitInfo} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Họ và tên
          </Label>
          <Input
            placeholder="Nguyễn Văn A"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="h-12 bg-white border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Email</Label>
          <Input
            type="email"
            placeholder="admin@example.com"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
            }}
            required
            className="h-12 bg-white border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-sm font-medium text-gray-700">
            Số điện thoại
          </Label>
          <Input
            type="tel"
            placeholder="0912345678"
            value={formData.phone}
            onChange={(e) => {
              setFormData({ ...formData, phone: e.target.value });
            }}
            required
            className="h-12 bg-white border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Mật khẩu</Label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Tối thiểu 8 ký tự"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
            minLength={8}
            className="h-12 bg-white border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Tên cửa hàng
          </Label>
          <Input
            placeholder="Quán Cafe ABC"
            value={formData.store_name}
            onChange={(e) => {
              const name = e.target.value;
              const updates = { ...formData, store_name: name };
              if (!slugManual) updates.store_slug = toSlug(name);
              setFormData(updates);
            }}
            required
            className="h-12 bg-white border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Slug (URL)
          </Label>
          <Input
            placeholder="quan-cafe-abc"
            value={formData.store_slug}
            onChange={(e) => {
              setSlugManual(true);
              setFormData({
                ...formData,
                store_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              });
            }}
            required
            className="h-12 bg-white border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl"
          />
          <p className="text-xs text-gray-400">
            minitake.app/menu/{formData.store_slug || "slug-cua-ban"}
          </p>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-semibold shadow-lg shadow-emerald-600/25 transition-all hover:shadow-xl hover:shadow-emerald-600/30"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <span className="flex items-center gap-2">
            Tiếp tục chọn gói
            <ArrowRight className="w-4 h-4" />
          </span>
        )}
      </Button>

    </form>
  );

  const renderStepPlan = () => (
    <div className="space-y-4">
      {plans.map((plan) => {
        const Icon = plan.icon;
        return (
          <button
            key={plan.id}
            onClick={() => handleSelectPlan(plan.id)}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 hover:shadow-lg group relative overflow-hidden ${
              plan.badge
                ? "border-emerald-300 bg-emerald-50/50 hover:border-emerald-400"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            {plan.badge && (
              <span className="absolute top-3 right-3 text-xs font-semibold bg-emerald-600 text-white px-3 py-1 rounded-full">
                {plan.badge}
              </span>
            )}
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center flex-shrink-0`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-lg font-bold text-gray-900">
                    {plan.name}
                  </span>
                  <span className="text-lg font-bold text-emerald-600">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-gray-400">{plan.period}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  {plan.description}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {plan.features.map((f, i) => (
                    <span
                      key={i}
                      className="text-xs text-gray-600 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
            </div>
          </button>
        );
      })}

      <button
        onClick={() => setStep(1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mx-auto mt-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại
      </button>
    </div>
  );

  const renderStepConfirm = () => {
    const selectedPlan = plans.find((p) => p.id === formData.plan_id);
    const Icon = selectedPlan?.icon || Zap;
    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
            Thông tin đăng ký
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 block">Tên</span>
              <span className="font-medium text-gray-900">{formData.name}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Email</span>
              <span className="font-medium text-gray-900">
                {formData.email}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">Số điện thoại</span>
              <span className="font-medium text-gray-900">{formData.phone}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Cửa hàng</span>
              <span className="font-medium text-gray-900">
                {formData.store_name}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block">URL</span>
              <span className="font-medium text-emerald-600">
                /menu/{formData.store_slug}
              </span>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div
          className={`rounded-2xl border-2 p-5 ${
            formData.plan_id === "pro"
              ? "border-emerald-300 bg-emerald-50/50"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedPlan?.gradient} flex items-center justify-center`}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900">
                Gói {selectedPlan?.name}
              </span>
              <span className="text-emerald-600 font-bold ml-2">
                {selectedPlan?.price}
              </span>
              {selectedPlan?.period && (
                <span className="text-sm text-gray-400">
                  {selectedPlan.period}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setStep(2)}
            className="flex-1 h-12 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Đổi gói
          </Button>
          <Button
            onClick={handleRegisterWithPayment}
            disabled={processingPayment || loading}
            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/25 transition-all hover:shadow-xl"
          >
            {processingPayment || loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : formData.plan_id === "pro" ? (
              "Thanh toán & Đăng ký"
            ) : (
              "Hoàn tất đăng ký"
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-700 items-center justify-center p-12">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-white/5 rounded-full" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-white/5 rounded-full" />

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
            Bắt đầu kinh doanh <span className="text-emerald-200">thông minh</span> hơn
          </h1>
          <p className="text-lg text-white/70 leading-relaxed mb-8">
            Chỉ 3 bước đơn giản để có hệ thống quản lý quán hoàn chỉnh với menu QR, chatbot AI và thanh toán online.
          </p>

          {/* Steps preview */}
          <div className="space-y-4">
            {[
              { n: 1, t: "Thông tin cửa hàng", active: step >= 1 },
              { n: 2, t: "Chọn gói dịch vụ", active: step >= 2 },
              { n: 3, t: "Xác nhận & khởi tạo", active: step >= 3 },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    s.active
                      ? "bg-white text-emerald-600"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {step > s.n ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    s.n
                  )}
                </div>
                <span
                  className={`transition-all duration-300 ${
                    s.active ? "text-white font-medium" : "text-white/40"
                  }`}
                >
                  {s.t}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gray-50">
        <div className="w-full max-w-lg">
          {/* Mobile logo */}
          <div className="lg:hidden mb-6">
            <MinitakeLogo size="md" />
          </div>

          {/* Mobile step indicator */}
          <div className="lg:hidden flex items-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step >= s
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {step > s ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-0.5 rounded transition-all ${
                      step > s ? "bg-emerald-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {step === 1 && "Tạo tài khoản"}
              {step === 2 && "Chọn gói dịch vụ"}
              {step === 3 && "Xác nhận đăng ký"}
            </h2>
            <p className="text-gray-500 mt-1">
              {step === 1 && "Nhập thông tin cửa hàng của bạn"}
              {step === 2 && "Chọn gói phù hợp với nhu cầu"}
              {step === 3 && "Kiểm tra lại thông tin trước khi hoàn tất"}
            </p>
          </div>

          {step === 1 && renderStepInfo()}
          {step === 2 && renderStepPlan()}
          {step === 3 && renderStepConfirm()}

          {step === 1 && (
            <div className="mt-8 text-center">
              <p className="text-gray-500">
                Đã có tài khoản?{" "}
                <Link
                  to="/admin/login"
                  className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors"
                >
                  Đăng nhập
                </Link>
              </p>
            </div>
          )}

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

export default AdminRegister;
