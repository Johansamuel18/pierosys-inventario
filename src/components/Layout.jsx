import React, { useState } from 'react';
import { LayoutDashboard, PackagePlus, Truck, ShoppingCart, BarChart3, Settings, Boxes, Menu, ChevronDown, ChevronUp } from 'lucide-react';

const Layout = ({ children, activeTab, setActiveTab, currentRate, onRateChange }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Inicio', icon: LayoutDashboard },
    { id: 'sales', label: 'Vender', mobileLabel: 'Venta', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventario', mobileLabel: 'Stock', icon: Boxes },
    { id: 'supply', label: 'Abastecimiento', mobileLabel: 'Compra', icon: Truck },
    { id: 'products', label: 'Nuevo Prod.', mobileLabel: 'Nuevo', icon: PackagePlus },
    { id: 'reports', label: 'Reportes', mobileLabel: 'Reporte', icon: BarChart3 },
  ];

  // En móvil mostramos TODOS los ítems. Usamos grid para distribuirlos.
  const mobileMenuItems = menuItems;

  const activeItem = menuItems.find(i => i.id === activeTab) || menuItems[0];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* =======================================================
          1. SIDEBAR (DESKTOP ONLY) - md:flex hidden
         ======================================================= */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col h-full shadow-2xl z-50 shrink-0 transition-all">
        {/* Logo Area */}
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-black tracking-widest text-emerald-400">PIERO<span className="text-white">SYS</span></h1>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Gestión Comercial v2.0</p>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-6 py-4 transition-all duration-200 border-l-4 group ${
                  isActive 
                    ? 'bg-slate-800 border-emerald-500 text-emerald-400' 
                    : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} className={`mr-3 transition-transform group-hover:scale-110 ${isActive ? 'text-emerald-400' : ''}`} />
                <span className="font-bold text-sm uppercase tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Desktop Tasa Cambio */}
        <div className="p-6 border-t border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-2">
              <Settings size={12} /> Tasa Cambio
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-600 focus-within:border-emerald-500 transition-colors">
            <span className="text-emerald-500 font-bold text-xs">S/1 =</span>
            <input 
              type="number" 
              step="0.01"
              value={currentRate}
              onChange={(e) => onRateChange(parseFloat(e.target.value))}
              className="w-full bg-transparent text-white font-bold outline-none text-right text-sm"
            />
            <span className="text-slate-500 text-[10px] uppercase font-bold">R$</span>
          </div>
        </div>
      </aside>


      {/* =======================================================
          2. MAIN CONTENT WRAPPER
         ======================================================= */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        
        {/* MOBILE HEADER (Sticky) - md:hidden */}
        <header className="md:hidden sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md text-white p-4 shadow-lg flex justify-between items-center transition-all border-b border-slate-800">
            <div className="flex items-center gap-3">
                {/* Botón para colapsar/expandir menú */}
                <button 
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="bg-slate-800 p-2 rounded-lg text-emerald-400 border border-slate-700 active:scale-95 transition-transform hover:bg-slate-700"
                >
                  {isMobileMenuOpen ? <ChevronDown size={20} /> : <Menu size={20} />}
                </button>

                <div>
                    <h1 className="font-black tracking-widest text-emerald-400 text-lg leading-tight">PIERO<span className="text-white">SYS</span></h1>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        {activeItem.label}
                    </p>
                </div>
            </div>
            
            {/* Mobile Rate Input (Compact) */}
            <div className="flex items-center gap-1 bg-slate-800 px-3 py-2 rounded-lg border border-slate-600 shadow-inner">
                <span className="text-emerald-500 font-bold text-xs">S/</span>
                <input 
                  type="number" 
                  value={currentRate}
                  onChange={(e) => onRateChange(parseFloat(e.target.value))}
                  className="w-12 bg-transparent text-white font-bold text-sm outline-none text-center"
                />
            </div>
        </header>

        {/* CONTENT SCROLLABLE AREA */}
        <main 
          className={`flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth transition-all duration-300 ${
            isMobileMenuOpen ? 'pb-24' : 'pb-6'
          } md:pb-10`}
        >
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION (Fixed) - md:hidden */}
        <nav 
          className={`md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-50 transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
            {/* Usamos GRID con 6 columnas para que quepan todos los items. 
                min-w-0 permite que el texto se trunque si es necesario, aunque con etiquetas cortas entra bien. */}
            <div className="grid grid-cols-6 h-full px-1 pb-safe">
                {mobileMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex flex-col items-center justify-center py-2 min-w-0 transition-all active:scale-95 ${
                                isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <div className={`p-1.5 rounded-xl mb-0.5 transition-all ${
                                isActive ? 'bg-emerald-50 translate-y-[-2px] shadow-sm' : ''
                            }`}>
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tight truncate w-full text-center px-0.5 ${
                                isActive ? 'opacity-100' : 'opacity-70'
                            }`}>
                                {item.mobileLabel}
                            </span>
                        </button>
                    )
                })}
            </div>
        </nav>

      </div>
    </div>
  );
};

export default Layout;