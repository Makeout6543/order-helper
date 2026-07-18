import { useEffect, useState } from "react";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../stores/api";
import type { Order } from "../types";

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true); setError("");
    try { setOrders(await api.orders.list()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除吗？")) return;
    setDeletingId(id); setError("");
    try { await api.orders.delete(id); setOrders(prev => prev.filter(o => o.id !== id)); }
    catch (e) { setError((e as Error).message); }
    finally { setDeletingId(null); }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">加载中...</div>;

  if (error && orders.length === 0) return <div className="p-8 text-center"><p className="text-red-500 mb-3">{error}</p><button onClick={load} className="px-4 py-2 rounded-lg bg-primary-600 text-white">重试</button></div>;

  if (orders.length === 0) {
    return <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400"><p className="text-lg">暂无订单记录</p></div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">📋 历史订单</h2>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        {orders.map(order => {
          const id = order.id!;
          const d = new Date(order.createdAt);
          const ds = `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          const total = order.items.reduce((sum, it) => sum + (it.price ? it.price * it.quantity : 0), 0);
          const totalRounded = Math.round(total);
          return (
            <div key={id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => setExpanded(p => ({ ...p, [id]: !p[id] }))}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50">
                <div><span className="font-medium text-gray-800">{order.supplierName}</span><span className="text-xs text-gray-400 ml-2">{ds}</span></div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {totalRounded > 0 ? `¥${totalRounded} · ${order.items.length}种` : `${order.items.length}种`}
                  </span>
                  {expanded[id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </button>
              {expanded[id] && (
                <div className="px-4 pb-3 border-t border-gray-100">
                  <div className="pt-2 space-y-1">
                    {order.items.map((item, i) => {
                      const lineTotal = item.price ? Math.round(item.price * item.quantity) : 0;
                      return (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.materialName}{item.spec ? <span className="text-gray-400 text-xs ml-1">{item.spec}</span> : null}</span>
                          <span className="text-gray-800 font-medium">
                            {item.quantity}{item.unit}
                            {lineTotal > 0 && <span className="text-gray-400 text-xs ml-2 font-normal">¥{lineTotal}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button disabled={deletingId === id} onClick={() => handleDelete(id)} className="flex items-center gap-1 mt-3 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"><Trash2 size={12} /> {deletingId === id ? "删除中…" : "删除"}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
