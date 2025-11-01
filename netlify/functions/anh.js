const cheerio = require("cheerio");

// =============================
// 🔹 Hàm chính (handler)
// =============================
exports.handler = async function (event) {
  const params = new URLSearchParams(event.queryStringParameters);
  const searchKeyword = params.get("s");
  const postUrl = params.get("url");
  const path = event.path;
  const pageNumMatch = path.match(/page\/(\d+)/);
  const pageNum = pageNumMatch ? parseInt(pageNumMatch[1]) : 1;

  // 🏠 /home → hiển thị hướng dẫn API
  if (path === "/home" || path === "/anh/home") {
    return jsonResponse({
      project: "🖼️ TopAnhAnime API (Netlify Functions)",
      author: "truyentranh210",
      version: "1.0.0",
      updated: new Date().toISOString(),
      description:
        "API cho phép tìm kiếm và lấy toàn bộ ảnh từ các bài viết trên trang TopAnhAnime.",
      usage: {
        "/home": "Hiển thị hướng dẫn chi tiết (trang hiện tại)",
        "/anh?s=<từ-khóa>": "Tìm kiếm bài viết hoặc bộ ảnh theo từ khóa",
        "/anh?url=<link-bài-viết>":
          "Lấy toàn bộ ảnh trong bài viết cụ thể từ đường dẫn",
      },
      parameters: {
        "s": "Chuỗi từ khóa cần tìm (VD: one piece, naruto, anime girl)",
        "url": "Link bài viết cần tải ảnh (VD: https://topanhanime.com/abc...)",
      },
      examples: {
        search: "/anh?s=anime&page=1",
        get_details:
          "/anh?url=https://topanhanime.com/truyen-tranh-sexy-001",
      },
      response_format: {
        "tieu_de": "Tiêu đề bài viết hoặc bộ ảnh",
        "hinh_anh": "URL hình ảnh (trong danh sách)",
        "link_bai_viet": "Link chi tiết bài viết",
      },
      message:
        "✅ API đang hoạt động! Hãy thử gọi /anh?s=anime hoặc /anh?url=<link-bài-viết>.",
    });
  }

  // 📘 Nếu có ?url= → lấy chi tiết bài viết
  if (postUrl) return await getPostDetails(postUrl);

  // 🔍 Nếu có ?s= → tìm kiếm
  if (searchKeyword) return await performSearch(searchKeyword, pageNum);

  // ❌ Không có tham số hợp lệ
  return jsonResponse({ error: "Vui lòng cung cấp 's' hoặc 'url'." }, 400);
};

// =============================
// 🔹 Hàm tìm kiếm
// =============================
async function performSearch(keyword, pageNum = 1) {
  try {
    const searchUrl =
      pageNum > 1
        ? `https://topanhanime.com/page/${pageNum}/?s=${encodeURIComponent(
            keyword
          )}`
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

    const results = [];
    searchResults.each((_, el) => {
      const aTag = $(el).find("a").first();
      const imgTag = $(el).find("img").first();
      if (aTag.length && imgTag.length) {
        let title =
          aTag.attr("title") ||
          $(el).find("h5.post-title").text().trim() ||
          "Không có tiêu đề";
        results.push({
          tieu_de: title,
          hinh_anh: imgTag.attr("src"),
          link_bai_viet: aTag.attr("href"),
        });
      }
    });

    return jsonResponse(results);
  } catch (err) {
    return jsonResponse({ error: `Lỗi kết nối: ${err.message}` }, 500);
  }
}

// =============================
// 🔹 Hàm lấy chi tiết bài viết
// =============================
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
      tong_so_anh: images.length,
    });
  } catch (err) {
    return jsonResponse(
      { error: `Lỗi khi lấy chi tiết bài viết: ${err.message}` },
      500
    );
  }
}

// =============================
// 🔹 Hàm trả JSON
// =============================
function jsonResponse(data, status = 200) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(data, null, 2),
  };
}
