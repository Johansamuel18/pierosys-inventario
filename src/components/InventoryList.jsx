import React, { useState, useEffect, useMemo } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { ChevronDown, ChevronUp, Package, Trash2, Ruler, RefreshCw, AlertOctagon, Plus, X, Save, Loader2, Calculator, Info, Box, Disc, Layers, Archive, Truck, DollarSign, Lock, Pencil, Edit3, TrendingUp, History } from 'lucide-react';

const roundMoney = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

// ==================================================================================
// COMPONENTE: MODAL DE EDICIÓN DE PRECIO (NUEVO)
// ==================================================================================
const EditPriceModal = ({ isOpen, onClose, variant, onSave }) => {
    const [newPrice, setNewPrice] = useState('');
    const [loading, setLoading] = useState(false);
    const [rate, setRate] = useState(1.6);

    useEffect(() => {
        if (isOpen && variant) {
            setNewPrice(variant.priceSellBRL ? variant.priceSellBRL.toFixed(2) : '');
            const r = InventoryService.getExchangeRate();
            setRate(r);
        }
    }, [isOpen, variant]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const price = parseFloat(newPrice);
            if (isNaN(price) || price < 0) throw new Error("Precio inválido");
            await onSave(variant.id, price);
            onClose();
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !variant) return null;

    // Cálculos de Referencia
    const costSoles = variant.priceBuySoles || 0;
    const costBRL = costSoles * rate;
    const currentInput = parseFloat(newPrice) || 0;
    const margin = currentInput > 0 ? ((currentInput - costBRL) / currentInput) * 100 : 0;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
                <div className="bg-emerald-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                        <DollarSign size={16}/> Editar Precio Venta
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X size={16}/></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="text-center mb-2">
                        <p className="text-xs font-bold text-slate-400 uppercase">{variant.name}</p>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Nuevo Precio (R$)</label>
                        <input 
                            type="number" step="0.01" autoFocus
                            value={newPrice} onChange={e => setNewPrice(e.target.value)}
                            className="w-full text-center text-3xl font-black text-emerald-600 border-2 border-emerald-100 rounded-xl py-3 outline-none focus:border-emerald-500 focus:bg-emerald-50/30 transition-all"
                        />
                    </div>

                    {/* DATOS DE REFERENCIA PARA NO PERDER DINERO */}
                    <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                         <div className="flex justify-between items-center text-xs">
                             <span className="font-bold text-slate-400 uppercase">Costo Base</span>
                             <span className="font-bold text-slate-600">S/ {costSoles.toFixed(2)} <span className="text-slate-300">|</span> R$ {costBRL.toFixed(2)}</span>
                         </div>
                         <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2">
                             <span className="font-bold text-slate-400 uppercase">Margen Est.</span>
                             <span className={`font-black ${margin > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                 {margin.toFixed(1)}%
                             </span>
                         </div>
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-lg flex justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : <Save size={18}/>} Guardar Precio
                    </button>
                </form>
             </div>
        </div>
    );
};

// ==================================================================================
// 1. COMPONENTE: MODAL DE CREACIÓN RÁPIDA (MANTENIDO)
// ==================================================================================
const QuickVariantModal = ({ isOpen, onClose, product, onSave }) => {
    // 1. Configuración de Costo (Input)
    const [costConfig, setCostConfig] = useState({
        currency: 'PEN',     // 'PEN' | 'BRL'
        isBulk: true,        // Switch Principal: ¿Empaque Cerrado?
        rate: 1.60,          // Tasa Default
        inputValue: '',      // Costo ingresado (ej: 150 soles el rollo)
        contentValue: ''     // Contenido (ej: 100 metros)
    });

    const [packagingType, setPackagingType] = useState('CAJA'); 
    const [stockQty, setStockQty] = useState(''); 
    const [salePriceBRL, setSalePriceBRL] = useState('');
    const [variantName, setVariantName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if(isOpen) {
            const sysRate = InventoryService.getExchangeRate() || 1.60;
            setCostConfig({ 
                currency: 'PEN', 
                isBulk: true, 
                rate: sysRate, 
                inputValue: '', 
                contentValue: '' 
            });
            setPackagingType('CAJA');
            setStockQty('');
            setSalePriceBRL('');
            setVariantName('');
        }
    }, [isOpen]);

    const getLabels = () => {
        if (!costConfig.isBulk) {
            return { inputLabel: 'Costo Unitario', stockLabel: 'Cantidad (Unidades)', contentLabel: 'N/A' };
        }
        switch (packagingType) {
            case 'ROLLO': return { inputLabel: 'Costo por Rollo', contentLabel: 'Metros por Rollo', stockLabel: 'Cantidad de Rollos' };
            case 'BULTO': return { inputLabel: 'Costo por Bulto/Saco', contentLabel: 'Kg por Bulto', stockLabel: 'Cantidad de Bultos' };
            case 'PAQUETE': return { inputLabel: 'Costo por Paquete', contentLabel: 'Unidades por Paquete', stockLabel: 'Cantidad de Paquetes' };
            default: return { inputLabel: 'Costo por Caja', contentLabel: 'Unidades por Caja', stockLabel: 'Cantidad de Cajas' };
        }
    };
    const labels = getLabels();

    const calculateMath = () => {
        const costInput = parseFloat(costConfig.inputValue) || 0;
        const content = parseFloat(costConfig.contentValue) || 1;
        const rate = parseFloat(costConfig.rate) || 1.60;
        const qty = parseFloat(stockQty) || 0;

        let unitCostBase = costConfig.isBulk ? (costInput / content) : costInput;
        let unitCostSoles = 0;
        let unitCostBRL = 0;

        if (costConfig.currency === 'PEN') {
            unitCostSoles = unitCostBase;
            unitCostBRL = unitCostBase * rate; 
        } else {
            unitCostBRL = unitCostBase;
            unitCostSoles = rate > 0 ? (unitCostBase / rate) : 0;
        }

        // Redondeamos para visualización limpia
        unitCostBRL = roundMoney(unitCostBRL);
        unitCostSoles = roundMoney(unitCostSoles);

        const totalStockUnits = costConfig.isBulk ? (qty * content) : qty;
        
        return { unitCostSoles, unitCostBRL, totalStockUnits };
    };
    const math = calculateMath();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave({
                name: variantName.toUpperCase(),
                price_buy_soles: math.unitCostSoles, 
                price_sell_brl: roundMoney(salePriceBRL),
                stock_quantity: math.totalStockUnits,
                purchase_unit: costConfig.isBulk ? packagingType : 'UNIDAD',
                conversion_factor: costConfig.isBulk ? (parseFloat(costConfig.contentValue) || 1) : 1
            });
            onClose();
        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 my-8 border border-slate-100">
                <div className="bg-slate-900 p-6 flex justify-between items-center text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                            <Plus className="text-emerald-400" strokeWidth={3} size={20}/> Nueva Medida
                        </h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="bg-white/10 p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/20 transition-colors relative z-10"><X size={18}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Variante / Medida</label>
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="Ej. Caja Roja / 2 Pulgadas" 
                            value={variantName}
                            onChange={e => setVariantName(e.target.value.toUpperCase())}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-indigo-500 text-sm transition-colors uppercase"
                            required
                        />
                    </div>
                    <div className="border-t border-slate-100"></div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                <Calculator size={14}/> Configuración Costo
                            </h4>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button type="button" onClick={() => setCostConfig({...costConfig, currency: 'PEN'})} className={`px-3 py-1 rounded text-[10px] font-black transition-all ${costConfig.currency === 'PEN' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>S/ SOLES</button>
                                <button type="button" onClick={() => setCostConfig({...costConfig, currency: 'BRL'})} className={`px-3 py-1 rounded text-[10px] font-black transition-all ${costConfig.currency === 'BRL' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>R$ REALES</button>
                            </div>
                        </div>

                        <div className="bg-indigo-50/30 rounded-2xl p-5 border border-indigo-100 relative">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black uppercase text-slate-500">¿Ingreso por Empaque Cerrado?</span>
                                <button 
                                    type="button"
                                    onClick={() => setCostConfig({...costConfig, isBulk: !costConfig.isBulk})}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors relative ${costConfig.isBulk ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${costConfig.isBulk ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                            
                            {costConfig.isBulk && (
                                <div className="grid grid-cols-4 gap-2 mb-4">
                                    {[
                                        { id: 'CAJA', icon: Box, label: 'Caja' },
                                        { id: 'ROLLO', icon: Disc, label: 'Rollo' },
                                        { id: 'BULTO', icon: Archive, label: 'Bulto' },
                                        { id: 'PAQUETE', icon: Layers, label: 'Paq.' }
                                    ].map(type => (
                                        <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => setPackagingType(type.id)}
                                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${packagingType === type.id ? 'bg-white border-indigo-500 text-indigo-600 shadow-sm' : 'border-transparent text-slate-400 hover:bg-white/50'}`}
                                        >
                                            <type.icon size={16}/>
                                            <span className="text-[8px] font-black uppercase mt-1">{type.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-12 gap-3 mb-2">
                                <div className={`${costConfig.isBulk ? 'col-span-4' : 'col-span-6'}`}>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 truncate">{labels.inputLabel}</label>
                                    <input 
                                        type="number"
                                        placeholder="0.00"
                                        value={costConfig.inputValue}
                                        onChange={e => setCostConfig({...costConfig, inputValue: e.target.value})}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-black text-slate-800 outline-none focus:border-indigo-500"
                                    />
                                </div>
                                {costConfig.currency === 'PEN' && (
                                    <div className={`${costConfig.isBulk ? 'col-span-4' : 'col-span-6'}`}>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Tasa</label>
                                        <input 
                                            type="number" step="0.01"
                                            value={costConfig.rate} 
                                            onChange={e => setCostConfig({...costConfig, rate: e.target.value})}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-black text-slate-800 outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                )}
                                {costConfig.isBulk && (
                                    <div className="col-span-4">
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 truncate">{labels.contentLabel}</label>
                                        <input 
                                            type="number"
                                            placeholder="Contenido"
                                            value={costConfig.contentValue}
                                            onChange={e => setCostConfig({...costConfig, contentValue: e.target.value})}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-black text-slate-800 outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-4 bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-slate-400">Costo Base Unitario</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-bold text-emerald-400">R$</span>
                                    <span className="text-xl font-black text-emerald-600">{math.unitCostBRL.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">{labels.stockLabel}</label>
                             <input 
                                type="number" placeholder="0" 
                                value={stockQty} onChange={e => setStockQty(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-slate-700 outline-none focus:border-indigo-500"
                             />
                        </div>
                        <div>
                             <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Precio Venta (R$)</label>
                             <input 
                                type="number" step="0.01" placeholder="0.00" 
                                value={salePriceBRL} onChange={e => setSalePriceBRL(e.target.value)}
                                className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 font-black text-emerald-600 outline-none focus:border-emerald-500"
                                required
                             />
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-transform active:scale-95">
                        {loading ? <Loader2 className="animate-spin"/> : <Save size={20}/>} Guardar Medida
                    </button>
                </form>
            </div>
        </div>
    );
};

// ==================================================================================
// 2. COMPONENTE: MODAL DE REABASTECIMIENTO (RESTOCK) - RECONSTRUIDO
// ==================================================================================
const RestockModal = ({ isOpen, onClose, product, variant, onSave }) => {
    // Estado de configuración de costos
    const [costConfig, setCostConfig] = useState({
        currency: 'PEN',     
        isBulk: false,
        rate: 1.60,         
        inputValue: '',      // Costo Compra
        contentValue: ''     // Contenido por Bulto
    });

    const [packagingType, setPackagingType] = useState('CAJA'); 
    const [stockQty, setStockQty] = useState(''); 
    const [newSalePrice, setNewSalePrice] = useState(''); 
    const [loading, setLoading] = useState(false);
    
    // NUEVO: Estado de bloqueo para modal (Requerimiento)
    const [isCostLocked, setIsCostLocked] = useState(true);

    useEffect(() => {
        if(isOpen && variant) {
            const sysRate = InventoryService.getExchangeRate() || 1.60;
            const unitType = variant.purchaseUnit || 'UNIDAD';
            const wasBulk = variant.conversionFactor > 1 && unitType !== 'UNIDAD';
            const baseCost = variant.priceBuySoles || 0;
            
            // Lógica de Pre-llenado (Requerimiento 1 y 4)
            // Si es Bulk (Caja), mostramos el costo por Caja (Unit * Factor).
            // Si es Unidad, mostramos Unit.
            const initialCost = wasBulk ? baseCost * variant.conversionFactor : baseCost;

            setCostConfig({ 
                currency: 'PEN', 
                isBulk: wasBulk, 
                rate: sysRate, 
                inputValue: initialCost > 0 ? initialCost.toFixed(2) : '', 
                contentValue: wasBulk ? variant.conversionFactor : '' 
            });
            
            setIsCostLocked(true); // Siempre inicia bloqueado
            setPackagingType(unitType === 'ROLLO' ? 'ROLLO' : 'CAJA');
            setStockQty('');
            setNewSalePrice(variant.priceSellBRL ? variant.priceSellBRL.toFixed(2) : ''); 
        }
    }, [isOpen, variant]);

    const getLabels = () => {
        if (!costConfig.isBulk) {
            return { inputLabel: 'Costo Unitario', stockLabel: 'Cantidad a Ingresar (Unidades)', contentLabel: 'N/A' };
        }
        switch (packagingType) {
            case 'ROLLO': return { inputLabel: 'Costo por Rollo', contentLabel: 'Metros/Rollo', stockLabel: 'Cantidad de Rollos' };
            case 'BULTO': return { inputLabel: 'Costo por Bulto', contentLabel: 'Kg/Bulto', stockLabel: 'Cantidad de Bultos' };
            case 'PAQUETE': return { inputLabel: 'Costo por Paquete', contentLabel: 'Unid/Paquete', stockLabel: 'Cantidad de Paquetes' };
            default: return { inputLabel: 'Costo por Caja', contentLabel: 'Unid/Caja', stockLabel: 'Cantidad de Cajas' };
        }
    };
    const labels = getLabels();

    const calculateMath = () => {
        const costInput = parseFloat(costConfig.inputValue) || 0;
        const content = parseFloat(costConfig.contentValue) || 1;
        const rate = parseFloat(costConfig.rate) || 1.60;
        const qty = parseFloat(stockQty) || 0;

        let unitCostBase = costConfig.isBulk ? (costInput / content) : costInput;
        let unitCostSoles = 0;
        let unitCostBRL = 0;

        if (costConfig.currency === 'PEN') {
            unitCostSoles = unitCostBase;
            unitCostBRL = unitCostBase * rate; 
        } else {
            unitCostBRL = unitCostBase;
            unitCostSoles = rate > 0 ? (unitCostBase / rate) : 0;
        }

        // Redondeo
        unitCostBRL = roundMoney(unitCostBRL);
        unitCostSoles = roundMoney(unitCostSoles);

        const totalStockToAdd = costConfig.isBulk ? (qty * content) : qty;
        return { unitCostSoles, unitCostBRL, totalStockToAdd };
    };

    const math = calculateMath();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave({
                variantId: variant.id,
                addedStock: math.totalStockToAdd,
                newCostSoles: math.unitCostSoles,
                newPriceBRL: roundMoney(newSalePrice)
            });
            onClose();
        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !variant) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 transform scale-100">
                
                {/* HEADER DISTINTIVO */}
                <div className="bg-indigo-900 p-6 relative overflow-hidden text-center text-white">
                    <div className="relative z-10">
                        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1 block">ABASTECIENDO INVENTARIO</span>
                        <h3 className="text-xl font-black uppercase tracking-tight">{product?.name}</h3>
                        <div className="mt-2 inline-flex items-center gap-2 bg-indigo-800 px-3 py-1 rounded-full border border-indigo-700">
                             <Ruler size={12} className="text-indigo-300"/>
                             <span className="text-xs font-bold text-indigo-200 uppercase">{variant.name}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full text-indigo-200 hover:text-white transition-colors z-20"><X size={18}/></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    
                    {/* SECCIÓN 1: CALCULADORA DE COSTO */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Truck size={14}/> Datos de Ingreso
                            </h4>
                            <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                                <button type="button" onClick={() => setCostConfig({...costConfig, currency: 'PEN'})} className={`px-2 py-1 rounded text-[9px] font-black transition-all ${costConfig.currency === 'PEN' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'}`}>SOLES</button>
                                <button type="button" onClick={() => setCostConfig({...costConfig, currency: 'BRL'})} className={`px-2 py-1 rounded text-[9px] font-black transition-all ${costConfig.currency === 'BRL' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'}`}>REALES</button>
                            </div>
                        </div>

                        {/* Switch Bulk */}
                        <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-black uppercase text-slate-500">¿Ingreso por {packagingType === 'ROLLO' ? 'Rollo' : 'Caja/Bulto'}?</span>
                            <button 
                                type="button"
                                onClick={() => setCostConfig({...costConfig, isBulk: !costConfig.isBulk})}
                                className={`w-10 h-5 rounded-full p-0.5 transition-colors relative ${costConfig.isBulk ? 'bg-indigo-500' : 'bg-slate-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${costConfig.isBulk ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                        
                        {/* Selector Tipo Empaque */}
                        {costConfig.isBulk && (
                            <div className="grid grid-cols-4 gap-2 mb-4 animate-in fade-in">
                                {[
                                    { id: 'CAJA', icon: Box, label: 'Caja' },
                                    { id: 'ROLLO', icon: Disc, label: 'Rollo' },
                                    { id: 'BULTO', icon: Archive, label: 'Bulto' },
                                    { id: 'PAQUETE', icon: Layers, label: 'Paq.' }
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setPackagingType(type.id)}
                                        className={`flex flex-col items-center p-2 rounded border ${packagingType === type.id ? 'bg-white border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400'}`}
                                    >
                                        <type.icon size={14}/>
                                        <span className="text-[7px] font-black uppercase mt-1">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative group">
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 truncate">{labels.inputLabel}</label>
                                
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        className={`w-full border rounded-lg pl-3 pr-10 py-2 font-black text-sm outline-none transition-colors ${
                                            isCostLocked 
                                            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' 
                                            : 'bg-white text-slate-800 border-indigo-500'
                                        }`}
                                        placeholder="0.00"
                                        value={costConfig.inputValue}
                                        onChange={e => setCostConfig({...costConfig, inputValue: e.target.value})}
                                        disabled={isCostLocked} // BLOQUEO
                                    />
                                    {/* BOTÓN DESBLOQUEO */}
                                    <button
                                        type="button"
                                        onClick={() => setIsCostLocked(!isCostLocked)}
                                        className="absolute right-2 top-1.5 p-1 rounded hover:bg-slate-200 text-slate-400"
                                        title={isCostLocked ? "Editar Costo" : "Bloquear"}
                                    >
                                        {isCostLocked ? <Lock size={12}/> : <Pencil size={12} className="text-indigo-500"/>}
                                    </button>
                                </div>
                            </div>
                            {costConfig.currency === 'PEN' && (
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Tasa Cambio</label>
                                    <input 
                                        type="number" step="0.01" 
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-black text-slate-800 text-sm outline-none focus:border-indigo-500"
                                        value={costConfig.rate}
                                        onChange={e => setCostConfig({...costConfig, rate: e.target.value})}
                                    />
                                </div>
                            )}
                            {costConfig.isBulk && (
                                <div className="col-span-2">
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{labels.contentLabel}</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-black text-slate-800 text-sm outline-none focus:border-indigo-500"
                                        placeholder="Ej: 20"
                                        value={costConfig.contentValue}
                                        onChange={e => setCostConfig({...costConfig, contentValue: e.target.value})}
                                    />
                                </div>
                            )}
                        </div>

                        {/* FEEDBACK MATEMÁTICO */}
                        <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase">Costo Unit. Resultante</span>
                            <div className="text-right">
                                <span className="block text-lg font-black text-slate-700">R$ {math.unitCostBRL.toFixed(2)}</span>
                                <span className="block text-[8px] font-bold text-slate-400 uppercase">S/ {math.unitCostSoles.toFixed(2)} (Base)</span>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 2: CANTIDAD Y ACTUALIZACIÓN DE PRECIO */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 truncate">
                                 {labels.stockLabel}
                             </label>
                             <div className="relative">
                                <input 
                                    type="number" 
                                    placeholder="0" 
                                    value={stockQty}
                                    onChange={e => setStockQty(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                                />
                                {costConfig.isBulk && (
                                    <span className="absolute -bottom-4 right-0 text-[9px] font-bold text-indigo-500">
                                        = +{math.totalStockToAdd} Unid.
                                    </span>
                                )}
                             </div>
                        </div>
                        <div>
                             <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Precio Venta (R$)</label>
                             <input 
                                type="number" step="0.01" placeholder="0.00" 
                                value={newSalePrice}
                                onChange={e => setNewSalePrice(e.target.value)}
                                className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 font-black text-emerald-600 outline-none focus:border-emerald-500"
                                required
                             />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-transform active:scale-95 mt-4"
                    >
                        {loading ? <Loader2 className="animate-spin"/> : <Save size={20}/>} 
                        {loading ? 'Procesando...' : 'Confirmar Ingreso'}
                    </button>

                </form>
            </div>
        </div>
    );
};

// ==================================================================================
// 3. COMPONENTE: MODAL DE HISTORIAL DE VENTAS (NUEVO)
// ==================================================================================
const SalesHistoryModal = ({ isOpen, onClose, product }) => {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && product) {
            loadHistory();
        }
    }, [isOpen, product]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await InventoryService.getSalesByProduct(product.id);
            setSales(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="bg-slate-900 p-4 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                            <History size={18} className="text-emerald-400"/> Historial de Ventas
                        </h3>
                        <p className="text-xs text-slate-400 font-bold mt-1">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X size={20}/></button>
                </div>

                <div className="overflow-auto p-0 flex-1">
                    {loading ? (
                        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={32}/></div>
                    ) : sales.length === 0 ? (
                        <div className="p-10 text-center text-slate-400 font-bold">No hay ventas registradas para este producto.</div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-black sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3">Fecha</th>
                                    <th className="p-3">Cliente</th>
                                    <th className="p-3">Medida</th>
                                    <th className="p-3 text-right">Cant.</th>
                                    <th className="p-3 text-right">P. Unit (R$)</th>
                                    <th className="p-3 text-right">Total (R$)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-600">
                                            {new Date(sale.date).toLocaleDateString()} <span className="text-slate-400 text-[10px]">{new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </td>
                                        <td className="p-3 font-bold text-slate-700">{sale.clientName}</td>
                                        <td className="p-3 text-slate-600"><span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-bold text-[10px]">{sale.variantName}</span></td>
                                        <td className="p-3 text-right font-bold">{sale.quantity}</td>
                                        <td className="p-3 text-right text-slate-500">{sale.unitPrice.toFixed(2)}</td>
                                        <td className="p-3 text-right font-black text-emerald-600">{sale.subtotal.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                
                <div className="bg-slate-50 p-3 border-t border-slate-200 shrink-0 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">{sales.length} Transacciones encontradas</span>
                    <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Total Ventas:</span>
                        <span className="text-lg font-black text-emerald-600">R$ {sales.reduce((acc, s) => acc + s.subtotal, 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==================================================================================
// 3. COMPONENTE PRINCIPAL: INVENTORY LIST
// ==================================================================================
const InventoryList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false); // Quick Variant
  const [selectedParentProduct, setSelectedParentProduct] = useState(null);

  const [isRestockOpen, setIsRestockOpen] = useState(false); // Restock
  const [selectedRestockData, setSelectedRestockData] = useState({ product: null, variant: null });

  // NUEVO: Estado para Edición de Precio
  const [isPriceEditOpen, setIsPriceEditOpen] = useState(false);
  const [variantToEditPrice, setVariantToEditPrice] = useState(null);

  // NUEVO: Estado para Historial
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await InventoryService.getProducts();
      setProducts(data);
    } catch (error) {
      console.error("Error cargando inventario:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const groupedProducts = useMemo(() => {
      const groups = {};
      products.forEach(p => {
          const key = p.name.trim().toUpperCase();
          if (!groups[key]) {
              groups[key] = {
                  uniqueGroupId: key, 
                  primaryDbId: p.id,  
                  name: p.name.toUpperCase(),
                  type: p.type,
                  totalStock: 0,
                  allVariants: []
              };
          }
          if (p.variants && p.variants.length > 0) {
              p.variants.forEach(v => {
                  groups[key].allVariants.push({ ...v, parentDbId: p.id });
                  groups[key].totalStock += (v.stock || 0);
              });
          }
      });
      
      const result = Object.values(groups).map(group => {
          group.allVariants.sort((a, b) => {
              const extractNum = (str) => {
                  const match = str.match(/(\d+(\.\d+)?)/);
                  return match ? parseFloat(match[0]) : null;
              };
              const numA = extractNum(a.name);
              const numB = extractNum(b.name);
              if (numA !== null && numB !== null) return numB - numA;
              if (numA !== null) return -1;
              if (numB !== null) return 1;
              return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
          });
          return group;
      });

      return result.sort((a,b) => a.name.localeCompare(b.name));
  }, [products]);

  const filteredGroups = groupedProducts.filter(g => 
    g.name.includes(searchTerm.toUpperCase())
  );

  // ELIMINAR PRODUCTO COMPLETO (PADRE)
  const handleDeleteProduct = async (id) => {
    if(confirm('ATENCIÓN: ¿Seguro que deseas eliminar el PRODUCTO COMPLETO?\n\nSe borrarán TODAS las medidas y todo el historial de ventas.\nEsta acción no se puede deshacer.')) {
        try {
            await InventoryService.deleteProduct(id);
            await refresh();
        } catch (e) { alert("Error al eliminar: " + e.message); }
    }
  };

  // ELIMINAR VARIANTE INDIVIDUAL (HIJO)
  const handleDeleteVariant = async (variantId) => {
      if(confirm('¿Seguro que deseas eliminar esta medida específica?\n\nEl historial de ventas asociado también se borrará.')) {
          try {
              await InventoryService.deleteVariant(variantId);
              await refresh();
          } catch (e) { alert("Error al eliminar medida: " + e.message); }
      }
  };

  // EDITAR NOMBRE PRODUCTO (RENOMBRAR)
  const handleEditProductName = async (group) => {
      const newName = prompt("Nuevo nombre para el producto:", group.name);
      if (newName && newName.trim() !== "") {
          try {
              await InventoryService.updateProductName(group.primaryDbId, newName);
              await refresh();
          } catch (e) { alert("Error al renombrar: " + e.message); }
      }
  };

  // EDITAR NOMBRE VARIANTE (RENOMBRAR MEDIDA)
  const handleEditVariantName = async (variant) => {
      const newName = prompt("Nuevo nombre para la medida:", variant.name);
      if (newName && newName.trim() !== "") {
          try {
              await InventoryService.updateVariantName(variant.id, newName);
              await refresh();
          } catch (e) { alert("Error al renombrar medida: " + e.message); }
      }
  };

  const handleOpenAddVariant = (group) => {
      setSelectedParentProduct({ id: group.primaryDbId, name: group.name });
      setIsModalOpen(true);
  };

  const handleSaveVariant = async (variantData) => {
      if (!selectedParentProduct) return;
      await InventoryService.addVariant(selectedParentProduct.id, variantData);
      await refresh();
      setExpandedGroupId(selectedParentProduct.name.trim().toUpperCase());
  };

  const handleOpenRestock = (group, variant) => {
      setSelectedRestockData({ 
          product: { name: group.name }, 
          variant: variant 
      });
      setIsRestockOpen(true);
  };

  const handleSaveRestock = async (data) => {
      await InventoryService.addSupply(
          data.variantId, 
          data.addedStock, 
          data.newCostSoles,
          data.newPriceBRL
      );
      await refresh();
  };

  // MANEJO DE EDICIÓN DE PRECIO
  const handleOpenEditPrice = (variant) => {
      setVariantToEditPrice(variant);
      setIsPriceEditOpen(true);
  };

  const handleSaveNewPrice = async (variantId, newPrice) => {
      await InventoryService.updateVariantPrice(variantId, newPrice);
      await refresh();
  };

  const handleOpenHistory = (group) => {
      setHistoryProduct({ id: group.primaryDbId, name: group.name });
      setIsHistoryOpen(true);
  };

  const handleResetAll = async () => {
    const word = prompt("ESCRIBE: 'BORRAR TODO' para eliminar inventario y ventas.");
    if (word === "BORRAR TODO") {
        setLoading(true);
        await InventoryService.deleteAllData();
        await refresh();
        setLoading(false);
    }
  };

  return (
    <>
        {/* CAMBIO: Estructura Flex con altura fija en móvil para scroll interno */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[calc(100dvh-150px)] md:h-auto md:min-h-[500px]">
        {/* HEADER */}
        <div className="bg-slate-900 p-6 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-10">
            <div>
                <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Package className="text-emerald-500" /> Inventario Maestro
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                    {loading ? 'Sincronizando...' : `${groupedProducts.length} Productos Únicos (Agrupados)`}
                </p>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
                <input 
                    type="text" 
                    placeholder="Buscar producto..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value.toUpperCase())}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 w-full placeholder-slate-500 font-bold uppercase"
                />
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={refresh} className="p-2 bg-slate-800 text-emerald-400 rounded-lg hover:bg-slate-700 flex-1 md:flex-none justify-center flex">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''}/>
                    </button>
                    <button onClick={handleResetAll} className="p-2 bg-rose-900/50 text-rose-500 rounded-lg hover:bg-rose-900 border border-rose-900 flex-1 md:flex-none justify-center flex transition-colors" title="Borrar Todo">
                        <AlertOctagon size={20} />
                    </button>
                </div>
            </div>
        </div>

        {/* CONTENIDO */}
        {loading && products.length === 0 ? (
            <div className="p-10 flex justify-center text-slate-400">
                <Loader2 className="animate-spin" size={40}/>
            </div>
        ) : (
            <div className="overflow-auto flex-1">
                <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black tracking-wider border-b border-slate-200">
                    <tr>
                    <th className="px-6 py-4 w-1/3">Producto</th>
                    <th className="px-6 py-4 text-center">Medidas</th>
                    <th className="px-6 py-4 text-right">Stock Total</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredGroups.map(group => {
                    const isExpanded = expandedGroupId === group.uniqueGroupId;

                    return (
                        <React.Fragment key={group.uniqueGroupId}>
                        {/* FILA PADRE (AGRUPADA) */}
                        <tr className={`hover:bg-indigo-50/30 transition-colors cursor-pointer group ${isExpanded ? 'bg-indigo-50/50' : ''}`} onClick={() => setExpandedGroupId(isExpanded ? null : group.uniqueGroupId)}>
                            <td className="px-6 py-4">
                                <span className="font-black text-slate-700 text-sm md:text-base">{group.name}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${group.allVariants.length > 0 ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-500'}`}>
                                    {group.allVariants.length} Opciones
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="font-black text-slate-800 text-lg">
                                    {group.totalStock.toFixed(2)}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex justify-center items-center gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleOpenAddVariant(group); }}
                                        className="bg-indigo-100 hover:bg-indigo-600 hover:text-white text-indigo-600 p-2 rounded-lg transition-all flex items-center gap-1 group/btn"
                                        title="Agregar Medida"
                                    >
                                        <Plus size={16} strokeWidth={3}/>
                                        <span className="text-[10px] font-black uppercase hidden md:inline">Medida</span>
                                    </button>
                                    
                                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                                    
                                    {/* BOTON HISTORIAL (NUEVO) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenHistory(group); }}
                                        className="text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                                        title="Ver Historial de Ventas"
                                    >
                                        <History size={18} />
                                    </button>

                                    {/* BOTON EDITAR NOMBRE (NUEVO) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEditProductName(group); }}
                                        className="text-slate-400 hover:text-orange-500 hover:bg-orange-50 p-2 rounded-lg transition-colors"
                                        title="Editar Nombre del Producto"
                                    >
                                        <Edit3 size={18} />
                                    </button>

                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteProduct(group.primaryDbId); }}
                                        className="text-slate-300 hover:text-rose-500 p-2 rounded-lg transition-colors"
                                        title="Eliminar Producto Completo"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button 
                                        className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-slate-200 text-slate-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </button>
                                </div>
                            </td>
                        </tr>
                        
                        {/* DETALLE EXPANDIDO (VARIANTES) */}
                        {isExpanded && (
                            <tr>
                                <td colSpan={4} className="px-0 py-0 border-b border-slate-200 shadow-inner bg-slate-50/50">
                                    <div className="p-4 space-y-2">
                                        <div className="flex items-center gap-2 mb-2 px-2">
                                            <Ruler size={14} className="text-indigo-400"/>
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Desglose de Medidas</span>
                                        </div>
                                        
                                        {group.allVariants.length === 0 ? (
                                            <div className="text-center py-4 text-slate-400 text-xs font-bold italic">Sin variantes registradas. Usa el botón + para agregar una.</div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {group.allVariants.map((variant, idx) => (
                                                    <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group/card hover:border-indigo-300 transition-colors">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <span className="font-bold text-slate-700 text-sm">
                                                                {variant.name}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <button 
                                                                    onClick={() => handleEditVariantName(variant)}
                                                                    className="text-slate-300 hover:text-orange-500 p-1.5 rounded transition-colors"
                                                                    title="Renombrar Medida"
                                                                >
                                                                    <Edit3 size={14}/>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleOpenRestock(group, variant)}
                                                                    className="bg-emerald-100 hover:bg-emerald-500 hover:text-white text-emerald-600 p-1.5 rounded transition-colors"
                                                                    title="Abastecer esta medida"
                                                                >
                                                                    <Truck size={14}/>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteVariant(variant.id)} 
                                                                    className="text-slate-300 hover:text-rose-500 p-1.5 rounded transition-colors"
                                                                    title="Eliminar Medida Individual"
                                                                >
                                                                    <Trash2 size={14}/>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex justify-between items-end">
                                                            <div>
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Precio Venta</div>
                                                                <div className="font-black text-emerald-500 text-lg flex items-center group/price">
                                                                    <span className="text-xs mr-0.5">R$</span> {variant.priceSellBRL ? variant.priceSellBRL.toFixed(2) : '0.00'}
                                                                    
                                                                    {/* BOTÓN EDITAR PRECIO */}
                                                                    <button 
                                                                        onClick={() => handleOpenEditPrice(variant)}
                                                                        className="ml-2 bg-emerald-50 text-emerald-300 p-1 rounded hover:bg-emerald-500 hover:text-white transition-all opacity-0 group-hover/price:opacity-100"
                                                                        title="Editar Precio"
                                                                    >
                                                                        <Pencil size={12}/>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Stock</div>
                                                                <span className="font-black text-slate-800 text-lg bg-slate-100 px-2 py-0.5 rounded-lg">
                                                                    {(variant.stock || 0).toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        
                                                        {variant.priceBuySoles > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-slate-50 flex justify-between items-center">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Costo Base (Ref.)</span>
                                                                <span className="text-[10px] font-bold text-slate-500">S/ {variant.priceBuySoles.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                        </React.Fragment>
                    );
                    })}
                </tbody>
                </table>
            </div>
        )}
        </div>

        {/* MODAL CREACIÓN RÁPIDA */}
        <QuickVariantModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)}
            product={selectedParentProduct}
            onSave={handleSaveVariant}
        />

        {/* MODAL DE REABASTECIMIENTO (NUEVO) */}
        <RestockModal 
            isOpen={isRestockOpen}
            onClose={() => setIsRestockOpen(false)}
            product={selectedRestockData.product}
            variant={selectedRestockData.variant}
            onSave={handleSaveRestock}
        />

        {/* MODAL DE EDICIÓN DE PRECIO (NUEVO) */}
        <EditPriceModal
            isOpen={isPriceEditOpen}
            onClose={() => setIsPriceEditOpen(false)}
            variant={variantToEditPrice}
            onSave={handleSaveNewPrice}
        />

        {/* MODAL DE HISTORIAL (NUEVO) */}
        <SalesHistoryModal
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            product={historyProduct}
        />
    </>
  );
};

export default InventoryList;