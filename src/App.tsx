import { useEffect, useState, useCallback } from "react";
import { ShoppingCart, History, Settings } from "lucide-react";
import OrderPage from "./pages/OrderPage";
import HistoryPage from "./pages/HistoryPage";
import ManagePage from "./pages/ManagePage";
import { api } from "./stores/api";
import type { Supplier } from "./types";

type Tab = "order" | "history" | "manage";

export default function App() {
  const [tab, setTab] = useState<Tab>("order");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { loadSuppliers(); }, [refreshKey]);

  const loadSuppliers = useCallback(async () => {
    try {
      const all = await api.suppliers.list();
      setSuppliers(all);
      setCurrentSupplier(prev => {
        if (!prev || !all.find(s => s.id === prev.id)) return all[0] || null;
        return all.find(s => s.id === prev.id) || all[0] || null;
      });
    } catch (e) {
      console.error("加载供应商失败", e);
    }
  }, []);

  const refresh = () => setRefreshKey(k => k + 1);

  const tabs = [
    { key: "order" as Tab, icon: ShoppingCart, label: "下单" },
    { key: "history" as Tab, icon: History, label: "历史" },
    { key: "manage" as Tab, icon: Settings, label: "管理" },
  ];

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-white shadow-xl">
      <header className="bg-primary-700 text-white px-4 py-3 safe-top">
        <h1 className="text-lg font-bold text-center">下单助手</h1>
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === "order" && (
          <OrderPage
            suppliers={suppliers}
            currentSupplier={currentSupplier}
            onSupplierChange={setCurrentSupplier}
            onOrderCreated={refresh}
          />
        )}
        {tab === "history" && <HistoryPage key={refreshKey} />}
        {tab === "manage" && <ManagePage suppliers={suppliers} onChanged={refresh} />}
      </main>

      <nav className="flex border-t border-gray-200 bg-white safe-bottom">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
              tab === key ? "text-primary-600" : "text-gray-400"
            }`}
          >
            <Icon size={20} />
            <span className="mt-0.5">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
