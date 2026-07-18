import { useEffect, useState, useCallback } from "react";
import { ShoppingCart, History, Settings } from "lucide-react";
import OrderPage from "./pages/OrderPage";
import HistoryPage from "./pages/HistoryPage";
import ManagePage from "./pages/ManagePage";
import PasswordGate from "./components/PasswordGate";
import { api } from "./stores/api";
import { supabase } from "./lib/supabase";
import type { Supplier } from "./types";

type Tab = "order" | "history" | "manage";

function AppInner() {
  const [tab, setTab] = useState<Tab>("order");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);
  const [supplierRevision, setSupplierRevision] = useState(0);
  const [materialRevision, setMaterialRevision] = useState(0);
  const [orderRevision, setOrderRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const all = await api.suppliers.list();
      setSuppliers(all);
      setCurrentSupplier(prev => all.find(s => s.id === prev?.id) ?? all[0] ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSuppliers(); }, [supplierRevision, loadSuppliers]);

  useEffect(() => {
    const channel = supabase.channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "suppliers" }, () => setSupplierRevision(v => v + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "materials" }, () => setMaterialRevision(v => v + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => setOrderRevision(v => v + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const tabs = [
    { key: "order" as Tab, icon: ShoppingCart, label: "下单" },
    { key: "history" as Tab, icon: History, label: "历史" },
    { key: "manage" as Tab, icon: Settings, label: "管理" },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] max-h-[100dvh] max-w-lg mx-auto bg-white shadow-xl">
      <header className="bg-primary-700 text-white px-4 py-3 safe-top"><h1 className="text-lg font-bold text-center">下单助手</h1></header>
      <main className="flex-1 overflow-y-auto">
        {error ? <div className="p-8 text-center"><p className="text-red-600 mb-3">数据加载失败：{error}</p><button onClick={loadSuppliers} className="px-4 py-2 rounded-lg bg-primary-600 text-white">重试</button></div> : loading ? <div className="p-8 text-center text-gray-400">加载中…</div> : <>
          {tab === "order" && <OrderPage suppliers={suppliers} currentSupplier={currentSupplier} onSupplierChange={setCurrentSupplier} onOrderCreated={() => setOrderRevision(v => v + 1)} materialRevision={materialRevision} orderRevision={orderRevision} />}
          {tab === "history" && <HistoryPage key={orderRevision} />}
          {tab === "manage" && <ManagePage suppliers={suppliers} onChanged={() => setSupplierRevision(v => v + 1)} materialRevision={materialRevision} />}
        </>}
      </main>
      <nav className="flex border-t border-gray-200 bg-white safe-bottom">
        {tabs.map(({ key, icon: Icon, label }) => <button key={key} onClick={() => setTab(key)} className={`flex-1 flex flex-col items-center py-2 text-xs ${tab === key ? "text-primary-600" : "text-gray-400"}`}><Icon size={20} /><span className="mt-0.5">{label}</span></button>)}
      </nav>
    </div>
  );
}

export default function App() { return <PasswordGate><AppInner /></PasswordGate>; }
