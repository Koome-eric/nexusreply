"use client";
import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils";

interface AdminUser { id: string; email: string; name: string|null; role: string; plan: string; status: string; locationCount: number; messageCount: number; trialEndsAt: string|null; createdAt: string }
const PLAN_COLORS: Record<string,string> = { trial: "#f59e0b", starter: "#14b8a6", pro: "#8b5cf6", agency: "#ec4899", none: "#445566" };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string|null>(null);

  const load = (p = page) => {
    setLoading(true);
    fetch(`/api/admin/users?page=${p}`).then(r=>r.json()).then(d => {
      setUsers(d.users||[]); setTotal(d.total||0); setLoading(false);
    });
  };
  useEffect(() => { load(); }, [page]);

  const doAction = async (userId: string, action: string, plan?: string) => {
    setActing(userId);
    await fetch("/api/admin/users", { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({userId,action,plan}) });
    load(); setActing(null);
  };

  const filtered = search ? users.filter(u => u.email.includes(search) || u.name?.includes(search)) : users;
  const INP: React.CSSProperties = { background: "#060b12", border: "1px solid rgba(236,72,153,0.15)", borderRadius: "9px", padding: "9px 14px", color: "#e2eaf4", fontSize: "13px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ padding: "clamp(20px,4vw,36px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", color: "#e2eaf4", marginBottom: "4px" }}>Users ({total})</h1>
          <p style={{ color: "#7c9ab8", fontSize: "13px" }}>Manage all registered users and their plans.</p>
        </div>
        <input style={{ ...INP, width: "240px" }} placeholder="Search email or name..." value={search} onChange={e => setSearch(e.target.value)}
          onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = "#ec4899"}
          onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = "rgba(236,72,153,0.15)"} />
      </div>

      <div style={{ background: "rgba(13,21,37,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "700px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["User","Plan","Status","Locations","Messages","Joined","Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#445566", fontWeight: 700, fontSize: "10px", letterSpacing: "0.05em" }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:5}).map((_,i) => (
                <tr key={i}><td colSpan={7} style={{ padding: "12px 16px" }}><div style={{ height: "30px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} /></td></tr>
              )) : filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: `${PLAN_COLORS[u.plan]}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: PLAN_COLORS[u.plan], flexShrink: 0 }}>
                        {(u.name||u.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: "#e2eaf4" }}>{u.name||"—"}</div>
                        <div style={{ color: "#445566", fontSize: "11px" }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: PLAN_COLORS[u.plan], background: `${PLAN_COLORS[u.plan]}18`, padding: "3px 8px", borderRadius: "5px" }}>
                      {u.plan.toUpperCase()}
                    </span>
                    {u.role === "admin" && <span style={{ marginLeft: "5px", fontSize: "10px", color: "#ec4899" }}>🛡</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: "11px", color: u.status === "active" ? "#22c55e" : u.status === "trialing" ? "#f59e0b" : "#ef4444" }}>● {u.status}</span>
                    {u.status === "trialing" && u.trialEndsAt && <div style={{ fontSize: "10px", color: "#445566" }}>ends {formatRelativeTime(u.trialEndsAt)}</div>}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#7c9ab8" }}>{u.locationCount}</td>
                  <td style={{ padding: "12px 16px", color: "#7c9ab8" }}>{u.messageCount.toLocaleString()}</td>
                  <td style={{ padding: "12px 16px", color: "#445566", whiteSpace: "nowrap" }}>{formatRelativeTime(u.createdAt)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {acting === u.id ? <span style={{ fontSize: "12px", color: "#445566" }}>...</span> : (
                      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                        <select onChange={e => { if(e.target.value) { doAction(u.id,"set_plan",e.target.value); e.target.value=""; } }}
                          style={{ fontSize: "11px", padding: "4px 6px", background: "#060b12", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#7c9ab8", cursor: "pointer", fontFamily: "inherit" }}>
                          <option value="">Set plan…</option>
                          {["trial","starter","pro","agency"].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button onClick={() => doAction(u.id, u.role === "admin" ? "remove_admin" : "make_admin")}
                          style={{ fontSize: "11px", padding: "4px 8px", background: "transparent", border: "1px solid rgba(236,72,153,0.2)", borderRadius: "6px", color: u.role === "admin" ? "#ec4899" : "#445566", cursor: "pointer", fontFamily: "inherit" }}>
                          {u.role === "admin" ? "Admin ✓" : "Admin"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 20 && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "6px", justifyContent: "center" }}>
            {Array.from({ length: Math.ceil(total/20) }, (_,i) => i+1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={{ width: "30px", height: "30px", borderRadius: "7px", border: `1px solid ${page===p ? "#ec4899" : "rgba(255,255,255,0.08)"}`, background: page===p ? "rgba(236,72,153,0.1)" : "transparent", color: page===p ? "#ec4899" : "#7c9ab8", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>{p}</button>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }`}</style>
    </div>
  );
}
