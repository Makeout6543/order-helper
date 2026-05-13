import { useEffect, useState } from "react";
import { ChevronDown, Check, Copy } from "lucide-react";
import { api } from "../stores/api";
import type { Supplier, Material, OrderItem } from "../types";

interface Props {
  suppliers: Supplier[];
  currentSupplier: Supplier | null;
  onSupplierChange: (s: Supplier) => void;
  onOrderCreated: () => void;
}

export default function OrderPage({ suppliers, currentSupplier, onSupplierChange, onOrderCreated }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [showPicker, setShowPicker] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastOrderText, setLastOrderText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (currentSupplier?.id) {
      api.materials.list(currentSupplier.id).then(mats => {
        setMaterials(mats);
        const q: Record<number, string> = {};
        mats.forEach(m => { q[m.id!] = "0"; });
        setQuantities(q);
      });
    }
  }, [currentSupplier]);

  if (!currentSupplier) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-gray-400">
        <p className="text-lg mb-2">还没有供应商</p>
        <p className="text-sm">点击底部「管理」添加供应商和物料</p>
      </div>
    );
  }

  const handleQuantityChange = (id: number, value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setQuantities(prev => ({ ...prev, [id]: value }));
    }
  };

  const buildOrderText = (supplierName: string, items: OrderItem[]) => {
    const date = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
    return `${supplierName} ${date}\n` + items.map(i => `${i.materialName} ${i.quantity}${i.unit}`).join("\n");
  };

  const handleSubmit = async () => {
    const items: OrderItem[] = [];
    materials.forEach(m => {
      const qty = parseInt(quantities[m.id!] || "0");
      if (qty > 0) items.push({ materialName: m.name, spec: m.spec, quantity: qty, unit: m.unit });
    });
    if (items.length === 0) return;

    await api.orders.create({
      supplier_id: currentSupplier.id!,
      supplier_name: currentSupplier.name,
      items,
    });

    setLastOrderText(buildOrderText(currentSupplier.name, items));
    setShowResult(true);
    setCopied(false);
    onOrderCreated();

    // 重置数量
    const q: Record<number, string> = {};
    materials.forEach(m => { q[m.id!] = "0"; });
    setQuantities(q);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(lastOrderText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasItems = Object.values(quantities).some(v => parseInt(v) > 0);

  return (
    <div className="p-4">
      <div className="relative mb-4">
        <button onClick={() => setShowPicker(!showPicker)}
          className="w-full flex items-center justify-between bg-primary-50 border border-primary-200 rounded-xl px-4 py-3 text-primary-700 font-medium">
          <span>📦 {currentSupplier.name}</span>
          <ChevronDown size={18} className={`transition-transform ${showPicker ? "rotate-180" : ""}`} />
        </button>
        {showPicker && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
            {suppliers.map(s => (
              <button key={s.id} onClick={() => { onSupplierChange(s); setShowPicker(false); }}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${s.id === currentSupplier.id ? "bg-primary-50 text-primary-700 font-medium" : ""}`}>
                {s.name}{s.id === currentSupplier.id && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 mb-6">
        {materials.map(m => (
          <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-800">{m.name}</span>
              {m.spec && <span className="text-gray-400 text-xs ml-1">{m.spec}</span>}
            </div>
            <input type="text" inputMode="numeric" value={quantities[m.id!] || "0"}
              onChange={e => handleQuantityChange(m.id!, e.target.value)}
              className="w-16 text-center text-sm font-bold border border-gray-300 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400" />
            <span className="text-xs text-gray-500 w-6">{m.unit}</span>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={!hasItems}
        className={`w-full py-3.5 rounded-xl text-white font-bold text-lg transition-all ${hasItems ? "bg-primary-600 hover:bg-primary-700 active:scale-[0.98]" : "bg-gray-300"}`}>
        确认下单
      </button>

      {showResult && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setShowResult(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4"><span className="text-4xl">✅</span><h3 className="text-lg font-bold mt-2">下单成功</h3></div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{lastOrderText}</pre>
            </div>
            <button onClick={handleCopy}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-all ${copied ? "bg-emerald-500" : "bg-primary-600 hover:bg-primary-700 active:scale-[0.98]"}`}>
              {copied ? <Check size={20} /> : <Copy size={20} />}
              {copied ? "已复制" : "一键复制，发到微信"}
            </button>
            <button onClick={() => setShowResult(false)} className="w-full mt-2 py-2 text-sm text-gray-400">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
