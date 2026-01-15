import React, { useState, useEffect } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { Truck, Calculator, RefreshCw, Package, DollarSign, Archive, Box, Layers, Loader2, AlertTriangle } from 'lucide-react';

const SupplyForm = () => {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  
  // Modos de operación
  const [supplyMode, setSupplyMode] = useState('PACK'); 
  
  // Inputs
  const [inputQty, setInputQty] = useState('');   
  const [inputMoney, setInputMoney] = useState(''); 

  // Datos derivados
  const [rate, setRate] = useState(1.6);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

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

  const selectedItem = products.find(p => p.id == selectedProductId); // Nota: Doble igual por si tipo string/number

  const calculateMath = () => {
      if (!selectedItem) return { totalStockToAdd: 0, realUnitCostSoles: 0, frozenBRL: 0, totalInvestment: 0 };

      // Buscar variante por defecto si es lista plana o primera variante si es anidada
      // Asumimos estructura plana enriquecida del servicio
      const conversionFactor = selectedItem.conversionFactor || selectedItem.variants?.[0]?.conversionFactor || 1;
      
      const qty = parseFloat(inputQty) || 0;
      const moneySoles = parseFloat(inputMoney) || 0;
      
      const factor = supplyMode === 'PACK' ? conversionFactor : 1;
      const totalStockToAdd = qty * factor;
      
      // Costo Unitario de lo que ingresa
      const unitCostOfInput = parseFloat(inputMoney) || 0;
      const realUnitCostSoles = supplyMode === 'PACK' ? (unitCostOfInput / factor) : unitCostOfInput;
      
      const frozenBRL = realUnitCostSoles * rate;
      const totalInvestment = unitCostOfInput * qty;

      return { totalStockToAdd, realUnitCostSoles, frozenBRL, totalInvestment };
  };

  const math = calculateMath();

  const handleSubmit = async (e) => {
      e.preventDefault();
      if (!selectedProductId) return;
      
      setProcessing(true);
      try {
          // Si selectedItem tiene variants (estructura anidada), tomamos la primera
          const variantId = selectedItem.variants && selectedItem.variants.length > 0 ? selectedItem.variants[0].id : selectedItem.id;
          const conversionFactor = selectedItem.conversionFactor || selectedItem.variants?.[0]?.conversionFactor || 1;

          await InventoryService.addSupply(
              selectedItem.id, // ID Producto
              variantId,       // ID Variante
              parseFloat(inputQty), 
              supplyMode === 'PACK' ? 'CAJA' : 'UNIDAD',
              supplyMode === 'PACK' ? conversionFactor : 1,
              parseFloat(inputMoney)
          );
          
          alert("Abastecimiento registrado correctamente.");
          setInputQty('');
          setInputMoney('');
      } catch (err) {
          console.error(err);
          alert("Error: " + err.message);
      } finally {
          setProcessing(false);
      }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline"/> Cargando productos...</div>;

  if (products.length === 0) return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
          <Package size={64} className="mb-4 opacity-20"/>
          <h3 className="text-xl font-black uppercase tracking-widest text-slate-600">Sin Productos</h3>
          <p className="max-w-md text-center mt-2">No hay productos registrados en la base de datos o hubo un error de conexión.</p>
          <div className="mt-6 p-4 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={16}/> 
            Ve a la pestaña "Nuevo Producto" para crear uno primero.
          </div>
      </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
            <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-200 text-white">
                <Truck size={32} />
            </div>
            <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Abastecimiento</h2>
                <p className="text-slate-500 font-medium">Entrada de mercancía y fijación de costos.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Package size={16}/> Paso 1: Selección
                    </h3>
                    <div>
                        <label className="block text-xs font-black text-indigo-500 uppercase tracking-widest mb-2">Producto</label>
                        <select 
                            value={selectedProductId}
                            onChange={e => setSelectedProductId(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 font-bold text-slate-700 outline-none"
                        >
                            <option value="">-- Seleccione --</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedItem && (
                    <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Archive size={16}/> Paso 2: Datos de Entrada
                        </h3>

                        <div className="bg-slate-100 p-1.5 rounded-xl flex gap-2 mb-6 border border-slate-200">
                            <button
                                onClick={() => setSupplyMode('PACK')}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                                    supplyMode === 'PACK' 
                                    ? 'bg-white text-indigo-600 shadow-md' 
                                    : 'text-slate-400'
                                }`}
                            >
                                <Box size={16}/> Por Caja/Bulto
                            </button>
                            <button
                                onClick={() => setSupplyMode('BULK')}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                                    supplyMode === 'BULK' 
                                    ? 'bg-white text-indigo-600 shadow-md' 
                                    : 'text-slate-400'
                                }`}
                            >
                                <Layers size={16}/> Unidad/Granel
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                    Cantidad
                                </label>
                                <input 
                                    type="number"
                                    value={inputQty}
                                    onChange={e => setInputQty(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 font-black text-slate-800 text-xl outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                    Costo {supplyMode === 'PACK' ? 'por Caja' : 'Unitario'} (S/)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-5 text-slate-400 font-black">S/</span>
                                    <input 
                                        type="number"
                                        value={inputMoney}
                                        onChange={e => setInputMoney(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-10 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 font-black text-slate-800 text-xl outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="lg:col-span-5 space-y-6">
                 <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col h-full">
                    {selectedItem ? (
                        <>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 pointer-events-none"></div>

                            <div className="relative z-10 flex-1">
                                <h3 className="font-black uppercase tracking-widest text-emerald-400 mb-8 flex items-center gap-2">
                                    <Calculator size={20}/> Simulación Financiera
                                </h3>
                                <div className="space-y-6">
                                    <div className="bg-slate-800/50 p-4 rounded-xl flex justify-between items-center">
                                        <span className="text-xs font-bold uppercase text-slate-400">Tasa de Cambio</span>
                                        <span className="text-white font-black">S/ 1.00 = R$ {rate.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                        <div>
                                            <span className="block text-xs font-black text-slate-500 uppercase mb-1">Stock a Ingresar</span>
                                            <span className="text-3xl font-black text-white">{math.totalStockToAdd.toFixed(2)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[10px] font-bold text-slate-500 uppercase">Inversión</span>
                                            <span className="text-lg font-bold text-slate-300">S/ {math.totalInvestment.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden">
                                        <span className="block text-xs font-black text-emerald-400 uppercase tracking-widest mb-1">Costo Unitario (BRL)</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-black text-white tracking-tighter">R$ {math.frozenBRL.toFixed(3)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleSubmit}
                                disabled={processing}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-5 rounded-2xl shadow-lg shadow-emerald-900/30 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wider mt-8 relative z-10"
                            >
                                {processing ? <Loader2 className="animate-spin"/> : <RefreshCw size={24} />}
                                {processing ? 'Procesando...' : 'Confirmar Ingreso'}
                            </button>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 opacity-50">
                            <Truck size={48} className="mb-4"/>
                            <p className="font-bold uppercase text-sm">Seleccione Producto</p>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    </div>
  );
};

export default SupplyForm;