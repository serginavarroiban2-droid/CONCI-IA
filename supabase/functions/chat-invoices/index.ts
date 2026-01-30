import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query } = await req.json();

        if (!query) {
            throw new Error('No query provided');
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const apiKey = Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('google_api_key');

        if (!apiKey) {
            throw new Error('GOOGLE_API_KEY is not set');
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // 1. Aggressive Search Criteria Extraction
        const searchPrompt = `Ets un expert en analitzar consultes d'usuaris per a un sistema de facturació. La teva missió és extreure els paràmetres de cerca de forma MOLT precisa.
        
Pregunta de l'usuari: "${query}"

INSTRUCCIONS D'EXTRACCIÓ:
- "proveedor": Busca un nom propi d'empresa o proveïdor (ex: "Ferrer", "Europastry", "Guissona"). Si l'usuari el menciona, posa'l aquí encara que estigui incomplet.
- "data_aproximada": Si menciona "gener", "últim mes", etc., extreu-ho en format YYYY-MM.
- "producte": El nom de l'article específic que busca (ex: "formatge", "patates", "aspirina").
- "keywords": Paraules clau addicionals per buscar dins el contingut del document.

Si l'usuari pregunta "Quins son els ultims articles comprats a X", el proveedor és "X". No ometis el proveedor!

Respon EXCLUSIVAMENT amb un JSON seguint aquest esquema:
{
  "proveedor": "nom o part del nom o null",
  "data_aproximada": "YYYY-MM o null",
  "producte": "nom del producte o null",
  "keywords": ["paraula1", "paraula2"]
}`;

        const geminiModel = 'gemini-2.0-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

        const searchCriteriaResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: searchPrompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const searchCriteriaData = await searchCriteriaResponse.json();

        if (!searchCriteriaResponse.ok) {
            console.error("Gemini Search Criteria Error:", searchCriteriaData);
            throw new Error(`Gemini API Error (Search): ${searchCriteriaData.error?.message || 'Unknown error'}`);
        }

        const criteriaText = searchCriteriaData.candidates?.[0]?.content?.parts?.[0]?.text;
        let criteria = { proveedor: null, producte: null, keywords: [] };
        try {
            criteria = JSON.parse(criteriaText || '{}');
        } catch (e) {
            console.error("Failed to parse criteria JSON:", criteriaText);
        }

        console.log("Aggressive Search Criteria:", criteria);

        // 2. Resilient Database Querying
        let dbQuery = supabase
            .from('registres_comptables')
            .select('*')
            .eq('tipus', 'factura')
            .order('created_at', { ascending: false });

        if (criteria.proveedor) {
            // Busquem de forma molt flexible tant al camp PROVEEDOR com a subcamps
            dbQuery = dbQuery.or(`contingut->>PROVEEDOR.ilike.%${criteria.proveedor}%,contingut->>NIF PROVEEDOR.ilike.%${criteria.proveedor}%`);
        }

        const { data: dbInvoices, error: dbError } = await dbQuery.limit(3);

        if (dbError) throw dbError;

        let relevantInvoices = dbInvoices || [];
        if (relevantInvoices.length === 0 && (criteria.proveedor || (criteria.keywords && criteria.keywords.length > 0))) {
            const searchTerm = criteria.proveedor || (criteria.keywords && criteria.keywords[0]);
            if (searchTerm) {
                const { data: keywordInvoices } = await supabase
                    .from('registres_comptables')
                    .select('*')
                    .eq('tipus', 'factura')
                    .ilike('contingut::text', `%${searchTerm}%`)
                    .limit(2);
                relevantInvoices = keywordInvoices || [];
            }
        }

        if (relevantInvoices.length === 0) {
            return new Response(
                JSON.stringify({ answer: "No he trobat cap factura relacionada amb la teva consulta. Si us plau, verifica el nom del proveïdor." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Prepare Multi-Factor Context
        const invoicesContext = relevantInvoices.map(inv => ({
            id: inv.id,
            proveedor: inv.contingut.PROVEEDOR,
            data: inv.contingut.DATA,
            total: inv.contingut['TOTAL FACTURA'],
            url: inv.contingut['URL FACTURA']
        }));

        console.log("Documents found for analysis:", invoicesContext.length);

        // 4. Deep Analysis & Anti-Hallucination Prompt
        let filesCount = 0;
        const contents = [{
            parts: [{ text: "" }]
        }];

        // Adjuntem fins a 3 fitxers si n'hi ha
        for (const inv of invoicesContext) {
            if (inv.url) {
                try {
                    const fileResponse = await fetch(inv.url);
                    if (fileResponse.ok) {
                        const fileBuffer = await fileResponse.arrayBuffer();
                        const bytes = new Uint8Array(fileBuffer);
                        let binary = "";
                        for (let i = 0; i < bytes.length; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        const base64File = btoa(binary);
                        const mimeType = inv.url.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg';

                        contents[0].parts.push({
                            inline_data: {
                                mime_type: mimeType,
                                data: base64File
                            }
                        });
                        filesCount++;
                        console.log(`Context visual afegit OK: ${inv.proveedor} (${inv.data})`);
                    } else {
                        console.error(`Error fetch file: ${fileResponse.status} ${inv.url}`);
                    }
                } catch (err) {
                    console.error("Error carregar document visual:", err);
                }
            }
        }

        const strictPrompt = `Ets un Analista de Facturació EXTREMADAMENT RIGURÓS. La teva prioritat absoluta és la VERITAT.
        
PREGUNTA DE L'USUARI: "${query}"

CONTEXT DE LA BASE DE DADES (Metadades):
${JSON.stringify(invoicesContext, null, 2)}

PRODUCTE BUSCAT: "${criteria.producte || 'No especificat'}"

INSTRUCCIONS DE SEGURETAT (CRÍTIQUES):
1. **PROHIBIT INVENTAR**: No inventis mai noms de productes, preus o dates.
2. **VERIFICACIÓ VISUAL**: Tens ${filesCount} documents adjunts. Si aquest número és 0, NO TENS ACCÉS VISUAL. Si és $>0$, analitza-ls línia per línia.
3. **NO HALLUCINIS**: Si no trobes el que es demana, digues-ho clarament.
4. **FORMAT DE RESPOSTA**:
   - Primer: Confirma quina factura estàs mirant (Proveïdor i Data).
   - Segon: Respon la pregunta amb precisió.
   - Tercer: Si dones un preu, especifica el preu unitari i la quantitat.

RESPOSTA EN CATALÀ:`;

        contents[0].parts[0].text = strictPrompt;

        const finalResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: 0.0,
                    topP: 1,
                    maxOutputTokens: 2048
                }
            })
        });

        const finalData = await finalResponse.json();

        if (!finalResponse.ok) {
            console.error("Gemini Analysis Error:", finalData);
            throw new Error(`Gemini API Error (Analysis): ${finalData.error?.message || 'Unknown error'}`);
        }

        const answer = finalData.candidates?.[0]?.content?.parts?.[0]?.text || "Ho sento, no he pogut generar una resposta detallada.";

        return new Response(
            JSON.stringify({ answer }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    } catch (error) {
        console.error("Chat Function Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
    }
});
