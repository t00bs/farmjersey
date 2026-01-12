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
  const { client } = await getUncachableResendClient();
  
  // Use verified domain for sending
  const senderEmail = 'Farm Jersey <noreply@mail.farmjersey.je>';
  
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

export async function sendPasswordResetEmail(toEmail: string, resetUrl: string) {
  const { client } = await getUncachableResendClient();
  
  const senderEmail = 'Farm Jersey <noreply@mail.farmjersey.je>';
  
  const { data, error } = await client.emails.send({
    from: senderEmail,
    to: [toEmail],
    subject: 'Reset Your Password - Farm Jersey',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background-color: #231f20; padding: 30px; text-align: center;">
            <h1 style="color: #c69a71; margin: 0; font-size: 24px;">Farm Jersey</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h2 style="color: #231f20; margin: 0 0 20px 0; font-size: 22px;">Password Reset Request</h2>
            
            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              We received a request to reset your password for your Farm Jersey account. Click the button below to create a new password:
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${resetUrl}" style="background-color: #c69a71; color: #231f20; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #555555; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
              Or copy and paste this link into your browser:
            </p>
            <p style="color: #c69a71; font-size: 14px; word-break: break-all; margin: 0 0 30px 0;">
              ${resetUrl}
            </p>
            
            <!-- Security Notice -->
            <div style="background-color: #f9f9f9; border-radius: 6px; padding: 20px; margin-top: 30px;">
              <p style="color: #666666; font-size: 13px; line-height: 1.5; margin: 0;">
                <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f5f5f5; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
            <p style="color: #999999; font-size: 12px; margin: 0;">
              Rural Support Scheme Portal
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }

  return data;
}

export async function sendResubmissionEmail(toEmail: string, reason: string, applicationUrl: string) {
  const { client } = await getUncachableResendClient();
  
  const senderEmail = 'Farm Jersey <noreply@mail.farmjersey.je>';
  
  const { data, error } = await client.emails.send({
    from: senderEmail,
    to: [toEmail],
    subject: 'Action Required: Your Application Needs Changes - Farm Jersey',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background-color: #231f20; padding: 30px; text-align: center;">
            <h1 style="color: #c69a71; margin: 0; font-size: 24px;">Farm Jersey</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h2 style="color: #231f20; margin: 0 0 20px 0; font-size: 22px;">Your Application Requires Changes</h2>
            
            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Your grant application has been reviewed and requires some changes before it can be processed. Please review the feedback below and update your application accordingly.
            </p>
            
            <!-- Reason Box -->
            <div style="background-color: #fff8f0; border-left: 4px solid #c69a71; padding: 20px; margin: 25px 0; border-radius: 0 6px 6px 0;">
              <p style="color: #231f20; font-size: 14px; font-weight: bold; margin: 0 0 10px 0;">Reason for resubmission:</p>
              <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${reason}</p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${applicationUrl}" style="background-color: #c69a71; color: #231f20; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                Edit Your Application
              </a>
            </div>
            
            <p style="color: #555555; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
              Or copy and paste this link into your browser:
            </p>
            <p style="color: #c69a71; font-size: 14px; word-break: break-all; margin: 0 0 30px 0;">
              ${applicationUrl}
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f5f5f5; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
            <p style="color: #999999; font-size: 12px; margin: 0;">
              Rural Support Scheme Portal
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    console.error('Error sending resubmission email:', error);
    throw new Error('Failed to send resubmission email');
  }

  return data;
}
