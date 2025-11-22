
async function jfetch(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
function fmtNumber(n){
  return new Intl.NumberFormat('pt-BR').format(n);
}
function fmtMoney(n){
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(n ?? 0);
}
window.jfetch = jfetch;
window.fmtNumber = fmtNumber;
window.fmtMoney = fmtMoney;
