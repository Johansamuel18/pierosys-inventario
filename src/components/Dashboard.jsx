import React, { useMemo, useState, useEffect } from 'react';
import { InventoryService } from '../services/inventoryService.js';
import { DollarSign, Package, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState({
      totalInventoryValueBRL: 0,
      totalSalesTodayBRL: 0,
      totalProfitTodayBRL: 0,
      lowStockCount: 0
  });
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        try {
            const dashboardStats = await InventoryService.fetchDashboardStats();
            const salesData = await InventoryService.fetchSales();
            setStats(dashboardStats);
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
          data[key] += (sale.salePriceTotalBRL || 0);
        }
      }
    });

    return Object.entries(data).map(([name, total]) => ({ name, total }));
  }, [sales]);

  const StatCard = ({ title, value, sub, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex items-center justify-between transition-transform hover:-translate-y-1">
      <div>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-800">{loading ? '...' : value}</h3>
        {sub && <p className={`text-xs font-bold mt-1 ${color === 'rose' ? 'text-rose-500' : 'text-emerald-500'}`}>{sub}</p>}
      </div>
      <div className={`p-4 rounded-xl bg-${color}-50 text-${color}-600`}>
        <Icon size={28} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
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
        <StatCard 
          title="Alertas Stock" 
          value={stats.lowStockCount} 
          sub="Productos críticos"
          icon={AlertTriangle}
          color="rose"
        />
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