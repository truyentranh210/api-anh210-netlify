import fetch from "node-fetch";
import * as cheerio from "cheerio";

export async function handler(event) {
  const urlParams = new URLSearchParams(event.queryStringParameters);
  const searchKeyword = urlParams.get("s");
  const postUrl = urlParams.get("url");
  const path = event.path;
  const pageNumMatch = path.match(/page\/(\d+)/);
  const pageNum = pageNumMatch ? parseInt(pageNumMatch[1]) : 1;

  // Nếu có url → lấy chi tiết bài viết
  if (postUrl) return await getPostDetails(postUrl);

  // Nếu có từ khóa tìm kiếm → thực hiện tìm kiếm
  if (searchKeyword) return await performSearch(searchKeyword, pageNum);

  // Nếu thiếu tham số
  return jsonResponse({ error: "Vui lòng cung cấp tham số 's' hoặc 'url'." }, 400);
}

// ----------------------------
// 🧠 HÀM TÌM KIẾM BÀI VIẾT
// ----------------------------
async function performSearch(keyword, pageNum = 1) {
  try {
    const searchUrl =
      pageNum > 1
        ? `https://topanhanime.com/page/${pageNum}/?s=${encodeURIComponent(keyword)}`
        : `https://topanhanime.com/?s=${encodeURIComponent(keyword)}`;

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    };

    const res = await fetch(searchUrl, { headers });
    if (res.status === 404) return jsonResponse([]);

    const html = await res.text();
    const $ = cheerio.load(html);

    let searchResults = $("div.bs, div.utao, div.post-item");
    if (searchResults.length === 0) return jsonResponse([]);

    const resultsData = [];
    searchResults.each((_, el) => {
      const aTag = $(el).find("a").first();
      const imgTag = $(el).find("img").first();
      if (aTag.length && imgTag.length) {
        let title =
          aTag.attr("title") ||
          $(el).find("h5.post-title").text().trim() ||
          "Không có tiêu đề";
        resultsData.push({
          tieu_de: title,
          hinh_anh: imgTag.attr("src"),
          link_bai_viet: aTag.attr("href"),
        });
      }
    });

    return jsonResponse(resultsData);
  } catch (e) {
    return jsonResponse({ error: `Lỗi kết nối: ${e.message}` }, 500);
  }
}

// ----------------------------
// 🧠 HÀM LẤY CHI TIẾT BÀI VIẾT
// ----------------------------
async function getPostDetails(fullUrl) {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    };

    const res = await fetch(fullUrl, { headers });
    if (res.status === 404)
      return jsonResponse({ error: "Không tìm thấy bài viết." }, 404);

    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $("h1.entry-title").text().trim() || "Không tìm thấy tiêu đề";
    const content = $("div.entry-content");

    if (content.length === 0)
      return jsonResponse(
        { error: "Không thể tìm thấy nội dung bài viết." },
        404
      );

    const images = [];
    content.find("img").each((_, img) => {
      const src = $(img).attr("src");
      if (src) images.push(src);
    });

    return jsonResponse({
      tieu_de: title,
      danh_sach_anh: images,
    });
  } catch (e) {
    return jsonResponse({ error: `Lỗi khi lấy chi tiết bài viết: ${e.message}` }, 500);
  }
}

// ----------------------------
// ⚙️ HÀM HỖ TRỢ TRẢ JSON
// ----------------------------
function jsonResponse(data, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(data, null, 2),
  };
}
