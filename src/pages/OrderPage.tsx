import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Copy } from "lucide-react";
import { api } from "../stores/api";
import type { Supplier, Material, OrderItem } from "../types";

interface Props {
  suppliers: Supplier[];
  currentSupplier: Supplier | null;
  onSupplierChange: (s: Supplier) => void;
  onOrderCreated: () => void;
  materialRevision: number;
  orderRevision: number;
}

interface LastOrder { supplierName: string; userName: string; items: OrderItem[]; note: string; date: string; total: number; }
const money = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const createRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
};

export default function OrderPage({ suppliers, currentSupplier, onSupplierChange, onOrderCreated, materialRevision, orderRevision }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [copied, setCopied] = useState(false);
  const [usageCount, setUsageCount] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copyError, setCopyError] = useState("");
  const requestId = useRef(createRequestId());
  const previousSupplierId = useRef<number | null>(null);
  const loadSequence = useRef(0);

  useEffect(() => {
    if (!currentSupplier?.id) return;
    const supplierId = currentSupplier.id;
    const switched = previousSupplierId.current !== supplierId;
    previousSupplierId.current = supplierId;
    if (switched) { setQuantities({}); setNote(""); requestId.current = createRequestId(); }
    const sequence = ++loadSequence.current;
    setLoading(true); setError("");
    api.materials.list(supplierId).then(mats => {
      if (sequence !== loadSequence.current) return;
      setMaterials(mats);
      setQuantities(prev => Object.fromEntries(mats.map(m => [m.id!, switched ? "" : (prev[m.id!] ?? "")])));
    }).catch(e => { if (sequence === loadSequence.current) setError((e as Error).message); })
      .finally(() => { if (sequence === loadSequence.current) setLoading(false); });
  }, [currentSupplier?.id, materialRevision]);

  useEffect(() => {
    api.orders.list().then(orders => {
      const count: Record<number, number> = {};
      orders.forEach(o => { if (o.supplierId != null) count[o.supplierId] = (count[o.supplierId] || 0) + 1; });
      setUsageCount(count);
    }).catch(() => setUsageCount({}));
  }, [orderRevision, suppliers]);

  const sortedSuppliers = useMemo(() => [...suppliers].sort((a, b) => (usageCount[b.id!] || 0) - (usageCount[a.id!] || 0)), [suppliers, usageCount]);
  const topSuppliers = sortedSuppliers.slice(0, 3);
  const otherSuppliers = sortedSuppliers.slice(3);
  const currentInOthers = !!(currentSupplier && otherSuppliers.find(s => s.id === currentSupplier.id));

  if (!currentSupplier) return <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400"><p className="text-lg mb-2">还没有供应商</p><p className="text-sm">点击底部「管理」添加供应商和物料</p></div>;

  const handleQuantityChange = (id: number, value: string) => {
    if (value === "" || /^\d+(\.\d{0,2})?$/.test(value)) { setQuantities(prev => ({ ...prev, [id]: value })); requestId.current = createRequestId(); }
  };

  const buildOrderText = (order: LastOrder) => {
    const lines = order.items.map(i => `• ${i.materialName}${i.spec ? " " + i.spec : ""}：${i.quantity}${i.unit}`);
    let text = order.userName ? `【${order.userName}】\n` : "";
    text += `${order.supplierName}下单｜${order.date}\n\n📦 物料清单\n${lines.join("\n")}`;
    if (order.total > 0) text += `\n\n合计：¥${money.format(order.total)}`;
    if (order.note) text += `\n\n备注：${order.note}`;
    return text;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const items = materials.flatMap(m => {
      const quantity = Number(quantities[m.id!] || 0);
      return quantity > 0 ? [{ materialName: m.name, spec: m.spec, quantity, unit: m.unit, price: m.price }] : [];
    });
    if (!items.length) return;
    setSubmitting(true); setSubmitError("");
    try {
      const userName = (localStorage.getItem("userName") || "").trim();
      await api.orders.create({ supplier_id: currentSupplier.id!, supplier_name: currentSupplier.name, items, user_name: userName, note: note.trim(), request_id: requestId.current });
      const order: LastOrder = { supplierName: currentSupplier.name, userName, items, note: note.trim(), date: new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" }), total: items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0) };
      setLastOrder(order); setCopied(false); setCopyError(""); onOrderCreated();
      setQuantities(Object.fromEntries(materials.map(m => [m.id!, ""]))); setNote(""); requestId.current = createRequestId();
    } catch (e) { setSubmitError((e as Error).message); }
    finally { setSubmitting(false); }
  };

  const handleCopy = async () => {
    if (!lastOrder) return;
    const text = buildOrderText(lastOrder);
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const succeeded = document.execCommand("copy");
        textarea.remove();
        if (!succeeded) throw new Error("浏览器拒绝复制");
      }
      setCopied(true); setCopyError(""); setTimeout(() => setCopied(false), 2000);
    } catch { setCopyError("复制失败，请长按下方内容手动复制"); }
  };

  const hasItems = Object.values(quantities).some(v => Number(v || 0) > 0);
  return (
    <div className="p-4">
      <div className="relative mb-4"><div className="flex gap-2">
        {topSuppliers.map(s => <button key={s.id} onClick={() => onSupplierChange(s)} className={`flex-1 min-w-0 px-3 py-2 rounded-xl text-sm font-medium truncate ${s.id === currentSupplier.id ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"}`}>{s.name}</button>)}
        {otherSuppliers.length > 0 && <button onClick={() => setShowPicker(!showPicker)} className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium ${currentInOthers ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"}`}>{currentInOthers ? currentSupplier.name : "其他"}<ChevronDown size={14} /></button>}
      </div>{showPicker && <div className="absolute top-full right-0 mt-1 min-w-[60%] bg-white border rounded-xl shadow-lg z-10 overflow-hidden">{otherSuppliers.map(s => <button key={s.id} onClick={() => { onSupplierChange(s); setShowPicker(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex justify-between">{s.name}{s.id === currentSupplier.id && <Check size={16} />}</button>)}</div>}</div>
      {loading && <p className="text-center text-gray-400 py-4">物料加载中…</p>}
      {error && <p className="text-center text-red-500 py-4">{error}</p>}
      {!loading && !error && <div className="space-y-2 mb-6">{materials.map(m => <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5"><div className="flex-1 min-w-0"><span className="text-sm font-medium">{m.name}</span>{m.spec && <span className="text-gray-400 text-xs ml-1">{m.spec}</span>}{m.price > 0 && <span className="text-gray-400 text-xs ml-2">¥{money.format(m.price)}/{m.unit}</span>}</div><input aria-label={`${m.name}数量`} inputMode="decimal" value={quantities[m.id!] ?? ""} placeholder="0" onChange={e => handleQuantityChange(m.id!, e.target.value)} className="w-16 text-center text-base font-bold border rounded-lg py-1.5" /><span className="text-xs text-gray-500 w-6">{m.unit}</span></div>)}</div>}
      <input value={note} onChange={e => { setNote(e.target.value); requestId.current = createRequestId(); }} placeholder="备注：" className="w-full mb-3 border rounded-xl px-4 py-3 text-base sm:text-sm" />
      {submitError && <p className="text-sm text-red-500 mb-3">{submitError}</p>}
      <button onClick={handleSubmit} disabled={!hasItems || submitting} aria-busy={submitting} className="w-full py-3.5 rounded-xl text-white font-bold text-lg bg-primary-600 disabled:bg-gray-300">{submitting ? "提交中…" : "确认下单"}</button>
      {lastOrder && <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setLastOrder(null)}><div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm max-h-[90dvh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4"><span className="text-4xl">✅</span><h3 className="text-lg font-bold mt-2">下单成功</h3><p className="text-xs text-gray-400 mt-1">{lastOrder.userName && `【${lastOrder.userName}】 · `}{lastOrder.supplierName} · {lastOrder.date}</p></div>
        <div className="bg-primary-50 rounded-xl p-4 mb-3"><h4 className="text-sm font-bold text-primary-700 mb-2">📦 物料清单</h4><div className="divide-y divide-primary-100">{lastOrder.items.map((item, i) => <div key={i} className="flex justify-between gap-3 py-2"><span className="font-medium">{item.materialName}{item.spec && <small className="text-gray-400 ml-1">{item.spec}</small>}</span><strong className="text-primary-700 shrink-0">{item.quantity}{item.unit}</strong></div>)}</div></div>
        {lastOrder.total > 0 && <div className="flex justify-between items-baseline px-2 mb-3"><span className="text-gray-500">合计</span><strong className="text-xl text-gray-900">¥{money.format(lastOrder.total)}</strong></div>}
        {lastOrder.note && <div className="bg-amber-50 text-amber-900 rounded-lg p-3 text-sm mb-3">备注：{lastOrder.note}</div>}
        {copyError ? <div className="mb-3"><p className="text-sm text-red-500 mb-2">{copyError}</p><textarea readOnly value={buildOrderText(lastOrder)} onFocus={e => e.currentTarget.select()} className="w-full min-h-44 rounded-xl border border-red-200 bg-gray-50 p-3 text-sm leading-6" /></div> : <pre className="sr-only">{buildOrderText(lastOrder)}</pre>}
        <button onClick={handleCopy} className={`w-full flex justify-center gap-2 py-3 rounded-xl font-bold text-white ${copied ? "bg-emerald-500" : "bg-primary-600"}`}>{copied ? <Check size={20} /> : <Copy size={20} />}{copied ? "已复制" : "一键复制，发到微信"}</button><button onClick={() => setLastOrder(null)} className="w-full mt-2 py-2 text-sm text-gray-400">关闭</button>
      </div></div>}
    </div>
  );
}
