// Vercel Serverless Function: Notion API 프록시
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
    let url = "https://api.notion.com/v1/pages";
    let fetchBody = body;

    if (action === "query") {
      url = `https://api.notion.com/v1/databases/${body.database_id}/query`;
      fetchBody = body.filter ? { filter: body.filter } : {};
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify(fetchBody),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Notion API call failed" });
  }
}
