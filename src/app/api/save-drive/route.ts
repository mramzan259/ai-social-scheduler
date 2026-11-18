import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Helper: Check if folder exists, if not create it
async function getOrCreateFolder(accessToken: string, folderName = 'AI Social Scheduler'): Promise<string | null> {
  try {
    // 1. Search if folder already exists in Google Drive
    const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&spaces=drive`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // 2. If folder does not exist, create it
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id || null;
    }
    return null;
  } catch (err) {
    console.error('getOrCreateFolder error:', err);
    return null;
  }
}

// Lightweight Google Drive upload using fetch (saves inside folder)
async function uploadToDrive(content: string, fileName: string): Promise<{ fileId: string | null; folderId: string | null }> {
  try {
    // Get access token from refresh token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;
    if (!access_token) {
      console.error('No access token received:', tokenData);
      return { fileId: null, folderId: null };
    }

    // Get or create dedicated folder: 'AI Social Scheduler'
    const folderId = await getOrCreateFolder(access_token, 'AI Social Scheduler');

    // Multipart upload to Drive inside the folder
    const boundary = 'boundary_ai_scheduler';
    const metadata: Record<string, unknown> = {
      name: fileName,
      mimeType: 'text/plain',
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const metadataStr = JSON.stringify(metadata);
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadataStr,
      `--${boundary}`,
      'Content-Type: text/plain',
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n');

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    const uploadData = await uploadRes.json();
    return {
      fileId: uploadData.id || null,
      folderId: folderId || null,
    };
  } catch (err) {
    console.error('Drive upload error:', err);
    return { fileId: null, folderId: null };
  }
}

export async function POST(req: NextRequest) {
  const { caption, scheduledTime, platform, email } = await req.json();

  // Save to Google Drive inside 'AI Social Scheduler' folder
  const content = `AI Social Scheduler - Draft Post\n${'='.repeat(40)}\nPlatform: ${platform}\nScheduled: ${new Date(scheduledTime).toLocaleString()}\nCreated: ${new Date().toLocaleString()}\nFolder: AI Social Scheduler\n\nCaption:\n${caption}`;

  const { fileId, folderId } = await uploadToDrive(content, `post-${platform}-${Date.now()}.txt`);

  // Send email notification
  let emailSent = false;
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `AI Social Scheduler <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `📅 Post Scheduled for ${platform}!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e);color:white;border-radius:16px;padding:32px;">
          <h1 style="margin:0 0 8px;font-size:28px;">✨ AI Social Scheduler</h1>
          <p style="color:#a5b4fc;margin:0 0 24px;">Your post has been scheduled!</p>
          
          <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin-bottom:20px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#f472b6;font-weight:bold;padding:6px 0;width:140px;">Platform</td><td style="color:#e0e7ff;">${platform}</td></tr>
              <tr><td style="color:#f472b6;font-weight:bold;padding:6px 0;">Scheduled Time</td><td style="color:#e0e7ff;">${new Date(scheduledTime).toLocaleString()}</td></tr>
            </table>
          </div>

          <div style="background:rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:20px;">
            <p style="color:#f472b6;font-weight:bold;margin:0 0 10px;">Caption:</p>
            <p style="color:#e0e7ff;line-height:1.7;margin:0;">${caption}</p>
          </div>

          ${fileId
            ? `<p style="color:#6ee7b7;margin:0 0 8px;">📁 Saved to Google Drive in folder: <strong>AI Social Scheduler</strong></p>`
            : `<p style="color:#fbbf24;margin:0 0 8px;">⚠️ Drive save skipped (check credentials)</p>`
          }

          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:20px 0;"/>
          <p style="color:#6366f1;font-size:12px;margin:0;">Built with Next.js + Gemini AI 🚀</p>
        </div>
      `,
    });
    emailSent = true;
  } catch (err) {
    console.error('Email error:', err);
  }

  return NextResponse.json({ success: true, fileId, folderId, emailSent });
}
