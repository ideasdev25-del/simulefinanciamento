import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailBody {
  email: string;
  xlsxBase64: string;
  params: {
    valorImovel: number;
    entradaPct: number;
    taxa: number;
    prazo: number;
    sistema: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, xlsxBase64, params } = req.body as SendEmailBody;

  if (!email || !xlsxBase64) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 1. Save lead to Google Sheets
  const googleScriptUrl = process.env.GOOGLE_SHEETS_SCRIPT_URL;
  if (googleScriptUrl) {
    try {
      await fetch(googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          timestamp: new Date().toISOString(),
          valorImovel: params.valorImovel,
          entradaPct: params.entradaPct,
          taxa: params.taxa,
          prazo: params.prazo,
          sistema: params.sistema,
        }),
      });
    } catch (err) {
      // Log but don't block email sending if Sheets fails
      console.error('Google Sheets save failed:', err);
    }
  }

  // 2. Send email via Resend
  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

  const entradaValor = (params.valorImovel * params.entradaPct) / 100;
  const valorFinanciado = params.valorImovel - entradaValor;

  const { error } = await resend.emails.send({
    from: 'Simule Financiamento <simulacao@simulefinanciamento.app>',
    to: [email],
    subject: `Sua Simulação de Financiamento — Sistema ${params.sistema.toUpperCase()}`,
    html: `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Simulação de Financiamento</title>
      </head>
      <body style="margin:0;padding:0;background:#0d0f14;font-family:'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
          
          <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #252a38;">
            <p style="font-size:11px;letter-spacing:3px;color:#c8a96e;text-transform:uppercase;margin:0 0 12px;">
              CENÁRIO BRASIL · 2025
            </p>
            <h1 style="font-size:28px;color:#e8e4dc;margin:0 0 8px;line-height:1.2;">
              Simulador de<br>
              <em style="color:#c8a96e;">Financiamento Imobiliário</em>
            </h1>
            <p style="font-size:13px;color:#7a8099;margin:0;">
              Sua tabela de amortização está em anexo neste email.
            </p>
          </div>

          <div style="background:#13161e;border:1px solid #252a38;border-radius:12px;padding:24px;margin-bottom:24px;">
            <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#7a8099;margin:0 0 16px;">
              PARÂMETROS DA SIMULAÇÃO
            </p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#7a8099;border-bottom:1px solid #252a38;">Valor do Imóvel</td>
                <td style="padding:8px 0;font-size:13px;color:#e8e4dc;text-align:right;border-bottom:1px solid #252a38;font-family:monospace;">${fmt(params.valorImovel)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#7a8099;border-bottom:1px solid #252a38;">Entrada (${params.entradaPct}%)</td>
                <td style="padding:8px 0;font-size:13px;color:#e8e4dc;text-align:right;border-bottom:1px solid #252a38;font-family:monospace;">${fmt(entradaValor)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#7a8099;border-bottom:1px solid #252a38;">Valor Financiado</td>
                <td style="padding:8px 0;font-size:13px;color:#c8a96e;text-align:right;border-bottom:1px solid #252a38;font-family:monospace;font-weight:bold;">${fmt(valorFinanciado)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#7a8099;border-bottom:1px solid #252a38;">Taxa de Juros</td>
                <td style="padding:8px 0;font-size:13px;color:#e8e4dc;text-align:right;border-bottom:1px solid #252a38;font-family:monospace;">${params.taxa.toFixed(2).replace('.', ',')}% a.a.</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:13px;color:#7a8099;">Prazo</td>
                <td style="padding:8px 0;font-size:13px;color:#e8e4dc;text-align:right;font-family:monospace;">${params.prazo} anos · ${params.prazo * 12} parcelas</td>
              </tr>
            </table>
          </div>

          <div style="background:#13161e;border:1px solid ${params.sistema === 'sac' ? '#6edac8' : '#d47eb8'};border-radius:12px;padding:20px;margin-bottom:32px;">
            <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#7a8099;margin:0 0 4px;">SISTEMA SELECIONADO</p>
            <p style="font-size:22px;font-weight:bold;color:${params.sistema === 'sac' ? '#6edac8' : '#d47eb8'};margin:0;">
              ${params.sistema === 'sac' ? 'SAC — Sistema de Amortização Constante' : 'Price (Francês)'}
            </p>
          </div>

          <p style="font-size:12px;color:#7a8099;text-align:center;margin:0;">
            Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} · 
            <a href="https://simulefinanciamento.app" style="color:#c8a96e;text-decoration:none;">simulefinanciamento.app</a>
          </p>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: `Simulacao_${params.sistema.toUpperCase()}_${params.prazo}anos.xlsx`,
        content: xlsxBase64,
      },
    ],
  });

  if (error) {
    console.error('Resend error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }

  return res.status(200).json({ success: true });
}
