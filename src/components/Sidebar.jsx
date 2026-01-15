import React from 'react';
import { LayoutDashboard, PackagePlus, Truck, ShoppingCart, BarChart3, Settings, Boxes } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, currentRate, onRateChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sales', label: 'Ventas', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventario', icon: Boxes },
    { id: 'supply', label: 'Abastecimiento', icon: Truck },
    { id: 'products', label: 'Nuevo Producto', icon: PackagePlus },
    { id: 'reports', label: 'Ganancias', icon: BarChart3 },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col h-full shadow-2xl z-50">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-black tracking-widest text-emerald-400">PIERO<span className="text-white">SYS</span></h1>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">Gestión Comercial</p>
      </div>

      <div className="flex-1 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-6 py-3 transition-all duration-200 border-l-4 ${
                isActive 
                  ? 'bg-slate-800 border-emerald-500 text-emerald-400' 
                  : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={20} className="mr-3" />
              <span className="font-bold text-sm uppercase tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-6 border-t border-slate-700 bg-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
            <Settings size={12} /> Tasa Cambio (S/ → R$)
          </span>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-600">
          <span className="text-emerald-500 font-bold">1 S/ =</span>
          <input 
            type="number" 
            step="0.01"
            value={currentRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="w-full bg-transparent text-white font-bold outline-none text-right"
          />
          <span className="text-slate-500 text-sm">Reales</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;