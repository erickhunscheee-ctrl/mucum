const url = `${process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://localhost:3001'}/api/mucum/projection`;

try {
  const response = await fetch(url);
  const payload = await response.json();
  console.log(`Mucum projection: HTTP ${response.status}`);
  console.log(JSON.stringify(payload, null, 2));
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(`Nao foi possivel acessar ${url}. Inicie o proxy com npm.cmd run proxy.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
