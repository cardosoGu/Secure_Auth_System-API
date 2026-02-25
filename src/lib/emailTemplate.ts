export function verificationCodeTemplate(code: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de verificação</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#111827;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">
                Auth Service
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 12px;color:#111827;font-size:18px;font-weight:600;">
                Seu código de verificação
              </h2>
              <p style="margin:0 0 32px;color:#6b7280;font-size:14px;line-height:1.6;">
                Use o código abaixo para confirmar seu cadastro. Ele é válido por <strong>15 minutos</strong>.
              </p>

              <!-- Code Box -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;margin-bottom:32px;">
                <span style="font-size:36px;font-weight:700;color:#111827;letter-spacing:10px;">
                  ${code}
                </span>
              </div>

              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;">
                Se você não solicitou este código, ignore este email. Nenhuma ação é necessária.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © ${new Date().getFullYear()} Auth Service. Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
