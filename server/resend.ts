import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function sendInvitationEmail(toEmail: string, invitationUrl: string) {
  const { client, fromEmail } = await getUncachableResendClient();
  
  // Use Resend's onboarding email for development since custom domains need verification
  const senderEmail = fromEmail?.includes('resend.dev') ? fromEmail : 'onboarding@resend.dev';
  
  const { data, error } = await client.emails.send({
    from: senderEmail,
    to: [toEmail],
    subject: 'You\'re invited to Farm Jersey',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to Farm Jersey</h2>
        <p>You've been invited to access the Farm Jersey grant application system.</p>
        <p>Click the link below to accept your invitation and log in:</p>
        <p style="margin: 30px 0;">
          <a href="${invitationUrl}" style="background-color: #c69a71; color: #231f20; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Accept Invitation
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          This invitation link is one-time use only and will expire in 7 days.
        </p>
        <p style="color: #666; font-size: 14px;">
          If you did not expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Error sending invitation email:', error);
    throw new Error('Failed to send invitation email');
  }

  return data;
}
