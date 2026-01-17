import React, { useEffect, useState } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { BarChart3, Download, Loader2, ChevronDown, ChevronUp, User, Calendar, DollarSign, TrendingUp, Package } from 'lucide-react';
import * as XLSX from 'xlsx';

const Reports = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Helper para mostrar números limpios (3.000 -> 3)
  const formatQty = (num) => Number(parseFloat(num).toFixed(3));

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        const data = await InventoryService.fetchTransactions();
        setTransactions(data);
        setLoading(false);
    };
    loadData();
  }, []);

  const toggleExpand = (id) => {
      setExpandedId(expandedId === id ? null : id);
  };

  const exportToExcel = () => {
    // Aplanar transacciones para excel
    const flatData = [];
    transactions.forEach(t => {
        t.items.forEach(item => {
            flatData.push({
                'ID Venta': t.id,
                'Cliente': t.clientName,
                'Fecha': new Date(t.timestamp).toLocaleDateString(),
                'Producto': item.productName,
                'Variante': item.variantName,
                'Cantidad': formatQty(item.quantity),
                'Subtotal (R$)': item.subtotal.toFixed(2)
            });
        });
    });

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial_Ventas");
    XLSX.writeFile(wb, "Reporte_Ventas_Agrupado.xlsx");
  };

  const totalRevenue = transactions.reduce((a, t) => a + (t.totalRevenue || 0), 0);
  const totalProfit = transactions.reduce((a, t) => a + (t.totalProfit || 0), 0);

  if (loading) return <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <div className="space-y-8 pb-20">
      
      {/* HEADER DASHBOARD */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">Historial de Ventas</h2>
           <p className="text-slate-500">Registro detallado de transacciones por cliente.</p>
        </div>
        <button 
          onClick={exportToExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95"
        >
          <Download size={20} /> Exportar Excel
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-xl shadow-indigo-200">
           <span className="text-indigo-200 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <DollarSign size={14}/> Ingresos Totales
           </span>
           <span className="block text-5xl font-black mt-4 tracking-tight">R$ {totalRevenue.toFixed(2)}</span>
           <span className="block text-indigo-200 mt-2 text-sm font-medium">{transactions.length} Transacciones registradas</span>
        </div>
        <div className="bg-emerald-500 text-white p-8 rounded-3xl shadow-xl shadow-emerald-200">
           <span className="text-emerald-100 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={14}/> Utilidad Neta Real
           </span>
           <span className="block text-5xl font-black mt-4 tracking-tight">R$ {totalProfit.toFixed(2)}</span>
           <span className="text-emerald-100 text-sm font-bold mt-2 inline-block bg-emerald-600/30 px-3 py-1 rounded-full">
               Margen Global: {totalRevenue ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0}%
           </span>
        </div>
      </div>

      {/* LISTA DE TRANSACCIONES */}
      <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Últimos Movimientos</h3>
          
          {transactions.length === 0 ? (
              <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100">
                  <Package size={48} className="mx-auto mb-4 opacity-20"/>
                  <p>No hay ventas registradas aún.</p>
              </div>
          ) : (
              transactions.map(sale => {
                  const isExpanded = expandedId === sale.id;
                  const date = new Date(sale.timestamp);
                  
                  return (
                    <div key={sale.id} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'shadow-xl border-indigo-200 ring-2 ring-indigo-50' : 'shadow-sm border-slate-100 hover:border-indigo-100 hover:shadow-md'}`}>
                        
                        {/* HEADER DE LA TARJETA (Clickable) */}
                        <div 
                            onClick={() => toggleExpand(sale.id)}
                            className="p-6 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${isExpanded ? 'bg-indigo-500' : 'bg-slate-200 text-slate-500'}`}>
                                    {sale.clientName.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-700 text-lg uppercase flex items-center gap-2">
                                        {sale.clientName}
                                    </h4>
                                    <div className="flex items-center gap-3 text-xs font-medium text-slate-400 mt-1">
                                        <span className="flex items-center gap-1"><Calendar size={12}/> {date.toLocaleDateString()}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                        <span>{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                <div className="text-right">
                                    <span className="block text-[10px] font-black uppercase text-slate-400">Total Venta</span>
                                    <span className="block text-xl font-black text-slate-800">R$ {sale.totalRevenue.toFixed(2)}</span>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <span className="block text-[10px] font-black uppercase text-emerald-500">Ganancia</span>
                                    <span className="block text-xl font-black text-emerald-500">R$ {sale.totalProfit.toFixed(2)}</span>
                                </div>
                                <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-500' : 'text-slate-300'}`}>
                                    <ChevronDown size={24}/>
                                </div>
                            </div>
                        </div>

                        {/* DETALLE EXPANDIBLE (Acordeón) */}
                        {isExpanded && (
                            <div className="bg-slate-50 border-t border-indigo-100 animate-in slide-in-from-top-2">
                                <div className="p-4 md:p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h5 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                            <Package size={14}/> Detalle de Productos
                                        </h5>
                                        {/* Ganancia visible en móvil dentro del detalle */}
                                        <div className="sm:hidden text-right">
                                            <span className="text-[10px] font-black uppercase text-emerald-500 mr-2">Ganancia:</span>
                                            <span className="font-black text-emerald-600">R$ {sale.totalProfit.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-4 py-3">Producto</th>
                                                    <th className="px-4 py-3 text-right">Cantidad</th>
                                                    <th className="px-4 py-3 text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {sale.items.map((item, idx) => (
                                                    <tr key={item.id || idx} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">
                                                            <div className="font-bold text-slate-700 text-sm">{item.productName}</div>
                                                            <div className="text-[10px] font-black text-indigo-400 uppercase">{item.variantName}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-slate-600">
                                                            {formatQty(item.quantity)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-black text-slate-800">
                                                            R$ {item.subtotal.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                  );
              })
          )}
      </div>
    </div>
  );
};

export default Reports;