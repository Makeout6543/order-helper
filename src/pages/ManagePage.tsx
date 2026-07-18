import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit3, Download, Upload } from "lucide-react";
import { api } from "../stores/api";
import { snapshot, restoreFromSnapshot, backupToLocalStorage, validateSnapshot } from "../stores/db";
import type { Supplier, Material } from "../types";

interface Props {
  suppliers: Supplier[];
  onChanged: () => void;
  materialRevision: number;
}

export default function ManagePage({ suppliers, onChanged, materialRevision }: Props) {
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [mName, setMName] = useState(""); const [mSpec, setMSpec] = useState(""); const [mUnit, setMUnit] = useState(""); const [mPrice, setMPrice] = useState("");
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loadSequence = useRef(0);

  const handleUserNameChange = (v: string) => {
    setUserName(v);
    localStorage.setItem("userName", v);
  };

  const exportData = async () => {
    setBusy(true); setError("");
    try {
    const data = await snapshot();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `下单助手-备份-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const data = validateSnapshot(JSON.parse(text));
      const total = data.suppliers.length + data.materials.length + data.orders.length;
      if (!confirm(`预检通过：${data.suppliers.length} 个供应商、${data.materials.length} 个物料、${data.orders.length} 张订单，共 ${total} 条。恢复将在数据库事务中执行。确定？`)) return;
      if (!confirm("再次确认：导入后云端原有数据将被清空，不可撤销。继续？")) return;
      setBusy(true); setError("");
      const result = await restoreFromSnapshot(data);
      await backupToLocalStorage();
      onChanged();
      alert(`导入成功：${result.suppliers} 个供应商、${result.materials} 个物料、${result.orders} 张订单`);
    } catch (e) {
      console.error(e);
      alert("导入失败：" + (e as Error).message);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    setSelectedSupplier(prev => suppliers.find(s => s.id === prev?.id) ?? suppliers[0] ?? null);
  }, [suppliers]);
  useEffect(() => {
    const sequence = ++loadSequence.current;
    if (selectedSupplier?.id) api.materials.list(selectedSupplier.id).then(rows => { if (sequence === loadSequence.current) setMaterials(rows); }).catch(e => { if (sequence === loadSequence.current) setError((e as Error).message); });
    else setMaterials([]);
  }, [selectedSupplier?.id, materialRevision]);

  const addSupplier = async () => {
    if (!newSupplierName.trim()) return;
    setBusy(true); setError("");
    try { await api.suppliers.create(newSupplierName.trim()); setNewSupplierName(""); setShowAddSupplier(false); onChanged(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const deleteSupplier = async (id: number) => {
    if (!confirm("删除供应商将同时删除其所有物料，确定？")) return;
    setBusy(true); setError("");
    try { await api.suppliers.delete(id); setSelectedSupplier(null); onChanged(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const openMaterialForm = (m?: Material) => {
    setEditing(m || null);
    setMName(m?.name || ""); setMSpec(m?.spec || ""); setMUnit(m?.unit || ""); setMPrice(m?.price?.toString() || "");
    setShowMaterialForm(true);
  };

  const saveMaterial = async () => {
    if (!mName.trim() || !mUnit.trim() || !selectedSupplier) return;
    setBusy(true); setError("");
    try {
      if (editing) await api.materials.update(selectedSupplier.id!, editing.id!, { name: mName, spec: mSpec, unit: mUnit, price: parseFloat(mPrice) || 0 });
      else await api.materials.create(selectedSupplier.id!, { name: mName, spec: mSpec, unit: mUnit, price: parseFloat(mPrice) || 0 });
      setShowMaterialForm(false); setEditing(null); setMaterials(await api.materials.list(selectedSupplier.id!));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const deleteMaterial = async (id: number) => {
    if (!confirm("确定删除？") || !selectedSupplier) return;
    setBusy(true); setError("");
    try { await api.materials.delete(selectedSupplier.id!, id); setMaterials(await api.materials.list(selectedSupplier.id!)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">⚙️ 管理</h2>
      {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
        <label className="text-xs text-gray-500 mb-1.5 block">我的名称（显示在一键复制订单的顶端）</label>
        <input
          type="text"
          value={userName}
          onChange={e => handleUserNameChange(e.target.value)}
          placeholder="如：老板 / 小王"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      </div>

      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 mb-4">
        <div className="text-xs text-sky-800 mb-2 leading-relaxed">
          ☁️ 数据存储在云端，所有人共享。一键复制中的「我的名称」独立存储在本机。
        </div>
        <div className="flex gap-2">
          <button onClick={exportData} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-sky-200 text-sky-700 text-sm font-medium py-2 rounded-lg disabled:opacity-50">
            <Download size={14} />{busy ? "处理中…" : "导出备份"}
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-sky-200 text-sky-700 text-sm font-medium py-2 rounded-lg disabled:opacity-50">
            <Upload size={14} />导入备份
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importData(f); }} />
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {suppliers.map(s => (
          <button key={s.id} onClick={() => setSelectedSupplier(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${selectedSupplier?.id === s.id ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600"}`}>{s.name}</button>
        ))}
        <button onClick={() => setShowAddSupplier(true)}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400"><Plus size={16} /></button>
      </div>

      {selectedSupplier && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-700">📦 {selectedSupplier.name} 的物料</h3>
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => openMaterialForm()} className="text-xs text-primary-600 font-medium flex items-center gap-1 disabled:opacity-50"><Plus size={14} />添加</button>
              <button aria-label="删除供应商" disabled={busy} onClick={() => deleteSupplier(selectedSupplier.id!)} className="text-xs text-red-400 disabled:opacity-50"><Trash2 size={14} /></button>
            </div>
          </div>
          {materials.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">还没有物料</p>
          ) : (
            <div className="space-y-2">
              {materials.map(m => (
                <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-700">{m.name}</span>
                    {m.spec && <span className="text-gray-400 ml-1 text-xs">{m.spec}</span>}
                  </div>
                  <span className="text-xs text-gray-400">{m.unit}</span>
                  <button aria-label={`编辑${m.name}`} disabled={busy} onClick={() => openMaterialForm(m)} className="p-1 text-gray-400 hover:text-primary-600 disabled:opacity-50"><Edit3 size={14} /></button>
                  <button aria-label={`删除${m.name}`} disabled={busy} onClick={() => deleteMaterial(m.id!)} className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddSupplier(false)}>
          <div className="bg-white rounded-2xl p-6 w-[90%] max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">添加供应商</h3>
            <input autoFocus value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)}
              placeholder="供应商名称"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 mb-4" />
            <div className="flex gap-3">
              <button onClick={addSupplier} className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-medium">添加</button>
              <button onClick={() => setShowAddSupplier(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl">取消</button>
            </div>
          </div>
        </div>
      )}

      {showMaterialForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setShowMaterialForm(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">{editing ? "编辑物料" : "添加物料"}</h3>
            <div className="space-y-3">
              {[{ label: "名称 *", v: mName, set: setMName, ph: "如：白菜" },
                { label: "规格", v: mSpec, set: setMSpec, ph: "如：大颗" },
                { label: "单位 *", v: mUnit, set: setMUnit, ph: "如：斤" },
                { label: "参考价", v: mPrice, set: setMPrice, ph: "0", type: "number" }].map(f => (
                <div key={f.label}><label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                  <input value={f.v} onChange={e => f.set(e.target.value)} placeholder={f.ph} type={f.type || "text"}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button disabled={busy} onClick={saveMaterial} className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-medium disabled:bg-gray-300">{busy ? "保存中…" : editing ? "保存" : "添加"}</button>
              <button onClick={() => setShowMaterialForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
