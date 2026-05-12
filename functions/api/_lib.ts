// Vercel Serverless Function 的通用辅助工具
// 从 Vercel Request 对象中提取 JSON body、query params、route params

export interface ApiContext {
  params: Record<string, string>;
}

export function getQuery(request: Request): Record<string, string> {
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

export async function getBody<T = any>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

// 从 query 或 body 获取 room_id，必须提供
export function getRoomId(query: Record<string, string>, body?: any): string {
  return query.room || body?.room || '';
}

// Vercel 多部分表单解析（用于文件上传）
export async function parseMultipart(request: Request): Promise<{ fields: Record<string, string>; files: Map<string, { name: string; data: ArrayBuffer; type: string }> }> {
  const formData = await request.formData();
  const fields: Record<string, string> = {};
  const files = new Map<string, { name: string; data: ArrayBuffer; type: string }>();

  for (const [key, value] of formData.entries()) {
    if (value instanceof Blob) {
      files.set(key, {
        name: (value as File).name || 'unknown',
        data: await value.arrayBuffer(),
        type: value.type,
      });
    } else {
      fields[key] = String(value);
    }
  }

  return { fields, files };
}
