import React, { useState, useEffect } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { Truck, Calculator, RefreshCw, Package, DollarSign, Archive, Box, Layers, Loader2, AlertTriangle, Ruler, ArrowRight, Disc, CheckSquare, Square, Lock, Pencil } from 'lucide-react';

const SupplyForm = () => {
  const [products, setProducts] = useState([]);
  
  // --- ESTADOS DE SELECCIÓN ---
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState(''); 
  
  // --- ESTADOS DE MODO Y LÓGICA ---
  // PACK = Por Caja/Bulto/Rollo, BULK = Por Unidad Suelta
  const [supplyMode, setSupplyMode] = useState('PACK'); 
  const [canUsePackMode, setCanUsePackMode] = useState(true); // ¿El producto permite cajas/rollos?
  const [packType, setPackType] = useState('CAJA'); // 'CAJA' | 'ROLLO'

  // --- ESTADOS DE DATOS ---
  const [inputQty, setInputQty] = useState('');     // Cantidad física (Cajas o Unidades)
  const [inputCost, setInputCost] = useState('');   // Costo en Soles (Por Caja o Unidad)
  const [isCostLocked, setIsCostLocked] = useState(true); // NUEVO: Bloqueo de costo por defecto
  
  // --- ESTADOS DE PRECIO DE VENTA (SEGURIDAD) ---
  const [shouldUpdatePrice, setShouldUpdatePrice] = useState(false);
  const [newSalePriceInput, setNewSalePriceInput] = useState('');

  // --- DERIVADOS ---
  const [rate, setRate] = useState(1.6);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Helper de Redondeo Financiero (2 decimales estrictos)
  const roundMoney = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

  // 1. CARGA INICIAL
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const data = await InventoryService.getProducts();
      setProducts(data || []); 
      const currentRate = InventoryService.getExchangeRate();
      setRate(currentRate);
      setLoading(false);
    };
    init();
  }, []);

  // 2. HELPERS DE SELECCIÓN
  const selectedItem = products.find(p => p.id == selectedProductId);
  const selectedVariant = selectedItem?.variants?.find(v => v.id == selectedVariantId);

  // 3. EFECTO: AL CAMBIAR VARIANTE O MODO (LÓGICA DE COSTOS AUTOMÁTICOS)
  useEffect(() => {
    if (selectedVariant) {
        // A. Configuración de Modo (Bloqueo PACK/BULK)
        const unitType = selectedVariant.purchaseUnit || 'UNIDAD';
        const factor = selectedVariant.conversionFactor || 1;
        
        const isBulkOnly = unitType === 'UNIDAD' || factor <= 1;
        
        // Solo cambiamos el modo automáticamente si acabamos de seleccionar la variante (inputQty vacío es un proxy de "recién cargado")
        if (inputQty === '') {
            if (isBulkOnly) {
                setCanUsePackMode(false);
                setSupplyMode('BULK');
            } else {
                setCanUsePackMode(true);
                setPackType(unitType === 'ROLLO' ? 'ROLLO' : 'CAJA');
                setSupplyMode('PACK');
            }
        }

        // B. Lógica de Pre-llenado de Costo (REQUERIMIENTO 1)
        // Solo sobreescribimos el costo si está BLOQUEADO. Si el usuario lo editó, respetamos su valor.
        if (isCostLocked) {
            const baseDbCost = selectedVariant.priceBuySoles || 0;
            let suggestedCost = 0;

            if (isBulkOnly || supplyMode === 'BULK') {
                suggestedCost = baseDbCost;
            } else {
                // Si es PACK, el costo sugerido es CostoUnitario * Factor
                suggestedCost = baseDbCost * factor;
            }
            
            // REQUERIMIENTO 4: Siempre 2 decimales
            setInputCost(suggestedCost > 0 ? suggestedCost.toFixed(2) : '');
        }

        // Resetear inputs de dinero si cambiamos de variante
        if (inputQty === '') {
             setShouldUpdatePrice(false);
             setNewSalePriceInput(selectedVariant.priceSellBRL ? selectedVariant.priceSellBRL.toFixed(2) : ''); 
        }
    }
  }, [selectedVariantId, supplyMode]); // Se ejecuta al cambiar variante O al cambiar de Pack a Bulk

  const handleProductChange = (e) => {
      setSelectedProductId(e.target.value);
      setSelectedVariantId(''); 
      setInputQty('');
      setInputCost('');
      setIsCostLocked(true); // Reset al cambiar producto
  };

  // 4. CÁLCULOS MATEMÁTICOS EN TIEMPO REAL
  const calculateMath = () => {
      if (!selectedVariant) return { totalStockToAdd: 0, realUnitCostSoles: 0, frozenBRL: 0, totalInvestmentSoles: 0, projectedValueBRL: 0, finalSalePrice: 0 };

      const conversionFactor = selectedVariant.conversionFactor || 1;
      const qtyInputVal = parseFloat(inputQty) || 0;
      const costInputVal = parseFloat(inputCost) || 0;

      // A. Calcular Stock Real a Sumar
      const factor = supplyMode === 'PACK' ? conversionFactor : 1;
      const totalStockToAdd = qtyInputVal * factor;

      // B. Calcular Costo Unitario en Soles (Base)
      // Si el modo es PACK, dividimos el costo ingresado entre el factor
      const realUnitCostSolesRaw = supplyMode === 'PACK' && factor > 0 ? (costInputVal / factor) : costInputVal;
      const realUnitCostSoles = roundMoney(realUnitCostSolesRaw);

      // C. Conversión a Reales (Congelado)
      const frozenBRL = roundMoney(realUnitCostSoles * rate);
      
      // D. Inversión Total (Cashflow)
      const totalInvestmentSoles = roundMoney(costInputVal * qtyInputVal);

      // REGLA 3: Valorización
      const projectedValueBRL = roundMoney(realUnitCostSoles * rate * totalStockToAdd);

      // E. Precio de Venta Final
      const finalSalePrice = shouldUpdatePrice ? roundMoney(newSalePriceInput) : roundMoney(selectedVariant.priceSellBRL);

      return { 
          totalStockToAdd, 
          realUnitCostSoles, 
          frozenBRL, 
          totalInvestmentSoles,
          projectedValueBRL,
          finalSalePrice
      };
  };

  const math = calculateMath();

  // 5. SUBMIT
  const handleSubmit = async (e) => {
      e.preventDefault();
      if (!selectedVariantId) return alert("Selecciona una medida.");
      if (math.totalStockToAdd <= 0) return alert("La cantidad debe ser mayor a 0.");

      setProcessing(true);
      try {
          // REGLA 2: Solo enviamos el nuevo precio si el checkbox está marcado.
          const priceToSend = shouldUpdatePrice ? math.finalSalePrice : 0;

          await InventoryService.addSupply(
              selectedVariantId, 
              math.totalStockToAdd, 
              math.realUnitCostSoles, 
              priceToSend 
          );
          
          const labelQty = supplyMode === 'PACK' ? (packType === 'ROLLO' ? 'Rollos' : 'Cajas') : 'Unidades';
          alert(`✅ Abastecimiento Exitoso.\n\nIngreso: ${inputQty} ${labelQty}\nStock total sumado: +${math.totalStockToAdd}\nCosto Unitario: S/ ${math.realUnitCostSoles.toFixed(2)}`);
          
          // Limpieza inteligente
          setInputQty('');
          // No limpiamos el costo, lo dejamos pre-lleno y bloqueado de nuevo
          setIsCostLocked(true);
          setShouldUpdatePrice(false);
          
      } catch (err) {
          console.error(err);
          alert("Error: " + err.message);
      } finally {
          setProcessing(false);
      }
  };

  // Dynamic Labels
  const getPackLabel = () => packType === 'ROLLO' ? 'Por Rollo' : 'Por Caja/Bulto';
  const getQtyLabel = () => supplyMode === 'PACK' ? (packType === 'ROLLO' ? '(Rollos)' : '(Cajas)') : '(Unidades)';
  const getCostLabel = () => supplyMode === 'PACK' ? (packType === 'ROLLO' ? 'por Rollo' : 'por Caja') : 'Unitario';

  if (loading) return <div className="p-10 text-center text-slate-500"><Loader2 className="animate-spin inline mr-2"/> Cargando catálogo...</div>;

  return (
    <div className="max-w-6xl mx-auto pb-20">
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8">
            <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-200 text-white">
                <Truck size={32} />
            </div>
            <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Abastecimiento Inteligente</h2>
                <p className="text-slate-500 font-medium">Entrada de stock y gestión de costos.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* COLUMNA IZQUIERDA: FORMULARIO */}
            <div className="lg:col-span-7 space-y-6">
                
                {/* 1. SELECTOR DE PRODUCTO */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Package size={14}/> 1. Identificación
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label-header">Producto</label>
                            <select 
                                value={selectedProductId}
                                onChange={handleProductChange}
                                className="input-field uppercase"
                            >
                                <option value="">-- SELECCIONAR --</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                        <div className={!selectedProductId ? 'opacity-50 pointer-events-none' : ''}>
                             <label className="label-header">Medida / Variante</label>
                             <div className="relative">
                                <select 
                                    value={selectedVariantId}
                                    onChange={e => setSelectedVariantId(e.target.value)}
                                    className="input-field appearance-none uppercase"
                                >
                                    <option value="">-- SELECCIONAR --</option>
                                    {selectedItem?.variants?.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.name.toUpperCase()} {v.conversionFactor > 1 ? `(x${v.conversionFactor})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <Ruler className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" size={16}/>
                             </div>
                        </div>
                    </div>
                </div>

                {/* 2. DATOS DE INGRESO */}
                {selectedVariant && (
                    <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Archive size={14}/> 2. Datos de Carga
                        </h3>

                        {/* SELECTOR DE MODO */}
                        <div className="bg-slate-100 p-1.5 rounded-xl flex gap-2 mb-6 border border-slate-200">
                            <button
                                onClick={() => canUsePackMode && setSupplyMode('PACK')}
                                disabled={!canUsePackMode}
                                className={`flex-1 py-3 rounded-lg text-[10px] md:text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                                    supplyMode === 'PACK' 
                                    ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
                                    : canUsePackMode ? 'text-slate-400 hover:text-slate-600' : 'text-slate-300 cursor-not-allowed opacity-50'
                                }`}
                            >
                                {packType === 'ROLLO' ? <Disc size={16}/> : <Box size={16}/>} 
                                {canUsePackMode ? `${getPackLabel()} (x${selectedVariant.conversionFactor})` : `No aplica (Solo Unidad)`}
                            </button>
                            <button
                                onClick={() => setSupplyMode('BULK')}
                                className={`flex-1 py-3 rounded-lg text-[10px] md:text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                                    supplyMode === 'BULK' 
                                    ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                <Layers size={16}/> Por Unidad Suelta
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="label-header">
                                    Cantidad {getQtyLabel()}
                                </label>
                                <input 
                                    type="number"
                                    value={inputQty}
                                    onChange={e => setInputQty(e.target.value)}
                                    placeholder="0"
                                    className="input-field text-xl"
                                    autoFocus
                                />
                            </div>

                            {/* INPUT DE COSTO CON SEGURIDAD (REQUERIMIENTO PRINCIPAL) */}
                            <div>
                                <div className="flex justify-between items-center mb-0.5">
                                    <label className="label-header mb-0">
                                        Costo {getCostLabel()} (S/)
                                    </label>
                                    <span className={`text-[9px] font-bold uppercase ${isCostLocked ? 'text-indigo-400' : 'text-orange-500'}`}>
                                        {isCostLocked ? 'Precio BD (Bloqueado)' : 'Editando Precio'}
                                    </span>
                                </div>
                                
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black z-10">S/</span>
                                    
                                    <input 
                                        type="number"
                                        step="0.01"
                                        value={inputCost}
                                        onChange={e => setInputCost(e.target.value)}
                                        disabled={isCostLocked} // REQUERIMIENTO 1: Disabled por defecto
                                        placeholder="0.00"
                                        className={`input-field !pl-12 text-xl pr-12 transition-colors ${
                                            isCostLocked 
                                            ? 'bg-slate-100 text-slate-500 cursor-not-allowed' 
                                            : 'bg-white text-slate-800 border-orange-200 focus:border-orange-500'
                                        }`}
                                    />

                                    {/* REQUERIMIENTO 2: Botón de Edición */}
                                    <button
                                        type="button"
                                        onClick={() => setIsCostLocked(!isCostLocked)}
                                        className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center text-slate-400 hover:bg-slate-200 rounded-lg transition-colors z-20"
                                        title={isCostLocked ? "Desbloquear para editar" : "Bloquear costo"}
                                    >
                                        {isCostLocked ? <Pencil size={16}/> : <Lock size={16} className="text-orange-500"/>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. SEGURIDAD DE PRECIOS */}
                {selectedVariant && (
                    <div className={`rounded-3xl shadow-xl p-8 border-2 transition-colors ${shouldUpdatePrice ? 'bg-white border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                         <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <DollarSign size={14}/> 3. Precio de Venta
                            </h3>
                         </div>

                         <div className="flex items-center gap-3 mb-6 bg-slate-100 p-3 rounded-xl cursor-pointer" onClick={() => setShouldUpdatePrice(!shouldUpdatePrice)}>
                            <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${shouldUpdatePrice ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-500'}`}>
                                {shouldUpdatePrice ? <CheckSquare size={16}/> : <Square size={16}/>}
                            </div>
                            <span className="text-xs font-bold text-slate-600 uppercase">¿Desea actualizar el precio de venta?</span>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                             <div>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Precio Actual en Sistema</span>
                                 <div className="text-2xl font-black text-slate-700 flex items-center gap-2">
                                    R$ {selectedVariant.priceSellBRL.toFixed(2)}
                                 </div>
                             </div>

                             {shouldUpdatePrice && (
                                 <div className="animate-in fade-in slide-in-from-right-4">
                                     <label className="label-header text-emerald-600">Nuevo Precio Venta (R$)</label>
                                     <input 
                                        type="number"
                                        step="0.01"
                                        value={newSalePriceInput}
                                        onChange={e => setNewSalePriceInput(e.target.value)}
                                        className="w-full bg-white border-2 border-emerald-400 rounded-xl px-4 py-3 font-black text-emerald-700 text-xl outline-none shadow-sm focus:ring-4 ring-emerald-100 transition-all"
                                     />
                                 </div>
                             )}
                         </div>
                         {shouldUpdatePrice && (
                             <p className="mt-3 text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                 <AlertTriangle size={12}/> El nuevo precio se guardará al confirmar el ingreso.
                             </p>
                         )}
                    </div>
                )}
            </div>

            {/* COLUMNA DERECHA: SIMULACIÓN */}
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col h-full sticky top-6 min-h-[500px]">
                     {selectedVariant ? (
                         <>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 pointer-events-none"></div>
                            
                            <div className="relative z-10 flex-1 space-y-8">
                                <h3 className="font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                                    <Calculator size={20}/> Simulación
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                        <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Stock Actual</span>
                                        <span className="text-2xl font-black text-white">{selectedVariant.stock.toFixed(2)}</span>
                                    </div>
                                    <div className="bg-emerald-500/20 p-4 rounded-2xl border border-emerald-500/30">
                                        <span className="block text-[10px] font-bold uppercase text-emerald-300 mb-1">A Ingresar</span>
                                        <span className="text-2xl font-black text-emerald-400">+{math.totalStockToAdd.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/10">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Total a Pagar (S/)</span>
                                        <span className="text-lg font-black text-slate-200">S/ {math.totalInvestmentSoles.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Costo Unit. Real (S/)</span>
                                        <span className="text-lg font-black text-slate-200">S/ {math.realUnitCostSoles.toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-800 p-4 rounded-xl space-y-2 border border-white/5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-emerald-400 uppercase">Costo Congelado Unit. (R$)</span>
                                            <span className="text-lg font-black text-white">R$ {math.frozenBRL.toFixed(2)}</span>
                                        </div>
                                        <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                                             <span className="text-[10px] font-bold text-emerald-400 uppercase">Valor Total Inventario (R$)</span>
                                             <span className="text-xl font-black text-emerald-300">R$ {math.projectedValueBRL.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleSubmit}
                                disabled={processing || math.totalStockToAdd <= 0}
                                className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 relative z-10 mt-8 ${
                                    math.totalStockToAdd > 0
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-900/40'
                                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                }`}
                            >
                                {processing ? <Loader2 className="animate-spin"/> : <RefreshCw size={24}/>}
                                {processing ? 'Procesando...' : 'Confirmar Ingreso'}
                            </button>
                         </>
                     ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-700 opacity-60">
                            <ArrowRight size={48} className="mb-4 text-emerald-900"/>
                            <p className="font-bold uppercase text-xs tracking-widest text-center">Configura el ingreso<br/>a la izquierda</p>
                        </div>
                     )}
                </div>
            </div>
        </div>

        <style>{`
            .label-header { display: block; font-size: 0.65rem; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem; }
            .input-field { width: 100%; background-color: #f8fafc; border: 2px solid #f1f5f9; border-radius: 0.75rem; padding: 1rem; font-weight: 800; color: #334155; outline: none; transition: all; }
            .input-field:focus { border-color: #6366f1; background-color: white; }
        `}</style>
    </div>
  );
};

export default SupplyForm;