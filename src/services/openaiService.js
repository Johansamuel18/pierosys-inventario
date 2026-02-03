// c:\Proyectos\sistema-de-inventario-piero\src\services\openaiService.js

// 1. OBTENER API KEY
const apiKey = (import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_GROQ_API_KEY || "").trim();

// CONFIGURACIÓN:
let API_URL = "https://api.groq.com/openai/v1/chat/completions";
let MODEL = "llama-3.3-70b-versatile"; 
let PROVIDER_NAME = "Groq";

// DETECCIÓN AUTOMÁTICA DE PROVEEDOR
if (apiKey.startsWith('sk-')) {
    // Es una clave de OpenAI
    API_URL = "https://api.openai.com/v1/chat/completions";
    MODEL = "gpt-4o-mini";
    PROVIDER_NAME = "OpenAI";
}

// Diagnóstico
console.log("🤖 Piero AI Config:", { 
    provider: PROVIDER_NAME,
    hasKey: !!apiKey, 
    keyStart: apiKey ? apiKey.substring(0, 4) + "..." : "NONE",
    mode: import.meta.env.MODE 
});

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
      items: s.items.map(i => `${i.quantity} ${i.unit || 'UND'} de ${i.productName} ${i.variantName} (Precio: ${i.unitPrice}, Subtotal: ${i.subtotal})`)
  })) || []);
  
  const systemInstruction = `
    Eres "Piero AI", el socio estratégico experto en finanzas y logística para esta Ferretería emergente.
    Tu objetivo es guiar al dueño para hacer crecer el negocio, optimizar el capital y asegurar el abastecimiento inteligente.

    PERFIL DEL NEGOCIO:
    - Rubro: Ferretería (Materiales de construcción).
    - Etapa: Negocio que está comenzando (el flujo de caja es vital).
    - Productos Estrella (Top Sellers): Calaminas, Clavos, Fierros. (Prioridad máxima en stock).
    
    DATOS DEL NEGOCIO EN TIEMPO REAL:
    - FECHA: ${new Date().toLocaleString()}
    - TASA DE CAMBIO: 1 Sol = ${exchangeRate || 1.6} Reales.
    - KPI FINANCIEROS: ${JSON.stringify(stats || {})}
    - INVENTARIO DETALLADO: ${inventorySummary.substring(0, 50000)}...
    - HISTORIAL DE VENTAS (ÚLTIMAS 300): ${salesSummary}
    
    IMPORTANTE SOBRE UNIDADES:
    - Los productos se venden por UNIDAD (UND), METRO (MT) o KILO (KG).
    - Al analizar, SIEMPRE menciona la unidad correcta (ej: "50 metros de Lona", "2.5 Kilos de Clavos").
    
    TUS 5 FUNCIONES PRINCIPALES (BUSINESS INTELLIGENCE):
    
    1. 💰 **Gestión de Capital y Flujo de Caja**:
       - Analiza cuánto capital hay invertido en inventario vs cuánto se ha vendido.
       - Si te preguntan "¿Cómo muevo mi plata?", analiza qué productos generan liquidez rápida (Calaminas, Clavos) vs cuáles dan más margen.
       - Recomienda montos exactos para reinvertir basándote en el 'restockCostBRL' y las ventas recientes.
    
    2. 📦 **Abastecimiento Inteligente**:
       - Tu prioridad es que NO falten Calaminas, Clavos ni Fierros.
       - Revisa el inventario y avisa URGENTE si el stock es bajo.
       - Calcula cuánto dinero se necesita para reponer el stock crítico.
    
    3.  **Análisis de Movimientos y Gastos**:
       - Identifica tendencias en el historial. ¿Qué días se vende más?
       - Detecta "Gastos Hormiga" o productos que no rotan (Hueso) y sugieren liquidarlos para recuperar capital.
    
    4.  **Cálculo de Rentabilidad Real**: 
       - Tienes el 'cost' (Soles) y 'price' (Reales).
       - Fórmula Costo en Reales: CostoBRL = cost * ${exchangeRate || 1.6}.
       - Margen Real = (price - CostoBRL).
       - Si un producto tiene margen negativo o muy bajo, ALERTA inmediatamente.
       
    5. 🧠 **Recomendaciones Realistas y Detalladas**:
       - No des consejos genéricos. Usa los números del negocio.
       - Ejemplo: "Vende los 50kg de clavos estancados para comprar más calaminas que rotan cada 2 días".
       - Sé detallado en tus respuestas, explicando el "Por qué" financiero de tus consejos.
    
    Responde con tono profesional, motivador y detallado. Eres el cerebro financiero del negocio.
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
      return generateLocalResponse(message, session.contextData) + "\n\n*(⚠️ Error de Configuración: No detecto la API Key. Si estás en Vercel, ve a la pestaña 'Deployments' y haz clic en 'Redeploy' para que tome la nueva variable)*";
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
    return `${localReply}\n\n*(⚠️ Error IA (${PROVIDER_NAME}): ${error.message}. Usando modo local)*`;
  }
};
