import React, { useState, useEffect } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { Save, Layers, TrendingUp, Package, Loader2, Plus, Trash2, Disc, Box } from 'lucide-react';

const ProductForm = () => {
  // --- Global State ---
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState(1.6);
  const [productName, setProductName] = useState('');
  
  // Lógica de Medida
  const [measureType, setMeasureType] = useState('UNIT'); // UI: UNIT, KILO, METRO

  // --- Variants State ---
  // presentation: 'PACK' (Caja/Rollo) | 'BULK' (Granel/Suelto)
  const [variants, setVariants] = useState([
    {
      tempId: Date.now(),
      name: '',
      presentation: 'PACK', 
      contentPerBulto: '',
      qtyBultos: '',
      costInputSoles: '',
      sellingPriceBRL: '',
      initialStockUnit: ''
    }
  ]);

  useEffect(() => {
    const r = InventoryService.getExchangeRate();
    setRate(r);
  }, []);

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        tempId: Date.now() + Math.random(),
        name: '',
        presentation: 'PACK',
        contentPerBulto: '',
        qtyBultos: '',
        costInputSoles: '',
        sellingPriceBRL: '',
        initialStockUnit: ''
      }
    ]);
  };

  const removeVariant = (index) => {
    if (variants.length === 1) return;
    const newVars = [...variants];
    newVars.splice(index, 1);
    setVariants(newVars);
  };

  const updateVariant = (index, field, value) => {
    const newVars = [...variants];
    newVars[index] = { ...newVars[index], [field]: value };
    setVariants(newVars);
  };

  // --- Math Logic ---
  const calculateVariantMath = (v) => {
    const costSoles = parseFloat(v.costInputSoles) || 0;
    let unitCostSoles = 0;
    let calculatedCostBRL = 0;
    let totalStock = 0;

    // Usamos measureType para la lógica visual
    if (measureType === 'UNIT') {
        unitCostSoles = costSoles; 
        totalStock = parseFloat(v.initialStockUnit) || 0;
    } else {
        // KILO o METRO
        if (v.presentation === 'PACK') {
            const content = parseFloat(v.contentPerBulto) || 1;
            unitCostSoles = content > 0 ? (costSoles / content) : 0;
            const qty = parseFloat(v.qtyBultos) || 0;
            totalStock = qty * content;
        } else {
            // BULK (Granel)
            unitCostSoles = costSoles; 
            totalStock = parseFloat(v.qtyBultos) || 0;
        }
    }

    calculatedCostBRL = unitCostSoles * rate;
    const sellPrice = parseFloat(v.sellingPriceBRL) || 0;
    let margin = 0;
    if (sellPrice > 0 && calculatedCostBRL > 0) {
        margin = ((sellPrice - calculatedCostBRL) / sellPrice) * 100;
    }

    return { unitCostSoles, calculatedCostBRL, totalStock, margin };
  };

  // Helpers de UI para etiquetas dinámicas
  const getPackLabel = () => measureType === 'METRO' ? 'Por Rollo' : 'Por Caja';
  const getContentLabel = () => measureType === 'METRO' ? 'Metros x Rollo' : 'Contenido x Caja';
  const getCostLabel = () => measureType === 'METRO' ? 'Costo Rollo (S/)' : 'Costo Caja (S/)';
  const getStockLabel = () => measureType === 'METRO' ? 'Stock Inicial (Rollos)' : 'Stock Inicial (Cajas)';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productName.trim()) return alert("Falta nombre del producto");

    setLoading(true);
    try {
        const variantsPayload = variants.map(v => {
            const math = calculateVariantMath(v);
            
            // Determinar unidad de venta para DB
            let salesUnitStr = 'UND';
            if (measureType === 'KILO') salesUnitStr = 'KG';
            if (measureType === 'METRO') salesUnitStr = 'MT';

            // Determinar unidad de compra (PACK -> CAJA o ROLLO)
            let purchaseUnitStr = 'UNIDAD';
            if (v.presentation === 'PACK') {
                purchaseUnitStr = measureType === 'METRO' ? 'ROLLO' : 'CAJA';
            }

            return {
                name: v.name || 'Estándar',
                price_sell_brl: parseFloat(v.sellingPriceBRL) || 0,
                price_buy_soles: math.unitCostSoles, 
                stock_quantity: math.totalStock,
                sales_unit: salesUnitStr, 
                conversion_factor: parseFloat(v.contentPerBulto) || 1,
                purchase_unit: purchaseUnitStr,
            };
        });

        const fullProduct = {
            name: productName,
            type: 'producto',
            variants: variantsPayload
        };

        await InventoryService.addProduct(fullProduct); 
        
        alert("Producto guardado correctamente en Supabase");
        
        // Reset
        setProductName('');
        setVariants([{ tempId: Date.now(), name: '', presentation: 'PACK', costInputSoles: '', sellingPriceBRL: '' }]);

    } catch (error) {
        console.error(error);
        alert("Error guardando: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* HEADER */}
        <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-100 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>
             
             <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <Package className="text-indigo-600" size={28}/> Nuevo Producto
                    </h2>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tasa Actual</p>
                        <p className="text-sm font-black text-slate-700">S/ 1.00 = R$ {rate.toFixed(2)}</p>
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                 <div className="md:col-span-8">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Nombre del Producto
                    </label>
                    <input 
                        type="text" 
                        value={productName}
                        onChange={e => setProductName(e.target.value)}
                        placeholder="EJ. LONA PLÁSTICA / CLAVOS"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 font-black text-xl text-slate-700 focus:border-indigo-500 outline-none uppercase"
                    />
                </div>

                <div className="md:col-span-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Tipo de Unidad
                    </label>
                    <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200 h-[60px] items-center">
                        {['UNIT', 'KILO', 'METRO'].map((t) => (
                             <button
                                key={t}
                                type="button"
                                onClick={() => setMeasureType(t)}
                                className={`flex-1 h-full rounded-lg text-xs font-black uppercase transition-all ${
                                    measureType === t
                                    ? 'bg-white text-indigo-600 shadow-md' 
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {t === 'UNIT' ? 'Unidad' : t}
                            </button>
                        ))}
                    </div>
                </div>
             </div>
        </div>

        {/* VARIANTS */}
        <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-2">
                <Layers size={16}/> Configuración de Variantes
            </h3>

            {variants.map((variant, index) => {
                const math = calculateVariantMath(variant);
                
                return (
                    <div key={variant.tempId} className="bg-white rounded-2xl shadow-lg border-l-4 border-indigo-500 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex-1 w-full">
                                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Nombre Variante (Opcional)</label>
                                <input 
                                    type="text" 
                                    value={variant.name}
                                    onChange={e => updateVariant(index, 'name', e.target.value)}
                                    placeholder={measureType === 'UNIT' ? "Ej. Estándar" : (measureType === 'METRO' ? "Ej. Calibre 20" : "Ej. 1 Pulgada")}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-800 focus:border-indigo-500 outline-none text-sm"
                                />
                            </div>

                            {measureType !== 'UNIT' && (
                                <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => updateVariant(index, 'presentation', 'PACK')}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1 transition-all ${variant.presentation === 'PACK' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400'}`}
                                    >
                                        {measureType === 'METRO' ? <Disc size={12}/> : <Box size={12}/>}
                                        {getPackLabel()}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateVariant(index, 'presentation', 'BULK')}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1 transition-all ${variant.presentation === 'BULK' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400'}`}
                                    >
                                        <Layers size={12}/>
                                        Granel
                                    </button>
                                </div>
                            )}

                            <button onClick={() => removeVariant(index)} className="text-rose-400 hover:bg-rose-50 p-2 rounded"><Trash2 size={16}/></button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                            
                            <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {measureType === 'UNIT' ? (
                                    <>
                                        <div>
                                            <label className="label-tiny">Stock Inicial (Und)</label>
                                            <input type="number" value={variant.initialStockUnit} onChange={e => updateVariant(index, 'initialStockUnit', e.target.value)} className="input-compact" />
                                        </div>
                                        <div>
                                            <label className="label-tiny">Costo Unitario (Soles)</label>
                                            <input type="number" value={variant.costInputSoles} onChange={e => updateVariant(index, 'costInputSoles', e.target.value)} className="input-compact" />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {variant.presentation === 'PACK' ? (
                                            <>
                                                <div>
                                                    <label className="label-tiny">{getContentLabel()}</label>
                                                    <input type="number" placeholder={measureType === 'METRO' ? "Ej. 50" : "Ej. 20"} value={variant.contentPerBulto} onChange={e => updateVariant(index, 'contentPerBulto', e.target.value)} className="input-compact" />
                                                </div>
                                                <div>
                                                    <label className="label-tiny">{getCostLabel()}</label>
                                                    <input type="number" placeholder="Ej. 100" value={variant.costInputSoles} onChange={e => updateVariant(index, 'costInputSoles', e.target.value)} className="input-compact" />
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <label className="label-tiny">{getStockLabel()}</label>
                                                    <input type="number" value={variant.qtyBultos} onChange={e => updateVariant(index, 'qtyBultos', e.target.value)} className="input-compact" />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="label-tiny">Costo x {measureType} (Soles)</label>
                                                    <input type="number" value={variant.costInputSoles} onChange={e => updateVariant(index, 'costInputSoles', e.target.value)} className="input-compact" />
                                                </div>
                                                <div>
                                                    <label className="label-tiny">Stock Inicial ({measureType})</label>
                                                    <input type="number" value={variant.qtyBultos} onChange={e => updateVariant(index, 'qtyBultos', e.target.value)} className="input-compact" />
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="md:col-span-4 bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">Costo Base Ref.</span>
                                        <span className="text-xs font-black text-slate-600">R$ {math.calculatedCostBRL.toFixed(2)}</span>
                                    </div>
                                    <label className="label-tiny text-emerald-600">Precio Venta (R$)</label>
                                    <input 
                                        type="number"
                                        value={variant.sellingPriceBRL}
                                        onChange={e => updateVariant(index, 'sellingPriceBRL', e.target.value)}
                                        className="w-full bg-white border-2 border-emerald-100 rounded-lg px-3 py-2 font-black text-emerald-700 focus:border-emerald-500 outline-none text-lg"
                                        placeholder="0.00"
                                    />
                                </div>
                                {math.margin !== 0 && (
                                    <div className={`mt-3 flex items-center gap-1 text-[10px] font-black uppercase ${math.margin > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        <TrendingUp size={12}/> Margen: {math.margin.toFixed(1)}%
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                );
            })}

            <button type="button" onClick={addVariant} className="w-full py-4 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-500 font-black uppercase tracking-widest hover:bg-indigo-50 flex items-center justify-center gap-2">
                <Plus size={20}/> Agregar Medida
            </button>
        </div>

        <div className="pt-6 border-t border-slate-200 flex justify-end gap-4">
             <button type="submit" disabled={loading} className="btn-primary bg-emerald-500 text-white px-8 py-4 rounded-xl font-black uppercase shadow-lg flex items-center gap-2">
                {loading ? <Loader2 className="animate-spin"/> : <Save/>} {loading ? 'Guardando...' : 'Guardar Todo'}
             </button>
        </div>

        <style>{`
            .label-tiny { display: block; font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
            .input-compact { width: 100%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-weight: 700; color: #334155; outline: none; transition: all; font-size: 0.875rem; }
            .input-compact:focus { border-color: #6366f1; background-color: white; }
        `}</style>
      </form>
    </div>
  );
};

export default ProductForm;