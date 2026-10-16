import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

const sharePointPathFile = path.join(process.cwd(), "sharepoint-path.txt");

function readSharePointBasePath() {
  if (!fs.existsSync(sharePointPathFile)) return "";

  const value = fs.readFileSync(sharePointPathFile, "utf8").trim();
  if (!value) return "";

  const normalized = value.split("/").filter(Boolean).join("/");
  return normalized ? `/${normalized}` : "";
}

const isHostinger = process.env.DEPLOY_TARGET === "hostinger";
const basePath = isHostinger ? "" : readSharePointBasePath();

const nextConfig: NextConfig = {
  // Static export works for both Hostinger and SharePoint.
  // DEPLOY_TARGET=hostinger removes the SharePoint-specific basePath.
  output: "export",
  ...(basePath ? { basePath, trailingSlash: true } : {}),
};

export default nextConfig;
