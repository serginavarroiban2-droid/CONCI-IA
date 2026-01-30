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
        const { messageId, attachmentId } = await req.json();

        if (!messageId || !attachmentId) {
            throw new Error("Falten paràmetres: messageId i attachmentId són obligatoris.");
        }

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
        const accessToken = tokenData.access_token;

        // 2. Obtenir l'adjunt de Gmail
        const gmailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const gmailData = await gmailRes.json();
        if (!gmailRes.ok) throw new Error(`Error descarregant de Gmail: ${JSON.stringify(gmailData)}`);

        const base64Data = gmailData.data.replace(/-/g, '+').replace(/_/g, '/');

        // 3. Gestionar etiquetes: Treure "factures pendents" i afegir "factures escanejades"
        try {
            const labelsRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const labelsData = await labelsRes.json();

            let pendingLabelId = labelsData.labels.find((l: any) => l.name.toLowerCase() === 'factures pendents')?.id;
            let scannedLabelId = labelsData.labels.find((l: any) => l.name.toLowerCase() === 'factures escanejades')?.id;

            // Crear etiqueta si no existeix
            if (!scannedLabelId) {
                const createLabelRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'factures escanejades' })
                });
                const newLabel = await createLabelRes.json();
                scannedLabelId = newLabel.id;
            }

            // Moure etiquetes
            if (pendingLabelId) {
                await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        addLabelIds: scannedLabelId ? [scannedLabelId] : [],
                        removeLabelIds: [pendingLabelId]
                    })
                });
            }
        } catch (e) {
            console.error("Error gestionant etiquetes (continuem igualment):", e);
        }

        return new Response(JSON.stringify({ success: true, data: base64Data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
