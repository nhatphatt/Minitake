import React, { useState, useEffect } from "react";
import { useLoading } from '../contexts/LoadingContext';
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  Check,
  Loader2,
  CreditCard,
  UtensilsCrossed,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import PaymentFlow from "@/components/PaymentFlow";
import OrderStatusTracker from "@/components/OrderStatusTracker";
import ChatbotWidget from "@/components/ChatbotWidget";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const CustomerMenu = () => {
  const { storeSlug } = useParams();
  const [searchParams] = useState(
    () => new URLSearchParams(window.location.search),
  );
  const tableId = searchParams.get("table");

  const { showLoading, hideLoading } = useLoading();
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [tableInfo, setTableInfo] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentChoiceOpen, setPaymentChoiceOpen] = useState(false);
  const [statusTrackerOpen, setStatusTrackerOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [tableClosed, setTableClosed] = useState(false);

  const [customerInfo, setCustomerInfo] = useState({
    customer_name: "",
    customer_phone: "",
    table_number: "",
    note: "",
  });

  useEffect(() => {
    fetchMenu();
    if (tableId) {
      fetchTableInfo();
    }

    // Restore payment state from localStorage if exists
    restorePaymentState();

    // Restore cart from localStorage
    restoreCart();
  }, [storeSlug, tableId]);

  // Save cart to localStorage whenever it changes (if not in payment flow)
  useEffect(() => {
    if (cart.length > 0 && !paymentOpen) {
      localStorage.setItem(`minitake_cart_${storeSlug}`, JSON.stringify(cart));
    } else if (cart.length === 0 && !paymentOpen) {
      localStorage.removeItem(`minitake_cart_${storeSlug}`);
    }
  }, [cart, paymentOpen, storeSlug]);

  const restoreCart = () => {
    const savedCart = localStorage.getItem(`minitake_cart_${storeSlug}`);
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate and filter cart items - ensure they have required properties
          const validItems = parsed.filter((item) => {
            return (
              item && item.id && item.name && typeof item.price === "number"
            );
          });

          if (validItems.length > 0) {
            setCart(validItems);
            toast.info(`Đã khôi phục ${validItems.length} món trong giỏ hàng`);
          }

          // If some items were invalid, log and clean up
          if (validItems.length < parsed.length) {
            console.warn(
              `Removed ${parsed.length - validItems.length} invalid items from cart`,
            );
          }
        }
      } catch (error) {
        console.error("Failed to restore cart:", error);
        localStorage.removeItem(`minitake_cart_${storeSlug}`);
      }
    }
  };

  // Save payment state to localStorage whenever it changes
  useEffect(() => {
    if (currentOrder && paymentOpen) {
      const paymentState = {
        currentOrder,
        cart,
        customerInfo,
        paymentOpen: true,
        timestamp: new Date().getTime(),
      };
      localStorage.setItem(
        `minitake_payment_${storeSlug}`,
        JSON.stringify(paymentState),
      );
    }
  }, [currentOrder, paymentOpen, cart, customerInfo, storeSlug]);

  const restorePaymentState = () => {
    const savedState = localStorage.getItem(`minitake_payment_${storeSlug}`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        const now = new Date().getTime();
        // Only restore if less than 30 minutes old
        if (now - parsed.timestamp < 30 * 60 * 1000) {
          setCurrentOrder(parsed.currentOrder);
          setCart(parsed.cart || []);
          setCustomerInfo(
            parsed.customerInfo || {
              customer_name: "",
              customer_phone: "",
              table_number: "",
              note: "",
            },
          );
          setPaymentOpen(true);
          toast.info("Đã khôi phục thông tin thanh toán");
        } else {
          // Clear expired state
          localStorage.removeItem(`minitake_payment_${storeSlug}`);
        }
      } catch (error) {
        console.error("Failed to restore payment state:", error);
        localStorage.removeItem(`minitake_payment_${storeSlug}`);
      }
    }
  };

  const fetchMenu = async () => {
    showLoading('Đang tải dữ liệu...');
    try {
      const response = await axios.get(`${API_BASE}/public/${storeSlug}/menu`);
      setStore(response.data.store);
      setCategories(response.data.categories);
      setMenuItems(response.data.menu_items);
    } catch (error) {
      toast.error("Không tìm thấy cửa hàng");
    } finally {
      hideLoading();
    }
  };

  const fetchTableInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE}/tables/${tableId}`);
      const table = response.data;
      if (table.status !== "occupied") {
        setTableClosed(true);
        return;
      }
      setTableInfo(table);
      setCustomerInfo((prev) => ({
        ...prev,
        table_number: table.table_number,
      }));
    } catch (error) {
      setTableClosed(true);
    }
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setItemDetailOpen(true);
  };

  const addToCart = (item, qty = 1) => {
    // Validate item has required properties
    if (!item || !item.id || !item.name) {
      console.error("Invalid item:", item);
      toast.error("Không thể thêm món vào giỏ hàng");
      return;
    }

    const existingItem = cart.find((i) => i.id === item.id);

    // Use discounted price if promotion exists, otherwise use regular price
    // Ensure we have a valid price
    const effectivePrice =
      item.has_promotion && item.discounted_price
        ? item.discounted_price
        : item.price || 0;

    const cartItem = {
      ...item,
      price: effectivePrice,
      // Ensure these properties exist
      name: item.name,
      id: item.id,
    };

    if (existingItem) {
      setCart(
        cart.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + qty } : i,
        ),
      );
    } else {
      setCart([...cart, { ...cartItem, quantity: qty }]);
    }
    toast.success(`Đã thêm ${item.name} vào giỏ hàng`);
  };

  const addToCartFromDetail = () => {
    if (selectedItem) {
      addToCart(selectedItem);
      setItemDetailOpen(false);
    }
  };

  const updateQuantity = (itemId, delta) => {
    setCart(
      cart
        .map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter((i) => i.id !== itemId));
  };

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => {
      const price = item.price || 0;
      const quantity = item.quantity || 0;
      return sum + price * quantity;
    }, 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error("Giỏ hàng trống");
      return;
    }
    setCheckoutOpen(true);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const orderPayload = {
        ...customerInfo,
        items: cart.map((item) => ({
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      };

      const response = await axios.post(
        `${API_BASE}/public/${storeSlug}/orders`,
        orderPayload,
      );

      // Save order and show payment choice dialog
      setCurrentOrder(response.data);
      setCheckoutOpen(false);
      setPaymentChoiceOpen(true);

      toast.success("Đặt món thành công!");
    } catch (error) {
      toast.error("Đặt hàng thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentOpen(false);
    setOrderSuccess(true);

    // Open order status tracker
    if (currentOrder?.id) {
      setTrackingOrderId(currentOrder.id);
      setStatusTrackerOpen(true);
    }

    setCart([]);
    setCurrentOrder(null);
    setCustomerInfo({
      customer_name: "",
      customer_phone: "",
      table_number: "",
      note: "",
    });

    // Clear localStorage after successful payment
    localStorage.removeItem(`minitake_payment_${storeSlug}`);
    localStorage.removeItem(`minitake_cart_${storeSlug}`);
  };

  const handlePayNow = () => {
    setPaymentChoiceOpen(false);
    setPaymentOpen(true);
  };

  const handlePayLater = () => {
    setPaymentChoiceOpen(false);
    if (currentOrder?.id) {
      setTrackingOrderId(currentOrder.id);
      setStatusTrackerOpen(true);
    }
    setCart([]);
    setCustomerInfo({
      customer_name: "",
      customer_phone: "",
      table_number: "",
      note: "",
    });
    localStorage.removeItem(`minitake_cart_${storeSlug}`);
    setCurrentOrder(null);
    toast.info("Đơn hàng đã được tạo. Bạn có thể thanh toán sau tại quầy.");
  };

  const handlePaymentCancel = () => {
    setPaymentOpen(false);

    // Open order tracker so customer can track their unpaid order
    if (currentOrder?.id) {
      setTrackingOrderId(currentOrder.id);
      setStatusTrackerOpen(true);
    }

    setCurrentOrder(null);
    setCart([]);
    setCustomerInfo({
      customer_name: "",
      customer_phone: "",
      table_number: "",
      note: "",
    });

    // Clear localStorage
    localStorage.removeItem(`minitake_payment_${storeSlug}`);
    localStorage.removeItem(`minitake_cart_${storeSlug}`);

    toast.info("Đơn hàng đã được tạo. Bạn có thể thanh toán sau tại quầy.");
  };

  // Auto-retry khi bàn chưa mở — poll mỗi 5 giây
  useEffect(() => {
    if (!tableClosed || !tableId) return;
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE}/tables/${tableId}`);
        if (response.data.status === "occupied") {
          setTableClosed(false);
          setTableInfo(response.data);
          setCustomerInfo((prev) => ({
            ...prev,
            table_number: response.data.table_number,
          }));
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [tableClosed, tableId]);

  const filteredItems =
    selectedCategory === "all"
      ? menuItems
      : menuItems.filter((item) => item.category_id === selectedCategory);

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-customer">
        <p className="text-muted-foreground">Không tìm thấy cửa hàng</p>
      </div>
    );
  }

  if (tableClosed) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-customer bg-background">
        <div className="text-center p-8 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Bàn chưa được mở</h2>
          <p className="text-muted-foreground text-sm">
            Vui lòng nhờ nhân viên mở bàn trước khi quét mã QR để gọi món.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Đang chờ nhân viên mở bàn...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-customer min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm sticky top-0 z-40 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {store.logo ? (
              <img
                src={store.logo}
                alt={store.name}
                className="h-12 w-12 object-contain rounded-lg bg-muted/20"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground">{store.name}</h1>
              {tableInfo && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {tableInfo.table_number}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({tableInfo.capacity} chỗ)
                  </span>
                </div>
              )}
              {store.address && !tableInfo && (
                <p className="text-sm text-muted-foreground line-clamp-1">{store.address}</p>
              )}
            </div>
          </div>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button className="relative bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                <ShoppingCart className="h-5 w-5" />
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground px-2 py-0.5 border-2 border-background">
                    {cart.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg theme-customer flex flex-col">
              <SheetHeader>
                <SheetTitle>Giỏ hàng của bạn</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4 flex-1 flex flex-col overflow-hidden">
                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mb-4 opacity-20" />
                    <p>Giỏ hàng đang trống</p>
                    <Button
                      variant="link"
                      className="text-primary mt-2"
                      onClick={() => setCartOpen(false)}
                    >
                      Tiếp tục xem menu
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 bg-card p-3 rounded-lg border border-border shadow-sm"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground">{item.name}</h4>
                            <p className="text-sm text-primary font-semibold">
                              {(item.price || 0).toLocaleString("vi-VN")} đ
                            </p>
                          </div>
                          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-background"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-background"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-4 pb-6 space-y-4 mt-auto flex-shrink-0">
                      <div className="flex justify-between items-center text-xl font-bold">
                        <span>Tổng cộng:</span>
                        <span className="text-primary">
                          {getTotalPrice().toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-lg shadow-lg shadow-primary/20"
                        onClick={handleCheckout}
                      >
                        Đặt món ngay
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Categories Filter */}
      <div className="sticky top-[81px] z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 py-3">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-6 ${selectedCategory === "all"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "hover:text-primary hover:border-primary"
                }`}
            >
              Tất cả
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-6 whitespace-nowrap ${selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:text-primary hover:border-primary"
                  }`}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/50"
              onClick={() => handleItemClick(item)}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <UtensilsCrossed className="h-12 w-12 opacity-20" />
                  </div>
                )}
                {item.has_promotion && item.promotion_label && (
                  <Badge className="absolute top-3 right-3 bg-secondary text-secondary-foreground shadow-lg">
                    {item.promotion_label}
                  </Badge>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <span className="text-white font-medium">Xem chi tiết</span>
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-col">
                    {item.has_promotion ? (
                      <>
                        <span className="text-xs text-muted-foreground line-through">
                          {item.original_price.toLocaleString("vi-VN")} đ
                        </span>
                        <span className="text-lg font-bold text-secondary">
                          {item.discounted_price.toLocaleString("vi-VN")} đ
                        </span>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-primary">
                        {item.price.toLocaleString("vi-VN")} đ
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(item);
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-9 w-9 p-0 shadow-md shadow-primary/20"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Item Detail Dialog */}
      <Dialog open={itemDetailOpen} onOpenChange={setItemDetailOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden theme-customer bg-card border-none">
          {selectedItem && (
            <div className="flex flex-col max-h-[90vh]">
              <div className="relative aspect-[4/3] max-h-[40vh] bg-muted overflow-hidden">
                {selectedItem.image_url ? (
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UtensilsCrossed className="h-16 w-16 text-muted-foreground/20" />
                  </div>
                )}
                {selectedItem.has_promotion && selectedItem.promotion_label && (
                  <Badge className="absolute bottom-4 left-4 bg-secondary text-secondary-foreground shadow-lg">
                    {selectedItem.promotion_label}
                  </Badge>
                )}
              </div>

              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{selectedItem.name}</h2>
                  <div className="mt-2 flex items-baseline gap-3">
                    {selectedItem.has_promotion ? (
                      <>
                        <span className="text-2xl font-bold text-secondary">
                          {selectedItem.discounted_price.toLocaleString("vi-VN")} đ
                        </span>
                        <span className="text-lg text-muted-foreground line-through">
                          {selectedItem.original_price.toLocaleString("vi-VN")} đ
                        </span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold text-primary">
                        {selectedItem.price.toLocaleString("vi-VN")} đ
                      </span>
                    )}
                  </div>
                </div>

                {selectedItem.description && (
                  <p className="text-muted-foreground leading-relaxed">
                    {selectedItem.description}
                  </p>
                )}

                <div className="pt-4">
                  <Button
                    onClick={addToCartFromDetail}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-lg shadow-lg shadow-primary/20"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Thêm vào giỏ hàng
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="theme-customer">
          <DialogHeader>
            <DialogTitle>Thông tin đặt món</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitOrder} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tên của bạn (Tuỳ chọn)</Label>
              <Input
                id="name"
                value={customerInfo.customer_name}
                onChange={(e) =>
                  setCustomerInfo({
                    ...customerInfo,
                    customer_name: e.target.value,
                  })
                }
                placeholder="Nguyễn Văn A"
                className="focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại (Tuỳ chọn)</Label>
              <Input
                id="phone"
                value={customerInfo.customer_phone}
                onChange={(e) =>
                  setCustomerInfo({
                    ...customerInfo,
                    customer_phone: e.target.value,
                  })
                }
                placeholder="0123456789"
                className="focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="table">Số bàn</Label>
              <Input
                id="table"
                value={customerInfo.table_number}
                onChange={(e) =>
                  setCustomerInfo({
                    ...customerInfo,
                    table_number: e.target.value,
                  })
                }
                placeholder="Nhập số bàn"
                disabled={!!tableInfo}
                className="focus-visible:ring-primary"
              />
              {tableInfo && (
                <p className="text-xs text-muted-foreground">
                  Đã tự động nhận diện từ mã QR
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Ghi chú</Label>
              <Input
                id="note"
                value={customerInfo.note}
                onChange={(e) =>
                  setCustomerInfo({ ...customerInfo, note: e.target.value })
                }
                placeholder="Yêu cầu đặc biệt..."
                className="focus-visible:ring-primary"
              />
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold mb-4">
                <span>Tổng tiền:</span>
                <span className="text-primary">
                  {getTotalPrice().toLocaleString("vi-VN")} đ
                </span>
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang đặt hàng...
                  </>
                ) : (
                  "Xác nhận đặt món"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Choice Dialog */}
      <Dialog open={paymentChoiceOpen} onOpenChange={setPaymentChoiceOpen}>
        <DialogContent className="max-w-sm theme-customer">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Chọn phương thức</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-center text-muted-foreground text-sm">
              Tổng: <span className="font-bold text-foreground">{currentOrder?.total?.toLocaleString()}đ</span>
            </p>
            <Button
              className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground gap-3"
              onClick={handlePayNow}
            >
              <CreditCard className="h-5 w-5" />
              Thanh toán ngay
            </Button>
            <Button
              variant="outline"
              className="w-full h-14 text-base gap-3 border-2"
              onClick={handlePayLater}
            >
              <Banknote className="h-5 w-5" />
              Thanh toán sau
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Thanh toán sau: đơn hàng sẽ ở trạng thái &quot;Chờ xử lý&quot; cho đến khi thanh toán hoàn tất.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Flow */}
      {currentOrder && (
        <div className="theme-customer">
          <PaymentFlow
            order={currentOrder}
            storeSlug={storeSlug}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
            open={paymentOpen}
          />
        </div>
      )}

      {/* Order Status Tracker */}
      {trackingOrderId && (
        <div className="theme-customer">
          <OrderStatusTracker
            orderId={trackingOrderId}
            open={statusTrackerOpen}
            onClose={() => {
              setStatusTrackerOpen(false);
              setTrackingOrderId(null);
            }}
          />
        </div>
      )}

      {/* Success Dialog */}
      <Dialog open={orderSuccess} onOpenChange={setOrderSuccess}>
        <DialogContent className="text-center theme-customer">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Thanh toán thành công!
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Cảm ơn bạn đã sử dụng dịch vụ. Đang theo dõi trạng thái đơn hàng...
          </p>
          <Button
            onClick={() => {
              setOrderSuccess(false);
              // Open status tracker if not already open
              if (trackingOrderId && !statusTrackerOpen) {
                setStatusTrackerOpen(true);
              }
            }}
            className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Xem trạng thái
          </Button>
        </DialogContent>
      </Dialog>

      {/* AI Chatbot Widget - Only show for PRO plans */}
      {store?.plan_id === "pro" && (
        <div className="theme-customer">
          <ChatbotWidget
            storeSlug={storeSlug}
            customerPhone={customerInfo.customer_phone}
            tableId={tableId}
            cart={cart}
            onAddToCart={addToCart}
            onRemoveFromCart={(name) => {
              const item = cart.find((i) => i.name.toLowerCase() === name.toLowerCase());
              if (item) removeFromCart(item.id);
            }}
            onCheckout={() => setCheckoutOpen(true)}
          />
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
