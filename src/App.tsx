import { useMemo, useEffect, useRef, useState } from 'react';
import './index.css';
import { calcSAC, calcPrice, fmt, fmtFull } from './utils/financing';
import type { RowResult } from './utils/financing';
import { Mail, X, Send, Loader2 } from 'lucide-react';
import * as xlsx from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// --- Components ---

function Header() {
  return (
    <header>
      <h1>Simulador de<br /><em>Financiamento Imobiliário</em></h1>
      <p className="subtitle">SAC vs Price · Amortização · Juros Totais · Parcelas mês a mês</p>
    </header>
  );
}

const PUB_ID = import.meta.env.VITE_ADSENSE_PUBLISHER_ID as string | undefined;

function AdBanner({ slot, format = 'auto', className = 'banner' }: { slot: string; format?: string; className?: string }) {
  useEffect(() => {
    if (!import.meta.env.PROD || !PUB_ID) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded
    }
  }, [slot]);

  if (!import.meta.env.PROD || !ADSENSE_READY) return null;

  return (
    <div className={`ads-container ${className}`} aria-label="Publicidade">
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={PUB_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

function Controls({
  valorImovel, setValorImovel,
  entradaPct, setEntradaPct,
  taxa, setTaxa,
  prazo, setPrazo
}: {
  valorImovel: number, setValorImovel: (v: number) => void,
  entradaPct: number, setEntradaPct: (v: number) => void,
  taxa: number, setTaxa: (v: number) => void,
  prazo: number, setPrazo: (v: number) => void
}) {
  const entradaValor = (valorImovel * entradaPct) / 100;
  
  return (
    <div className="controls-grid">
      <div className="field">
        <label>Valor do Imóvel</label>
        <input type="range" min="100000" max="3000000" step="25000" value={valorImovel} onChange={e => setValorImovel(+e.target.value)} />
        <div className="range-val">{fmt(valorImovel)}</div>
      </div>
      <div className="field">
        <label>Entrada (%)</label>
        <input type="range" min="10" max="50" step="5" value={entradaPct} onChange={e => setEntradaPct(+e.target.value)} />
        <div className="range-val">{entradaPct}% <small>= {fmt(entradaValor)}</small></div>
      </div>
      <div className="field">
        <label>Taxa de Juros (% a.a.)</label>
        <input type="range" min="7" max="16" step="0.25" value={taxa} onChange={e => setTaxa(+e.target.value)} />
        <div className="range-val">{taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% <small>a.a.</small></div>
      </div>
      <div className="field">
        <label>Prazo (anos)</label>
        <input type="range" min="5" max="35" step="1" value={prazo} onChange={e => setPrazo(+e.target.value)} />
        <div className="range-val">{prazo} <small>anos · {prazo * 12} parcelas</small></div>
      </div>
    </div>
  );
}

function FormalizationCosts({
  valorImovel, entradaValor,
  itbiPct, setItbiPct,
  cartorioPct, setCartorioPct,
  taxaAvaliacao, setTaxaAvaliacao,
  primeiroImovel, setPrimeiroImovel
}: {
  valorImovel: number, entradaValor: number,
  itbiPct: number, setItbiPct: (v: number) => void,
  cartorioPct: number, setCartorioPct: (v: number) => void,
  taxaAvaliacao: number, setTaxaAvaliacao: (v: number) => void,
  primeiroImovel: boolean, setPrimeiroImovel: (v: boolean) => void
}) {
  // If "Primeiro Imóvel" via SFH, roughly 50% discount on Cartório fees
  const realCartorioPct = primeiroImovel ? cartorioPct / 2 : cartorioPct;
  
  const custoItbi = valorImovel * (itbiPct / 100);
  const custoCartorio = valorImovel * (realCartorioPct / 100);
  const totalTaxas = custoItbi + custoCartorio + taxaAvaliacao;
  const capitalNecessario = entradaValor + totalTaxas;

  return (
    <div className="formalization-costs">
      <div className="section-title">Custos de Formalização (Estimativa)</div>
      <div className="section-desc">Despesas extras obrigatórias como ITBI e encargos do cartório.</div>
      
      <div className="costs-grid">
        <div className="costs-inputs">
          <div className="field">
            <label>ITBI (%) <span className="label-hint">padrão 2% a 3%</span></label>
            <input type="range" min="0" max="5" step="0.1" value={itbiPct} onChange={e => setItbiPct(+e.target.value)} />
            <div className="range-val">{itbiPct.toFixed(1)}% <small>= {fmt(custoItbi)}</small></div>
          </div>
          <div className="field">
            <label>Cartório (RGI) (%) <span className="label-hint">padrão 1% a 2%</span></label>
            <input type="range" min="0" max="3" step="0.1" value={cartorioPct} onChange={e => setCartorioPct(+e.target.value)} />
            <div className="range-val">{cartorioPct.toFixed(1)}% {primeiroImovel && <small className="discount">-50%</small>} <small>= {fmt(custoCartorio)}</small></div>
          </div>
          <div className="field">
            <label>Taxa de Avaliação Bancária</label>
            <input type="range" min="0" max="5000" step="100" value={taxaAvaliacao} onChange={e => setTaxaAvaliacao(+e.target.value)} />
            <div className="range-val">{fmt(taxaAvaliacao)}</div>
          </div>
          <label className="checkbox-field">
            <input type="checkbox" checked={primeiroImovel} onChange={e => setPrimeiroImovel(e.target.checked)} />
            <span>Primeiro imóvel (Desconto no Cartório via SFH)</span>
          </label>
        </div>

        <div className="costs-summary">
          <div className="summary-item">
            <span>Entrada do Financiamento</span>
            <strong>{fmt(entradaValor)}</strong>
          </div>
          <div className="summary-item">
            <span>Total de Taxas Extras</span>
            <strong>{fmt(totalTaxas)}</strong>
          </div>
          <div className="summary-total">
            <span>Capital Total Inicial</span>
            <strong>{fmt(capitalNecessario)}</strong>
          </div>
          <p className="disclaimer">* Valores estimados. As alíquotas de ITBI e emolumentos de cartório variam por município e estado. Consulte um correspondente bancário da sua região.</p>
        </div>
      </div>
    </div>
  );
}

function SummaryCards({ sac, price }: { sac: RowResult[], price: RowResult[] }) {
  const sacTotal = sac.reduce((s, r) => s + r.prestacao, 0);
  const sacJuros = sac.reduce((s, r) => s + r.juros, 0);
  const priceTotal = price.reduce((s, r) => s + r.prestacao, 0);
  const priceJuros = price.reduce((s, r) => s + r.juros, 0);

  const economiaSac = priceTotal - sacTotal;
  const difPrice = ((priceTotal / sacTotal - 1) * 100).toFixed(1);

  return (
    <div className="summary-row">
      <div className="summary-card sac">
        <div className="card-label">Sistema</div>
        <div className="card-system" data-tip="Sistema de Amortização Constante: parcela decresce ao longo do tempo. Amortização fixa, juros caem mês a mês.">SAC</div>
        <div className="card-metrics">
          <div className="metric">
            <div className="metric-name">1ª Parcela</div>
            <div className="metric-val big">{fmtFull(sac[0].prestacao)}</div>
          </div>
          <div className="metric">
            <div className="metric-name">Última Parcela</div>
            <div className="metric-val">{fmtFull(sac[sac.length - 1].prestacao)}</div>
          </div>
          <div className="metric">
            <div className="metric-name">Total pago</div>
            <div className="metric-val">{fmt(sacTotal)}</div>
          </div>
          <div className="metric">
            <div className="metric-name">Juros totais</div>
            <div className="metric-val">{fmt(sacJuros)}</div>
          </div>
        </div>
        <div className="diff-badge">Economia de {fmt(economiaSac)} vs Price</div>
      </div>

      <div className="summary-card price">
        <div className="card-label">Sistema</div>
        <div className="card-system" data-tip="Tabela Francesa: parcela fixa durante todo o contrato. No início paga-se mais juros; a amortização cresce com o tempo.">Price (Francês)</div>
        <div className="card-metrics">
          <div className="metric">
            <div className="metric-name">Parcela fixa</div>
            <div className="metric-val big">{fmtFull(price[0].prestacao)}</div>
          </div>
          <div className="metric">
            <div className="metric-name">Total pago</div>
            <div className="metric-val">{fmt(priceTotal)}</div>
          </div>
          <div className="metric">
            <div className="metric-name">Juros totais</div>
            <div className="metric-val">{fmt(priceJuros)}</div>
          </div>
        </div>
        <div className="diff-badge">{difPrice}% mais caro que SAC</div>
      </div>
    </div>
  );
}

function ChartsSection({ sac, price, prazo, pv }: { sac: RowResult[], price: RowResult[], prazo: number, pv: number }) {
  const n = prazo * 12;
  const step = Math.max(1, Math.floor(n / 120));
  
  const labels: string[] = [];
  const sacParc: number[] = []; const priceParc: number[] = [];
  const sacSaldo: number[] = []; const priceSaldo: number[] = [];
  
  for (let i = 0; i < n; i += step) {
    labels.push(`${Math.round((i + 1) / 12)}a`);
    sacParc.push(sac[i].prestacao);
    priceParc.push(price[i].prestacao);
    sacSaldo.push(sac[i].saldo);
    priceSaldo.push(price[i].saldo);
  }

  const tickFmt = (v: number) => 'R$' + (v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : (v / 1000).toFixed(0) + 'k');
  const tooltipLabel = (ctx: { dataset: { label: string }, raw: unknown }) => ` ${ctx.dataset.label}: ${fmtFull(ctx.raw as number)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseOptions: Record<string, any> = {
    responsive: true,
    maintainAspectRatio: false, // let the CSS wrapper control height
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1e2a', borderColor: '#252a38', borderWidth: 1,
        titleColor: '#7a8099', bodyColor: '#e8e4dc',
        titleFont: { family: 'DM Mono', size: 11 }, bodyFont: { family: 'DM Mono', size: 12 },
        callbacks: { label: tooltipLabel }
      }
    },
    scales: {
      x: { grid: { color: '#252a38' }, ticks: { color: '#7a8099', font: { family: 'DM Mono', size: 10 } } },
      y: { 
        grid: { color: '#252a38' },
        ticks: { color: '#7a8099', font: { family: 'DM Mono', size: 10 }, callback: tickFmt }
      }
    }
  };

  // Saldo devedor: Y max locked to loan amount (pv)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saldoOptions: Record<string, any> = {
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
      y: {
        ...baseOptions.scales.y,
        min: 0,
        max: pv,
        ticks: { color: '#7a8099', font: { family: 'DM Mono', size: 10 }, callback: tickFmt }
      }
    }
  };

  const dataParcelas = {
    labels,
    datasets: [
      { label: 'SAC', data: sacParc, borderColor: '#6edac8', backgroundColor: '#6edac818', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3 },
      { label: 'Price', data: priceParc, borderColor: '#d47eb8', backgroundColor: '#d47eb818', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3 }
    ]
  };

  const dataSaldo = {
    labels,
    datasets: [
      { label: 'SAC', data: sacSaldo, borderColor: '#6edac8', backgroundColor: '#6edac818', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3 },
      { label: 'Price', data: priceSaldo, borderColor: '#d47eb8', backgroundColor: '#d47eb818', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3 }
    ]
  };

  return (
    <div className="charts-row">
      <div className="chart-section">
        <div className="section-title">Evolução das Parcelas</div>
        <div className="section-desc">Prestação mês a mês</div>
        <div className="chart-wrap">
          <Line data={dataParcelas} options={baseOptions} />
        </div>
        <div className="legend">
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--sac)' }}></div>SAC</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--price)' }}></div>Price</div>
        </div>
      </div>
      <div className="chart-section">
        <div className="section-title">Saldo Devedor</div>
        <div className="section-desc">Máximo = valor financiado</div>
        <div className="chart-wrap">
          <Line data={dataSaldo} options={saldoOptions} />
        </div>
        <div className="legend">
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--sac)' }}></div>SAC</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--price)' }}></div>Price</div>
        </div>
      </div>
    </div>
  );
}

type SimParams = {
  valorImovel: number;
  entradaPct: number;
  taxa: number;
  prazo: number;
};

function EmailModal({ onClose, onSend }: { onClose: () => void; onSend: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      await onSend(email);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        
        {status === 'success' ? (
          <div className="modal-success">
            <div className="modal-success-icon">✉️</div>
            <h3>Email enviado!</h3>
            <p>Sua simulação foi enviada para <strong>{email}</strong>.<br />Verifique sua caixa de entrada.</p>
            <button className="btn-modal-primary" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-icon"><Mail size={28} /></div>
            <h3>Receber simulação por email</h3>
            <p>Enviaremos a tabela de amortização completa em Excel para o seu email.</p>
            <div className="modal-field">
              <label htmlFor="email-input">Seu email</label>
              <input
                id="email-input"
                ref={inputRef}
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            {status === 'error' && (
              <p className="modal-error">Erro ao enviar. Tente novamente.</p>
            )}
            <button className="btn-modal-primary" type="submit" disabled={status === 'loading'}>
              {status === 'loading'
                ? <><Loader2 size={16} className="spin" /> Enviando...</>
                : <><Send size={16} /> Enviar simulação</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AmortizationTable({ sac, price, params, itbiPct, cartorioPct, taxaAvaliacao, primeiroImovel }: {
  sac: RowResult[], price: RowResult[], params: SimParams,
  itbiPct: number, cartorioPct: number, taxaAvaliacao: number, primeiroImovel: boolean
}) {
  const [tab, setTab] = useState<'sac'|'price'>('sac');
  const [showModal, setShowModal] = useState(false);
  const rows = tab === 'sac' ? sac : price;

  const buildPdfBase64 = (): string => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const realCartorioPct = primeiroImovel ? cartorioPct / 2 : cartorioPct;
    const entradaValor = (params.valorImovel * params.entradaPct) / 100;
    const pv = params.valorImovel - entradaValor;
    const custoItbi = params.valorImovel * (itbiPct / 100);
    const custoCartorio = params.valorImovel * (realCartorioPct / 100);
    const totalTaxas = custoItbi + custoCartorio + taxaAvaliacao;
    const capitalNecessario = entradaValor + totalTaxas;

    const sacTotal = sac.reduce((s, r) => s + r.prestacao, 0);
    const sacJuros = sac.reduce((s, r) => s + r.juros, 0);
    const priceTotal = price.reduce((s, r) => s + r.prestacao, 0);
    const priceJuros = price.reduce((s, r) => s + r.juros, 0);
    const economiaSac = priceTotal - sacTotal;

    const fmtR = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

    // Header band
    doc.setFillColor(13, 15, 20);
    doc.rect(0, 0, W, 38, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(200, 169, 110);
    doc.text('CENÁRIO BRASIL · 2026', 20, 13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(232, 228, 220);
    doc.text('Simulação de Financiamento Imobiliário', 20, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(122, 128, 153);
    doc.text(
      `Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} · simulefinanciamento.app`,
      20, 33
    );

    let y = 50;

    const section = (title: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(200, 169, 110);
      doc.text(title, 20, y);
      doc.setDrawColor(200, 169, 110);
      doc.setLineWidth(0.25);
      doc.line(20, y + 2, W - 20, y + 2);
      y += 9;
    };

    // ── Parâmetros ──
    section('PARÂMETROS DA SIMULAÇÃO');
    autoTable(doc, {
      startY: y,
      margin: { left: 20, right: 20 },
      styles: { fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
      alternateRowStyles: { fillColor: [246, 246, 250] },
      body: [
        ['Valor do Imóvel', fmtR(params.valorImovel)],
        [`Entrada (${params.entradaPct}%)`, fmtR(entradaValor)],
        ['Valor Financiado', fmtR(pv)],
        ['Taxa de Juros', `${params.taxa.toFixed(2).replace('.', ',')}% a.a.`],
        ['Prazo', `${params.prazo} anos · ${params.prazo * 12} parcelas`],
      ],
      columnStyles: {
        0: { textColor: [90, 90, 110], cellWidth: 90 },
        1: { textColor: [20, 20, 40], fontStyle: 'bold', halign: 'right' },
      },
      theme: 'plain',
    });
    y = (doc as any).lastAutoTable.finalY + 14;

    // ── Comparativo ──
    section('COMPARATIVO SAC vs PRICE');
    autoTable(doc, {
      startY: y,
      margin: { left: 20, right: 20 },
      head: [['', 'SAC', 'Price (Francês)']],
      styles: { fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
      headStyles: { fillColor: [30, 35, 50], textColor: [200, 169, 110], fontStyle: 'bold', halign: 'center', fontSize: 8 },
      alternateRowStyles: { fillColor: [246, 246, 250] },
      body: [
        ['1ª Parcela', fmtR(sac[0]?.prestacao ?? 0), fmtR(price[0]?.prestacao ?? 0)],
        ['Última Parcela', fmtR(sac[sac.length - 1]?.prestacao ?? 0), fmtR(price[price.length - 1]?.prestacao ?? 0) + ' (fixa)'],
        ['Total Pago', fmtR(sacTotal), fmtR(priceTotal)],
        ['Juros Totais', fmtR(sacJuros), fmtR(priceJuros)],
        ['Economia no SAC', `${fmtR(economiaSac)} a menos`, '—'],
      ],
      columnStyles: {
        0: { textColor: [90, 90, 110], cellWidth: 70 },
        1: { halign: 'right', textColor: [10, 125, 111] },
        2: { halign: 'right', textColor: [156, 56, 120] },
      },
      didParseCell: (data) => {
        if (data.row.index === 4 && data.column.index !== 0) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
      theme: 'plain',
    });
    y = (doc as any).lastAutoTable.finalY + 14;

    // ── Custos de Formalização ──
    section('CUSTOS DE FORMALIZAÇÃO');
    autoTable(doc, {
      startY: y,
      margin: { left: 20, right: 20 },
      styles: { fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
      alternateRowStyles: { fillColor: [246, 246, 250] },
      body: [
        [`ITBI (${itbiPct.toFixed(1)}%)`, fmtR(custoItbi)],
        [`Cartório/RGI (${realCartorioPct.toFixed(2)}%${primeiroImovel ? ' — 50% desc. SFH' : ''})`, fmtR(custoCartorio)],
        ['Taxa de Avaliação Bancária', fmtR(taxaAvaliacao)],
        ['Total de Custos de Formalização', fmtR(totalTaxas)],
        ['Capital Total Necessário (entrada + custos)', fmtR(capitalNecessario)],
      ],
      columnStyles: {
        0: { textColor: [90, 90, 110], cellWidth: 120 },
        1: { halign: 'right', textColor: [20, 20, 40], fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.row.index >= 3) {
          data.cell.styles.fillColor = [245, 240, 228];
          data.cell.styles.textColor = [140, 90, 30];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      theme: 'plain',
    });

    // Footer band
    doc.setFillColor(13, 15, 20);
    doc.rect(0, pageH - 14, W, 14, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(122, 128, 153);
    doc.text(
      'simulefinanciamento.app · Simulação para fins informativos. Consulte sua instituição financeira.',
      W / 2, pageH - 5,
      { align: 'center' }
    );

    const buffer = doc.output('arraybuffer');
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  };

  const buildXlsxBase64 = (): string => {
    const entrada = (params.valorImovel * params.entradaPct) / 100;
    const valorFinanciado = params.valorImovel - entrada;

    // Sheet 1: Parâmetros
    const wsParams = xlsx.utils.aoa_to_sheet([
      ['Parâmetro', 'Valor'],
      ['Valor do Imóvel', params.valorImovel],
      ['Entrada (%)', `${params.entradaPct}%`],
      ['Valor da Entrada', entrada],
      ['Valor Financiado', valorFinanciado],
      ['Taxa de Juros (a.a.)', `${params.taxa.toFixed(2).replace('.', ',')}%`],
      ['Prazo', `${params.prazo} anos (${params.prazo * 12} parcelas)`],
      ['Sistema', tab === 'sac' ? 'SAC — Sistema de Amortização Constante' : 'Price (Tabela Francesa)'],
      ['Data da simulação', new Date().toLocaleDateString('pt-BR')],
    ]);

    // Column widths
    wsParams['!cols'] = [{ wch: 28 }, { wch: 36 }];

    // Currency format for numeric rows (indices 1, 2, 3)
    const currencyFmt = 'R$ #,##0.00';
    ['B2', 'B4', 'B5'].forEach(cell => {
      if (wsParams[cell]) wsParams[cell].z = currencyFmt;
    });

    // Sheet 2: Amortização
    const wsData = rows.map(r => ({
      'Mês': r.mes,
      'Amortização (R$)': Number(r.amort.toFixed(2)),
      'Juros (R$)': Number(r.juros.toFixed(2)),
      'Prestação (R$)': Number(r.prestacao.toFixed(2)),
      'Saldo Devedor (R$)': Number(Math.max(0, r.saldo).toFixed(2)),
    }));
    const wsAmort = xlsx.utils.json_to_sheet(wsData);
    wsAmort['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, wsParams, 'Parâmetros');
    xlsx.utils.book_append_sheet(wb, wsAmort, `Amortização_${tab.toUpperCase()}`);

    return xlsx.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  };

  const handleSendEmail = async (email: string) => {
    const xlsxBase64 = buildXlsxBase64();
    const pdfBase64 = buildPdfBase64();
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        xlsxBase64,
        pdfBase64,
        params: { ...params, sistema: tab },
      }),
    });
    if (!res.ok) throw new Error('send failed');
  };

  return (
    <>
      {showModal && <EmailModal onClose={() => setShowModal(false)} onSend={handleSendEmail} />}
      <div className="table-section">
        <div className="section-title">Tabela de Amortização</div>
        <div className="section-desc">Detalhamento mês a mês · A simulação completa será enviada ao seu email em Excel</div>
        
        <div className="table-header-row">
          <div className="tab-bar">
            <button className={`tab-btn sac ${tab === 'sac' ? 'active' : ''}`} onClick={() => setTab('sac')}>SAC</button>
            <button className={`tab-btn price ${tab === 'price' ? 'active' : ''}`} onClick={() => setTab('price')}>Price</button>
          </div>
          <button className="btn-export" onClick={() => setShowModal(true)}>
            <Mail size={16} /> Receber simulação por email
          </button>
        </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Amortização</th>
              <th>Juros</th>
              <th>Prestação</th>
              <th>Saldo Devedor</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter((_, i) => i % 3 === 0).map((r, i) => (
              <tr key={r.mes} className={(i * 3 + 1) % 12 === 1 ? 'year-marker' : ''}>
                <td>{r.mes}</td>
                <td className="td-amort">{fmtFull(r.amort)}</td>
                <td className="td-juros">{fmtFull(r.juros)}</td>
                <td className="td-prestacao">{fmtFull(r.prestacao)}</td>
                <td className="td-saldo">{fmtFull(Math.max(0, r.saldo))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}

function Explainer() {
  return (
    <section aria-labelledby="sistemas-heading">
      <h2 id="sistemas-heading" className="section-title" style={{ marginBottom: '6px' }}>Entenda os Sistemas de Amortização</h2>
      <p className="section-desc" style={{ marginBottom: '20px' }}>SAC e Price são os dois sistemas utilizados no Brasil — cada um com vantagens diferentes dependendo do seu perfil financeiro.</p>
      <div className="explainer-grid">
        <div className="explainer-card sac">
          <h3>SAC — Sistema de Amortização Constante</h3>
          <p>A parcela de amortização do principal é sempre igual durante todo o contrato. Os juros incidem sobre o saldo devedor, que cai linearmente — por isso as prestações começam maiores e diminuem com o tempo.</p>
          <p><strong>Fórmula:</strong> Amortização = Saldo ÷ n &nbsp;&middot;&nbsp; Juros = Saldo × taxa mensal</p>
          <div className="pro-con">
            <div className="pro-con-item"><span>✅</span><span>Paga menos juros totais</span></div>
            <div className="pro-con-item"><span>✅</span><span>Saldo devedor cai mais rápido</span></div>
            <div className="pro-con-item"><span>✅</span><span>Melhor para quitar antecipado</span></div>
            <div className="pro-con-item"><span>⚠️</span><span>Parcela inicial mais alta (compromete mais renda)</span></div>
          </div>
        </div>
        <div className="explainer-card price">
          <h3>Price — Tabela Francesa</h3>
          <p>A parcela total é fixa durante todo o contrato. No início, a maior parte é juros; com o tempo, a amortização vai crescendo. O saldo devedor cai lentamente no início.</p>
          <p><strong>Fórmula:</strong> PMT = PV &times; [i(1+i)ⁿ] ÷ [(1+i)ⁿ−1]</p>
          <div className="pro-con">
            <div className="pro-con-item"><span>✅</span><span>Parcela previsível e fixa — fácil de planejar</span></div>
            <div className="pro-con-item"><span>✅</span><span>Parcela inicial menor (facilita aprovação)</span></div>
            <div className="pro-con-item"><span>✅</span><span>Orçamento familiar mais estável</span></div>
            <div className="pro-con-item"><span>⚠️</span><span>Paga mais juros no total e amortiza pouco no início</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: 'Qual a diferença entre SAC e Price no financiamento imobiliário?',
      a: 'No SAC, a amortização mensal é constante e as parcelas decrescem ao longo do tempo. Na Tabela Price, a parcela é fixa, mas no início a maior parte é composta por juros. O SAC resulta em menor custo total; o Price facilita o planejamento por ter parcela fixa.',
    },
    {
      q: 'Qual sistema de amortização é melhor: SAC ou Price?',
      a: 'O SAC é melhor para quem pode pagar parcela inicial mais alta e quer economizar juros no longo prazo. O Price é indicado para quem precisa de parcela menor no início ou prefere previsibilidade. Nosso simulador mostra exatamente quanto você economiza escolhendo o SAC.',
    },
    {
      q: 'Como calcular o financiamento imobiliário no Brasil em 2026?',
      a: 'Você precisa de: valor do imóvel, percentual de entrada (mínimo 10–20%), taxa de juros anual e prazo. Nosso simulador faz o cálculo automaticamente para SAC e Price, exibindo parcelas, juros totais e tabela de amortização completa.',
    },
    {
      q: 'Quanto devo dar de entrada num financiamento imobiliário?',
      a: 'O mínimo geralmente é de 20% para financiamento pelo SFH. Quanto maior a entrada, menor o saldo financiado, menores as parcelas e menos juros pagos no total. Use o slider de entrada no simulador para comparar cenários.',
    },
    {
      q: 'Quais os custos extras além da entrada (ITBI, Cartório, etc)?',
      a: 'Além da entrada, reserve os chamados Custos de Formalização (de 4% a 6% do valor do imóvel). Isso inclui o ITBI (Imposto de Transmissão, em média 2% a 3% cobrado pela prefeitura), a taxa de registro no Cartório (RGI, padrão de 1% a 2%) e a Taxa de Avaliação Bancária. Atenção: Se for a compra do seu primeiro imóvel financiado pelo SFH/MCMV, a lei federal concede 50% de desconto nas taxas de registro de cartório!',
    },
  ];

  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="faq-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="section-title" style={{ marginBottom: '6px' }}>Perguntas Frequentes</h2>
      <p className="section-desc" style={{ marginBottom: '20px' }}>Dúvidas comuns sobre financiamento imobiliário no Brasil</p>
      <div className="faq-list">
        {faqs.map((faq, i) => (
          <div key={i} className="faq-item">
            <button
              className="faq-question"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span>{faq.q}</span>
              <span className={`faq-chevron ${open === i ? 'open' : ''}`}>›</span>
            </button>
            <div className={`faq-answer${open === i ? ' faq-answer--open' : ''}`} role="region" aria-hidden={open !== i}>
              <p>{faq.a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DisclaimerBanner() {
  return (
    <div className="disclaimer-banner">
      <span className="disclaimer-icon">ⓘ</span>
      Os valores apresentados são estimativas para fins de planejamento. Consulte sua instituição financeira para condições definitivas.
    </div>
  );
}

function ContentSection() {
  return (
    <section className="content-section" aria-labelledby="guia-heading">
      <h2 id="guia-heading">Como calcular o capital total necessário para comprar um imóvel</h2>
      <p>
        Muitos compradores focam apenas na parcela mensal e esquecem que, antes de assinar o contrato,
        é preciso ter em caixa um valor significativamente maior do que a entrada. Além do valor da entrada
        — geralmente mínimo de 20% pelo SFH — existem custos obrigatórios de formalização que podem
        representar de 4% a 6% do valor do imóvel. O simulador acima calcula tudo isso na seção
        "Custos de Formalização", mas vale entender cada item.
      </p>

      <h3>O que é ITBI e quanto custa</h3>
      <p>
        O ITBI (Imposto de Transmissão de Bens Imóveis) é um tributo municipal cobrado toda vez que
        um imóvel muda de proprietário. A alíquota varia por cidade: em São Paulo é 3%, no Rio de Janeiro
        2%, em Curitiba e Porto Alegre 2,7%. Para um imóvel de R&nbsp;500.000, o ITBI pode custar entre
        R&nbsp;10.000 e R&nbsp;15.000 — dinheiro que precisa sair do bolso à vista, separado da entrada.
        Use o slider de ITBI no simulador para ajustar à alíquota do seu município.
      </p>

      <h3>Custos de cartório e registro de imóveis</h3>
      <p>
        O Registro Geral de Imóveis (RGI) é o passo que transfere legalmente o imóvel para seu nome.
        Os emolumentos (taxas do cartório) seguem tabelas estaduais e costumam ficar entre 1% e 2%
        do valor do imóvel. Quem compra o <strong>primeiro imóvel pelo SFH ou MCMV</strong> tem direito
        a 50% de desconto nessas taxas — o simulador aplica esse desconto automaticamente quando você
        marca a opção "Primeiro imóvel".
      </p>

      <h3>Taxa de avaliação bancária</h3>
      <p>
        O banco contrata um engenheiro ou arquiteto para avaliar o imóvel antes de liberar o crédito.
        Esse laudo custa tipicamente entre R&nbsp;1.500 e R&nbsp;5.000 dependendo da instituição e do
        valor do bem. Caixa Econômica Federal, Bradesco e Itaú cobram valores diferentes — vale
        perguntar antes de escolher o banco.
      </p>

      <h3>Capital total inicial: a conta completa</h3>
      <p>
        Some entrada + ITBI + cartório + avaliação e você tem o <strong>capital total inicial</strong>
        que precisa ter disponível no dia da assinatura. Para um imóvel de R&nbsp;500.000 com 20% de
        entrada, esse valor costuma ficar entre R&nbsp;130.000 e R&nbsp;145.000 — cerca de 26% a 29%
        do valor do imóvel, não apenas os 20% de entrada. O simulador mostra esse número em tempo real
        conforme você ajusta os parâmetros.
      </p>

      <h3>SAC ou Price: qual impacta mais o seu orçamento?</h3>
      <p>
        Depois de garantir o capital inicial, a escolha entre SAC e Price define o impacto mensal no
        seu orçamento pelos próximos 20 a 35 anos. No SAC, a primeira parcela é maior mas o total
        pago é sempre menor. Na Tabela Price, a parcela inicial é menor — o que facilita a aprovação
        do crédito pela regra de comprometimento de renda — mas o custo total é significativamente
        superior. Use os cartões de comparação acima para ver a diferença exata para o seu cenário.
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <p>
        <strong>Simule Financiamento</strong> &nbsp;&middot;&nbsp;
        Simulador gratuito de financiamento imobiliário &nbsp;&middot;&nbsp;
        SAC e Price &nbsp;&middot;&nbsp;
        Brasil 2026
      </p>
      <nav aria-label="Guias de financiamento" style={{ marginTop: '24px', marginBottom: '16px' }}>
        <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
          Aprenda sobre financiamento
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', justifyContent: 'center', fontSize: '13px' }}>
          <a href="/sac-ou-price" style={{ color: 'var(--muted)', textDecoration: 'none' }}>SAC ou Price</a>
          <a href="/quanto-preciso-ganhar" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Renda mínima</a>
          <a href="/entrada-financiamento" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Entrada</a>
          <a href="/fgts-financiamento" style={{ color: 'var(--muted)', textDecoration: 'none' }}>FGTS</a>
          <a href="/itbi" style={{ color: 'var(--muted)', textDecoration: 'none' }}>ITBI</a>
          <a href="/custos-de-cartorio" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Custos de cartório</a>
          <a href="/custo-total-comprar-imovel" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Custo total</a>
          <a href="/amortizar-financiamento" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Amortização</a>
        </div>
      </nav>
      <p style={{ marginTop: '16px', fontSize: '13px' }}>
        <a href="/sobre" style={{ color: 'var(--muted)', textDecoration: 'none', marginRight: '16px' }}>Sobre</a>
        <a href="/privacidade" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Política de Privacidade</a>
      </p>
    </footer>
  );
}

const ADSENSE_READY = import.meta.env.VITE_ADS_ENABLED === 'true'
  && !!import.meta.env.VITE_ADSENSE_PUBLISHER_ID
  && !import.meta.env.VITE_ADSENSE_PUBLISHER_ID?.includes('XXXXXXXXX');

function Sidebar({ slots }: { slots: [string, string] }) {
  if (!import.meta.env.PROD || !ADSENSE_READY) return null;
  return (
    <aside className="sidebar">
      <AdBanner slot={slots[0]} format="vertical" className="sidebar-ad" />
      <AdBanner slot={slots[1]} format="vertical" className="sidebar-ad" />
    </aside>
  );
}

// --- Main application ---

export default function App() {
  const [valorImovel, setValorImovel] = useState(500000);
  const [entradaPct, setEntradaPct] = useState(20);
  const [taxa, setTaxa] = useState(10.5);
  const [prazo, setPrazo] = useState(30);

  // Custos Extras state
  const [itbiPct, setItbiPct] = useState(3.0);
  const [cartorioPct, setCartorioPct] = useState(1.5);
  const [taxaAvaliacao, setTaxaAvaliacao] = useState(3500);
  const [primeiroImovel, setPrimeiroImovel] = useState(true);

  const { sac, price, pv, entradaValor } = useMemo(() => {
    const entradaValor = (valorImovel * entradaPct) / 100;
    const pv = valorImovel - entradaValor;
    const n = prazo * 12;
    return {
      pv,
      entradaValor,
      sac: calcSAC(pv, taxa, n),
      price: calcPrice(pv, taxa, n)
    };
  }, [valorImovel, entradaPct, taxa, prazo]);

  const params: SimParams = { valorImovel, entradaPct, taxa, prazo };

  return (
    <div className="container">
      <Header />
      <DisclaimerBanner />
      <div className="page-layout">
        <Sidebar slots={['1111111111', '2222222222']} />
        <main className="main-content">
          <Controls 
            valorImovel={valorImovel} setValorImovel={setValorImovel}
            entradaPct={entradaPct} setEntradaPct={setEntradaPct}
            taxa={taxa} setTaxa={setTaxa}
            prazo={prazo} setPrazo={setPrazo}
          />
          <FormalizationCosts
            valorImovel={valorImovel} entradaValor={entradaValor}
            itbiPct={itbiPct} setItbiPct={setItbiPct}
            cartorioPct={cartorioPct} setCartorioPct={setCartorioPct}
            taxaAvaliacao={taxaAvaliacao} setTaxaAvaliacao={setTaxaAvaliacao}
            primeiroImovel={primeiroImovel} setPrimeiroImovel={setPrimeiroImovel}
          />
          <SummaryCards sac={sac} price={price} />
          <AmortizationTable sac={sac} price={price} params={params}
            itbiPct={itbiPct} cartorioPct={cartorioPct}
            taxaAvaliacao={taxaAvaliacao} primeiroImovel={primeiroImovel}
          />
          <ChartsSection sac={sac} price={price} prazo={prazo} pv={pv} />
          <AdBanner slot="6666666666" format="auto" className="banner in-content-ad" />
          <Explainer />
          <FAQ />
          <ContentSection />
          <Footer />
        </main>
        <Sidebar slots={['3333333333', '4444444444']} />
      </div>
    </div>
  );
}
