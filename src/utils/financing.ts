export type RowResult = {
  mes: number;
  amort: number;
  juros: number;
  prestacao: number;
  saldo: number;
};

export function calcSAC(pv: number, taxaAA: number, n: number): RowResult[] {
  const i = Math.pow(1 + taxaAA / 100, 1 / 12) - 1;
  const amort = pv / n;
  let saldo = pv;
  const rows: RowResult[] = [];
  
  for (let m = 1; m <= n; m++) {
    const juros = saldo * i;
    const prestacao = amort + juros;
    rows.push({ mes: m, amort, juros, prestacao, saldo: saldo - amort });
    saldo -= amort;
  }
  return rows;
}

export function calcPrice(pv: number, taxaAA: number, n: number): RowResult[] {
  const i = Math.pow(1 + taxaAA / 100, 1 / 12) - 1;
  const pmt = pv * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  let saldo = pv;
  const rows: RowResult[] = [];
  
  for (let m = 1; m <= n; m++) {
    const juros = saldo * i;
    const amort = pmt - juros;
    rows.push({ mes: m, amort, juros, prestacao: pmt, saldo: saldo - amort });
    saldo -= amort;
  }
  return rows;
}

export const fmt = (v: number) => 
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const fmtFull = (v: number) => 
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
