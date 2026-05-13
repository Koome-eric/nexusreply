import { prisma } from "./db";
import { refreshAccessToken } from "./ghl";

export async function getValidTokenForLocation(locationId: string): Promise<{
  token: string;
  userId: string;
  location: { id: string; ghlLocationId: string; name: string };
} | null> {
  const location = await prisma.location.findUnique({
    where: { ghlLocationId: locationId },
    include: { ghlConnection: true, user: true },
  });
  if (!location) return null;

  const conn = location.ghlConnection;
  const now = new Date();
  const expiresAt = conn.tokenExpiresAt;

  let token = conn.accessToken;

  // Private integration tokens (pit-...) never expire — skip refresh entirely.
  // Only attempt OAuth refresh for tokens that are about to expire AND
  // where the access/refresh tokens differ (OAuth pattern).
  const isPrivateKey = conn.accessToken?.startsWith("pit-");
  const nearExpiry   = expiresAt && (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000);
  const canRefresh   = !isPrivateKey && nearExpiry && conn.refreshToken !== conn.accessToken;

  if (canRefresh) {
    try {
      const refreshed = await refreshAccessToken(conn.refreshToken);
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
      await prisma.gHLConnection.update({
        where: { id: conn.id },
        data: {
          accessToken:    refreshed.access_token,
          refreshToken:   refreshed.refresh_token || conn.refreshToken,
          tokenExpiresAt: newExpiry,
        },
      });
      token = refreshed.access_token;
    } catch {
      // Use existing token as fallback
    }
  }

  return { token, userId: location.userId, location };
}

export async function getValidTokenByUserId(userId: string): Promise<string | null> {
  const conn = await prisma.gHLConnection.findFirst({
    where: { userId },
    orderBy: { connectedAt: "desc" },
  });
  if (!conn) return null;

  const now = new Date();
  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(conn.refreshToken);
      await prisma.gHLConnection.update({
        where: { id: conn.id },
        data: {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || conn.refreshToken,
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
      return refreshed.access_token;
    } catch {
      return conn.accessToken;
    }
  }

  return conn.accessToken;
}
