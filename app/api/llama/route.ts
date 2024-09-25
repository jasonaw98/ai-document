import { NextResponse } from "next/server";
import OpenAI from "openai";
import FirecrawlApp from "@mendable/firecrawl-js";

const openai = new OpenAI();
const firecrawlApp = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export async function POST(request: Request) {
  const { url, instructions } = await request.json();

  const crawlResponse = await firecrawlApp.crawlUrl(url, {
    limit: 5,
    scrapeOptions: {
      formats: ["markdown", "html"],
    },
  });

  if (!crawlResponse.success) {
    throw new Error(`Failed to crawl: ${crawlResponse.error}`);
  }

  console.log(crawlResponse.data);

  const completion = await openai.chat.completions.create({
    model: "o1-preview",
    messages: [
      {
        role: "user",
        content: `
          Generate a report with the following details in valid HTML:
          - Instructions: ${instructions}
          - URL: ${url}
          - Results: ${JSON.stringify(crawlResponse.data)}
        `,
      },
    ],
  });

  const response = await fetch(" http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3.1",
      prompt: `
           Generate a report with the following details in valid HTML:
           - Instructions: ${instructions}
           - URL: ${url}
           - Results: ${JSON.stringify(crawlResponse.data)}
         `,
    }),
  });

  // const reader = response.body!.getReader();
  // const decoder = new TextDecoder();
  // let result = "";
  // while (true) {
  //   const { done, value } = await reader?.read();
  //   if (done) {
  //     break;
  //   }
  //   result += decoder.decode(value);
  // }

  const reader = response.body!.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const decoded = new TextDecoder().decode(value);
    const json = JSON.parse(decoded);
    console.log(json.response);
  }


  const generatedHtml = completion.choices[0].message.content;

  return NextResponse.json({
    html: generatedHtml,
    crawlData: crawlResponse.data,
  });
}
