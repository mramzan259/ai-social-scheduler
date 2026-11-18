import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Lightweight Google Drive upload using fetch (no googleapis needed)
async function uploadToDrive(content: string, fileName: string): Promise<string | null> {
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

    const { access_token } = await tokenRes.json();
    if (!access_token) return null;

    // Multipart upload to Drive
    const boundary = 'boundary_ai_scheduler';
    const metadata = JSON.stringify({ name: fileName, mimeType: 'text/plain' });
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
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

    const { id } = await uploadRes.json();
    return id || null;
  } catch (err) {
    console.error('Drive upload error:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { caption, scheduledTime, platform, email } = await req.json();

  // Save to Google Drive
  const content = `AI Social Scheduler - Draft Post\n${'='.repeat(40)}\nPlatform: ${platform}\nScheduled: ${new Date(scheduledTime).toLocaleString()}\nCreated: ${new Date().toLocaleString()}\n\nCaption:\n${caption}`;

  const fileId = await uploadToDrive(content, `post-${platform}-${Date.now()}.txt`);

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
            ? `<p style="color:#6ee7b7;margin:0 0 8px;">✅ Saved to Google Drive</p>`
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

  return NextResponse.json({ success: true, fileId, emailSent });
}
