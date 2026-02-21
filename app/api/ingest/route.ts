import { NextResponse } from "next/server";
import { setRepo } from "@/lib/db";
import { downloadGitHubZip, extractTextFilesFromZip } from "@/lib/repo";
import { validateGitHubUrl, validateZipUpload } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const githubUrl = validateGitHubUrl(String(form.get("githubUrl") || ""));
    const zipFile = validateZipUpload(form.get("zipFile"));

    if (githubUrl && zipFile) {
      return NextResponse.json(
        { error: "Provide either GitHub URL or zip upload, not both." },
        { status: 400 }
      );
    }

    if (!githubUrl && !zipFile) {
      return NextResponse.json(
        { error: "Provide either a public GitHub URL or a .zip file" },
        { status: 400 }
      );
    }

    if (githubUrl) {
      const downloaded = await downloadGitHubZip(githubUrl);
      const files = extractTextFilesFromZip(downloaded.zipBytes);

      await setRepo({
        sourceType: "github",
        sourceLabel: `${downloaded.meta.owner}/${downloaded.meta.repo}@${downloaded.meta.branch}`,
        files,
        ingestedAt: new Date().toISOString(),
        github: downloaded.meta
      });

      return NextResponse.json({
        ok: true,
        sourceType: "github",
        sourceLabel: `${downloaded.meta.owner}/${downloaded.meta.repo}@${downloaded.meta.branch}`,
        fileCount: files.length
      });
    }

    const zipBytes = Buffer.from(await zipFile!.arrayBuffer());
    const files = extractTextFilesFromZip(zipBytes);

    await setRepo({
      sourceType: "zip",
      sourceLabel: zipFile!.name,
      files,
      ingestedAt: new Date().toISOString()
    });

    return NextResponse.json({
      ok: true,
      sourceType: "zip",
      sourceLabel: zipFile!.name,
      fileCount: files.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    const status = /invalid|required|provide|only|large|use a valid/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
