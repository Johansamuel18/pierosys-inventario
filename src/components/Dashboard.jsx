import React, { useMemo, useState, useEffect } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { DollarSign, Package, TrendingUp, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState({
      totalInventoryValueBRL: 0,
      totalSalesTodayBRL: 0,
      totalProfitTodayBRL: 0,
      lowStockCount: 0,
      restockCostBRL: 0,
      lowStockItems: [] // Inicializamos la lista
  });
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLowStockOpen, setIsLowStockOpen] = useState(false); // Estado para la ventanita

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const dashboardStats = await InventoryService.fetchDashboardStats();
            // Usamos fetchTransactions para tener datos completos (profit/revenue) y consistencia con Reportes
            const salesData = await InventoryService.fetchTransactions();
            
            // CÁLCULO MANUAL DE "HOY" USANDO ZONA HORARIA LIMA-PERU
            const options = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
            const formatter = new Intl.DateTimeFormat('en-CA', options); // Formato YYYY-MM-DD
            const todayPeru = formatter.format(new Date());

            let salesToday = 0;
            let profitToday = 0;

            salesData.forEach(sale => {
                const saleDate = new Date(sale.timestamp);
                const saleDatePeru = formatter.format(saleDate);
                
                if (saleDatePeru === todayPeru) {
                    salesToday += (sale.totalRevenue || sale.salePriceTotalBRL || 0);
                    profitToday += (sale.totalProfit || 0);
                }
            });

            // Sobrescribimos los datos del backend con el cálculo local preciso
            setStats({
                ...dashboardStats,
                totalSalesTodayBRL: salesToday,
                totalProfitTodayBRL: profitToday
            });
            setSales(salesData);
        } catch (e) {
            console.error("Error loading dashboard", e);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, []);

  // Prepare chart data (Last 7 days)
  const chartData = useMemo(() => {
    const data = {};
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toLocaleDateString('es-BR', { weekday: 'short' });
      data[key] = 0;
    }

    sales.forEach(sale => {
      const date = new Date(sale.timestamp);
      const diffTime = Math.abs(today.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays <= 7) {
        const key = date.toLocaleDateString('es-BR', { weekday: 'short' });
        if (data[key] !== undefined) {
          data[key] += (sale.totalRevenue || sale.salePriceTotalBRL || 0);
        }
      }
    });

    return Object.entries(data).map(([name, total]) => ({ name, total: parseFloat(total.toFixed(2)) }));
  }, [sales]);

  const StatCard = ({ title, value, sub, icon: Icon, color, onClick, className }) => (
    <div onClick={onClick} className={`bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex items-center justify-between transition-transform hover:-translate-y-1 ${className || ''}`}>
      <div>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-800">{loading ? '...' : value}</h3>
        {sub && <p className={`text-[10px] font-bold mt-1 text-${color}-500`}>{sub}</p>}
      </div>
      <div className={`p-4 rounded-xl bg-${color}-50 text-${color}-600`}>
        <Icon size={28} />
      </div>
    </div>
  );

  return (
    // CAMBIO: Altura dinámica y scroll interno para móvil
    <div className="space-y-8 h-[calc(100dvh-150px)] md:h-auto overflow-y-auto md:overflow-visible pb-20 md:pb-0 scrollbar-hide">
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Centro de Comando</h2>
        <p className="text-slate-500">
            {loading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={14}/> Sincronizando con Supabase...</span> : 'Resumen financiero y logístico en tiempo real.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Ventas Hoy" 
          value={`R$ ${stats.totalSalesTodayBRL.toFixed(2)}`} 
          sub="Ingreso Bruto"
          icon={DollarSign}
          color="emerald"
        />
        <StatCard 
          title="Ganancia Neta" 
          value={`R$ ${stats.totalProfitTodayBRL.toFixed(2)}`} 
          sub="Utilidad Real (Post-Costo)"
          icon={TrendingUp}
          color="indigo"
        />
        <StatCard 
          title="Valor Inventario" 
          value={`R$ ${stats.totalInventoryValueBRL.toFixed(2)}`} 
          sub="Costo Congelado"
          icon={Package}
          color="slate"
        />
        
        {/* TARJETA INTERACTIVA DE STOCK BAJO */}
        <div className="relative z-20">
            <StatCard 
              title="Stock Bajo" 
              value={stats.lowStockCount} 
              sub={
                stats.lowStockCount > 0 
                ? (
                    <span className="flex items-center gap-1 cursor-pointer hover:underline">
                        {stats.lowStockItems?.[0]?.name}
                        {stats.lowStockCount > 1 && <span className="opacity-70 font-normal"> +{stats.lowStockCount - 1}</span>}
                        <ChevronDown size={10}/>
                    </span>
                ) 
                : "Todo en orden"
              }
              icon={AlertTriangle}
              color="orange"
              onClick={() => stats.lowStockCount > 0 && setIsLowStockOpen(!isLowStockOpen)}
              className={stats.lowStockCount > 0 ? "cursor-pointer ring-2 ring-transparent hover:ring-orange-100" : ""}
            />

            {/* VENTANITA DESPLEGABLE */}
            {isLowStockOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Atención Requerida</span>
                        <button onClick={() => setIsLowStockOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Cerrar</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                        {stats.lowStockItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 hover:bg-orange-50 rounded-lg transition-colors border-b border-slate-50 last:border-0">
                                <div className="flex-1 min-w-0 mr-3">
                                    <p className="text-xs font-bold text-slate-700 truncate" title={item.name}>{item.name}</p>
                                    <p className="text-[9px] text-slate-400 font-medium">Mínimo requerido: <span className="text-slate-600">{item.min}</span></p>
                                </div>
                                <div className="text-right bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">
                                    <span className="block text-xs font-black text-rose-500">{parseFloat(item.stock.toFixed(2))}</span>
                                    <span className="text-[8px] text-slate-400 font-bold uppercase">Stock</span>
                                </div>
                            </div>
                        ))}
                        {stats.lowStockCount > stats.lowStockItems.length && (
                            <p className="text-center text-[9px] text-slate-400 py-2 italic bg-slate-50">
                                ... y {stats.lowStockCount - stats.lowStockItems.length} productos más
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 h-96">
        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase tracking-wider">Flujo de Ventas (7 Días)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value}`} />
            <Tooltip 
              cursor={{fill: '#f1f5f9'}}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
            />
            <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;