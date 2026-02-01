// c:\Proyectos\sistema-de-inventario-piero\src\services\openaiService.js

// 1. OBTENER API KEY
const apiKey = (import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_GROQ_API_KEY || "").trim();

// Diagnóstico para ver si la clave carga en la nube (F12 en el navegador)
console.log("🤖 Piero AI Config:", { hasKey: !!apiKey, mode: import.meta.env.MODE });

// CONFIGURACIÓN:
// Para OpenAI (ChatGPT):
// const API_URL = "https://api.openai.com/v1/chat/completions";
// const MODEL = "gpt-4o-mini"; // Modelo rápido y económico

// Para Groq (Opción GRATUITA):
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile"; 

/**
 * LÓGICA LOCAL DE RESPALDO (FALLBACK)
 */
const generateLocalResponse = (message, contextData) => {
    const msg = message.toLowerCase();
    const { stats, products } = contextData || {};
    
    if (msg.includes('hola') || msg.includes('buenos')) {
        return "¡Hola! 👋 Soy Piero AI. Estoy en **Modo Local** (sin conexión). Puedo darte datos exactos de tu inventario.";
    }
    if (msg.includes('stock') || msg.includes('productos') || msg.includes('cuantos')) {
        return `📦 **Inventario:** Tienes **${products?.length || 0} productos** registrados y **${stats?.lowStockCount || 0}** con stock bajo.`;
    }
    if (msg.includes('valor') || msg.includes('dinero') || msg.includes('capital')) {
        return `💰 **Capital:** Tienes aprox. **S/ ${stats?.totalInventoryValueBRL?.toFixed(2) || 0}** invertidos.`;
    }
    if (msg.includes('venta') || msg.includes('ganancia') || msg.includes('hoy')) {
        return `📈 **Hoy:** Ventas: **R$ ${stats?.totalSalesTodayBRL?.toFixed(2) || 0}** | Ganancia: **R$ ${stats?.totalProfitTodayBRL?.toFixed(2) || 0}**`;
    }
    return "⚠️ **Modo Local:** No entendí. Pregúntame por 'stock', 'capital' o 'ventas'. (No tengo conexión a la IA).";
};

/**
 * Crea la sesión de chat.
 * En OpenAI no hay objeto "chat session", así que gestionamos el historial nosotros.
 */
export const createPieroChatSession = (contextData) => {
  const { products, sales, valuation, slowMoving, stats, exchangeRate } = contextData || {};

  // Preparamos resúmenes de datos
  const inventorySummary = JSON.stringify(products?.map(p => ({
      name: p.name,
      variants: p.variants.map(v => ({ 
          name: v.name, 
          stock: v.stock, 
          min: v.minStock, // DATO CLAVE PARA ALERTAS
          price: v.priceSellBRL,
          cost: v.priceBuySoles, // DATO CLAVE PARA MÁRGENES
          unit: v.salesUnit // AHORA LA IA SABRÁ SI ES KG, MT o UND
      }))
  })) || []);

  // AUMENTAMOS EL HISTORIAL A 300 PARA QUE PUEDA VER "AYER" Y "ANTIER"
  const salesSummary = JSON.stringify(sales?.slice(0, 300).map(s => ({
      date: new Date(s.timestamp).toLocaleDateString() + ' ' + new Date(s.timestamp).toLocaleTimeString(),
      total: s.totalRevenue,
      profit: s.totalProfit, // DATO CLAVE PARA CALCULAR MÁRGENES
      items: s.items.map(i => `${i.quantity}x ${i.productName} ${i.variantName} (Precio: ${i.unitPrice}, Subtotal: ${i.subtotal})`)
  })) || []);
  
  const systemInstruction = `
    Eres "Piero AI", el estratega de negocios inteligente de PieroSys.
    
    DATOS DEL NEGOCIO EN TIEMPO REAL:
    - TASA DE CAMBIO ACTUAL: 1 Sol = ${exchangeRate || 1.6} Reales.
    - KPI: ${JSON.stringify(stats || {})}
    - INVENTARIO: ${inventorySummary.substring(0, 50000)}...
    - HISTORIAL DE VENTAS (ÚLTIMAS 300): ${salesSummary}
    
    TUS 5 FUNCIONES PRINCIPALES (BUSINESS INTELLIGENCE):
    
    1. 📊 **Tendencias de Ventas**: Analiza el historial para identificar qué productos están subiendo en demanda esta semana.
    
    2. 🚨 **Alertas de Stock Bajo**: Revisa el inventario y avisa URGENTE si 'stock' <= 'min'. Sugiere reposición inmediata.
    
    3. 🔄 **Rotación de Inventario**: Identifica productos que se venden rápido vs los que no se han movido en las últimas 300 ventas.
    
    4. 💰 **Análisis de Margen**: 
       - Tienes el 'cost' en Soles y 'price' en Reales.
       - Fórmula: CostoBRL = cost * ${exchangeRate || 1.6}.
       - Margen = (price - CostoBRL) / price.
       - Avisa si algún producto tiene margen bajo (< 20%).
       
    5. 📈 **Recomendaciones**: Si ves que se venden muchos "Clavos", sugiere verificar el stock de "Martillos" (productos complementarios).
    
    Responde como un consultor experto: breve, directo y usando datos numéricos para respaldar tus consejos.
  `;

  // Retornamos un objeto que mantiene el estado del historial
  return { 
      type: 'openai', 
      history: [
          { role: "system", content: systemInstruction }
      ], 
      contextData 
  };
};

/**
 * Envía el mensaje a OpenAI
 */
export const sendMessageToPiero = async (session, message) => {
  if (!session) return "Error: Sesión no inicializada.";

  // Si no hay API Key, usar modo local inmediatamente
  if (!apiKey) {
      return generateLocalResponse(message, session.contextData) + "\n\n*(⚠️ Error: No detecto la API Key en la configuración de la nube)*";
  }

  // 1. Agregar mensaje del usuario al historial
  session.history.push({ role: "user", content: message });

  try {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: session.history,
            temperature: 0.7
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || "Error en API OpenAI");
    }

    const reply = data.choices[0].message.content;

    // 2. Agregar respuesta de la IA al historial
    session.history.push({ role: "assistant", content: reply });

    return reply;

  } catch (error) {
    console.error("Piero AI Error:", error);
    
    // Fallback a local
    const localReply = generateLocalResponse(message, session.contextData);
    return `${localReply}\n\n*(⚠️ Error IA: ${error.message}. Usando modo local)*`;
  }
};
