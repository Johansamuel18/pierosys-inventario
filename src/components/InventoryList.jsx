import React, { useState, useEffect } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { ChevronDown, ChevronUp, Package, Trash2, Ruler, ArrowRight, History, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

const InventoryList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- LÓGICA DE AGRUPACIÓN (Supabase Flat -> UI Hierarchical) ---
  const processData = (flatData) => {
    if (!flatData) return [];
    
    // Si el servicio ya devuelve jerarquía (localStorage legacy), lo usamos directo.
    if (flatData.length > 0 && flatData[0].variants) return flatData;

    // Si es Supabase (Plano), agrupamos por 'name' o 'id' del producto padre
    const groups = {};
    flatData.forEach(item => {
      // Asumimos que item tiene { id, name, price, stock, sales_unit... }
      // Usamos el nombre como clave de agrupación si no hay un parent_id claro
      const key = item.name; 
      
      if (!groups[key]) {
        groups[key] = {
          id: item.id || Math.random().toString(), // ID del padre
          name: item.name,
          type: item.type || 'producto',
          variants: []
        };
      }
      
      // Convertimos el item plano en una "variante"
      groups[key].variants.push({
        id: item.id, // El ID de la variante es el ID real de la fila en BD
        name: item.variant_name || 'Estándar', // O ajusta según tu DB
        salesUnit: item.sales_unit || 'UND',
        priceSellBRL: parseFloat(item.price_sell_brl || item.price || 0),
        priceBuySoles: parseFloat(item.price_buy_soles || 0), // Si existe en DB
        stock: parseFloat(item.stock_quantity || item.stock || 0),
        batches: [] // Historial vacío por ahora si no viene de DB
      });
    });

    return Object.values(groups);
  };

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await InventoryService.getProducts();
      const hierarchicalData = processData(data);
      setProducts(hierarchicalData);
    } catch (error) {
      console.error("Error cargando inventario:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (id) => {
    if(confirm('¿Seguro que deseas eliminar este producto? Esta acción es irreversible en base de datos.')) {
        try {
            await InventoryService.deleteProduct(id); // Asumiendo que el servicio tiene este método
            refresh();
        } catch (e) {
            alert("Error al eliminar");
        }
    }
  }

  // Filtro
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
      {/* HEADER */}
      <div className="bg-slate-900 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Package className="text-emerald-500" /> Inventario Maestro
            </h2>
            <p className="text-slate-400 text-xs mt-1">
                {loading ? 'Sincronizando...' : `${products.length} Productos Agrupados`}
            </p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
             <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 w-full"
             />
             <button onClick={refresh} className="p-2 bg-slate-800 text-emerald-400 rounded-lg hover:bg-slate-700">
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''}/>
             </button>
        </div>
      </div>

      {/* CONTENIDO */}
      {loading && products.length === 0 ? (
          <div className="p-10 flex justify-center text-slate-400">
              <Loader2 className="animate-spin" size={40}/>
          </div>
      ) : (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-black tracking-wider border-b border-slate-200">
                <tr>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4 text-center">Tipo</th>
                <th className="px-6 py-4 text-center">Variantes</th>
                <th className="px-6 py-4 text-right">Stock Global</th>
                <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredProducts.map(product => {
                const totalStock = product.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
                const isExpanded = expandedId === product.id;

                return (
                    <React.Fragment key={product.id}>
                    <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}>
                        <td className="px-6 py-4 font-bold text-slate-700">{product.name}</td>
                        <td className="px-6 py-4 text-center">
                            <span className="px-2 py-1 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-600">
                                {product.type}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                                {product.variants.length} Opciones
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <span className="font-black text-slate-700">
                                {totalStock.toFixed(2)}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center flex justify-center gap-2">
                            <button 
                                onClick={() => setExpandedId(isExpanded ? null : product.id)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            <button 
                                onClick={() => handleDelete(product.id)}
                                className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </td>
                    </tr>
                    
                    {/* EXPANDED ROW (DETALLE VARIANTES) */}
                    {isExpanded && (
                        <tr>
                            <td colSpan={5} className="px-6 py-6 bg-slate-50 border-b border-slate-200 shadow-inner">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <Ruler size={14}/> Desglose de Stock
                                    </h4>
                                    {product.variants.map((variant, idx) => (
                                        <div key={variant.id || idx} className="bg-white rounded-xl border border-slate-200 p-3 flex justify-between items-center shadow-sm">
                                            <div>
                                                <span className="font-bold text-slate-700 text-sm block">
                                                    {variant.name}
                                                </span>
                                                <div className="flex gap-2 text-[10px] mt-1">
                                                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                                        Venta: R$ {variant.priceSellBRL.toFixed(2)}
                                                    </span>
                                                    {variant.priceBuySoles > 0 && (
                                                        <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
                                                            Ref. Compra: S/ {variant.priceBuySoles.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="block font-black text-lg text-emerald-600">
                                                    {(variant.stock || 0).toFixed(2)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 uppercase font-bold">
                                                    {variant.salesUnit}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
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
  );
};

export default InventoryList;