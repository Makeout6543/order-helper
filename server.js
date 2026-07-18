const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec, execSync } = require('child_process');

const PORT = 3456;
const DATA_FILE = path.join(__dirname, 'data', 'orders.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = __dirname;

// ======== 工具函数 ========

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data, null, 2));
}

function readOrders() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf-8');
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
  });
}

// ======== 解析 multipart/form-data（简易版） ========
function parseMultipart(req, boundary) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const parts = {};
      const str = buffer.toString('binary');
      const sections = str.split('--' + boundary);

      for (const section of sections) {
        const headerEnd = section.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const header = section.substring(0, headerEnd);
        const body = section.substring(headerEnd + 4);

        // 去掉末尾的 \r\n
        const bodyEnd = body.lastIndexOf('\r\n');
        const cleanBody = bodyEnd > -1 ? body.substring(0, bodyEnd) : body;

        const nameMatch = header.match(/name="([^"]+)"/);
        const filenameMatch = header.match(/filename="([^"]+)"/);

        if (nameMatch) {
          const fieldName = nameMatch[1];
          if (filenameMatch) {
            // 这是文件 - 从二进制中提取
            const binaryStart = Buffer.from(str.substring(0, str.indexOf(section)), 'binary').length;
            const headerBytes = Buffer.from(section.substring(0, headerEnd + 4), 'binary').length;
            const trailerLen = '\r\n'.length;

            const fileStart = buffer.indexOf(Buffer.from('\r\n\r\n')) + 4;
            // 找到文件数据在 buffer 中的范围
            let sectionStart = str.indexOf('--' + boundary + '\r\n' + 'Content-Disposition: form-data; name="' + fieldName + '"; filename="' + filenameMatch[1] + '"');
            if (sectionStart === -1) {
              sectionStart = str.indexOf('--' + boundary + '\r\nContent-Disposition: form-data; name="' + fieldName + '"; filename="' + filenameMatch[1] + '"');
            }

            // 简化处理：直接存文件内容
            const fileContent = Buffer.from(cleanBody, 'binary');
            parts[fieldName] = {
              filename: filenameMatch[1],
              data: fileContent
            };
          } else {
            parts[fieldName] = cleanBody;
          }
        }
      }
      resolve(parts);
    });
  });
}

// ======== 静态文件服务 ========
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ======== API 路由 ========
async function handleAPI(req, res, url) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // GET /api/orders — 获取所有订单
  if (url === '/api/orders' && req.method === 'GET') {
    const orders = readOrders();
    return jsonResponse(res, orders);
  }

  // GET /api/orders/search?q=xxx — 搜索订单
  if (url.startsWith('/api/orders/search') && req.method === 'GET') {
    const query = new URLSearchParams(url.split('?')[1] || '');
    const q = (query.get('q') || '').toLowerCase();
    const orders = readOrders();
    if (!q) return jsonResponse(res, orders);
    const filtered = orders.filter(o =>
      o.productName.toLowerCase().includes(q) ||
      o.supplier.toLowerCase().includes(q) ||
      (o.note && o.note.toLowerCase().includes(q))
    );
    return jsonResponse(res, filtered);
  }

  // POST /api/orders — 新增订单
  if (url === '/api/orders' && req.method === 'POST') {
    try {
      const body = await readJSON(req);
      const orders = readOrders();

      const newOrder = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
        date: body.date || new Date().toISOString().split('T')[0],
        productName: body.productName || '',
        quantity: Number(body.quantity) || 0,
        unit: body.unit || '斤',
        unitPrice: Number(body.unitPrice) || 0,
        amount: Number(body.amount) || 0,
        verified: body.verified !== undefined ? body.verified : null,
        priceChange: body.priceChange !== undefined ? body.priceChange : null,
        priceChangeNote: body.priceChangeNote || '',
        supplier: body.supplier || '',
        note: body.note || '',
        imageFile: body.imageFile || '',
        createdAt: new Date().toISOString()
      };

      // 自动核验：数量×单价 是否等于 金额
      const calculated = Math.round(newOrder.quantity * newOrder.unitPrice * 100) / 100;
      const discrepancy = Math.abs(calculated - newOrder.amount);
      newOrder.verified = discrepancy < 0.02;
      newOrder.verificationDetail = {
        calculated,
        stated: newOrder.amount,
        discrepancy: Math.round(discrepancy * 100) / 100,
        ok: discrepancy < 0.02
      };

      // 自动检测价格变动
      const previous = orders
        .filter(o => o.productName === newOrder.productName && o.supplier === newOrder.supplier)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      if (previous) {
        const prevPrice = previous.unitPrice;
        if (newOrder.unitPrice !== prevPrice) {
          const change = Math.round((newOrder.unitPrice - prevPrice) * 100) / 100;
          newOrder.priceChange = change;
          newOrder.priceChangeNote = change > 0
            ? `↑ 比上次(${previous.date})涨价 ${change} 元/${newOrder.unit}`
            : `↓ 比上次(${previous.date})降价 ${Math.abs(change)} 元/${newOrder.unit}`;
        } else {
          newOrder.priceChange = 0;
          newOrder.priceChangeNote = '价格未变';
        }
      } else {
        newOrder.priceChange = null;
        newOrder.priceChangeNote = '首次采购，无历史对比';
      }

      orders.push(newOrder);
      saveOrders(orders);
      return jsonResponse(res, newOrder, 201);
    } catch (e) {
      return jsonResponse(res, { error: e.message }, 400);
    }
  }

  // PUT /api/orders/:id — 更新订单
  if (url.startsWith('/api/orders/') && url.split('/').length === 4 && req.method === 'PUT') {
    const id = url.split('/')[3];
    try {
      const body = await readJSON(req);
      const orders = readOrders();
      const idx = orders.findIndex(o => o.id === id);
      if (idx === -1) return jsonResponse(res, { error: 'Not found' }, 404);

      orders[idx] = { ...orders[idx], ...body, id: orders[idx].id };
      saveOrders(orders);
      return jsonResponse(res, orders[idx]);
    } catch (e) {
      return jsonResponse(res, { error: e.message }, 400);
    }
  }

  // DELETE /api/orders/:id — 删除订单
  if (url.startsWith('/api/orders/') && url.split('/').length === 4 && req.method === 'DELETE') {
    const id = url.split('/')[3];
    let orders = readOrders();
    const before = orders.length;
    orders = orders.filter(o => o.id !== id);
    if (orders.length === before) return jsonResponse(res, { error: 'Not found' }, 404);
    saveOrders(orders);
    return jsonResponse(res, { success: true });
  }

  // POST /api/upload — 上传图片
  if (url === '/api/upload' && req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
      return jsonResponse(res, { error: '需要 multipart/form-data' }, 400);
    }

    try {
      const parts = await parseMultipart(req, boundaryMatch[1]);
      const file = parts.file || parts.image;
      if (!file || !file.data) {
        return jsonResponse(res, { error: '未找到文件' }, 400);
      }

      const ext = path.extname(file.filename) || '.png';
      const safeFilename = Date.now() + '_' + Math.random().toString(36).substring(2, 8) + ext;
      const filePath = path.join(UPLOADS_DIR, safeFilename);
      fs.writeFileSync(filePath, file.data);

      return jsonResponse(res, {
        success: true,
        filename: safeFilename,
        path: '/uploads/' + safeFilename
      });
    } catch (e) {
      return jsonResponse(res, { error: e.message }, 500);
    }
  }

  // POST /api/recognize — AI 识别订单截图（纯 Node.js 实现）
  if (url === '/api/recognize' && req.method === 'POST') {
    try {
      const body = await readJSON(req);
      const filename = body.filename;
      if (!filename) return jsonResponse(res, { error: '缺少 filename' }, 400);

      const imagePath = path.join(UPLOADS_DIR, path.basename(filename));
      if (!fs.existsSync(imagePath)) {
        return jsonResponse(res, { error: '图片文件不存在，请重新上传' }, 404);
      }

      const APP_ID = '100003';
      const APP_KEY = process.env.ORDER_HELPER_LEGACY_APP_KEY;
      if (!APP_KEY) return jsonResponse(res, { error: '旧识别服务未配置凭证' }, 503);

      // Step 1: 获取 token（用 curl，绕过 Python 3.14 兼容问题）
      let token;
      try {
        token = execSync('curl -s http://127.0.0.1:18432/get_token', { timeout: 10000 }).toString().trim();
      } catch (e) {
        return jsonResponse(res, { error: '无法获取认证 token' }, 500);
      }
      if (!token) return jsonResponse(res, { error: 'Token 为空' }, 500);
      if (!token.toLowerCase().startsWith('bearer ')) token = 'Bearer ' + token;

      // Step 2: 上传图片获取公网 URL
      const uploadUrl = await new Promise((resolve, reject) => {
        const imageData = fs.readFileSync(imagePath);
        const boundary = '----NodeUpload' + Date.now();
        const mimeType = 'image/jpeg';

        const bodyParts = [
          `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${path.basename(imagePath)}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
          imageData,
          `\r\n--${boundary}--\r\n`
        ];

        const timestamp = String(Math.floor(Date.now() / 1000));
        const sign = crypto.createHash('md5').update(`${APP_ID}&${timestamp}&${APP_KEY}`).digest('hex');

        const options = {
          hostname: 'autoglm-api.zhipuai.cn',
          path: '/agentdr/v1/assistant/upload-mix',
          method: 'POST',
          headers: {
            'Authorization': token,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'X-Auth-Appid': APP_ID,
            'X-Auth-TimeStamp': timestamp,
            'X-Auth-Sign': sign
          },
          timeout: 60000
        };

        const uploadReq = https.request(options, (uploadRes) => {
          let data = '';
          uploadRes.on('data', chunk => data += chunk);
          uploadRes.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (result.code !== 0) return reject(new Error('上传失败: ' + (result.msg || '未知错误')));
              resolve(result.data.oss_info[0].oss_url);
            } catch (e) {
              reject(new Error('解析上传结果失败: ' + data.substring(0, 200)));
            }
          });
        });
        uploadReq.on('error', e => reject(new Error('上传请求失败: ' + e.message)));
        uploadReq.on('timeout', () => { uploadReq.destroy(); reject(new Error('上传超时')); });

        for (const part of bodyParts) {
          if (typeof part === 'string') {
            uploadReq.write(part);
          } else {
            uploadReq.write(part);
          }
        }
        uploadReq.end();
      });

      // Step 3: 识别图片内容
      const prompt = `请仔细识别这张订单/发货单截图中的所有商品。每件商品提取：产品名称(productName)、数量(quantity,数字)、单位(unit)、单价(unitPrice,数字)、合计金额(amount,数字)、批发商(supplier)。以JSON数组格式返回，如：[{"productName":"白菜","quantity":10,"unit":"斤","unitPrice":1.5,"amount":15,"supplier":"老张批发"}]。注意：1)提取截图中全部商品 2)只返回JSON数组，不要任何其他文字`;

      const recogText = await new Promise((resolve, reject) => {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const sign = crypto.createHash('md5').update(`${APP_ID}&${timestamp}&${APP_KEY}`).digest('hex');

        const payload = JSON.stringify({ prompt: prompt, image_url: uploadUrl });

        const options = {
          hostname: 'autoglm-api.zhipuai.cn',
          path: '/agentdr/v1/assistant/skills/image-recognition',
          method: 'POST',
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
            'X-Auth-Appid': APP_ID,
            'X-Auth-TimeStamp': timestamp,
            'X-Auth-Sign': sign
          },
          timeout: 300000
        };

        const recogReq = https.request(options, (recogRes) => {
          let data = '';
          recogRes.on('data', chunk => data += chunk);
          recogRes.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (result.code === 0 && result.data && result.data.text) {
                resolve(result.data.text);
              } else {
                reject(new Error('识别失败: ' + (result.msg || '未知错误')));
              }
            } catch (e) {
              reject(new Error('解析识别结果失败: ' + data.substring(0, 200)));
            }
          });
        });
        recogReq.on('error', e => reject(new Error('识别请求失败: ' + e.message)));
        recogReq.on('timeout', () => { recogReq.destroy(); reject(new Error('识别超时')); });
        recogReq.write(payload);
        recogReq.end();
      });

      // Step 4: 解析识别结果
      let orders = [];
      let message = '';
      const text = recogText;

      // 1. 先从 markdown 代码块提取 JSON
      let jsonStr = null;
      const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeMatch) jsonStr = codeMatch[1].trim();

      // 2. 从纯文本提取 JSON 数组或对象
      if (!jsonStr) {
        const arrMatch = text.match(/\[[\s\S]*\]/);
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (arrMatch) jsonStr = arrMatch[0];
        else if (objMatch) jsonStr = objMatch[0];
      }

      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr);
          orders = Array.isArray(data) ? data : [data];
        } catch (e) {
          message = 'AI 已识别，但 JSON 格式不正确。原始内容: ' + text.substring(0, 300);
        }
      } else {
        message = 'AI 识别结果中未找到 JSON: ' + text.substring(0, 200);
      }

      return jsonResponse(res, {
        success: orders.length > 0,
        orders: orders,
        message: orders.length > 0 ? `成功识别 ${orders.length} 件商品` : message,
        raw: text.substring(0, 500)
      });
    } catch (e) {
      return jsonResponse(res, { error: e.message }, 500);
    }
  }

  // GET /api/stats — 统计信息
  if (url === '/api/stats' && req.method === 'GET') {
    const orders = readOrders();
    const totalAmount = orders.reduce((sum, o) => sum + o.amount, 0);
    const totalOrders = orders.length;
    const products = [...new Set(orders.map(o => o.productName))];

    // 按产品统计
    const productStats = {};
    orders.forEach(o => {
      if (!productStats[o.productName]) {
        productStats[o.productName] = { count: 0, totalAmount: 0, totalQuantity: 0 };
      }
      productStats[o.productName].count++;
      productStats[o.productName].totalAmount += o.amount;
      productStats[o.productName].totalQuantity += o.quantity;
    });

    // 价格变动记录
    const priceChanges = orders.filter(o => o.priceChange !== null && o.priceChange !== 0);

    return jsonResponse(res, {
      totalOrders,
      totalAmount: Math.round(totalAmount * 100) / 100,
      productCount: products.length,
      products,
      productStats,
      priceChangesCount: priceChanges.length,
      verificationFailures: orders.filter(o => o.verified === false).length
    });
  }

  // 404
  jsonResponse(res, { error: 'Not Found' }, 404);
}

// ======== 主服务 ========
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // API 路由
  if (url.startsWith('/api/')) {
    return handleAPI(req, res, req.url);
  }

  // 上传文件服务
  if (url.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(url));
    return serveStatic(res, filePath);
  }

  // 静态文件
  if (url === '/' || url === '/index.html') {
    return serveStatic(res, path.join(PUBLIC_DIR, 'index.html'));
  }

  // 其他静态文件
  const filePath = path.join(PUBLIC_DIR, url);
  if (fs.existsSync(filePath)) {
    return serveStatic(res, filePath);
  }

  // 最终404
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }

  console.log(`\n  🦐 老曾的订单助手已启动！\n`);
  console.log(`  💻 电脑访问: http://localhost:${PORT}`);
  console.log(`  📱 手机访问: http://${localIP}:${PORT}\n`);
  console.log(`  📦 数据文件: ${DATA_FILE}\n`);
  console.log(`  📸 图片目录: ${UPLOADS_DIR}\n`);
});
