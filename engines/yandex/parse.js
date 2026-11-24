import * as cheerio from "cheerio";

const absolute = (raw, domain) => {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://${domain}${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return undefined;
};

const cleanText = (value) =>
  typeof value === "string" ? cheerio.load(`<span>${value}</span>`).text().trim() : "";

const isYandexUrl = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "yandex.com" || host === "ya.ru" || host === "yandex.ru";
  } catch {
    return true;
  }
};

export const parseWeb = ($, domain, name) => {
  const results = [];
  $("li.serp-item[data-cid]").each((_, el) => {
    const item = $(el);
    if (item.find(".Label_theme_direct, [data-fast-name='adv']").length > 0) return;

    const link = item.find("a.OrganicTitle-Link, h2 a").first();
    const title = link.text().trim();
    let url = absolute(link.attr("href"), domain);
    if ((!url || isYandexUrl(url)) && !title) return;

    if (!url || isYandexUrl(url)) {
      url = absolute(item.find("a.OrganicHost-Link").first().attr("href"), domain);
    }
    if (!url || isYandexUrl(url) || !title) return;

    const snippet =
      cleanText(
        item
          .find(".OrganicTextContent, .OrganicText, [class*='OrganicTextContent']")
          .first()
          .html() ?? "",
      ) || undefined;

    results.push({
      title,
      url,
      snippet,
      source: name,
      displayUrl: item.find(".Path-Item").first().text().trim() || undefined,
    });
  });
  return results;
};

export const parseLegacyWeb = ($, domain, name) => {
  const results = [];
  $("li.b-serp-item").each((_, el) => {
    const item = $(el);
    if (item.find(".b-direct, .ad").length > 0) return;
    const link = item.find("a.b-serp-item__title-link").first();
    const title = cleanText(link.text());
    const url = absolute(link.attr("href"), domain);
    if (!title || !url || isYandexUrl(url)) return;
    const snippet =
      cleanText(item.find(".b-serp-item__text").first().html() ?? "") || undefined;
    results.push({
      title,
      url,
      snippet,
      source: name,
      displayUrl: item.find(".b-serp-url").first().text().trim() || undefined,
    });
  });
  return results;
};
