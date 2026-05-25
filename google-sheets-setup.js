/**
 * GOOGLE APPS SCRIPT — Receber leads do Simule Financiamento
 * ============================================================
 * 
 * COMO CONFIGURAR (uma vez só, leva ~5 minutos):
 * 
 * 1. Acesse: https://sheets.google.com
 * 2. Crie uma nova planilha chamada "Leads - Simule Financiamento"
 * 3. Na primeira linha, adicione os cabeçalhos:
 *    A1: Timestamp | B1: Email | C1: Valor Imóvel | D1: Entrada % 
 *    E1: Taxa a.a. | F1: Prazo (anos) | G1: Sistema
 * 
 * 4. Menu: Extensões → Apps Script
 * 5. Apague o código que aparece e cole TODO o código abaixo
 * 6. Clique em "Salvar" (ícone de disquete)
 * 7. Menu: Implementar → Nova implementação
 *    - Tipo: App da Web
 *    - Executar como: Você
 *    - Quem tem acesso: Qualquer pessoa
 * 8. Clique "Implementar" → Copie a URL gerada
 * 9. Cole essa URL no seu arquivo .env como GOOGLE_SHEETS_SCRIPT_URL
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    const fmt = (v) =>
      v.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
      });

    sheet.appendRow([
      new Date(data.timestamp),       // A: Timestamp
      data.email,                     // B: Email  
      fmt(data.valorImovel),          // C: Valor do Imóvel
      data.entradaPct + '%',          // D: Entrada %
      data.taxa + '% a.a.',           // E: Taxa de juros
      data.prazo + ' anos',           // F: Prazo
      data.sistema.toUpperCase(),     // G: Sistema (SAC ou PRICE)
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Função de teste — execute manualmente no editor para validar
function testDoPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        email: 'teste@gmail.com',
        timestamp: new Date().toISOString(),
        valorImovel: 500000,
        entradaPct: 20,
        taxa: 10.5,
        prazo: 30,
        sistema: 'sac',
      }),
    },
  };
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
