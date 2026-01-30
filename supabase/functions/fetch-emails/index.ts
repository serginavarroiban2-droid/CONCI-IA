import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { labelName = "factures pendents", sourceEmail = "" } = await req.json();

        const clientId = (Deno.env.get('GMAIL_CLIENT_ID') || "").trim();
        const clientSecret = (Deno.env.get('GMAIL_CLIENT_SECRET') || "").trim();
        const refreshToken = (Deno.env.get('GMAIL_REFRESH_TOKEN') || "").trim();

        // 1. Obtenir Access Token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }).toString(),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            throw new Error(`Error d'autenticació: ${tokenData.error_description || tokenData.error}`);
        }

        const accessToken = tokenData.access_token;

        // 2. Cercar missatges
        // Construïm la query: label:"nom etiqueta" [from:correu]
        let query = `label:"${labelName}"`;
        if (sourceEmail) {
            query += ` from:${sourceEmail}`;
        }

        console.log(`Cercant: ${query}`);

        const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const listData = await listResponse.json();
        const messages = listData.messages || [];

        const resultEmails = [];

        // 3. Processar cada missatge per extreure adjunts
        for (const msg of messages) {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const detail = await detailRes.json();

            const subject = detail.payload.headers.find((h: any) => h.name === 'Subject')?.value || '(Sense assumpte)';
            const from = detail.payload.headers.find((h: any) => h.name === 'From')?.value || 'Desconegut';
            const date = detail.payload.headers.find((h: any) => h.name === 'Date')?.value || '';

            const attachments = [];

            // Funció recursiva per trobar adjunts a les parts del mail
            const findAttachments = (parts: any[]) => {
                for (const part of parts) {
                    if (part.filename && part.body && part.body.attachmentId) {
                        const mimeType = part.mimeType;
                        // Només volem PDF o Imatges
                        if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
                            attachments.push({
                                id: part.body.attachmentId,
                                filename: part.filename,
                                mimeType: mimeType,
                                size: part.body.size,
                                messageId: msg.id
                            });
                        }
                    }
                    if (part.parts) {
                        findAttachments(part.parts);
                    }
                }
            };

            if (detail.payload.parts) {
                findAttachments(detail.payload.parts);
            } else if (detail.payload.filename && detail.payload.body.attachmentId) {
                // El mail és un sol fitxer (rar però possible)
                findAttachments([detail.payload]);
            }

            if (attachments.length > 0) {
                resultEmails.push({
                    id: msg.id,
                    subject,
                    from,
                    date,
                    attachments
                });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            emails: resultEmails,
            count: resultEmails.length
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("Error a la Edge Function:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200, // Retornem 200 per mostrar l'error amable a la UI si cal
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});

