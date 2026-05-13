import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { api } from "../stores/api";
import type { Supplier, Material } from "../types";

interface Props {
  suppliers: Supplier[];
  onChanged: () => void;
}

export default function ManagePage({ suppliers, onChanged }: Props) {
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [mName, setMName] = useState(""); const [mSpec, setMSpec] = useState(""); const [mUnit, setMUnit] = useState(""); const [mPrice, setMPrice] = useState("");

  useEffect(() => { if (suppliers.length && !selectedSupplier) setSelectedSupplier(suppliers[0]); }, [suppliers]);
  useEffect(() => {
    if (selectedSupplier?.id) api.materials.list(selectedSupplier.id).then(setMaterials);
    else setMaterials([]);
  }, [selectedSupplier]);

  const addSupplier = async () => {
    if (!newSupplierName.trim()) return;
    await api.suppliers.create(newSupplierName.trim());
    setNewSupplierName(""); setShowAddSupplier(false); onChanged();
  };

  const deleteSupplier = async (id: number) => {
    if (!confirm("删除供应商将同时删除其所有物料，确定？")) return;
    await api.suppliers.delete(id);
    setSelectedSupplier(null); onChanged();
  };

  const openMaterialForm = (m?: Material) => {
    setEditing(m || null);
    setMName(m?.name || ""); setMSpec(m?.spec || ""); setMUnit(m?.unit || ""); setMPrice(m?.price?.toString() || "");
    setShowMaterialForm(true);
  };

  const saveMaterial = async () => {
    if (!mName.trim() || !mUnit.trim() || !selectedSupplier) return;
    if (editing) {
      await api.materials.update(selectedSupplier.id!, editing.id!, { name: mName, spec: mSpec, unit: mUnit, price: parseFloat(mPrice) || 0 });
    } else {
      await api.materials.create(selectedSupplier.id!, { name: mName, spec: mSpec, unit: mUnit, price: parseFloat(mPrice) || 0 });
    }
    setShowMaterialForm(false); setEditing(null);
    api.materials.list(selectedSupplier.id!).then(setMaterials);
  };

  const deleteMaterial = async (id: number) => {
    if (!confirm("确定删除？") || !selectedSupplier) return;
    await api.materials.delete(selectedSupplier.id!, id);
    api.materials.list(selectedSupplier.id!).then(setMaterials);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">⚙️ 管理</h2>
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
              <button onClick={() => openMaterialForm()} className="text-xs text-primary-600 font-medium flex items-center gap-1"><Plus size={14} />添加</button>
              <button onClick={() => deleteSupplier(selectedSupplier.id!)} className="text-xs text-red-400"><Trash2 size={14} /></button>
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
                  <button onClick={() => openMaterialForm(m)} className="p-1 text-gray-400 hover:text-primary-600"><Edit3 size={14} /></button>
                  <button onClick={() => deleteMaterial(m.id!)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
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
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 mb-4" />
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={saveMaterial} className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-medium">{editing ? "保存" : "添加"}</button>
              <button onClick={() => setShowMaterialForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
