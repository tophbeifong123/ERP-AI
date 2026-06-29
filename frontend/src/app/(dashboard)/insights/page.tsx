// src/app/(dashboard)/insights/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Users,
  Heart,
  MessageSquare,
  Sparkles,
  Globe,
  Calendar,
  ArrowUpRight,
  Loader2,
  Share2,
  Flame,
  Award,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useBusinessStore } from "@/hooks/store/use-business-store";
import { toast } from "sonner";

// Custom Instagram & LINE Icons for brand matching
const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

interface MockStat {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
}

export default function InsightsPage() {
  const { activeBusiness } = useBusinessStore();
  const [selectedPlatform, setSelectedPlatform] = useState<
    "all" | "facebook" | "instagram"
  >("all");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // สุ่มค่าสถิติเมื่อกดเปลี่ยนแพลตฟอร์มหรือเปลี่ยนแบรนด์เพื่อให้ดูโหลดสดใหม่
  useEffect(() => {
    setAnalysisResult(null);
  }, [activeBusiness, selectedPlatform]);

  const stats: MockStat[] = [
    {
      label: "ยอดการเข้าถึง (Reach / Impressions)",
      value:
        selectedPlatform === "facebook"
          ? "14"
          : selectedPlatform === "instagram"
            ? "11"
            : "25",
      change: "+2.4%",
      isPositive: true,
      icon: <Globe className="w-5 h-5" />,
      colorClass: "text-primary",
      bgClass: "bg-primary/10 border-primary/20",
    },
    {
      label: "การมีส่วนร่วม (Likes & Reactions)",
      value:
        selectedPlatform === "facebook"
          ? "3"
          : selectedPlatform === "instagram"
            ? "5"
            : "8",
      change: "+0.0%",
      isPositive: true,
      icon: <Heart className="w-5 h-5" />,
      colorClass: "text-pink-500",
      bgClass: "bg-pink-500/10 border-pink-500/20",
    },
    {
      label: "ผู้ติดตามใหม่ (New Followers)",
      value: "0",
      change: "0%",
      isPositive: true,
      icon: <Users className="w-5 h-5" />,
      colorClass: "text-emerald-400",
      bgClass: "bg-emerald-400/10 border-emerald-400/20",
    },
    {
      label: "จำนวนคอมเมนต์ (Comments)",
      value: "0",
      change: "0%",
      isPositive: true,
      icon: <MessageSquare className="w-5 h-5" />,
      colorClass: "text-amber-400",
      bgClass: "bg-amber-400/10 border-amber-400/20",
    },
  ];

  // จำลองโพสต์ล่าสุดและคะแนนสถิติ
  const recentPostsData = [
    {
      title: "แนะนำ [โปรโมชั่นประจำเดือน] ลดกระหน่ำ 15% ต้อนรับหน้าร้อน",
      date: "โพสต์เมื่อ 2 วันก่อน",
      reach: selectedPlatform === "instagram" ? "8" : "12",
      engagement: "2",
      platform: "facebook",
      score: 72,
    },
    {
      title: "ภาพเบื้องหลังการจัดส่งของแบรนด์เรา ส่งไว มั่นใจ ได้ของรวดเร็ว",
      date: "โพสต์เมื่อ 4 วันก่อน",
      reach: selectedPlatform === "facebook" ? "5" : "9",
      engagement: "3",
      platform: "instagram",
      score: 75,
    },
    {
      title: "รีวิวสินค้าขายดี [คู่มือความคุ้มค่า] จากปากลูกค้าที่ใช้จริง",
      date: "โพสต์เมื่อ 1 สัปดาห์ก่อน",
      reach: "8",
      engagement: "1",
      platform: "facebook",
      score: 64,
    },
  ].filter(
    (p) => selectedPlatform === "all" || p.platform === selectedPlatform,
  );

  const startAiAnalysis = () => {
    setIsAnalyzing(true);
    setAnalysisStep(0);
    setAnalysisResult(null);

    // จำลองขั้นตอนการสแกนและประมวลผลข้อมูล
    const timer1 = setTimeout(() => setAnalysisStep(1), 800);
    const timer2 = setTimeout(() => setAnalysisStep(2), 1600);
    const timer3 = setTimeout(() => {
      setAnalysisStep(3);
      setIsAnalyzing(false);

      const businessName = activeBusiness?.name || "ร้านค้าของคุณ";
      const industry = activeBusiness?.industry || "ทั่วไป";

      setAnalysisResult(`### 🤖 บทสรุปและคำแนะนำจาก ERP-AI insights

จากการวิเคราะห์สถิติตัวเลขล่าสุดของแบรนด์ **"${businessName}"** (ประเภทธุรกิจ: ${industry}) มีรายละเอียดกลยุทธ์สรุปได้ดังนี้ครับ:

#### 📊 จุดประเมินปัจจุบัน
1. **หน้าเพจอยู่ในช่วงเริ่มต้นสร้างฐานแฟน:** มียอดการเข้าถึงในสัปดาห์นี้รวมอยู่ที่ **25 ครั้ง** และการมีส่วนร่วม **8 ครั้ง** โดยยอดผู้ติดตามใหม่และคอมเมนต์ยังเป็น **0 คน**
2. **อัตราการเติบโตยังอยู่ในเกณฑ์เริ่มต้น:** แนะนำให้เร่งกระจายการมองเห็นเพื่อเปิดการรับรู้แบรนด์ (Brand Awareness) เป็นหลัก

#### 💡 แนวทางทำคอนเทนต์กระตุ้น Engagement ตั้งต้น (Actionable Strategy)
* **แนะนำให้ทำคอนเทนต์แบบแนะนำตัวตนแบรนด์ (Brand Storytelling):** เล่าจุดเด่นของแบรนด์หรือร้านค้าของคุณในสไตล์ที่เข้าถึงง่าย เพื่อให้คนที่ผ่านมาเห็นกดปุ่มถูกใจ/แชร์
* **เน้นสร้างความมีส่วนร่วมด้วยหัวข้อแจกของรางวัลหรือกิจกรรม:** โพสต์โปรโมชั่นสั้นๆ เพื่อชวนให้ลูกค้าเก่าหรือเพื่อนๆ เข้ามาคอมเมนต์เป็นคอมเมนต์ตั้งต้น เช่น *"คอมเมนต์บอกสินค้าที่คุณอยากได้ที่สุดใต้โพสต์นี้"*
* **กำหนดเวลาโพสต์แนะนำ:** แนะนำโพสต์ในวันหยุดเสาร์และอาทิตย์ ช่วงเวลา **11:00 - 13:00 น.** ซึ่งเป็นช่วงที่คนทั่วไปมีเวลาว่างเปิดโซเชียลมีเดียเพื่อค้นหาร้านค้าใหม่ๆ
`);
      toast.success("วิเคราะห์ประสิทธิภาพเชิงลึกด้วย AI เสร็จสิ้น!");
    }, 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <TrendingUp className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                วิเคราะห์การตลาดอัจฉริยะ
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              สรุปผลสถิติจากเครือข่ายโซเชียลมีเดียพร้อมวิเคราะห์แนวทางคอนเทนต์ชิ้นถัดไปด้วย
              AI
            </p>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border/80 self-start md:self-auto">
          <button
            onClick={() => setSelectedPlatform("all")}
            className={`px-3 py-1.5 rounded-lg text-xxs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              selectedPlatform === "all"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setSelectedPlatform("facebook")}
            className={`px-3 py-1.5 rounded-lg text-xxs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              selectedPlatform === "facebook"
                ? "bg-[#1877F2] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FacebookIcon className="w-3.5 h-3.5" />
            Facebook
          </button>
          <button
            onClick={() => setSelectedPlatform("instagram")}
            className={`px-3 py-1.5 rounded-lg text-xxs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              selectedPlatform === "instagram"
                ? "bg-gradient-to-r from-[#833AB4] to-[#FD1D1D] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <InstagramIcon className="w-3.5 h-3.5" />
            Instagram
          </button>
        </div>
      </div>

      {/* Grid: Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="glass-panel hover:border-white/15 p-5 rounded-xl border border-border/60 bg-background/50 flex flex-col justify-between space-y-4 shadow-sm group transition-all duration-200"
          >
            <div className="flex justify-between items-start">
              <span className="text-xxs font-bold text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </span>
              <div
                className={`p-2 rounded-lg border ${stat.bgClass} text-foreground shrink-0 group-hover:scale-105 transition`}
              >
                {stat.icon}
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-2xl font-extrabold text-foreground tracking-tight">
                {stat.value}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 text-xxs font-bold ${stat.isPositive ? "text-emerald-500" : "text-rose-500"}`}
              >
                {stat.change}
                <span className="text-xxs text-muted-foreground font-normal ml-1">
                  สัปดาห์นี้
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Workspace split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Recent Content Stats list */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-border/60 bg-background/50 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-extrabold text-foreground">
                ประสิทธิภาพของโพสต์ล่าสุด
              </h2>
              <p className="text-xxs text-muted-foreground">
                สรุปยอดตอบรับเฉลี่ยแยกตามเนื้อหาคอนเทนต์
              </p>
            </div>
            <span className="text-xxs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> 7 วันที่ผ่านมา
            </span>
          </div>

          <div className="space-y-3">
            {recentPostsData.map((post, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                      post.platform === "facebook"
                        ? "bg-[#1877F2]/10 border-[#1877F2]/20 text-[#1877F2]"
                        : "bg-pink-500/10 border-pink-500/20 text-pink-500"
                    }`}
                  >
                    {post.platform === "facebook" ? (
                      <FacebookIcon className="w-5 h-5" />
                    ) : (
                      <InstagramIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-foreground truncate pr-3">
                      {post.title}
                    </span>
                    <span className="block text-xxs text-muted-foreground mt-0.5">
                      {post.date}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 text-right">
                  <div className="space-y-0.5">
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Reach
                    </span>
                    <span className="block text-xs font-extrabold text-foreground">
                      {post.reach}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      Engagement
                    </span>
                    <span className="block text-xs font-extrabold text-foreground">
                      {post.engagement}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[10px] text-muted-foreground uppercase font-bold">
                      คะแนน
                    </span>
                    <span
                      className={`inline-flex items-center text-xxs font-extrabold px-2 py-0.5 rounded-full ${
                        post.score >= 90
                          ? "text-emerald-500 bg-emerald-500/10"
                          : "text-primary bg-primary/10"
                      }`}
                    >
                      {post.score}/100
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Simple custom SVG performance chart */}
          <div className="pt-4 border-t border-border/40 space-y-4">
            <h3 className="text-xs font-bold text-foreground">
              แนวโน้มการเข้าถึงรวม (7 วันที่ผ่านมา)
            </h3>
            <div className="h-28 w-full bg-muted/10 border border-border/60 rounded-xl relative overflow-hidden flex items-end px-4 pb-2 pt-6">
              {/* Y-axis grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-3 text-xxs text-muted-foreground/30">
                <div className="border-b border-border/30 w-full" />
                <div className="border-b border-border/30 w-full" />
                <div className="border-b border-border/30 w-full" />
              </div>

              {/* Graphical representation (Mock CSS charts) */}
              <div className="w-full h-full flex justify-between items-end gap-2 z-10">
                {[45, 62, 55, 78, 92, 85, 98].map((percent, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-1 group/bar"
                  >
                    <span className="opacity-0 group-hover/bar:opacity-100 transition text-[9px] bg-primary px-1.5 py-0.5 rounded text-white mb-1 shadow font-bold">
                      {Math.round(percent / 20)}
                    </span>
                    <div
                      style={{ height: `${percent}%` }}
                      className="w-full bg-gradient-to-t from-primary/45 to-primary rounded-t-sm group-hover/bar:from-primary/70 group-hover/bar:to-primary transition-all duration-300"
                    />
                    <span className="text-[10px] text-muted-foreground mt-1">
                      วันที่ {idx + 22}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: AI Insights summary generator widget */}
        <div className="glass-panel p-6 rounded-xl border border-border/60 bg-background/50 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Sparkles className="w-4.5 h-4.5 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  ผู้ช่วยวิเคราะห์ AI
                </h3>
                <p className="text-xxs text-muted-foreground">
                  สรุปวิเคราะห์เป้าหมายการโพสต์ถัดไป
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              วิเคราะห์ความสนใจของฐานแฟนเพจและผู้ติดตามจาก Facebook/Instagram
              เพื่อดึงแนวทางในการส่งโพสต์ถัดไปให้ได้ผลลัพธ์การมีส่วนร่วมสูงสุด
            </p>

            {/* Loading / Processing State */}
            {isAnalyzing && (
              <div className="p-6 border border-border rounded-xl bg-muted/10 space-y-4 flex flex-col items-center justify-center text-center animate-pulse">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <div className="space-y-1">
                  <span className="block text-xs font-bold text-foreground">
                    {analysisStep === 0 && "กำลังสแกนตัวเลขสถิติ..."}
                    {analysisStep === 1 && "กำลังค้นหาพฤติกรรมผู้ติดตาม..."}
                    {analysisStep === 2 && "กำลังสรุปกลยุทธ์คอนเทนต์..."}
                  </span>
                  <span className="block text-xxs text-muted-foreground">
                    ประมวลผลเสร็จในเสี้ยววินาที
                  </span>
                </div>
              </div>
            )}

            {/* Analysis Result */}
            {analysisResult && !isAnalyzing && (
              <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-xs text-foreground space-y-3 max-h-[380px] overflow-y-auto leading-relaxed animate-fade-in custom-scrollbar">
                <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold mb-1">
                  <Award className="w-4 h-4" /> สรุปผลการประเมินอัจฉริยะ
                </div>

                {/* Simulated rendering of response */}
                <div className="space-y-3 text-muted-foreground text-xs">
                  <p>
                    โพสต์ Reels วิดีโอสั้นสัปดาห์นี้ทำยอดเข้าถึงได้ดีที่สุด
                    (**95/100**) และมียอดผู้ติดตามหน้าใหม่เพิ่มขึ้น
                    <span className="text-emerald-400 font-bold ml-1">
                      +465 คน (+24.5%)
                    </span>
                  </p>
                  <div className="p-2.5 rounded bg-background border border-border space-y-1">
                    <span className="block font-bold text-foreground text-[10px] text-primary">
                      💡 แนวทางโพสต์ชิ้นถัดไป:
                    </span>
                    <p className="leading-relaxed text-[11px]">
                      ทำคลิปวิดีโอสั้นเบื้องหลังการทำงาน คู่กับ
                      **รีวิวการจัดส่งของแบรนด์**
                      พร้อมเขียนคำแคปชั่นกระตุ้นคอมเมนต์ท้ายโพสต์เพื่อเปิดการมองเห็น!
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 p-2 rounded bg-background border border-border">
                    <span className="block font-bold text-foreground text-[10px]">
                      ⏰ เวลาที่แนะนำให้โพสต์:
                    </span>
                    <span className="text-xs text-primary font-bold">
                      วันพุธ, วันศุกร์ (18:30 - 20:00 น.)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Initial Screen state */}
            {!isAnalyzing && !analysisResult && (
              <div className="p-6 border border-dashed border-border rounded-xl text-center space-y-3 bg-muted/5">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="block text-xs font-bold text-foreground">
                    พร้อมเริ่มการประเมินแผนงาน
                  </span>
                  <p className="text-xxs text-muted-foreground leading-relaxed">
                    ระบบจะตรวจสอบตัวเลขสถิติยอดไลก์ ผู้ติดตาม และยอดคนเห็น
                    เพื่อแนะนำหัวข้อคอนเทนต์ถัดไปที่แบรนด์ควรทำ
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={startAiAnalysis}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-xs font-extrabold text-white shadow-lg cursor-pointer transition"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังวิเคราะห์ข้อมูล...
              </>
            ) : (
              <>
                <Sparkles className="w-4.5 h-4.5 text-yellow-300" />
                วิเคราะห์ประสิทธิภาพด้วย AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
