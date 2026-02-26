import React, { useState, useEffect, useMemo } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { ShoppingCart, Plus, Trash2, Search, Calculator, Tag, Layers, Box, AlertCircle, Banknote, Loader2, PackageSearch, Package, Ruler, ChevronDown, ArrowRight, User, Info, X, CheckCircle } from 'lucide-react';

// COMPONENTE: MODAL DE CONFIRMACIÓN / ÉXITO
const ConfirmActionModal = ({ isOpen, onClose, title, message, onConfirm, isDestructive, confirmText = "Confirmar", cancelText = "Cancelar", showCancel = true }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 transform scale-100 transition-all">
                <div className={`p-4 flex justify-between items-center text-white ${isDestructive ? 'bg-rose-600' : (title.includes('Exitosa') ? 'bg-emerald-600' : 'bg-indigo-600')}`}>
                    <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                        {isDestructive ? <AlertCircle size={16}/> : (title.includes('Exitosa') ? <CheckCircle size={16}/> : <Info size={16}/>)} {title}
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X size={16}/></button>
                </div>
                <div className="p-6">
                    <p className="text-slate-600 font-medium text-sm mb-6 leading-relaxed">{message}</p>
                    <div className="flex gap-3">
                        {showCancel && (
                            <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">{cancelText}</button>
                        )}
                        <button 
                            onClick={() => { if(onConfirm) onConfirm(); onClose(); }} 
                            className={`flex-1 py-3 rounded-xl font-black text-white shadow-lg transition-transform active:scale-95 ${isDestructive ? 'bg-rose-600 hover:bg-rose-500' : (title.includes('Exitosa') ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500')} ${!showCancel ? 'w-full' : ''}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SalesForm = () => {
  // --- DATA STATES ---
  const [allProducts, setAllProducts] = useState([]); // Raw Data de Supabase
  const [loading, setLoading] = useState(true);

  // --- SELECTION STATES (CASCADA) ---
  const [selectedProductName, setSelectedProductName] = useState(''); // Paso 1: Familia (String)
  const [selectedVariantId, setSelectedVariantId] = useState('');     // Paso 2: ID Único

  // --- CALCULATOR STATES ---
  const [unitPriceBRL, setUnitPriceBRL] = useState(0);
  const [stockAvailable, setStockAvailable] = useState(0);
  const [quantityInput, setQuantityInput] = useState('');
  const [totalInput, setTotalInput] = useState(''); 

  // --- CART STATES ---
  const [cart, setCart] = useState([]);
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [clientName, setClientName] = useState(''); // NUEVO: Estado para el cliente

  // --- MODAL STATE ---
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: false, showCancel: true, confirmText: 'Confirmar' });

  // Helper de Redondeo
  const roundMoney = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;
  
  // Helper para mostrar números limpios (3.000 -> 3, 2.500 -> 2.5)
  const formatQty = (num) => {
      const val = parseFloat(num);
      return isNaN(val) ? 0 : Number(val.toFixed(3));
  };

  // Helper para pluralizar etiquetas
  const getUnitLabel = (unitType, qty) => {
      const type = (unitType || 'UND').toUpperCase();
      if (type === 'KG' || type === 'KILO') return qty === 1 ? 'Kilo' : 'Kilos';
      if (type === 'MT' || type === 'METRO') return qty === 1 ? 'Metro' : 'Metros';
      return qty === 1 ? 'Unidad' : 'Unidades';
  };

  // --- 1. CARGA INICIAL ---
  const loadData = async () => {
    try {
      setLoading(true);
      const data = await InventoryService.getProducts();
      setAllProducts(data || []);
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

  // --- 2. LÓGICA DE AGRUPACIÓN (PRIMER SELECTOR) ---
  const uniqueProductNames = useMemo(() => {
      const names = new Set();
      allProducts.forEach(p => {
          if (p.variants && p.variants.length > 0) {
              names.add(p.name.trim().toUpperCase());
          }
      });
      return Array.from(names).sort();
  }, [allProducts]);

  // --- 3. LÓGICA DE FILTRADO (SEGUNDO SELECTOR) ---
  const availableVariants = useMemo(() => {
      if (!selectedProductName) return [];

      const variants = [];
      const matchingProducts = allProducts.filter(p => p.name.trim().toUpperCase() === selectedProductName);
      
      matchingProducts.forEach(p => {
          p.variants.forEach(v => {
              variants.push({
                  id: String(v.id),
                  parentId: p.id,
                  name: v.name, // Nombre de la medida (ej: "0.22 mm")
                  fullName: `${p.name} ${v.name}`,
                  price: parseFloat(v.priceSellBRL || 0),
                  stock: parseFloat(v.stock || 0),
                  salesUnit: v.salesUnit // Importante para la etiqueta (KG, MT, UND)
              });
          });
      });

      return variants.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedProductName, allProducts]);

  // --- 4. HANDLERS DE CAMBIO ---
  const handleNameChange = (e) => {
      const newName = e.target.value;
      setSelectedProductName(newName);
      
      // RESET COMPLETO AL CAMBIAR FAMILIA
      setSelectedVariantId('');
      setUnitPriceBRL(0);
      setStockAvailable(0);
      setQuantityInput('');
      setTotalInput('');

      // Auto-selección si solo hay 1 variante
      const matching = allProducts.filter(p => p.name.trim().toUpperCase() === newName);
      let totalVars = 0;
      let targetVar = null;
      
      matching.forEach(p => {
         if(p.variants) {
             totalVars += p.variants.length;
             if(p.variants.length > 0) targetVar = p.variants[0];
         }
      });

      if (totalVars === 1 && targetVar) {
          // Pequeño timeout para permitir que el render actualice las opciones primero
          setTimeout(() => applyVariantSelection(String(targetVar.id), targetVar.priceSellBRL, targetVar.stock), 50);
      }
  };

  const handleVariantChange = (e) => {
      const vId = e.target.value;
      const variant = availableVariants.find(v => v.id === vId);
      if (variant) {
          applyVariantSelection(vId, variant.price, variant.stock);
      }
  };

  const applyVariantSelection = (id, price, stock) => {
      setSelectedVariantId(id);
      setUnitPriceBRL(parseFloat(price) || 0);
      setStockAvailable(parseFloat(stock) || 0);
      setQuantityInput('1');
      setTotalInput((parseFloat(price) || 0).toFixed(2));
  };

  const selectedItem = availableVariants.find(v => v.id === selectedVariantId);

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

    // LÓGICA DE PRECISIÓN: Priorizar el total visual que ve el usuario
    let finalSubtotal = roundMoney(qtyToAdd * unitPriceBRL);
    const visualTotal = parseFloat(totalInput);
    
    // Si el usuario ingresó un total (o se calculó) y coincide aproximadamente,
    // forzamos el uso del total visual para evitar problemas de redondeo (ej: 0.99 vs 1.00)
    if (!isNaN(visualTotal) && Math.abs(visualTotal - finalSubtotal) < 0.1) {
        finalSubtotal = visualTotal;
    }

    const newItem = {
      tempId: Date.now().toString() + Math.random(),
      id: selectedItem.id,
      parentId: selectedItem.parentId,
      name: selectedItem.fullName,
      quantity: qtyToAdd,
      unitPriceBRL: unitPriceBRL,
      subtotalBRL: finalSubtotal,
      unitLabel: selectedItem.salesUnit // Guardamos la unidad (KG/MT/UND)
    };

    setCart([...cart, newItem]);
    setQuantityInput('');
    setTotalInput('');
    
    // Opcional: Resetear selección tras agregar
    setSelectedVariantId('');
    setUnitPriceBRL(0);
  };

  const removeFromCart = (tempId) => {
    setCart(cart.filter(item => item.tempId !== tempId));
  };

  // --- CONFIRMAR VENTA (NUEVO: LÓGICA TRANSACCIONAL) ---
  const subtotal = roundMoney(cart.reduce((acc, item) => acc + item.subtotalBRL, 0));
  const discount = parseFloat(globalDiscount) || 0;
  const netTotal = roundMoney(subtotal - discount);
  const isDiscountInvalid = discount > subtotal;

  const handleConfirmSale = () => {
    if (cart.length === 0) return;
    if (isDiscountInvalid) return alert("Descuento inválido");

    setConfirmModal({
        isOpen: true,
        title: "Confirmar Venta",
        message: `¿Estás seguro de procesar esta venta por un total de R$ ${netTotal.toFixed(2)}?`,
        confirmText: "Sí, Vender",
        cancelText: "Revisar",
        showCancel: true,
        isDestructive: false,
        onConfirm: processSale
    });
  };

  const processSale = async () => {
    try {
      setLoading(true);
      
      // FIX: Ajuste de zona horaria para evitar que ventas nocturnas pasen al día siguiente en UTC
      const now = new Date();
      const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString();

      // Llamada a la nueva función de transacción en bloque
      await InventoryService.recordSaleTransaction(
          clientName,
          cart,
          discount,
          localDate
      );

      setConfirmModal({
          isOpen: true,
          title: "¡Venta Exitosa!",
          message: "La transacción se ha registrado correctamente en el sistema.",
          confirmText: "Aceptar",
          showCancel: false,
          isDestructive: false,
          onConfirm: null
      });

      // Reset
      setCart([]);
      setGlobalDiscount('');
      setClientName('');
      setQuantityInput('');
      setSelectedProductName('');
      setSelectedVariantId('');
      
      await loadData();

    } catch (err) {
      console.error(err);
      setConfirmModal({
          isOpen: true,
          title: "Error",
          message: "Hubo un problema al registrar la venta: " + err.message,
          confirmText: "Cerrar",
          showCancel: false,
          isDestructive: true,
          onConfirm: null
      });
    } finally {
        setLoading(false);
    }
  };

  const currentInCart = selectedItem ? getExistingQtyInCart(selectedItem.id) : 0;
  const remainingStock = stockAvailable - currentInCart;
  const isInputInsufficient = parseFloat(quantityInput || '0') > remainingStock;

  if (loading && allProducts.length === 0) {
    return <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4"><Loader2 className="animate-spin text-indigo-500" size={48}/><p className="font-bold uppercase tracking-widest text-sm">Sincronizando Inventario...</p></div>;
  }

  if (!loading && allProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <PackageSearch size={64} className="mb-4 opacity-20"/>
        <h3 className="text-xl font-black uppercase tracking-widest text-slate-600">Sin Productos</h3>
        <p className="max-w-md text-center mt-2">No se encontraron productos disponibles. Crea productos y abastécelos primero.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto h-auto md:h-[calc(100vh-8rem)]">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-6">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg text-white">
                <ShoppingCart size={24} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Punto de Venta</h2>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto md:h-full pb-20 md:pb-10">
            
            {/* =======================================================
                COLUMNA IZQUIERDA: SELECTORES Y CALCULADORA
               ======================================================= */}
            <div className="lg:col-span-5 flex flex-col gap-6 h-auto md:h-full">
                
                {/* 1. CARD DE SELECCIÓN EN CASCADA */}
                <div className="bg-white rounded-[1.5rem] shadow-xl border border-slate-100 p-6 relative overflow-hidden">
                     {/* Decoración fondo */}
                     <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>

                     <div className="relative z-10 space-y-6">
                         
                         {/* PASO 1: FAMILIA */}
                         <div>
                            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="bg-indigo-100 p-1 rounded text-indigo-600"><Package size={14}/></span>
                                1. Selecciona Producto
                            </label>
                            <div className="relative">
                                <select 
                                    value={selectedProductName}
                                    onChange={handleNameChange}
                                    className="w-full appearance-none bg-slate-50 border-2 border-slate-200 rounded-xl px-4 pl-5 py-3 pr-10 font-bold text-slate-700 focus:border-indigo-500 focus:bg-white outline-none transition-all h-14 text-sm md:text-base shadow-sm"
                                >
                                    <option value="">-- ELIGE FAMILIA --</option>
                                    {uniqueProductNames.map(name => (
                                      <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <ChevronDown size={20}/>
                                </div>
                            </div>
                         </div>

                         {/* CONECTOR VISUAL */}
                         {selectedProductName && (
                            <div className="flex justify-center -my-2 opacity-50">
                                <ArrowRight className="text-slate-300 rotate-90" size={20}/>
                            </div>
                         )}

                         {/* PASO 2: MEDIDA */}
                         <div className={`transition-all duration-300 ${!selectedProductName ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="bg-emerald-100 p-1 rounded text-emerald-600"><Ruler size={14}/></span>
                                2. Selecciona Medida
                            </label>
                            <div className="relative">
                                <select 
                                    value={selectedVariantId}
                                    onChange={handleVariantChange}
                                    disabled={!selectedProductName}
                                    className="w-full appearance-none bg-slate-50 border-2 border-slate-200 rounded-xl px-4 pl-5 py-3 pr-10 font-bold text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all h-14 text-sm md:text-base shadow-sm"
                                >
                                    <option value="">
                                        {availableVariants.length > 0 ? '-- ELIGE MEDIDA --' : '(Selecciona Producto Primero)'}
                                    </option>
                                    {availableVariants.map(v => (
                                      <option key={v.id} value={v.id}>
                                        {v.name} — R$ {v.price.toFixed(2)}
                                      </option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <Layers size={20}/>
                                </div>
                            </div>
                         </div>

                     </div>
                </div>

                {/* 2. VISOR DE STOCK (SOLO SI HAY SELECCIÓN) */}
                {selectedItem && (
                    <div className={`rounded-2xl p-6 border-l-4 shadow-lg flex justify-between items-center transition-all animate-in slide-in-from-top-4 duration-300 ${
                        remainingStock <= 0 ? 'bg-rose-50 border-rose-500' : 'bg-emerald-50 border-emerald-500'
                    }`}>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Disponible</span>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-3xl font-black ${remainingStock <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {formatQty(remainingStock)}
                                </span>
                                <span className="text-xs font-bold text-slate-400 uppercase">
                                    {getUnitLabel(selectedItem.salesUnit, remainingStock)}
                                </span>
                            </div>
                        </div>
                        {currentInCart > 0 && (
                            <div className="text-right">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase">En Carrito</span>
                                <span className="text-lg font-bold text-indigo-600">{formatQty(currentInCart)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. CALCULADORA */}
                <div className={`bg-slate-900 rounded-[2rem] p-6 shadow-2xl flex-1 flex flex-col justify-center relative overflow-hidden min-h-[300px] md:min-h-0 transition-all duration-500 ${!selectedItem ? 'opacity-80 grayscale' : ''}`}>
                     {/* Efectos de fondo */}
                     <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>

                     {/* Overlay de carga si aplica */}
                     {loading && <div className="absolute inset-0 bg-slate-900/80 z-20 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={32}/></div>}

                     <div className="relative z-10 space-y-6">
                        {/* Header Calculadora */}
                        <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-white/10 pb-4">
                            <span className="flex items-center gap-2"><Calculator size={14}/> Ingreso Cantidad</span>
                            <span className="bg-white/10 px-2 py-1 rounded text-white">Unit: R$ {unitPriceBRL.toFixed(2)}</span>
                        </div>
                        
                        {/* Input Cantidad Gigante - AÑADIDO MB-8 para separar de precio */}
                        <div className="flex items-center gap-4 mb-8">
                             <input 
                                type="number"
                                value={quantityInput}
                                onChange={e => handleQuantityChange(e.target.value)}
                                disabled={!selectedItem}
                                placeholder="0"
                                className={`w-full bg-transparent text-6xl font-black outline-none transition-colors placeholder-slate-700 ${
                                    isInputInsufficient ? 'text-rose-500' : 'text-white'
                                }`}
                            />
                            <span className="text-slate-600 font-black text-xl rotate-90 origin-left whitespace-nowrap">CANT.</span>
                        </div>

                        {/* Input Dinero */}
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-3 focus-within:bg-white/10 transition-colors">
                            <span className="text-emerald-500 font-black text-2xl">R$</span>
                            <input 
                                type="number"
                                value={totalInput}
                                onChange={e => handleTotalChange(e.target.value)}
                                disabled={!selectedItem}
                                placeholder="0.00"
                                className="w-full bg-transparent text-3xl font-black text-emerald-400 outline-none placeholder-emerald-900/30"
                            />
                        </div>

                        {/* Botón Agregar */}
                        <button 
                            onClick={addToCart}
                            disabled={!selectedItem || isInputInsufficient || parseFloat(quantityInput) <= 0}
                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                                !selectedItem || isInputInsufficient || parseFloat(quantityInput) <= 0
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg active:scale-95 shadow-indigo-500/20'
                            }`}
                        >
                            {isInputInsufficient ? <><AlertCircle size={24}/> Stock Insuficiente</> : <><Plus size={24}/> Agregar al Ticket</>}
                        </button>
                     </div>
                </div>

            </div>

            {/* =======================================================
                COLUMNA DERECHA: TICKET DE VENTA
               ======================================================= */}
            <div className="lg:col-span-7 flex flex-col h-auto md:h-full">
                
                <div className="bg-white flex-1 rounded-t-[2rem] shadow-xl border border-slate-100 flex flex-col overflow-hidden min-h-[300px]">
                    <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
                        <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm flex items-center gap-2">
                            <Layers size={16} className="text-indigo-500"/> Detalle de Venta
                        </h3>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black">
                            {cart.length} {cart.length === 1 ? 'Ítem' : 'Ítems'}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 py-10">
                                <div className="bg-slate-100 p-6 rounded-full mb-4">
                                    <ShoppingCart size={48} className="text-slate-400"/>
                                </div>
                                <p className="font-black uppercase tracking-widest">El carrito está vacío</p>
                                <p className="text-xs font-medium mt-1">Agrega productos desde la izquierda</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.tempId} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-indigo-50 p-3 rounded-xl text-indigo-500">
                                            <Box size={20}/>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm leading-tight">{item.name}</p>
                                            <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
                                                {/* FORMATO ACTUALIZADO: Cantidad Limpia y Etiqueta Dinámica */}
                                                <span className="bg-slate-100 px-1.5 rounded text-slate-600 font-bold">
                                                    {formatQty(item.quantity)} {getUnitLabel(item.unitLabel, item.quantity)}
                                                </span>
                                                <span>x</span>
                                                <span>R$ {item.unitPriceBRL.toFixed(2)}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-slate-700 text-lg">R$ {item.subtotalBRL.toFixed(2)}</span>
                                        <button onClick={() => removeFromCart(item.tempId)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-500 transition-colors">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer Totales y Cliente */}
                <div className="bg-slate-900 rounded-b-[2rem] p-8 shadow-2xl z-20 space-y-6">
                    
                    {/* INPUT DE CLIENTE */}
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center gap-4">
                        <User className="text-indigo-400" size={24}/>
                        <div className="flex-1">
                             <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Nombre del Cliente (Opcional)</label>
                             <input 
                                type="text"
                                value={clientName}
                                onChange={e => setClientName(e.target.value.toUpperCase())}
                                placeholder="CLIENTE (OPCIONAL)"
                                className="w-full bg-transparent text-white font-bold placeholder-slate-600 outline-none uppercase"
                             />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                        <div className="hidden md:block">
                            <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Subtotal</span>
                            <span className="block text-2xl font-bold text-slate-300">R$ {subtotal.toFixed(2)}</span>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <Tag size={12}/> Descuento Global
                            </label>
                            <div className={`relative bg-slate-800 rounded-xl border-2 transition-colors ${isDiscountInvalid ? 'border-rose-500' : 'border-slate-700 focus-within:border-orange-500'}`}>
                                <input type="number" value={globalDiscount} onChange={e => setGlobalDiscount(e.target.value)} placeholder="0.00" className={`w-full bg-transparent p-3 pl-10 font-bold outline-none ${isDiscountInvalid ? 'text-rose-500' : 'text-white'}`} />
                                <span className="absolute left-3 top-3.5 text-slate-500 font-bold">R$</span>
                            </div>
                        </div>
                        <div className="text-right">
                             <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total a Pagar</span>
                             <span className="block text-4xl font-black text-emerald-400 mb-4 tracking-tight">R$ {Math.max(0, netTotal).toFixed(2)}</span>
                             <button onClick={handleConfirmSale} disabled={cart.length === 0 || isDiscountInvalid || loading} className={`w-full py-4 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${cart.length === 0 || isDiscountInvalid || loading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30 active:scale-95'}`}>
                                {loading ? <Loader2 className="animate-spin" size={20}/> : <Banknote size={20}/>} {loading ? 'Procesando...' : 'Confirmar Venta'}
                             </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        {/* MODAL DE CONFIRMACIÓN / ÉXITO */}
        <ConfirmActionModal 
            isOpen={confirmModal.isOpen}
            onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            {...confirmModal}
        />
    </div>
  );
};

export default SalesForm;