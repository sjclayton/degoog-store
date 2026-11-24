const _abs = (url) =>
  typeof url === "string" && url.startsWith("//") ? `https:${url}` : url;

const _cleanTitle = (title) =>
  typeof title === "string" ? title.replace(/\[[^\]]*\]/g, "").trim() : "";

const _durationText = (duration) => {
  if (!duration || typeof duration !== "object") return "";
  return typeof duration.text === "string" ? duration.text : "";
};

const _watchUrl = (clip, dup) => {
  if (clip?.url) return clip.url;
  if (dup?.player?.videoUrl) return dup.player.videoUrl;
  if (dup?.host?.href) return dup.host.href;
  if (dup?.href) return _abs(dup.href);
  return "";
};

const _thumbnail = (clip, dup, clips, dups) => {
  const poster = clip?.preview?.posterSrc;
  if (typeof poster === "string" && poster) return _abs(poster);
  if (dup?.thumbnail) return _abs(dup.thumbnail);
  const parentId = dup?.parentClipId;
  if (typeof parentId === "string" && parentId && parentId !== dup?.videoId) {
    const parentClip = clips?.[parentId];
    const parentPoster = parentClip?.preview?.posterSrc;
    if (typeof parentPoster === "string" && parentPoster) return _abs(parentPoster);
    const parentDup = dups?.[parentId];
    if (parentDup?.thumbnail) return _abs(parentDup.thumbnail);
  }
  return "";
};

const _title = (clip, dup) => {
  const clean = dup?.cleanTitle || dup?.title || "";
  const fromClip = typeof clip?.description === "string" ? clip.description : "";
  const title = clean || fromClip;
  return _cleanTitle(title);
};

const _channel = (dup) => {
  const host = dup?.host;
  if (!host) return "";
  if (host.secondPart?.type === "CHANNEL") {
    const a11y = host.secondPart.a11yText;
    if (typeof a11y === "string" && a11y) return a11y.replace(/\.$/, "");
  }
  if (typeof host.title === "string") return host.title;
  return "";
};

const _source = (dup) => {
  const host = dup?.host;
  if (!host) return "";
  return (
    host.providerName || host.name || host.sourceHost || host.title || ""
  );
};

export const parseResults = (data, name, options = {}) => {
  const { strict = false } = options;
  const results = data?.results;
  if (!results) return [];

  const serpItems = results.search?.serpItems ?? [];
  const clips = results.clips?.items ?? {};
  const dups = results.clips?.dups ?? {};

  const out = [];
  const seen = new Set();

  for (const item of serpItems) {
    if (item?.type !== "videoSnippet") continue;
    const vid = item?.props?.videoId;
    if (typeof vid !== "string" || !vid) continue;

    const clip = clips[vid] ?? {};
    const dup = dups[vid] ?? {};

    const censored = clip.censored === true;
    if (strict && censored) continue;

    const url = _watchUrl(clip, dup);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const title = _title(clip, dup);
    const thumbnail = _thumbnail(clip, dup, clips, dups);
    const duration = _durationText(dup.duration);
    const channel = _channel(dup);
    const hostName = _source(dup);

    out.push({
      title,
      url,
      snippet: typeof clip.description === "string" ? clip.description : "",
      source: hostName || name,
      ...(thumbnail ? { thumbnail } : {}),
      ...(duration ? { duration } : {}),
      ...(channel ? { channel } : {}),
    });
  }

  return out;
};
