import { OAuth2Client } from 'google-auth-library';

const getClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  return new OAuth2Client(clientId);
};

export const verifyGoogleCredential = async (credential) => {
  const client = getClient();
  if (!client) {
    throw new Error('Google Sign-In is not configured on the server (GOOGLE_CLIENT_ID)');
  }

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error('Google account email is not available');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    profilePic: payload.picture || '',
    emailVerified: payload.email_verified,
  };
};
