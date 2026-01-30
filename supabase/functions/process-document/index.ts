import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Maneig CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log("--- INICI PROCESS-DOCUMENT ---");

        let body;
        try {
            body = await req.json();
        } catch (e) {
            return new Response(JSON.stringify({ error: "No s'ha pogut llegir el JSON del body: " + e.message }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const { file, fileType, knownProviders } = body;

        console.log("DEBUG - Dades rebudes:", {
            hasFile: !!file,
            fileType,
            fileSize: file ? Math.round(file.length / 1024) + " KB" : "0 KB",
            hasKnownProviders: !!knownProviders
        });

        if (!file) {
            return new Response(JSON.stringify({ error: "No s'ha rebut cap fitxer en base64." }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const apiKey = Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('google_api_key');

        if (!apiKey) {
            console.error("ERROR: GOOGLE_API_KEY no trobada als secrets de Supabase.");
            return new Response(JSON.stringify({ error: "Falta la configuració de GOOGLE_API_KEY a Supabase." }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Context dels proveïdors si existeix
        let providerContext = "";
        if (knownProviders && Array.isArray(knownProviders) && knownProviders.length > 0) {
            providerContext = `
            CONTEXT D'EMPRESES CONEGUDES (DNA):
            Si el NIF o nom de l'empresa coincideix amb algun d'aquests, utilitza la configuració d'extracció adjunta:
            ${JSON.stringify(knownProviders, null, 2)}
            `;
        }

        const model = 'gemini-2.0-flash';
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Mime Type segur
        let safeMimeType = fileType || 'application/pdf';
        if (safeMimeType === 'image/jpg') safeMimeType = 'image/jpeg';

        const promptText = `Ets un auditor fiscal expert de Catalunya. Analitza aquesta factura/tiquet i retorna les dades en format JSON.
        ${providerContext}

        INSTRUCCIONS IMPORTANTS:
        1. Identifica totes les bases imposables i cuotes d'IVA (2%, 4%, 5%, 10%, 21%).
        2. Identifica bases exemptes.
        3. Identifica IRPF (base, percentatge i import).
        4. El TOTAL FACTURA ha de ser: Suma de totes les bases + Suma de tots els IVAs - Import IRPF.
        5. LA DATA ha de ser en format DD/MM/YYYY.
        6. EL NIF ha d'incloure la lletra.
        7. NR_FACTURA: Extreu el número de factura.

        Retorna EXCLUSIVAMENT un objecte JSON amb aquest esquema (sense markdown):
        {
          "factures": [
            {
              "data": "DD/MM/YYYY",
              "ultima_4_digits_numero_factura": "últims 4 digits del num factura",
              "proveedor": "NOM EMPRESA",
              "nif_proveedor": "NIF",
              "base_iva_2": 0, "import_iva_2": 0,
              "base_iva_4": 0, "import_iva_4": 0,
              "base_iva_5": 0, "import_iva_5": 0,
              "base_iva_10": 0, "import_iva_10": 0,
              "base_iva_21": 0, "import_iva_21": 0,
              "base_exempte": 0,
              "base_irpf": 0, "percentatge_irpf": 0, "import_irpf": 0,
              "total_factura": 0
            }
          ]
        }`;

        console.log("Invocant Gemini API...");
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: promptText },
                        {
                            inline_data: {
                                mime_type: safeMimeType,
                                data: file
                            }
                        }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1
                }
            })
        });

        const resText = await geminiResponse.text();

        if (!geminiResponse.ok) {
            console.error("Error de Gemini API:", resText);
            return new Response(JSON.stringify({ error: "Error de Gemini API: " + resText }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const result = JSON.parse(resText);
        const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiText) {
            console.error("Resposta buida de Gemini:", result);
            return new Response(JSON.stringify({ error: "Gemini no ha trobat dades a la imatge." }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        try {
            // Gemini amb responseMimeType hauria de retornar JSON pur, pero per si de cas netegem
            const cleanedJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanedJson);

            console.log("Exit: Dades extretes correctament.");
            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });

        } catch (e) {
            console.error("Error parsejant JSON final:", aiText);
            return new Response(JSON.stringify({ error: "Error de format en la resposta de la IA." }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        return new Response(JSON.stringify({ error: "Error crític a la funció: " + error.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
