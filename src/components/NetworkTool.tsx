import { useState, useEffect, useCallback } from "react";

interface NetworkInfo {
  publicIP: string | null;
  ipv6: string | null;
  isp: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  localIPs: string[];
  userAgent: string;
  connectionType: string | null;
  downlink: number | null;
  rtt: number | null;
  saveData: boolean | null;
  online: boolean;
  latency: number | null;
}

interface PingResult {
  url: string;
  latency: number | null;
  status: "pending" | "success" | "failed";
}

const PING_TARGETS = [
  { url: "https://www.cloudflare.com", name: "Cloudflare" },
  { url: "https://www.google.com", name: "Google" },
  { url: "https://www.baidu.com", name: "百度" },
];

function StatusBadge({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        online
          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${online ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
      />
      {online ? "在线" : "离线"}
    </span>
  );
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  loading,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  loading?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0 pt-0.5">{label}</span>
      {loading ? (
        <span className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      ) : (
        <span
          className={`text-sm text-right break-all ${mono ? "font-mono" : ""} ${
            value ? "text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

export default function NetworkTool() {
  const [info, setInfo] = useState<NetworkInfo>({
    publicIP: null,
    ipv6: null,
    isp: null,
    country: null,
    countryCode: null,
    region: null,
    city: null,
    latitude: null,
    longitude: null,
    timezone: null,
    localIPs: [],
    userAgent: navigator.userAgent,
    connectionType: null,
    downlink: null,
    rtt: null,
    saveData: null,
    online: navigator.onLine,
    latency: null,
  });

  const [loading, setLoading] = useState(true);
  const [pingResults, setPingResults] = useState<PingResult[]>(
    PING_TARGETS.map((t) => ({ url: t.url, latency: null, status: "pending" }))
  );
  const [refreshing, setRefreshing] = useState(false);

  // Get connection info from Network Information API
  const getConnectionInfo = useCallback(() => {
    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (conn) {
      return {
        connectionType: conn.effectiveType ?? conn.type ?? null,
        downlink: conn.downlink ?? null,
        rtt: conn.rtt ?? null,
        saveData: conn.saveData ?? null,
      };
    }
    return { connectionType: null, downlink: null, rtt: null, saveData: null };
  }, []);

  // Get local IPs via WebRTC
  const getLocalIPs = useCallback(async (): Promise<string[]> => {
    const ips: string[] = [];
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 2000);
        pc.onicecandidate = (e) => {
          if (!e.candidate) {
            clearTimeout(timeout);
            resolve();
            return;
          }
          const match = e.candidate.candidate.match(
            /(\d{1,3}(?:\.\d{1,3}){3}|[a-f0-9:]+:[a-f0-9:]+)/i
          );
          if (match) {
            const ip = match[1];
            if (!ips.includes(ip) && !ip.startsWith("0.") && ip !== "0.0.0.0") {
              ips.push(ip);
            }
          }
        };
      });
      pc.close();
    } catch (_) {}
    return ips;
  }, []);

  // Fetch public IP info from ipapi.co
  const fetchIPInfo = useCallback(async () => {
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return {
        publicIP: data.ip ?? null,
        isp: data.org ?? null,
        country: data.country_name ?? null,
        countryCode: data.country_code ?? null,
        region: data.region ?? null,
        city: data.city ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        timezone: data.timezone ?? null,
        ipv6: null as string | null,
      };
    } catch (_) {
      // fallback to ip-api.com
      try {
        const res2 = await fetch("http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,query", {
          signal: AbortSignal.timeout(8000),
        });
        if (!res2.ok) throw new Error("Failed");
        const data2 = await res2.json();
        if (data2.status === "success") {
          return {
            publicIP: data2.query ?? null,
            isp: data2.isp ?? null,
            country: data2.country ?? null,
            countryCode: data2.countryCode ?? null,
            region: data2.regionName ?? null,
            city: data2.city ?? null,
            latitude: data2.lat ?? null,
            longitude: data2.lon ?? null,
            timezone: data2.timezone ?? null,
            ipv6: null as string | null,
          };
        }
      } catch (_) {}
      return null;
    }
  }, []);

  // Measure latency to a URL via fetch timing
  const measureLatency = useCallback(async (url: string): Promise<number | null> => {
    try {
      const start = performance.now();
      await fetch(url + "?_nc=" + Date.now(), {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      return Math.round(performance.now() - start);
    } catch (_) {
      return null;
    }
  }, []);

  const runPingTests = useCallback(async () => {
    setPingResults(PING_TARGETS.map((t) => ({ url: t.url, latency: null, status: "pending" })));
    for (let i = 0; i < PING_TARGETS.length; i++) {
      const t = PING_TARGETS[i];
      const latency = await measureLatency(t.url);
      setPingResults((prev) => {
        const next = [...prev];
        next[i] = { url: t.url, latency, status: latency !== null ? "success" : "failed" };
        return next;
      });
    }
  }, [measureLatency]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const connInfo = getConnectionInfo();
    const [ipData, localIPs] = await Promise.all([fetchIPInfo(), getLocalIPs()]);
    const latency = await measureLatency("https://www.cloudflare.com");
    setInfo((prev) => ({
      ...prev,
      ...connInfo,
      ...(ipData ?? {}),
      localIPs,
      latency,
      online: navigator.onLine,
    }));
    setLoading(false);
    runPingTests();
  }, [getConnectionInfo, fetchIPInfo, getLocalIPs, measureLatency, runPingTests]);

  useEffect(() => {
    loadAll();
    const handleOnline = () => setInfo((p) => ({ ...p, online: true }));
    const handleOffline = () => setInfo((p) => ({ ...p, online: false }));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const latencyColor = (ms: number | null) => {
    if (ms === null) return "text-slate-400";
    if (ms < 100) return "text-green-600 dark:text-green-400";
    if (ms < 300) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const connectionTypeLabel: Record<string, string> = {
    "4g": "4G / WiFi",
    "3g": "3G",
    "2g": "2G",
    slow_2g: "弱网 (2G)",
    wifi: "WiFi",
    ethernet: "有线网络",
    cellular: "移动网络",
    none: "无连接",
    unknown: "未知",
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge online={info.online} />
          {info.latency !== null && (
            <span className={`text-xs font-mono font-semibold ${latencyColor(info.latency)}`}>
              {info.latency}ms
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={refreshing || loading ? "animate-spin" : ""}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          刷新检测
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Public IP */}
        <InfoCard title="公网 IP 信息" icon="🌐">
          <InfoRow label="公网 IPv4" value={info.publicIP} loading={loading} mono />
          <InfoRow label="ISP / 运营商" value={info.isp} loading={loading} />
          <InfoRow label="国家/地区" value={info.country ? `${info.country} ${info.countryCode ? `(${info.countryCode})` : ""}` : null} loading={loading} />
          <InfoRow label="省份 / 地区" value={info.region} loading={loading} />
          <InfoRow label="城市" value={info.city} loading={loading} />
          <InfoRow
            label="经纬度"
            value={
              info.latitude !== null && info.longitude !== null
                ? `${info.latitude.toFixed(4)}, ${info.longitude.toFixed(4)}`
                : null
            }
            loading={loading}
            mono
          />
          <InfoRow label="时区" value={info.timezone} loading={loading} />
        </InfoCard>

        {/* Connection Info */}
        <InfoCard title="连接信息" icon="📡">
          <InfoRow
            label="连接类型"
            value={
              info.connectionType
                ? connectionTypeLabel[info.connectionType] ?? info.connectionType
                : null
            }
            loading={loading}
          />
          <InfoRow
            label="下行速率"
            value={info.downlink !== null ? `${info.downlink} Mbps` : null}
            loading={loading}
            mono
          />
          <InfoRow
            label="往返延迟 (RTT)"
            value={info.rtt !== null ? `${info.rtt} ms` : null}
            loading={loading}
            mono
          />
          <InfoRow
            label="省流模式"
            value={info.saveData !== null ? (info.saveData ? "已开启" : "未开启") : null}
            loading={loading}
          />
          <div className="pt-1 border-t border-slate-100 dark:border-slate-700 mt-1">
            <span className="text-sm text-slate-500 dark:text-slate-400 block mb-2">本地 IP（WebRTC）</span>
            {loading ? (
              <span className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse block" />
            ) : info.localIPs.length > 0 ? (
              <div className="space-y-1">
                {info.localIPs.map((ip) => (
                  <span key={ip} className="block text-sm font-mono text-slate-800 dark:text-slate-100 break-all">
                    {ip}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>
        </InfoCard>

        {/* Ping Tests */}
        <InfoCard title="连通性测试" icon="🏓">
          <div className="space-y-3">
            {PING_TARGETS.map((target, i) => {
              const result = pingResults[i];
              return (
                <div key={target.url} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{target.name}</span>
                  <div className="flex items-center gap-2">
                    {result.status === "pending" ? (
                      <span className="text-xs text-slate-400 animate-pulse">检测中…</span>
                    ) : result.status === "failed" ? (
                      <span className="text-xs text-red-500 font-semibold">超时</span>
                    ) : (
                      <>
                        <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (result.latency ?? 9999) < 100
                                ? "bg-green-500"
                                : (result.latency ?? 9999) < 300
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(100, ((result.latency ?? 0) / 500) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono font-semibold w-14 text-right ${latencyColor(result.latency)}`}>
                          {result.latency !== null ? `${result.latency} ms` : "—"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </InfoCard>

        {/* Browser Info */}
        <InfoCard title="浏览器 / 系统信息" icon="💻">
          <InfoRow label="用户代理" value={info.userAgent} />
          <InfoRow
            label="语言"
            value={typeof navigator !== "undefined" ? navigator.language : null}
          />
          <InfoRow
            label="平台"
            value={typeof navigator !== "undefined" ? (navigator as any).userAgentData?.platform ?? navigator.platform ?? null : null}
          />
          <InfoRow
            label="逻辑核心数"
            value={typeof navigator !== "undefined" && navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} 核` : null}
            mono
          />
          <InfoRow
            label="设备内存"
            value={typeof navigator !== "undefined" && (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : null}
            mono
          />
          <InfoRow
            label="屏幕分辨率"
            value={typeof screen !== "undefined" ? `${screen.width} × ${screen.height} (${window.devicePixelRatio}x DPR)` : null}
            mono
          />
          <InfoRow
            label="当前时间"
            value={new Date().toLocaleString("zh-CN", { hour12: false })}
            mono
          />
        </InfoCard>
      </div>

      {/* DNS Leak hint */}
      <p className="text-xs text-center text-slate-400 dark:text-slate-500">
        * 本地 IP 通过 WebRTC ICE 候选获取，公网 IP 经由第三方 API 查询，所有数据均在您的浏览器中处理，未发送至本站服务器。
      </p>
    </div>
  );
}
