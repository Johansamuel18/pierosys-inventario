import React, { useEffect, useState } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { BarChart3, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const Reports = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('all');

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        const allSales = await InventoryService.fetchSales();
        setSales(allSales.sort((a,b) => b.timestamp - a.timestamp));
        setLoading(false);
    };
    loadData();
  }, []);

  const filteredSales = sales.filter(s => {
    if (filterDate === 'all') return true;
    const date = new Date(s.timestamp);
    const today = new Date();
    if (filterDate === 'today') {
      return date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
    }
    return true; 
  });

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredSales.map(s => ({
        ID: s.id,
        Fecha: new Date(s.timestamp).toLocaleDateString(),
        Producto: s.productName,
        Variante: s.variantName || '-',
        Cantidad: s.quantity,
        'Venta Total (R$)': s.salePriceTotalBRL,
        'Costo Histórico (R$)': s.historicalCostTotalBRL,
        'Ganancia Neta (R$)': s.grossProfitBRL,
        'Margen %': s.marginPercent.toFixed(2)
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ganancias");
    XLSX.writeFile(wb, "Reporte_Piero.xlsx");
  };

  const totalRevenue = filteredSales.reduce((a, s) => a + (s.salePriceTotalBRL || 0), 0);
  const totalProfit = filteredSales.reduce((a, s) => a + (s.grossProfitBRL || 0), 0);

  if (loading) return <div className="p-10 flex justify-center text-slate-400"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-black text-slate-800 tracking-tight">Reporte de Ganancias</h2>
           <p className="text-slate-500">Análisis detallado de rentabilidad (Venta vs Costo Congelado).</p>
        </div>
        <button 
          onClick={exportToExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg"
        >
          <Download size={18} /> Exportar Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg">
           <span className="text-indigo-200 text-xs font-black uppercase tracking-widest">Ingresos Totales (Periodo)</span>
           <span className="block text-4xl font-black mt-2">R$ {totalRevenue.toFixed(2)}</span>
        </div>
        <div className="bg-emerald-500 text-white p-6 rounded-2xl shadow-lg">
           <span className="text-emerald-100 text-xs font-black uppercase tracking-widest">Utilidad Neta Real</span>
           <span className="block text-4xl font-black mt-2">R$ {totalProfit.toFixed(2)}</span>
           <span className="text-emerald-100 text-sm font-bold mt-1">Margen Global: {totalRevenue ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0}%</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-white uppercase text-xs font-black tracking-wider">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Variante</th>
                <th className="px-6 py-4 text-right">Cant.</th>
                <th className="px-6 py-4 text-right">Venta (R$)</th>
                <th className="px-6 py-4 text-right text-orange-300">Costo Hist. (R$)</th>
                <th className="px-6 py-4 text-right text-emerald-400">Ganancia</th>
                <th className="px-6 py-4 text-right">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-500 text-xs font-bold">
                    {new Date(sale.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{sale.productName}</td>
                  <td className="px-6 py-4 text-xs font-bold text-indigo-600 uppercase">{sale.variantName || '-'}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{sale.quantity.toFixed(3)}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-800">
                    R$ {(sale.salePriceTotalBRL || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-400">
                    R$ {(sale.historicalCostTotalBRL || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-emerald-600">
                    R$ {(sale.grossProfitBRL || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-xs font-black px-2 py-1 rounded ${sale.marginPercent > 30 ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                      {(sale.marginPercent || 0).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;