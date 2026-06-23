import http from "node:http";
import resolveHandler from "./api/resolve.js";
import downloadHandler from "./api/download.js";

function createRes(res) {
  return {
    status(code) {
      res.statusCode = code;
      return {
        json(data) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        },
        send(data) {
          res.end(data);
        },
        end() {
          res.end();
        },
      };
    },
    setHeader(key, value) {
      res.setHeader(key, value);
    },
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3001");
  const mockReq = {
    method: req.method,
    body: await readBody(req),
    query: Object.fromEntries(url.searchParams),
  };
  const mockRes = createRes(res);

  try {
    if (url.pathname === "/api/resolve") {
      await resolveHandler(mockReq, mockRes);
      return;
    }
    if (url.pathname === "/api/download") {
      await downloadHandler(mockReq, mockRes);
      return;
    }
    res.statusCode = 404;
    res.end("Not found");
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(3001, () => {
  console.log("API dev server running at http://127.0.0.1:3001");
});