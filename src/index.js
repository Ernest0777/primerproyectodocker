import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 3000);

createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Hola mundo\n');
}).listen(port, '0.0.0.0', () => {
  console.log(`Servidor en http://localhost:${port}`);
});