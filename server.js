const express = require("express");
const client = require("prom-client");
const dns = require("dns").promises;
const net = require("net");
const path = require("path");


const app = express();
const PORT = 3001;

app.use(express.json());

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const lookupTotal = new client.Counter({
  name: "dns_lookups_total",
  help: "Total domain lookups, by result",
  labelNames: ["status"], // success | invalid_input | failed
  registers: [register],
});

const lookupDuration = new client.Histogram({
  name: "dns_lookup_duration_seconds",
  help: "Time spent resolving DNS records for one lookup",
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});


app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({
      method: req.method,
      route: req.route ? req.route.path : "unmatched",
      status_code: res.statusCode,
    });
  });
  next();
});


app.use(express.static(path.join(__dirname, "public")));


const safe = async (promise) => {
  try {
    return await promise;
  } catch (err) {
    if (!["ENODATA", "ENOTFOUND"].includes(err.code)) console.error("DNS error:", err.code, err.hostname);
    return [];
  }
};

function parseHostname(input) {
  let raw = String(input || "").trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = "http://" + raw;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/\.$/, "");
    const valid =
      net.isIP(host) ||
      /^(?=.{1,253}$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z]{2,63}$/.test(host) ||
      /^xn--/.test(host);
    return valid ? host : null;
  } catch {
    return null;
  }
}

async function findZone(host) {
  const labels = host.split(".");
  for (let i = 0; i <= labels.length - 2; i++) {
    const candidate = labels.slice(i).join(".");
    const ns = await safe(dns.resolveNs(candidate));
    if (ns.length) return { zone: candidate, ns };
  }
  return { zone: host, ns: [] };
}

app.get("/api/lookup", async (req, res) => {
  const host = parseHostname(req.query.url);
  if (!host) {
    lookupTotal.inc({ status: "invalid_input" });
    return res.status(400).json({ error: "Enter a valid domain or URL, like example.com" });
  }

  const stop = lookupDuration.startTimer();
  try {
  
    if (net.isIP(host)) {
      const reverse = await safe(dns.reverse(host));
      stop();
      lookupTotal.inc({ status: "success" });
      return res.json({ input: host, hostname: host, isIp: true, a: net.isIPv4(host) ? [host] : [], aaaa: net.isIPv6(host) ? [host] : [], reverse });
    }

    const [{ zone, ns }, a, aaaa, cname] = await Promise.all([
      findZone(host),
      safe(dns.resolve4(host)),
      safe(dns.resolve6(host)),
      safe(dns.resolveCname(host)),
    ]);

    const [mx, txt, soa, reverse] = await Promise.all([
      safe(dns.resolveMx(zone)),
      safe(dns.resolveTxt(zone)),
      dns.resolveSoa(zone).catch(() => null),
      a.length ? safe(dns.reverse(a[0])) : [],
    ]);

    stop();

    if (!a.length && !aaaa.length && !cname.length && !ns.length) {
      lookupTotal.inc({ status: "failed" });
      return res.status(404).json({ error: `No DNS records found forss ${host}` });
    }

    lookupTotal.inc({ status: "success" });
    res.json({
      input: req.query.url,
      hostname: host,
      zone,
      a,
      aaaa,
      cname,
      ns,
      mx: mx.sort((x, y) => x.priority - y.priority),
      txt: txt.map((parts) => parts.join("")),
      soa,
      reverse,
    });
  } catch (err) {
    stop();
    lookupTotal.inc({ status: "failed" });
    res.status(500).json({ error: "Lookup failed: " + err.message });
  }
});


app.post("/", (req, res) => {
  console.log("POST / called", req.body);
  res.send("POST request received");
});

app.put("/", (req, res) => {
  console.log("PUT / called", req.body);
  res.send("PUT request received");
});

app.delete("/", (req, res) => {
  console.log("DELETE / called");
  res.send("DELETE request received");
});

app.get("/contact", (req, res) => {
  res.send("Hello from contact endpoint");
});


app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});