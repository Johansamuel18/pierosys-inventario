import React, { useState, useEffect } from 'react';
import { LayoutDashboard, PackagePlus, Truck, ShoppingCart, BarChart3, Settings, Boxes, Database, Menu, Bot, Bell, BellOff } from 'lucide-react';

const Layout = ({ children, activeTab, setActiveTab, currentRate, onRateChange }) => {
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Inicio', icon: LayoutDashboard },
    { id: 'sales', label: 'Vender', mobileLabel: 'Venta', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventario', mobileLabel: 'Stock', icon: Boxes },
    { id: 'supply', label: 'Abastecer', mobileLabel: 'Compra', icon: Truck },
    { id: 'products', label: 'Nuevo Prod.', mobileLabel: 'Crear', icon: PackagePlus },
    { id: 'reports', label: 'Reportes', mobileLabel: 'Reportes', icon: BarChart3 },
    { id: 'ai-assistant', label: 'Piero AI', mobileLabel: 'IA', icon: Bot },
  ];

  const activeItem = menuItems.find(i => i.id === activeTab) || (activeTab === 'settings' ? {label: 'Configuración', mobileLabel: 'Config'} : menuItems[0]);

  // Estado de permisos de notificación
  const [notifPermission, setNotifPermission] = useState(Notification.permission);

  const requestNotification = async () => {
    if (!("Notification" in window)) return alert("Tu navegador no soporta notificaciones.");
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === 'granted') {
      new Notification("🔔 Notificaciones Activadas", { body: "Te avisaremos cuando se registre una venta." });
    }
  };

  return (
    // Usamos dvh (Dynamic Viewport Height) para solucionar problemas de scroll en móviles iOS/Android
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* =======================================================
          1. SIDEBAR (SOLO DESKTOP) - Estilo Pro
         ======================================================= */}
      <aside className="hidden md:flex w-72 bg-slate-900 text-white flex-col h-full shadow-2xl z-50 shrink-0 transition-all border-r border-slate-800">
        {/* Logo Area */}
        <div className="p-8 border-b border-slate-800/50">
          <h1 className="text-3xl font-black tracking-widest text-emerald-400 leading-none">PIERO<span className="text-white">SYS</span></h1>
          <div className="flex items-center gap-2 mt-2 opacity-50">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <p className="text-[10px] uppercase tracking-[0.2em] font-bold">Sistema Activo</p>
          </div>
        </div>

        {/* Menu Items Desktop */}
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-5 py-4 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-400 rounded-r-full"></div>}
                <Icon size={22} className={`mr-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-white'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`font-bold text-sm uppercase tracking-wide ${isActive ? 'text-white' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Desktop Settings */}
        <div className="p-6 bg-slate-900/50 backdrop-blur-sm border-t border-slate-800">
          <div className="flex items-center justify-between mb-3">
            {/* Botón Notificaciones Desktop */}
            <button 
                onClick={requestNotification}
                className={`text-[10px] font-black uppercase flex items-center gap-2 transition-colors tracking-widest ${notifPermission === 'granted' ? 'text-emerald-500' : 'text-slate-500 hover:text-white'}`}
                title={notifPermission === 'granted' ? 'Notificaciones Activas' : 'Activar Notificaciones'}
            >
              {notifPermission === 'granted' ? <Bell size={14} /> : <BellOff size={14} />} {notifPermission === 'granted' ? 'Alertas ON' : 'Alertas OFF'}
            </button>
            <button 
                onClick={() => setActiveTab('settings')}
                className={`text-[10px] font-black uppercase flex items-center gap-2 hover:text-white transition-colors tracking-widest ${activeTab === 'settings' ? 'text-emerald-400' : 'text-slate-500'}`}
            >
              <Settings size={14} /> Configuración
            </button>
          </div>
          <div className="flex items-center gap-3 bg-black/30 p-3 rounded-xl border border-white/5 focus-within:border-emerald-500/50 transition-colors">
            <span className="text-emerald-500 font-black text-xs">S/ 1.00 =</span>
            <input 
              type="number" 
              step="0.01"
              value={currentRate}
              onChange={(e) => onRateChange(parseFloat(e.target.value))}
              className="w-full bg-transparent text-white font-black outline-none text-right text-sm"
            />
            <span className="text-slate-600 text-[10px] uppercase font-black">Reales</span>
          </div>
        </div>
      </aside>


      {/* =======================================================
          2. MAIN CONTENT WRAPPER
         ======================================================= */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50">
        
        {/* MOBILE HEADER (Sticky Glassmorphism) */}
        <header className="md:hidden flex-none sticky top-0 z-40 px-4 py-3 flex justify-between items-center transition-all bg-slate-900/95 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/5">
            <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                    <span className="text-emerald-400 font-black text-lg leading-none">P</span>
                </div>
                <div>
                    <h1 className="font-black tracking-wider text-white text-base leading-none">PIERO<span className="text-slate-500">SYS</span></h1>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 fade-in">
                        {activeItem.label}
                    </p>
                </div>
            </div>
            
            {/* Mobile Notification Toggle */}
            <button 
              onClick={requestNotification}
              className={`p-2.5 rounded-xl border transition-all active:scale-95 mr-2 ${notifPermission === 'granted' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
            >
                {notifPermission === 'granted' ? <Bell size={18}/> : <BellOff size={18}/>}
            </button>
            {/* Mobile Settings Shortcut */}
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`p-2.5 rounded-xl border transition-all active:scale-95 ${activeTab === 'settings' ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
            >
                <Database size={18}/>
            </button>
        </header>

        {/* CONTENT SCROLLABLE AREA */}
        {/* pb-[120px] asegura que el contenido final nunca quede tapado por la barra de navegación */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-10 pb-[120px] md:pb-10 scroll-smooth">
          <div className="max-w-7xl mx-auto h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION (Premium Dock) */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50 pb-safe">
            <div className="flex justify-around items-center h-[70px] px-2 max-w-md mx-auto">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className="group flex flex-col items-center justify-center w-full h-full relative"
                        >
                            <div className={`
                                p-2 rounded-2xl mb-1 transition-all duration-300 ease-out relative z-10
                                ${isActive 
                                    ? '-translate-y-1.5 bg-slate-900 text-emerald-400 shadow-lg shadow-emerald-500/20 scale-110' 
                                    : 'text-slate-400 group-active:scale-95 bg-transparent'
                                }
                            `}>
                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            
                            <span className={`
                                text-[9px] font-black uppercase tracking-tight text-center leading-none transition-all duration-300 absolute bottom-1.5
                                ${isActive 
                                    ? 'opacity-100 text-slate-900 translate-y-0' 
                                    : 'opacity-0 text-slate-400 translate-y-2'
                                }
                            `}>
                                {item.mobileLabel}
                            </span>
                            
                            {/* Indicador de toque */}
                            {!isActive && <span className="absolute bottom-2 w-1 h-1 rounded-full bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"></span>}
                        </button>
                    )
                })}
            </div>
            {/* Safe Area Spacer for iPhone Home Bar */}
            <div className="h-safe-bottom w-full bg-transparent"></div>
        </nav>

      </div>
      
      <style>{`
        /* Utilidad para safe area en móviles */
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .h-safe-bottom { height: env(safe-area-inset-bottom); }
        
        /* Scrollbar personalizada */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default Layout;