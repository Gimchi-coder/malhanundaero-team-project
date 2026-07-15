const required = ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing environment variable(s): ${missing.join(', ')}`);
  console.error('Set the variables in your local shell and run this script again.');
  process.exitCode = 1;
  process.exit();
}

const baseUrl = (process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com').replace(/\/$/, '');
const credentials = Buffer.from(
  `${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`,
).toString('base64');

const response = await fetch(`${baseUrl}/api/public/projects`, {
  headers: { Authorization: `Basic ${credentials}` },
});

if (!response.ok) {
  const body = await response.text();
  console.error(`Langfuse connection failed (${response.status}): ${body.slice(0, 300)}`);
  process.exitCode = 1;
  process.exit();
}

const payload = await response.json();
const projects = Array.isArray(payload) ? payload : payload.data;
console.log(`Langfuse connection succeeded (${baseUrl}).`);
console.log(`Accessible project count: ${Array.isArray(projects) ? projects.length : 'unknown'}.`);
