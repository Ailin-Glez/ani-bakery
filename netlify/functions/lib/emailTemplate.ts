const LOGO_URL = 'https://anisartisanbakery.com/ana-logo.jpeg'

const BRAND = {
  wine: '#6B7A50',
  cream: '#FFFCFA',
  creamLight: '#FDF8F5',
  brownDark: '#2D1B1B',
  brownMid: '#5C3535',
  rose: '#C8D4B0',
}

interface EmailTemplateOptions {
  heading: string
  bodyHtml: string
  ctaLabel?: string
  ctaUrl?: string
}

export function renderBrandedEmail({ heading, bodyHtml, ctaLabel, ctaUrl }: EmailTemplateOptions) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:${BRAND.creamLight};font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.creamLight};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background-color:${BRAND.cream};border-radius:24px;overflow:hidden;border:1px solid ${BRAND.rose};">
          <tr>
            <td style="background-color:${BRAND.wine};padding:24px;text-align:center;">
              <img src="${LOGO_URL}" alt="Ani's Artisan Bakery" width="64" height="64" style="border-radius:50%;border:3px solid rgba(255,255,255,0.4);object-fit:cover;display:inline-block;" />
              <p style="color:${BRAND.cream};font-size:18px;font-weight:bold;margin:12px 0 0;font-family:Georgia,serif;">Ani's Artisan Bakery</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h2 style="color:${BRAND.brownDark};font-size:20px;margin:0 0 16px;font-family:Georgia,serif;">${heading}</h2>
              <div style="color:${BRAND.brownMid};font-size:15px;line-height:1.6;">${bodyHtml}</div>
              ${ctaUrl ? `<p style="margin-top:24px;"><a href="${ctaUrl}" style="background-color:${BRAND.wine};color:${BRAND.cream};padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block;">${ctaLabel}</a></p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;text-align:center;border-top:1px solid ${BRAND.rose};">
              <p style="color:${BRAND.brownMid};font-size:12px;margin:0;">Ani's Artisan Bakery · Hecho con ♥</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function textToHtmlParagraphs(text: string) {
  return text.split('\n').map(line => `<p style="margin:0 0 8px;">${line || '&nbsp;'}</p>`).join('')
}
