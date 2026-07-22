import { readFileSync } from 'fs';

async function run() {
  console.log("Starting fetch...");
  try {
    const res = await fetch("http://localhost:3001/api/ana/EstacoesTelemetricas/HidroInventarioEstacoes/v1?Unidade+Federativa=SP");
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.slice(0, 100));
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
