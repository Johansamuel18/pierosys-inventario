import React, { useState, useEffect } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { ShoppingCart, Plus, Trash2, Search, Calculator, Tag, Layers, Box, AlertCircle, Banknote, Loader2, PackageSearch } from 'lucide-react';

const SalesForm = () => {
  const [variantsList, setVariantsList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedVariantId, setSelectedVariantId] = useState('');
  
  // States para calculadora y lógica
  const [unitPriceBRL, setUnitPriceBRL] = useState(0);
  const [stockAvailable, setStockAvailable] = useState(0);
  const [quantityInput, setQuantityInput] = useState('');
  const [totalInput, setTotalInput] = useState(''); 

  const [cart, setCart] = useState([]);
  const [globalDiscount, setGlobalDiscount] = useState('');

  // --- 1. CARGA INICIAL ROBUSTA ---
  const loadData = async () => {
    try {
      setLoading(true);
      const products = await InventoryService.getProducts();
      
      // Aplanado seguro con conversión de tipos
      const flatList = (products || []).flatMap(p => 
          (p.variants || []).map(v => ({
              id: String(v.id), // Forzamos String para evitar bugs de select
              parentId: p.id,
              fullName: `${p.name} - ${v.name}`,
              price: parseFloat(v.priceSellBRL || 0),
              stock: parseFloat(v.stock || 0)
          }))
      );
      setVariantsList(flatList);
    } catch (err) {
      console.error(err);
      alert("Error cargando inventario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- 2. MANEJO DE SELECCIÓN ---
  const handleVariantChange = (e) => {
    const newId = e.target.value;
    setSelectedVariantId(newId);

    const item = variantsList.find(v => v.id === newId);
    if (item) {
        setUnitPriceBRL(item.price);
        setStockAvailable(item.stock);
        setQuantityInput('1');
        setTotalInput(item.price.toFixed(2));
    } else {
        setUnitPriceBRL(0);
        setStockAvailable(0);
        setQuantityInput('');
        setTotalInput('');
    }
  };

  // Helper para buscar item actual
  const selectedItem = variantsList.find(v => v.id === selectedVariantId);

  // --- CALCULADORA ---
  const handleQuantityChange = (val) => {
    setQuantityInput(val);
    const qty = parseFloat(val);
    if (!isNaN(qty) && unitPriceBRL > 0) {
      setTotalInput((qty * unitPriceBRL).toFixed(2));
    } else {
      setTotalInput('');
    }
  };

  const handleTotalChange = (val) => {
    setTotalInput(val);
    const total = parseFloat(val);
    if (!isNaN(total) && unitPriceBRL > 0) {
      setQuantityInput((total / unitPriceBRL).toFixed(3));
    } else {
      setQuantityInput('');
    }
  };

  // --- CARRITO ---
  const getExistingQtyInCart = (varId) => {
    return cart
      .filter(item => item.id === varId)
      .reduce((acc, item) => acc + item.quantity, 0);
  };

  const addToCart = (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    const qtyToAdd = parseFloat(quantityInput);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) return;

    const inCartQty = getExistingQtyInCart(selectedItem.id);
    if ((qtyToAdd + inCartQty) > stockAvailable) {
      return alert(`Stock insuficiente. Disponible: ${stockAvailable}`);
    }

    const newItem = {
      tempId: Date.now().toString() + Math.random(),
      id: selectedItem.id,
      parentId: selectedItem.parentId,
      name: selectedItem.fullName,
      quantity: qtyToAdd,
      unitPriceBRL: unitPriceBRL,
      subtotalBRL: qtyToAdd * unitPriceBRL
    };

    setCart([...cart, newItem]);
    setQuantityInput('');
    setTotalInput('');
    
    // Resetear selección para agilizar siguiente venta
    setSelectedVariantId('');
    setUnitPriceBRL(0);
  };

  const removeFromCart = (tempId) => {
    setCart(cart.filter(item => item.tempId !== tempId));
  };

  // --- CONFIRMAR VENTA ---
  const subtotal = cart.reduce((acc, item) => acc + item.subtotalBRL, 0);
  const discount = parseFloat(globalDiscount) || 0;
  const netTotal = subtotal - discount;
  const isDiscountInvalid = discount > subtotal;

  const handleConfirmSale = async () => {
    if (cart.length === 0) return;
    if (isDiscountInvalid) return alert("Descuento inválido");

    try {
      setLoading(true);
      
      // Procesar secuencialmente para evitar bloqueos de DB si hay muchos items
      for (const item of cart) {
        const weight = item.subtotalBRL / subtotal;
        const discountShare = discount * weight;
        const effectiveTotalRevenue = item.subtotalBRL - discountShare;

        await InventoryService.processSale(
          item.parentId,
          item.id,
          item.quantity,    
          effectiveTotalRevenue
        );
      }

      alert("Venta registrada correctamente.");
      setCart([]);
      setGlobalDiscount('');
      setQuantityInput('');
      setSelectedVariantId('');
      
      // Recargar datos frescos
      await loadData();

    } catch (err) {
      console.error(err);
      alert("Error al procesar venta: " + err.message);
      setLoading(false); // Asegurar que loading se apague si falla
    }
  };

  const currentInCart = selectedItem ? getExistingQtyInCart(selectedItem.id) : 0;
  const remainingStock = stockAvailable - currentInCart;
  const isInputInsufficient = parseFloat(quantityInput || '0') > remainingStock;

  if (loading && variantsList.length === 0) {
    return <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4"><Loader2 className="animate-spin text-indigo-500" size={48}/><p className="font-bold uppercase tracking-widest text-sm">Sincronizando Inventario...</p></div>;
  }

  // Empty State
  if (!loading && variantsList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <PackageSearch size={64} className="mb-4 opacity-20"/>
        <h3 className="text-xl font-black uppercase tracking-widest text-slate-600">Sin Productos</h3>
        <p className="max-w-md text-center mt-2">No se encontraron productos disponibles para venta. Crea productos y abastécelos primero.</p>
      </div>
    );
  }

  return (
    // CAMBIO CRÍTICO AQUÍ: h-auto en móvil, altura fija en desktop.
    <div className="max-w-7xl mx-auto h-auto md:h-[calc(100vh-8rem)]">
        
        <div className="flex items-center gap-4 mb-6">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg text-white">
                <ShoppingCart size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Punto de Venta</h2>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto md:h-full pb-10">
            
            {/* COLUMNA IZQUIERDA: Selector y Calculadora */}
            <div className="lg:col-span-5 flex flex-col gap-6 h-auto md:h-full">
                <div className="bg-white rounded-3xl shadow-xl p-6 border border-slate-100">
                     <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Buscar Ítem (Variante)</label>
                            <div className="relative">
                                <select 
                                    value={selectedVariantId}
                                    onChange={handleVariantChange}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-indigo-500 appearance-none"
                                >
                                    <option value="">-- Seleccione --</option>
                                    {variantsList.map(v => (
                                      <option key={v.id} value={v.id}>
                                        {v.fullName} — R$ {v.price.toFixed(2)}
                                      </option>
                                    ))}
                                </select>
                                <Search className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={18}/>
                            </div>
                        </div>
                     </div>
                </div>

                {selectedItem && (
                    <div className={`rounded-2xl p-6 border-l-4 shadow-lg flex justify-between items-center transition-all ${
                        remainingStock <= 0 ? 'bg-rose-50 border-rose-500' : 'bg-emerald-50 border-emerald-500'
                    }`}>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Stock Disponible</span>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-3xl font-black ${remainingStock <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {remainingStock.toFixed(2)}
                                </span>
                            </div>
                        </div>
                        {currentInCart > 0 && (
                            <div className="text-right">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">En Carrito</span>
                                <span className="text-lg font-bold text-indigo-600">{currentInCart.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-slate-900 rounded-[2rem] p-6 shadow-2xl flex-1 flex flex-col justify-center relative overflow-hidden min-h-[300px] md:min-h-0">
                     <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>

                     {loading && <div className="absolute inset-0 bg-slate-900/80 z-20 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={32}/></div>}

                     <div className="relative z-10 space-y-6">
                        <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                            <span><Calculator size={14} className="inline mr-1"/> Cantidad</span>
                            <span>Precio: R$ {unitPriceBRL.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                             <input 
                                type="number"
                                value={quantityInput}
                                onChange={e => handleQuantityChange(e.target.value)}
                                disabled={!selectedItem}
                                placeholder="0"
                                className={`w-full bg-transparent text-5xl font-black outline-none transition-colors ${
                                    isInputInsufficient ? 'text-rose-500' : 'text-white'
                                }`}
                            />
                            <span className="text-slate-600 font-black text-xl">Cant.</span>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-3">
                            <span className="text-emerald-500 font-black text-xl">R$</span>
                            <input 
                                type="number"
                                value={totalInput}
                                onChange={e => handleTotalChange(e.target.value)}
                                disabled={!selectedItem}
                                placeholder="0.00"
                                className="w-full bg-transparent text-3xl font-black text-emerald-400 outline-none"
                            />
                        </div>

                        <button 
                            onClick={addToCart}
                            disabled={!selectedItem || isInputInsufficient || parseFloat(quantityInput) <= 0}
                            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                                !selectedItem || isInputInsufficient || parseFloat(quantityInput) <= 0
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg active:scale-95'
                            }`}
                        >
                            {isInputInsufficient ? <><AlertCircle size={20}/> Stock Insuficiente</> : <><Plus size={20}/> Agregar</>}
                        </button>
                     </div>
                </div>

            </div>

            {/* COLUMNA DERECHA: TICKET */}
            <div className="lg:col-span-7 flex flex-col h-auto md:h-full">
                
                {/* En móvil usamos min-h para que el ticket tenga espacio */}
                <div className="bg-white flex-1 rounded-t-[2rem] shadow-xl border border-slate-100 flex flex-col overflow-hidden min-h-[300px]">
                    <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm flex items-center gap-2">
                            <Layers size={16}/> Ticket
                        </h3>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black">
                            {cart.length} Ítems
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50">
                                <ShoppingCart size={64} className="mb-4"/>
                                <p className="font-black uppercase tracking-widest">Carrito Vacío</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.tempId} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white p-2 rounded-lg text-slate-400 shadow-sm">
                                            <Box size={20}/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                                            <p className="text-xs text-slate-500 font-medium">
                                                {item.quantity.toFixed(3)} x R$ {item.unitPriceBRL.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-slate-700">R$ {item.subtotalBRL.toFixed(2)}</span>
                                        <button onClick={() => removeFromCart(item.tempId)} className="text-slate-300 hover:text-rose-500 transition-colors p-2">
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-slate-900 rounded-b-[2rem] p-8 shadow-2xl z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                        <div>
                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Subtotal</span>
                            <span className="block text-2xl font-bold text-slate-300">R$ {subtotal.toFixed(2)}</span>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <Tag size={12}/> Descuento
                            </label>
                            <div className={`relative bg-slate-800 rounded-xl border-2 transition-colors ${isDiscountInvalid ? 'border-rose-500' : 'border-slate-700 focus-within:border-orange-500'}`}>
                                <input type="number" value={globalDiscount} onChange={e => setGlobalDiscount(e.target.value)} placeholder="0.00" className={`w-full bg-transparent p-3 pl-10 font-bold outline-none ${isDiscountInvalid ? 'text-rose-500' : 'text-white'}`} />
                                <span className="absolute left-3 top-3.5 text-slate-500 font-bold">R$</span>
                            </div>
                        </div>
                        <div className="text-right">
                             <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total a Pagar</span>
                             <span className="block text-4xl font-black text-emerald-400 mb-4">R$ {Math.max(0, netTotal).toFixed(2)}</span>
                             <button onClick={handleConfirmSale} disabled={cart.length === 0 || isDiscountInvalid || loading} className={`w-full py-4 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${cart.length === 0 || isDiscountInvalid || loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30 active:scale-95'}`}>
                                {loading ? <Loader2 className="animate-spin" size={20}/> : <Banknote size={20}/>} {loading ? 'Procesando...' : 'Confirmar Venta'}
                             </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default SalesForm;