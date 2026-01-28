import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { file, fileType } = await req.json();

        if (!file) {
            throw new Error('No file provided');
        }

        const apiKey = Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('google_api_key');
        if (!apiKey) {
            throw new Error('GOOGLE_API_KEY is not set');
        }

        // Prepare content for Gemini
        // Using Gemini 2.0 Flash with v1beta API (required for responseMimeType)
        const model = 'gemini-2.0-flash';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const promptText = `Analitza aquest document. Cada pagina es una factura diferent.

Per CADA factura extreu:
- data (DD/MM/YYYY)
- ultima_4_digits_numero_factura
- proveedor (nom complet empresa)
- nif_proveedor (NIF/CIF)
- base_iva_2, import_iva_2 (si hi ha IVA 2%)
- base_iva_4, import_iva_4 (si hi ha IVA 4%)
- base_iva_5, import_iva_5 (si hi ha IVA 5%)
- base_iva_10, import_iva_10 (si hi ha IVA 10%)
- base_iva_21, import_iva_21 (si hi ha IVA 21%)
- base_exempte (si hi ha base exempta)
- base_irpf, percentatge_irpf, import_irpf (si hi ha retenció IRPF)
- total_factura

IMPORTANT:
- NO agafis el "Total IVA" general. Desglossa CADA percentatge.
- Si nomes hi ha un tipus d'IVA, emplena nomes aquells camps.
- Detecta IRPF si n'hi ha.
- TOTS els imports han de tenir EXACTAMENT 2 decimals (exemple: 276.01, no 276.0 ni 276)
- Sigues MOLT PRECÍS amb els decimals, no arrodoneixis.

Proveidors recurrents:
A08757759: EXCLUSIVAS EGARA SA
A25445131: CORPORACION ALIMENTARIA GUISSONA SA
A50109479: BEBINTER SA
B61767240: LOGISTICA DE MEDIOS CATALUNYA SL

Respon NOMES amb JSON seguint aquest esquema:
{
  "factures": [
    {
      "data": "DD/MM/YYYY",
      "ultima_4_digits_numero_factura": "1234",
      "proveedor": "NOM",
      "nif_proveedor": "X1234567X",
      "base_iva_2": 0.00, "import_iva_2": 0.00,
      "base_iva_4": 0.00, "import_iva_4": 0.00,
      "base_iva_5": 0.00, "import_iva_5": 0.00,
      "base_iva_10": 0.00, "import_iva_10": 0.00,
      "base_iva_21": 0.00, "import_iva_21": 0.00,
      "base_exempte": 0.00,
      "base_irpf": 0.00, "percentatge_irpf": 0.00, "import_irpf": 0.00,
      "total_factura": 0.00
    }
  ]
}`;

        const payload = {
            contents: [{
                parts: [
                    { text: promptText },
                    {
                        inline_data: {
                            mime_type: fileType,
                            data: file // Base64 string
                        }
                    }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API Error:", errorText);
            throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log("Gemini Response:", JSON.stringify(data));

        // Parse Gemini response
        // Gemini returns the text in candidates[0].content.parts[0].text
        // It should be JSON because of responseMimeType: "application/json"
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
            throw new Error("No structured content returned from Gemini");
        }

        // Sanitize response (remove markdown code blocks if present)
        let cleanedText = textResponse;
        if (cleanedText.startsWith("```json")) {
            cleanedText = cleanedText.substring(7, cleanedText.length - 3);
        } else if (cleanedText.startsWith("```")) {
            cleanedText = cleanedText.substring(3, cleanedText.length - 3);
        }
        cleanedText = cleanedText.trim();

        const jsonResult = JSON.parse(cleanedText);

        return new Response(
            JSON.stringify(jsonResult),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    } catch (error) {
        console.error(error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
});
