import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PatientEmailRequest {
  to: string;
  patientName: string;
  diagnosis: string;
  result: 'aceptado' | 'rechazado';
  explanation: string;
  additionalComment?: string;
  insuranceStatus?: 'pendiente' | 'aceptada' | 'rechazada' | null;
  insuranceType?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, 
      patientName, 
      diagnosis, 
      result, 
      explanation, 
      additionalComment,
      insuranceStatus,
      insuranceType
    }: PatientEmailRequest = await req.json();

    console.log("Sending email to:", to);

    const resultText = result === 'aceptado' ? 'ACTIVADA' : 'NO ACTIVADA';
    const resultColor = result === 'aceptado' ? '#10b981' : '#ef4444';
    
    // Determinar el estado de la aseguradora
    let insuranceStatusText = '';
    let insuranceStatusColor = '';
    if (insuranceStatus && insuranceType) {
      if (insuranceStatus === 'pendiente') {
        insuranceStatusText = `PENDIENTE RESOLUCIÓN ${insuranceType.toUpperCase()}`;
        insuranceStatusColor = '#6b7280';
      } else if (insuranceStatus === 'aceptada') {
        insuranceStatusText = `ACEPTADO POR ${insuranceType.toUpperCase()}`;
        insuranceStatusColor = '#10b981';
      } else if (insuranceStatus === 'rechazada') {
        insuranceStatusText = `RECHAZADO POR ${insuranceType.toUpperCase()}`;
        insuranceStatusColor = '#ef4444';
      }
    }

    const emailResponse = await resend.emails.send({
      from: "SaludIA <noreply@saludia.net>",
      to: [to],
      subject: "Resultado de Evaluación - Ley de Urgencia",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #0EA5E9 0%, #06B6D4 100%);
                color: white;
                padding: 30px 20px;
                border-radius: 8px 8px 0 0;
                text-align: center;
              }
              .content {
                background: #ffffff;
                padding: 30px;
                border: 1px solid #e5e7eb;
                border-top: none;
              }
              .result-box {
                background: #f9fafb;
                border-left: 4px solid ${resultColor};
                padding: 20px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .result-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 10px;
              }
              .result-status {
                color: ${resultColor};
                font-weight: bold;
                font-size: 20px;
              }
              .section {
                margin: 20px 0;
              }
              .section-title {
                font-weight: bold;
                margin-bottom: 8px;
                color: #0EA5E9;
              }
              .footer {
                background: #f9fafb;
                padding: 20px;
                text-align: center;
                border-radius: 0 0 8px 8px;
                color: #6b7280;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">Resultado de Evaluación</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Ley de Urgencia - Decreto 34</p>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; color: #0EA5E9; font-weight: 500;">
                Estimado/a ${patientName},
              </p>
              
              <p>
                Por medio del presente, le informamos el resultado de la evaluación de su caso clínico
                bajo la Ley de Urgencia (Decreto 34).
              </p>
              
              <div class="result-box">
                <div class="result-title">
                  <span style="color: #0EA5E9; font-size: 16px;">Decisión Médica:</span>
                  <div style="margin-top: 8px;">
                    <span class="result-status" style="font-size: 28px; font-weight: bold; color: ${resultColor};">
                      LEY DE URGENCIA ${resultText}
                    </span>
                  </div>
                </div>
                <p style="margin: 15px 0 0 0; font-size: 14px;">
                  <strong>Diagnóstico:</strong> ${diagnosis}
                </p>
              </div>
              
              ${insuranceStatusText ? `
                <div style="background: #f9fafb; border-left: 4px solid ${insuranceStatusColor}; padding: 20px; margin: 20px 0; border-radius: 4px;">
                  <div style="margin-bottom: 10px;">
                    <span style="color: #0EA5E9; font-size: 16px; font-weight: bold;">Estado de Aseguradora:</span>
                  </div>
                  <div>
                    <span style="color: ${insuranceStatusColor}; font-weight: bold; font-size: 24px;">
                      ${insuranceStatusText}
                    </span>
                  </div>
                </div>
              ` : ''}
              
              ${result === 'aceptado' && insuranceStatus && insuranceType ? `
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.6;">
                    <strong>Importante:</strong> 
                    ${insuranceStatus === 'aceptada' 
                      ? `Su aseguradora (${insuranceType}) ha aprobado la decisión médica. La Ley de Urgencia está activa y en pleno efecto.`
                      : insuranceStatus === 'rechazada'
                      ? `Su aseguradora (${insuranceType}) ha rechazado la decisión médica. La Ley de Urgencia no se activará. Por favor, contacte con su aseguradora para más información sobre su caso.`
                      : (insuranceStatus === 'pendiente' || insuranceStatus === 'pendiente_envio')
                      ? `Para que la Ley de Urgencia se active definitivamente, su aseguradora (${insuranceType}) debe aprobar esta decisión médica. La activación definitiva de la ley está sujeta a la aprobación de ${insuranceType}.`
                      : `Para que la Ley de Urgencia se active definitivamente, su aseguradora (${insuranceType}) debe aprobar esta decisión médica. La activación definitiva de la ley está sujeta a la aprobación de ${insuranceType}.`
                    }
                  </p>
                </div>
              ` : ''}
              
              <div class="section">
                <div class="section-title">Fundamento Legal:</div>
                <p style="font-size: 14px; color: #6b7280;">
                  Según lo establecido en el Decreto 34, que regula la Ley de Urgencia en Chile, se ha
                  evaluado su condición médica bajo los criterios establecidos en dicha normativa.
                </p>
              </div>
              
              <div class="section">
                <div class="section-title">Explicación del Análisis:</div>
                <p style="font-size: 14px; color: #6b7280;">
                  ${explanation}
                </p>
              </div>
              
              ${additionalComment ? `
                <div class="section">
                  <div class="section-title">Comentario del Médico Tratante:</div>
                  <p style="font-size: 14px; color: #6b7280;">
                    ${additionalComment}
                  </p>
                </div>
              ` : ''}
              
              <p style="margin-top: 30px;">
                Ante cualquier duda o consulta, no dude en contactarnos.
              </p>
              
              <p>
                Atentamente,<br>
                <strong>Equipo Médico - SaludIA</strong>
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 0;">
                Este es un correo automático generado por SaludIA.<br>
                Por favor no responda directamente a este mensaje.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      data: emailResponse 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-patient-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
