'use client';

import { use, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, ShoppingBag, X, Save, CheckCircle2, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import NavPanel from '@/components/panel/NavPanel';
import type { MenuItem, MenuItemVariation, MenuItemComplementGroup } from '@/lib/data';
import { getIdToken } from '@/lib/authToken';
import { compressImage } from '@/lib/compressImage';
import { getSafeImageSrc, normalizeDataUrl } from '@/lib/validImageUrl';

const DEFAULT_CATEGORIES = ['Más pedidos', 'Pollos', 'Combos', 'Bebidas'];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_VARIACIONES = 10;
const MAX_GROUPS_COMPLEMENTOS = 5;
const MAX_OPCIONES_PER_GROUP = 10;

function MenuForm({
  editing,
  categories,
  onSave,
  onCancel,
}: {
  editing: MenuItem | null;
  categories: string[];
  onSave: (_payload: Partial<MenuItem> & { name: string; price: number; category: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [price, setPrice] = useState(editing?.price?.toString() ?? '');
  const [category, setCategory] = useState(editing?.category ?? categories[0] ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [image, setImage] = useState<string | null>(editing?.image ?? null);
  const [tieneVariaciones, setTieneVariaciones] = useState(!!editing?.tieneVariaciones);
  const [variaciones, setVariaciones] = useState<MenuItemVariation[]>(
    editing?.variaciones?.length ? [...editing.variaciones] : [{ name: '', price: 0 }]
  );
  const [tieneComplementos, setTieneComplementos] = useState(!!editing?.tieneComplementos);
  const [complementos, setComplementos] = useState<MenuItemComplementGroup[]>(
    editing?.complementos?.length ? editing.complementos.map((g) => ({ groupLabel: g.groupLabel, options: [...g.options] })) : [{ groupLabel: '', options: [''] }]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(editing?.name ?? '');
    setPrice(editing?.price?.toString() ?? '');
    setCategory(editing?.category ?? categories[0] ?? '');
    setDescription(editing?.description ?? '');
    setImage(editing?.image ?? null);
    setTieneVariaciones(!!editing?.tieneVariaciones);
    setVariaciones(editing?.variaciones?.length ? [...editing.variaciones] : [{ name: '', price: 0 }]);
    setTieneComplementos(!!editing?.tieneComplementos);
    setComplementos(
      editing?.complementos?.length ? editing.complementos.map((g) => ({ groupLabel: g.groupLabel, options: [...g.options] })) : [{ groupLabel: '', options: [''] }]
    );
  }, [editing, categories]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const compressed = await compressImage(file, 'product');
      const base64 = await fileToBase64(compressed);
      setImage(base64.startsWith('data:') ? normalizeDataUrl(base64) : base64);
    } catch {
      // silencioso
    }
    e.target.value = '';
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nameTrim = name.trim();
    const priceNum = parseFloat(price);
    if (!nameTrim || isNaN(priceNum)) return;
    if (tieneVariaciones) {
      const valid = variaciones.filter((v) => v.name.trim() && !Number.isNaN(v.price));
      if (valid.length === 0) return;
    }
    if (tieneComplementos) {
      const valid = complementos.filter((g) => g.groupLabel.trim() && g.options.some((o) => o.trim()));
      if (valid.length === 0) return;
    }
    const imagePayload = image ? (image.startsWith('data:') ? normalizeDataUrl(image) : image) : undefined;
    const payload: Partial<MenuItem> & { name: string; price: number; category: string } = {
      name: nameTrim,
      price: priceNum,
      category,
      description: description.trim() || undefined,
      image: imagePayload,
    };
    if (tieneVariaciones) {
      payload.tieneVariaciones = true;
      payload.variaciones = variaciones.filter((v) => v.name.trim() && !Number.isNaN(v.price));
    } else {
      payload.tieneVariaciones = false;
      payload.variaciones = undefined;
    }
    if (tieneComplementos) {
      payload.tieneComplementos = true;
      payload.complementos = complementos
        .filter((g) => g.groupLabel.trim())
        .map((g) => ({ groupLabel: g.groupLabel.trim(), options: g.options.map((o) => o.trim()).filter(Boolean) }))
        .filter((g) => g.options.length > 0);
    } else {
      payload.tieneComplementos = false;
      payload.complementos = undefined;
    }
    onSave(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
      <h3 className="font-bold text-gray-900">{editing ? 'Editar producto' : 'Nuevo producto'}</h3>

      <div className="flex gap-3 items-start">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
          {getSafeImageSrc(image) ? (
            <>
              <Image
                src={getSafeImageSrc(image)!}
                alt="Preview"
                fill
                sizes="80px"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80"
                aria-label="Quitar foto"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <Upload className="w-6 h-6 mb-1" />
              <span className="text-[10px]">Foto</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="menu-image"
          />
          <label
            htmlFor="menu-image"
            className="inline-block px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            {image ? 'Cambiar foto' : 'Subir foto'}
          </label>
        </div>
      </div>

      <input
        type="text"
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
        required
      />
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="Precio"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
        required
      />
      <textarea
        placeholder="Descripción del plato (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30 resize-none"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
      >
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Switch: Habilitar Variaciones */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3">
        <span className="text-sm font-medium text-gray-700">Habilitar Variaciones</span>
        <button
          type="button"
          role="switch"
          aria-checked={tieneVariaciones}
          onClick={() => setTieneVariaciones((v) => !v)}
          className={`relative h-6 w-10 rounded-full transition-colors ${tieneVariaciones ? 'bg-rojo-andino' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${tieneVariaciones ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
      {tieneVariaciones && (
        <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-100 bg-white p-4 space-y-3">
          <p className="text-xs text-gray-500 font-medium">Ej. Media / Entera con precios distintos</p>
          {variaciones.map((v, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Nombre (ej. Media)"
                value={v.name}
                onChange={(e) =>
                  setVariaciones((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                }
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio"
                value={v.price || ''}
                onChange={(e) =>
                  setVariaciones((prev) => prev.map((x, i) => (i === idx ? { ...x, price: parseFloat(e.target.value) || 0 } : x)))
                }
                className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
              />
              <button
                type="button"
                onClick={() => setVariaciones((prev) => prev.filter((_, i) => i !== idx))}
                className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
                aria-label="Quitar variación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {variaciones.length < MAX_VARIACIONES && (
            <button
              type="button"
              onClick={() => setVariaciones((prev) => [...prev, { name: '', price: 0 }])}
              className="text-sm font-medium text-rojo-andino hover:underline"
            >
              Añadir variación
            </button>
          )}
        </div>
      )}

      {/* Switch: Habilitar Complementos */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-3">
        <span className="text-sm font-medium text-gray-700">Habilitar Complementos</span>
        <button
          type="button"
          role="switch"
          aria-checked={tieneComplementos}
          onClick={() => setTieneComplementos((v) => !v)}
          className={`relative h-6 w-10 rounded-full transition-colors ${tieneComplementos ? 'bg-rojo-andino' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${tieneComplementos ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
      {tieneComplementos && (
        <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-100 bg-white p-4 space-y-4">
          <p className="text-xs text-gray-500 font-medium">Ej. Elige tu arroz: Moro, Blanco</p>
          {complementos.map((g, gIdx) => (
            <div key={gIdx} className="rounded-2xl border border-gray-100 p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Nombre del grupo (ej. Elige tu guarnición)"
                  value={g.groupLabel}
                  onChange={(e) =>
                    setComplementos((prev) => prev.map((x, i) => (i === gIdx ? { ...x, groupLabel: e.target.value } : x)))
                  }
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                />
                <button
                  type="button"
                  onClick={() => setComplementos((prev) => prev.filter((_, i) => i !== gIdx))}
                  className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
                  aria-label="Quitar grupo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5 pl-2">
                {g.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Opción"
                      value={opt}
                      onChange={(e) =>
                        setComplementos((prev) =>
                          prev.map((x, i) =>
                            i === gIdx ? { ...x, options: x.options.map((o, j) => (j === oIdx ? e.target.value : o)) } : x
                          )
                        )
                      }
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setComplementos((prev) =>
                          prev.map((x, i) => (i === gIdx ? { ...x, options: x.options.filter((_, j) => j !== oIdx) } : x))
                        )
                      }
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50"
                      aria-label="Quitar opción"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {g.options.length < MAX_OPCIONES_PER_GROUP && (
                  <button
                    type="button"
                    onClick={() =>
                      setComplementos((prev) =>
                        prev.map((x, i) => (i === gIdx ? { ...x, options: [...x.options, ''] } : x))
                      )
                    }
                    className="text-xs font-medium text-rojo-andino hover:underline"
                  >
                    Añadir opción
                  </button>
                )}
              </div>
            </div>
          ))}
          {complementos.length < MAX_GROUPS_COMPLEMENTOS && (
            <button
              type="button"
              onClick={() => setComplementos((prev) => [...prev, { groupLabel: '', options: [''] }])}
              className="text-sm font-medium text-rojo-andino hover:underline"
            >
              Añadir grupo
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 py-2.5 rounded-xl bg-rojo-andino text-white font-semibold text-sm hover:bg-rojo-andino/90"
        >
          {editing ? 'Guardar' : 'Agregar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}

function generateId(localId: string): string {
  return `${localId}-${Date.now().toString(36)}`;
}

export default function PanelMenuIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: localId } = use(params);
  const router = useRouter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [pageVisible, setPageVisible] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<{ name: string; targetCategory: string } | null>(null);
  const [displayCount, setDisplayCount] = useState(15);
  const guardadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDisplayCount(15);
    fetch(`/api/locales/${localId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: { menu?: MenuItem[]; local?: { categories?: string[] } } | null) => {
        if (cancelled || !data) return;
        const initial = data.menu ?? [];
        setItems([...initial]);
        const categoriesFromMenu = Array.from(new Set<string>([...initial.map((i) => i.category).filter(Boolean)]));
        const baseCategories = data.local?.categories?.length ? data.local.categories : [];
        const merged = baseCategories.length
          ? [...baseCategories, ...categoriesFromMenu.filter((c) => !baseCategories.includes(c))]
          : Array.from(new Set<string>([...DEFAULT_CATEGORIES, ...categoriesFromMenu]));
        setCategories(merged);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [localId]);

  useEffect(() => {
    requestAnimationFrame(() => setPageVisible(true));
  }, []);

  async function persistirMenu(nuevosItems: MenuItem[]): Promise<{ ok: boolean; error?: string }> {
    setGuardando(true);
    setErrorGuardado(null);
    try {
      const token = await getIdToken();
      if (!token) {
        return { ok: false, error: 'Inicia sesión para guardar los cambios en el menú.' };
      }
      const res = await fetch(`/api/locales/${localId}/menu`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: nuevosItems }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string })?.error ?? (res.status === 401 ? 'Sesión expirada. Vuelve a iniciar sesión.' : 'No se pudo guardar.');
        return { ok: false, error: msg };
      }
      setGuardado(true);
      if (guardadoTimer.current) clearTimeout(guardadoTimer.current);
      guardadoTimer.current = setTimeout(() => setGuardado(false), 2500);
      router.refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Error de conexión. Intenta de nuevo.' };
    } finally {
      setGuardando(false);
    }
  }

  async function handleSave(item: Partial<MenuItem> & { name: string; price: number; category: string }): Promise<boolean> {
    const itemsAnteriores = [...items];
    let nuevosItems: MenuItem[];
    if (editing) {
      nuevosItems = items.map((i) => (i.id === editing.id ? { ...editing, ...item } as MenuItem : i));
      setItems(nuevosItems);
      setEditing(null);
    } else {
      nuevosItems = [...items, { ...item, id: generateId(localId) } as MenuItem];
      setItems(nuevosItems);
      setShowForm(false);
    }
    if (!categories.includes(item.category)) {
      setCategories((prev) => [...prev, item.category]);
    }
    const result = await persistirMenu(nuevosItems);
    if (!result.ok) {
      setItems(itemsAnteriores);
      setErrorGuardado(result.error ?? 'No se pudo guardar.');
      if (!editing) setShowForm(true);
      return false;
    }
    return true;
  }

  async function handleDelete(itemId: string) {
    const itemsAnteriores = [...items];
    const nuevosItems = items.filter((i) => i.id !== itemId);
    setItems(nuevosItems);
    setEditing(null);
    const result = await persistirMenu(nuevosItems);
    if (!result.ok) {
      setItems(itemsAnteriores);
      setErrorGuardado(result.error ?? 'No se pudo eliminar.');
    }
  }

  function addCategory() {
    const cat = newCategory.trim();
    if (cat && !categories.includes(cat)) {
      setCategories((prev) => [...prev, cat]);
      setNewCategory('');
    }
  }

  function moveCategory(index: number, direction: 'up' | 'down') {
    const next = [...categories];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setCategories(next);
    persistirOrdenCategorias(next);
  }

  async function persistirOrdenCategorias(orderedCategories: string[]) {
    const token = await getIdToken();
    if (!token) return;
    try {
      await fetch(`/api/locales/${localId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ categories: orderedCategories }),
      });
    } catch {
      // silencioso
    }
  }

  async function handleRenameCategory(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingCategory(null);
      return;
    }
    const newCategories = categories.map((c) => (c === oldName ? trimmed : c));
    const newItems = items.map((i) => (i.category === oldName ? { ...i, category: trimmed } : i));
    setCategories(newCategories);
    setItems(newItems);
    setEditingCategory(null);
    await persistirMenu(newItems);
    await persistirOrdenCategorias(newCategories);
  }

  async function handleDeleteCategory(catName: string, targetCategory: string) {
    if (!targetCategory || targetCategory === catName) {
      setDeletingCategory(null);
      return;
    }
    const newItems = items.map((i) => (i.category === catName ? { ...i, category: targetCategory } : i));
    const newCategories = categories.filter((c) => c !== catName);
    setCategories(newCategories);
    setItems(newItems);
    setDeletingCategory(null);
    await persistirMenu(newItems);
    await persistirOrdenCategorias(newCategories);
  }

  async function guardarTodo() {
    setGuardando(true);
    setErrorGuardado(null);
    try {
      const token = await getIdToken();
      if (!token) {
        setErrorGuardado('Inicia sesión para guardar los cambios.');
        return;
      }
      const resultMenu = await persistirMenu(items);
      if (!resultMenu.ok) {
        setErrorGuardado(resultMenu.error ?? 'No se pudo guardar el menú.');
        return;
      }
      setGuardando(true);
      await persistirOrdenCategorias(categories);
      setGuardado(true);
      if (guardadoTimer.current) clearTimeout(guardadoTimer.current);
      guardadoTimer.current = setTimeout(() => setGuardado(false), 2500);
    } catch {
      setErrorGuardado('Error al guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  const visibleItems = items.slice(0, displayCount);
  const byCategory = categories.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    acc[cat] = visibleItems.filter((i) => i.category === cat);
    return acc;
  }, {});
  const hasMoreItems = displayCount < items.length;

  return (
    <>
      <main
        className={`min-h-screen bg-gray-50 pb-24 transition-all duration-300 ${
          pageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <header className="bg-rojo-andino text-white px-5 pt-10 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-bold text-xl mb-1">Menú del negocio</h1>
              <p className="text-white/80 text-sm">Agrega, edita o elimina productos y categorías</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditMode((e) => !e)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  editMode ? 'bg-white/20 border-2 border-white text-white' : 'border-2 border-white/80 text-white hover:bg-white/15'
                }`}
              >
                <Pencil className="w-4 h-4" />
                {editMode ? 'Vista cliente' : 'Editar menú'}
              </button>
              {editMode && (
              <button
                type="button"
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-white/80 text-white font-semibold text-sm hover:bg-white/15 transition-all"
              >
                <Plus className="w-4 h-4" />
                Agregar producto
              </button>
              )}
              <button
              type="button"
              onClick={guardarTodo}
              disabled={guardando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-rojo-andino font-bold text-sm shadow-md hover:bg-white/95 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {guardando ? (
                <>
                  <Save className="w-4 h-4 animate-pulse" />
                  Guardando...
                </>
              ) : guardado ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Guardado
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar cambios
                </>
              )}
            </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {guardando && <span className="text-xs text-white/80 flex items-center gap-1"><Save className="w-3.5 h-3.5 animate-pulse" /> Guardando...</span>}
            {guardado && !guardando && <span className="text-xs text-green-200 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Cambios guardados</span>}
          </div>
          {errorGuardado && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-white/20 text-sm" role="alert">
              {errorGuardado}
              <button type="button" onClick={() => setErrorGuardado(null)} className="ml-2 underline">Cerrar</button>
            </div>
          )}
        </header>

        <div className="p-4 space-y-6">
          {editMode && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="Nueva categoría"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30 focus:border-rojo-andino/50"
            />
            <button
              type="button"
              onClick={addCategory}
              className="px-5 py-3 rounded-xl bg-rojo-andino text-white font-semibold text-sm hover:bg-rojo-andino/90 transition-colors"
            >
              Agregar
            </button>
          </div>
          )}

          {categories.map((cat, index) => (
            <div key={cat} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="flex items-center justify-between px-4 py-3.5 bg-gray-50/80 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  {editMode && (
                  <div className="flex flex-col gap-0">
                    <button
                      type="button"
                      onClick={() => moveCategory(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:pointer-events-none text-gray-600"
                      aria-label="Subir categoría"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(index, 'down')}
                      disabled={index === categories.length - 1}
                      className="p-1 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:pointer-events-none text-gray-600"
                      aria-label="Bajar categoría"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  )}
                  <h2 className="font-bold text-gray-900">{cat}</h2>
                  {editMode && (
                    <>
                      <button type="button" onClick={() => setEditingCategory({ oldName: cat, newName: cat })} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors" aria-label="Renombrar categoría">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {categories.length > 1 && (
                      <button type="button" onClick={() => setDeletingCategory({ name: cat, targetCategory: categories.filter((c) => c !== cat)[0] ?? '' })} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors" aria-label="Eliminar categoría">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      )}
                    </>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-medium">{(byCategory[cat] ?? []).length} productos</span>
              </div>
              <div className="divide-y divide-gray-50">
                {(byCategory[cat] ?? []).map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50/50 transition-colors">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      {getSafeImageSrc(item.image) ? (
                        <Image src={getSafeImageSrc(item.image)!} alt={item.name} fill className="object-cover" sizes="64px" unoptimized={item.image?.startsWith('data:')} />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ShoppingBag className="w-7 h-7 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="text-sm font-medium text-rojo-andino mt-0.5">${item.price.toFixed(2)}</p>
                    </div>
                    {editMode && (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { setEditing(item); setShowForm(true); }} className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors" aria-label="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setDeletingItem(item)} className="p-2.5 rounded-xl hover:bg-red-50 text-red-600 transition-colors" aria-label="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    )}
                  </div>
                ))}
                {(!byCategory[cat] || byCategory[cat].length === 0) && (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">Sin productos en esta categoría.</div>
                )}
              </div>
            </div>
          ))}

          {hasMoreItems && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setDisplayCount((prev) => Math.min(prev + 15, items.length))}
                className="px-5 py-3 rounded-xl border-2 border-rojo-andino text-rojo-andino font-semibold text-sm hover:bg-rojo-andino hover:text-white transition-colors"
              >
                Cargar más productos
              </button>
            </div>
          )}

        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            role="button"
            tabIndex={0}
            onClick={() => { setShowForm(false); setEditing(null); }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowForm(false); setEditing(null); } }}
            aria-label="Cerrar"
          />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl overflow-hidden shadow-xl bg-white">
            <MenuForm
              editing={editing}
              categories={categories}
              onSave={async (item) => {
                const ok = await handleSave(item);
                if (ok) { setShowForm(false); setEditing(null); }
              }}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingCategory(null)} aria-hidden />
          <div className="relative bg-white rounded-3xl shadow-xl border border-gray-100 p-6 w-full max-w-sm overflow-hidden">
            <h3 className="font-bold text-gray-900 text-lg mb-3">Renombrar categoría</h3>
            <input
              type="text"
              value={editingCategory.newName}
              onChange={(e) => setEditingCategory((x) => x && { ...x, newName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30 focus:border-rojo-andino mb-4"
              placeholder="Nombre de la categoría"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditingCategory(null)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => editingCategory && handleRenameCategory(editingCategory.oldName, editingCategory.newName)}
                className="px-4 py-2.5 rounded-xl bg-rojo-andino text-white font-semibold text-sm hover:bg-rojo-andino/90"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeletingCategory(null)} aria-hidden />
          <div className="relative bg-white rounded-3xl shadow-xl border border-gray-100 p-6 w-full max-w-sm overflow-hidden">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Eliminar categoría</h3>
            <p className="text-gray-600 text-sm mb-4">
              ¿Eliminar &quot;{deletingCategory.name}&quot;? Los {(byCategory[deletingCategory.name] ?? []).length} productos se moverán a la categoría que elijas.
            </p>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mover productos a</label>
            <select
              value={deletingCategory.targetCategory}
              onChange={(e) => setDeletingCategory((x) => x && { ...x, targetCategory: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30 focus:border-rojo-andino mb-4"
            >
              {categories.filter((c) => c !== deletingCategory.name).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeletingCategory(null)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deletingCategory && handleDeleteCategory(deletingCategory.name, deletingCategory.targetCategory)}
                disabled={!deletingCategory.targetCategory}
                className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Eliminar categoría
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeletingItem(null)}
            aria-hidden
          />
          <div className="relative bg-white rounded-3xl shadow-xl border border-gray-100 p-5 w-full max-w-sm overflow-hidden">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Eliminar producto</h3>
            <p className="text-gray-600 text-sm mb-4">
              ¿Eliminar &quot;{deletingItem.name}&quot;? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDelete(deletingItem.id);
                  setDeletingItem(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <NavPanel />
    </>
  );
}
