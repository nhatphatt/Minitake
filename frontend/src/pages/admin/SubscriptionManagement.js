import React, { useState, useEffect } from "react";
import { useLoading } from "../../contexts/LoadingContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Crown,
  Zap,
  CreditCard,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import api from "@/utils/api";
import { toast } from "sonner";

const SubscriptionManagement = () => {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const { showLoading, hideLoading } = useLoading();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    showLoading('Đang tải dữ liệu...');
    try {
      const response = await api.get("/subscriptions/current");
      setSubscription(response.data);
    } catch (error) {
      toast.error("Không thể tải thông tin subscription");
    } finally {
      hideLoading();
    }
  };

  const handleUpgrade = async () => {
    setProcessing(true);
    try {
      const response = await api.post("/subscriptions/create-checkout", {
        plan_id: "pro"
      });

      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Lỗi thanh toán");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async (immediate = false) => {
    if (!confirm(immediate ? "Hủy ngay lập tức?" : "Hủy khi hết kỳ hạn?")) {
      return;
    }

    setProcessing(true);
    try {
      await api.post("/subscriptions/cancel", { immediate });
      toast.success("Đã hủy subscription");
      fetchSubscription();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Lỗi hủy subscription");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };


  const isPro = subscription?.plan_id === "pro";
  const isTrial = subscription?.status === "trial";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Quản lý Subscription</h2>
        <p className="text-slate-600">Xem và quản lý gói dịch vụ của bạn</p>
      </div>

      {/* Current Plan */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isPro ? (
                  <>
                    <Crown className="w-6 h-6 text-violet-600" />
                    Gói PRO
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6 text-slate-600" />
                    Gói STARTER
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {isTrial ? "Dùng thử miễn phí" : "Gói hiện tại của bạn"}
              </CardDescription>
            </div>
            <Badge variant={isPro ? "default" : "secondary"} className={isPro ? "bg-violet-600" : ""}>
              {subscription?.status === "trial" ? "🎁 TRIAL" : subscription?.plan_id?.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Trạng thái</span>
              </div>
              <p className="font-semibold text-slate-900 capitalize">
                {subscription?.status === "trial" ? "Đang dùng thử" : "Hoạt động"}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">
                  {isTrial ? "Trial hết hạn" : "Hết hạn"}
                </span>
              </div>
              <p className="font-semibold text-slate-900">
                {subscription?.trial_ends_at || subscription?.current_period_end || "Không giới hạn"}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">Số bàn</span>
              </div>
              <p className="font-semibold text-slate-900">
                {subscription?.table_usage?.current || 0} / {subscription?.table_usage?.limit != null ? subscription.table_usage.limit : 'Không giới hạn'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Features */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Tính năng bao gồm</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: "QR Menu", included: true },
                { name: "Báo cáo cơ bản", included: true },
                { name: "Thanh toán online", included: true },
                { name: "AI Chatbot", included: isPro },
                { name: "Báo cáo AI nâng cao", included: isPro },
                { name: "Không giới hạn bàn", included: isPro },
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  {feature.included ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-slate-300" />
                  )}
                  <span className={feature.included ? "text-slate-700" : "text-slate-400"}>
                    {feature.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {isPro ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin/pricing")}
                  className="border-violet-200 text-violet-600 hover:bg-violet-50"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Xem chi tiết gói
                </Button>
                {!subscription?.cancel_at_period_end && (
                  <Button
                    variant="ghost"
                    onClick={() => handleCancel(false)}
                    disabled={processing}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Hủy subscription
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="default"
                onClick={handleUpgrade}
                disabled={processing}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Crown className="w-4 h-4 mr-2" />
                )}
                Nâng cấp lên PRO
              </Button>
            )}
          </div>

          {/* Cancel Info */}
          {isPro && subscription?.cancel_at_period_end && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm">
                ⚠️ Subscription của bạn sẽ bị hủy vào ngày {subscription.current_period_end}.
                Bạn sẽ quay lại gói STARTER với giới hạn 10 bàn.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA for STARTER */}
      {!isPro && (
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-violet-900 mb-1">
                  Mở khóa đầy đủ tiềm năng với PRO
                </h3>
                <p className="text-violet-700 text-sm">
                  AI Chatbot, báo cáo nâng cao, và không giới hạn bàn
                </p>
              </div>
              <Button
                variant="default"
                onClick={() => navigate("/admin/pricing")}
                className="bg-violet-600 hover:bg-violet-700"
              >
                Xem chi tiết
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SubscriptionManagement;
