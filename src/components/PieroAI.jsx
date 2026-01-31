import React, { useState, useEffect, useRef } from 'react';
import { createPieroChatSession, sendMessageToPiero } from '../services/openaiService.js';
import { InventoryService } from '../services/inventoryService.js';
import { Bot, Send, User, Eraser, BrainCircuit, Sparkles } from 'lucide-react';

const PieroAI = () => {
  // 1. Cargar historial guardado al iniciar
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('piero_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved).map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch (e) {
        console.error("Error recuperando chat", e);
      }
    }
    return [
      {
        id: 'welcome',
        role: 'ai',
        text: `¡Hola! Soy **Piero AI** 🏗️.\n\nEstoy conectando con tu base de datos para analizar el negocio...`,
        timestamp: new Date()
      }
    ];
  });

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const chatSessionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 2. Guardar historial cada vez que cambia
  useEffect(() => {
    localStorage.setItem('piero_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Inicializar la IA con todos los datos del negocio
  useEffect(() => {
    const initAI = async () => {
      try {
        setIsInitializing(true);
        // Cargar todos los datos necesarios para el contexto en paralelo
        const [products, sales, valuation, slowMoving, stats] = await Promise.all([
          InventoryService.getProducts(),
          InventoryService.fetchTransactions(),
          InventoryService.fetchValuationData(),
          InventoryService.fetchSlowMovingItems(),
          InventoryService.fetchDashboardStats()
        ]);

        // Obtenemos la tasa de cambio para cálculos financieros precisos
        const exchangeRate = InventoryService.getExchangeRate();

        const contextData = { products, sales, valuation, slowMoving, stats, exchangeRate };

        chatSessionRef.current = createPieroChatSession(contextData);
        
        // 3. Si hay historial previo, restaurarlo en la memoria de la IA
        if (messages.length > 1 || (messages.length === 1 && messages[0].id !== 'welcome')) {
            messages.forEach(msg => {
                if (msg.role === 'user') {
                    chatSessionRef.current.history.push({ role: 'user', content: msg.text });
                } else if (msg.role === 'ai' && msg.id !== 'welcome' && msg.id !== 'welcome-loaded') {
                    chatSessionRef.current.history.push({ role: 'assistant', content: msg.text });
                }
            });
        } else {
            // Si es nuevo, mostrar mensaje de bienvenida con datos
            setMessages(prev => [{
                id: 'welcome-loaded',
                role: 'ai',
                text: `¡Hola! Soy **Piero AI** 🏗️.\n\nHe analizado tus **${products?.length || 0} productos**, **${sales?.length || 0} ventas** y métricas clave. \n\nPregúntame sobre:\n* 📉 Productos con bajo stock\n* 💰 Capital invertido vs Ganancia\n* 🐢 Productos de baja rotación (Hueso)`,
                timestamp: new Date()
            }]);
        }

      } catch (error) {
        console.error("Error inicializando Piero AI:", error);
        if (messages.length <= 1) {
            setMessages(prev => [...prev, { id: 'error-init', role: 'ai', text: '⚠️ Tuve problemas cargando los datos. Usaré el modo básico.', timestamp: new Date() }]);
        }
      } finally {
        setIsInitializing(false);
      }
    };

    initAI();
  }, []); // Solo al montar

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const text = inputValue;
    setInputValue('');

    // 1. Mensaje Usuario
    const userMsg = { id: Date.now(), role: 'user', text: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // 2. Respuesta IA
    let responseText = "No tengo datos del inventario para responder.";
    if (chatSessionRef.current) {
        try {
            responseText = await sendMessageToPiero(chatSessionRef.current, text);
        } catch (error) {
            responseText = "Lo siento, tuve un error al procesar tu consulta.";
        }
    } else if (isInitializing) {
        responseText = "Aún estoy analizando los datos. Dame un momento ⏳.";
    }

    // 3. Mensaje IA
    const aiMsg = { id: Date.now() + 1, role: 'ai', text: responseText, timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  // Función para limpiar historial manualmente
  const clearHistory = () => {
      const newWelcome = {
        id: 'welcome-loaded',
        role: 'ai',
        text: `¡Hola! Soy **Piero AI** 🏗️.\n\nChat reiniciado. ¿En qué puedo ayudarte hoy?`,
        timestamp: new Date()
      };
      setMessages([newWelcome]);
      localStorage.removeItem('piero_chat_history');
      
      // Reiniciar sesión de IA también
      if (chatSessionRef.current) {
          const contextData = chatSessionRef.current.contextData;
          chatSessionRef.current = createPieroChatSession(contextData);
      }
  };

  // Renderizador simple de texto con formato básico
  const renderMessageText = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line.split(/(\*\*.*?\*\*)/).map((part, j) => 
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={j} className="font-bold text-emerald-400">{part.slice(2, -2)}</strong>
          ) : (
            part
          )
        )}
        <br />
      </React.Fragment>
    ));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600/20 p-2 rounded-full border border-emerald-500/30">
            <BrainCircuit size={24} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100">Piero AI Analyst</h3>
            <p className="text-xs text-slate-400">
              {isInitializing ? 'Analizando datos...' : (isTyping ? 'Escribiendo...' : 'Conectado al Negocio')}
            </p>
          </div>
        </div>
        <button 
            onClick={clearHistory}
            className="text-slate-500 hover:text-white transition-colors"
            title="Limpiar chat y reiniciar memoria"
        >
            <Eraser size={20} />
        </button>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-tr-none' 
                : 'bg-slate-700 text-slate-200 rounded-tl-none border border-slate-600'
            }`}>
              <div className="text-sm leading-relaxed">
                {renderMessageText(msg.text)}
              </div>
              <span className="text-[10px] opacity-50 block text-right mt-1">
                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-slate-500 text-sm ml-4">
            <Sparkles size={16} className="animate-pulse text-emerald-500" />
            <span className="text-emerald-500/50">Analizando...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-slate-800 border border-slate-600 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors placeholder-slate-500"
            placeholder={isInitializing ? "Cargando cerebro..." : "Escribe tu consulta aquí..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={isTyping || isInitializing}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping || isInitializing}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white p-3 rounded-xl transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PieroAI;
