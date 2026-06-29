"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  ShoppingBag,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/hooks/store/use-auth-store";
import { useBusinessStore } from "@/hooks/store/use-business-store";
import { authService } from "@/core/services/auth-service";
import {
  businessService,
  FacebookPageOption,
} from "@/core/services/business-service";
import { Service } from "@/core/types/service";
import { CreateBusinessInput } from "@/core/validations/business-schema";

import Step1BusinessForm from "@/components/features/onboarding/step1-business-form";
import Step3Services from "@/components/features/onboarding/step3-services";
import Step4FbConnection from "@/components/features/onboarding/step4-fb-connection";

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, clearAuth } = useAuthStore();
  const { activeBusinessId, setActiveBusinessId } = useBusinessStore();

  const stepParam = searchParams.get("step");
  const step = stepParam ? parseInt(stepParam, 10) : 1;

  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);

  const [fbPages, setFbPages] = useState<FacebookPageOption[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedFbPageId, setSelectedFbPageId] = useState<string | null>(null);

  const fbSuccessParam = searchParams.get("fb_success");
  const fbStatus =
    fbSuccessParam === "1"
      ? "connected"
      : fbSuccessParam === "0"
        ? "error"
        : "idle";

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const refreshToken =
        typeof window !== "undefined"
          ? localStorage.getItem("refresh_token")
          : null;

      if (!refreshToken) {
        clearAuth();
        router.push("/login");
        return;
      }

      try {
        let currentUser = useAuthStore.getState().user;
        if (!currentUser || !useAuthStore.getState().isAuthenticated) {
          currentUser = await authService.getMe();
          const currentAccessToken = useAuthStore.getState().accessToken;
          if (currentAccessToken) {
            setAuth(currentUser, currentAccessToken);
          }
        }
        if (isMounted) {
          setInitializing(false);
        }
      } catch {
        if (!isMounted) return;
        toast.error("เซสชันของท่านหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
        clearAuth();
        if (typeof window !== "undefined") {
          localStorage.removeItem("refresh_token");
        }
        router.push("/login");
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [setAuth, router, clearAuth]);

  useEffect(() => {
    const bizId = searchParams.get("businessId");
    if (bizId) {
      setActiveBusinessId(bizId);
      localStorage.setItem("active_business_id", bizId);
    }

    const fbSuccess = searchParams.get("fb_success");
    const fbMsg = searchParams.get("fb_message");

    if (fbSuccess === "1") {
      toast.success("เชื่อมต่อสิทธิ์ระบบบัญชี Facebook สำเร็จแล้ว");
    } else if (fbSuccess === "0") {
      toast.error(fbMsg || "การเชื่อมต่อสิทธิ์ Facebook ล้มเหลว");
    }
  }, [searchParams, setActiveBusinessId]);

  useEffect(() => {
    if (step === 3 && activeBusinessId && fbStatus === "connected") {
      const timer = setTimeout(() => {
        setLoadingPages(true);
        businessService
          .getFacebookPages(activeBusinessId)
          .then((pages) => {
            setFbPages(pages);
            if (pages.length > 0) {
              setSelectedFbPageId(pages[0].fbPageId);
            }
          })
          .catch(() => toast.error("ไม่สามารถโหลดรายการ Facebook Page ได้"))
          .finally(() => setLoadingPages(false));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [step, activeBusinessId, fbStatus]);

  const onSubmitStep1 = async (
    data: CreateBusinessInput,
    logoFile: File | null,
  ) => {
    setLoading(true);
    try {
      const business = await businessService.createBusiness(
        data,
        logoFile || undefined,
      );
      setActiveBusinessId(business.id);
      localStorage.setItem("active_business_id", business.id);
      toast.success("บันทึกข้อมูลธุรกิจเรียบร้อยแล้ว");
      router.push("/onboarding?step=2");
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "เกิดข้อผิดพลาดในการสร้างธุรกิจ",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConnectFacebookOAuth = async () => {
    if (!activeBusinessId) return;
    setLoading(true);
    try {
      await authService.getMe();
      const freshAccessToken = useAuthStore.getState().accessToken;

      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      window.location.href = `${backendUrl}/facebook/oauth/start?businessId=${activeBusinessId}&token=${freshAccessToken}`;
    } catch {
      toast.error("ไม่สามารถยืนยันความปลอดภัยเพื่อเริ่มเชื่อมต่อ Facebook ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeOnboarding = async () => {
    if (!activeBusinessId || !selectedFbPageId) {
      toast.error("กรุณาเลือกเพจ Facebook ที่ต้องการเชื่อมต่อ");
      return;
    }

    setLoading(true);
    try {
      await businessService.connectFacebookPage(
        activeBusinessId,
        selectedFbPageId,
      );
      toast.success("ตั้งค่าแบรนด์เสร็จสิ้นแล้ว! ยินดีต้อนรับเข้าสู่ ERP-AI");
      router.push("/dashboard");
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message ||
          "ไม่สามารถผูกบัญชีเพจเข้ากับระบบได้",
      );
    } finally {
      setLoading(false);
    }
  };

  const navigateToStep = (targetStep: number) => {
    router.push(`/onboarding?step=${targetStep}`);
  };

  const handleBack = () => {
    if (step <= 1) {
      router.push("/dashboard");
      return;
    }
    navigateToStep(step - 1);
  };

  if (initializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">กำลังโหลดข้อมูลเซสชัน...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none z-0" />

      <div className="w-full max-w-2xl mx-auto space-y-6 pt-4 md:pt-8 mb-6">
        <div className="relative flex justify-between items-center px-4 py-2 bg-neutral-900/20 border border-white/5 rounded-2xl max-w-md mx-auto">
          <div className="absolute top-[22px] left-[34px] right-[34px] h-[2px] bg-white/5 z-0" />
          <div
            className="absolute top-[22px] left-[34px] h-[2px] bg-primary transition-all duration-300 z-0"
            style={{ width: `${((step - 1) / 2) * 82}%` }}
          />

          {[
            { s: 1, label: "ข้อมูลธุรกิจ", icon: Briefcase },
            { s: 2, label: "คลังสินค้า", icon: ShoppingBag },
            { s: 3, label: "เชื่อมต่อเพจ", icon: FacebookIcon },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = step >= item.s;
            const isCurrent = step === item.s;
            return (
              <div
                key={item.s}
                className="flex flex-col items-center z-10 relative"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCurrent
                      ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30 ring-4 ring-primary/20"
                      : isActive
                        ? "bg-primary/80 text-white"
                        : "bg-muted border border-border text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] mt-2 font-medium hidden sm:block ${
                    isCurrent
                      ? "text-primary"
                      : isActive
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-2xl w-full mx-auto glass-panel glow-indigo rounded-2xl p-6 sm:p-8 shadow-2xl flex-1 flex flex-col justify-between z-10">
        {step === 1 && (
          <Step1BusinessForm
            onSubmit={onSubmitStep1}
            loading={loading}
            onBack={handleBack}
          />
        )}

        {step === 2 && activeBusinessId && (
          <Step3Services
            activeBusinessId={activeBusinessId}
            services={services}
            setServices={setServices}
            onNext={() => navigateToStep(3)}
            onBack={handleBack}
          />
        )}

        {step === 3 && (
          <Step4FbConnection
            fbStatus={fbStatus}
            fbPages={fbPages}
            loadingPages={loadingPages}
            selectedFbPageId={selectedFbPageId}
            setSelectedFbPageId={setSelectedFbPageId}
            onConnectOAuth={handleConnectFacebookOAuth}
            onFinalize={handleFinalizeOnboarding}
            loading={loading}
            onBack={handleBack}
          />
        )}
      </div>

      <div className="text-center text-[10px] text-muted-foreground mt-6 select-none z-10">
        © 2026 ERP.AI. All rights reserved.
      </div>
    </div>
  );
}

export default function OnboardingWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">
            กำลังโหลดหน้าตั้งค่าเริ่มต้น...
          </p>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
