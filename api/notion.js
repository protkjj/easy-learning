// Vercel Serverless Function: Notion API 프록시
const NOTION_HEADERS = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  "Notion-Version": "2022-06-28",
});

const MAX_PAGES = 10; // 최대 10회 페이지네이션 (1000개)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    return res.status(500).json({ error: "NOTION_TOKEN not configured" });
  }

  const { action, ...body } = req.body;

  try {
    // 페이지 생성
    if (action !== "query") {
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: NOTION_HEADERS(notionToken),
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // DB 쿼리 — 페이지네이션으로 전체 데이터 수집
    const url = `https://api.notion.com/v1/databases/${body.database_id}/query`;
    const queryBody = body.filter ? { filter: body.filter } : {};
    let allResults = [];
    let cursor = undefined;

    for (let i = 0; i < MAX_PAGES; i++) {
      const response = await fetch(url, {
        method: "POST",
        headers: NOTION_HEADERS(notionToken),
        body: JSON.stringify({ ...queryBody, ...(cursor ? { start_cursor: cursor } : {}) }),
      });

      if (!response.ok) {
        const data = await response.json();
        return res.status(response.status).json(data);
      }

      const data = await response.json();
      allResults = allResults.concat(data.results || []);

      if (!data.has_more) break;
      cursor = data.next_cursor;
    }

    return res.status(200).json({ results: allResults, has_more: false });
  } catch (error) {
    return res.status(500).json({ error: "Notion API call failed", detail: error.message });
  }
}
